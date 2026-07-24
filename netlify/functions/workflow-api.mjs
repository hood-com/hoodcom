import { db, json, normalized, verifyAdminJWT, verifyUserJWT } from './_admin-core.mjs';

const pendingCollections = ['orders','topup_transactions'];
const cleanReason = (value) => String(value || '').trim().replace(/[<>]/gu, '').slice(0, 500);
const pendingStatus = (value) => ['pending','processing','under_confirmation'].includes(String(value || 'pending'));
const adminStatus = (action) => action === 'approve' ? 'completed' : 'rejected';
const normalizeChannel=(channel,index)=>({id:String(channel?.id||`channel-${index}`),name:String(channel?.name||'تواصل').slice(0,80),type:['whatsapp','sms','email','telegram','url'].includes(channel?.type)?channel.type:'url',value:String(channel?.value||'').trim().slice(0,500),enabled:channel?.enabled!==false,order:Number(channel?.order||index)});

const userToken = async (event) => verifyUserJWT(event);
const adminToken = async (event) => verifyAdminJWT(event);
const listAll = async () => {
  const groups = await Promise.all(pendingCollections.map(async (collection) => (await normalized.list(collection)).map((entry) => ({ ...entry, workflowCollection: collection }))));
  return groups.flat().sort((a,b) => new Date(b.createdAt||0)-new Date(a.createdAt||0));
};
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405,{error:'Method not allowed'});
  try {
    const body=JSON.parse(event.body||'{}'), action=String(body.action||'');
    if(action==='public-channels'){const settings=await normalized.get('settings','purchase_channels');return json(200,{ok:true,channels:(settings?.channels||[]).map(normalizeChannel).filter((c)=>c.enabled).sort((a,b)=>a.order-b.order)});}
    if(action==='admin-save-channels'){if(!await adminToken(event))return json(403,{error:'صلاحية المدير مطلوبة'});const channels=(body.channels||[]).slice(0,30).map(normalizeChannel);await db.upsert('settings','purchase_channels',{channels,updatedAt:new Date().toISOString()});return json(200,{ok:true,channels});}
    if(action==='select-channel'){const user=await userToken(event);if(!user)return json(401,{error:'يجب تسجيل الدخول'});const order=await normalized.get('orders',String(body.orderId||''));if(!order||String(order.userId)!==String(user.id))return json(404,{error:'الطلب غير موجود'});if(order.status!=='pending')return json(409,{error:'تمت معالجة الطلب'});const settings=await normalized.get('settings','purchase_channels'),channel=(settings?.channels||[]).map(normalizeChannel).find((c)=>c.id===String(body.channelId)&&c.enabled);if(!channel)return json(400,{error:'قناة غير متاحة'});const{id,...data}=order;await db.upsert('orders',id,{...data,contactChannel:channel.id,contactChannelName:channel.name,contactOpenedAt:new Date().toISOString(),updatedAt:new Date().toISOString()});await db.upsert('activity',`channel-${Date.now()}-${id}`,{type:'contact_channel_selected',orderId:id,userId:user.id,channelId:channel.id,createdAt:new Date().toISOString()});return json(200,{ok:true,channel,tempToken:order.tempToken,orderId:id});}
    if(action==='admin-list'){
      if(!await adminToken(event))return json(403,{error:'صلاحية المدير مطلوبة'});
      const all=await listAll(),privateOrders=await normalized.list('order_private'),privateMap=new Map(privateOrders.map((entry)=>[entry.id,entry]));const enriched=all.map((entry)=>entry.workflowCollection==='orders'?{...entry,managerSecrets:privateMap.get(entry.id)||null}:entry);return json(200,{ok:true,pending:enriched.filter((entry)=>pendingStatus(entry.status)),all:enriched});
    }
    if(action==='admin-decide'){
      const admin=await adminToken(event);if(!admin)return json(403,{error:'صلاحية المدير مطلوبة'});
      if(!['approve','reject'].includes(body.decision))return json(400,{error:'قرار غير صالح'});
      const collection=String(body.collection||''),id=String(body.id||'');
      if(!pendingCollections.includes(collection)||!id)return json(400,{error:'طلب غير صالح'});
      const current=await normalized.get(collection,id);if(!current)return json(404,{error:'الطلب غير موجود'});
      if(!pendingStatus(current.status))return json(409,{error:'تمت معالجة الطلب مسبقًا'});
      const now=new Date().toISOString(),reason=cleanReason(body.reason),status=adminStatus(body.decision);
      if(collection==='topup_transactions'&&body.decision==='approve'&&current.type!=='withdraw'){
        const balance=await normalized.get('user_balances',String(current.userId));
        const amount=Number(current.amount||0);if(!(amount>0))throw new Error('قيمة العملية غير صالحة');
        await db.upsert('user_balances',String(current.userId),{...(balance||{}),userId:String(current.userId),balance:Number(balance?.balance||0)+amount,updatedAt:now});
      }
      const saved={...current,status,rejectionReason:body.decision==='reject'?reason:'',processedAt:now,processedBy:admin.id,updatedAt:now};delete saved.id;
      await db.upsert(collection,id,saved);
      if(collection==='orders'){const privateOrder=await normalized.get('order_private',id);if(privateOrder){const{ id:ignored,...privateData}=privateOrder;await db.upsert('order_private',id,{...privateData,status:body.decision==='approve'?'used':'cancelled',closedAt:now});}}
      await db.upsert('activity',`decision-${Date.now()}-${id}`,{type:'admin_decision',action:body.decision,collection,requestId:id,userId:current.userId||'',adminId:admin.id,reason,createdAt:now});
      return json(200,{ok:true,result:{id,...saved}});
    }
    if(action==='user-list'){
      const user=await userToken(event);if(!user)return json(401,{error:'يجب تسجيل الدخول'});
      const all=await listAll();return json(200,{ok:true,items:all.filter((entry)=>String(entry.userId)===String(user.id))});
    }
    if(action==='activity'){
      const user=await userToken(event);if(!user)return json(401,{error:'يجب تسجيل الدخول'});
      const type=String(body.type||'activity').slice(0,60),now=new Date().toISOString();
      await db.upsert('activity',`act-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,{type,userId:user.id,email:user.email||'',details:body.details&&typeof body.details==='object'?body.details:{},createdAt:now});
      return json(200,{ok:true});
    }
    return json(400,{error:'عملية غير معروفة'});
  }catch(error){console.error('[workflow-api]',error);return json(500,{error:error.message||'تعذر تنفيذ العملية'});}
};
