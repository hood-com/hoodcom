import { db, json, normalized, verifyAdminJWT, verifyUserJWT } from './_admin-core.mjs';

const pendingCollections = ['orders','topup_transactions'];
const cleanReason = (value) => String(value || '').trim().replace(/[<>]/gu, '').slice(0, 500);
const pendingStatus = (value) => ['pending','processing','under_confirmation'].includes(String(value || 'pending'));
const adminStatus = (action) => action === 'approve' ? 'completed' : 'rejected';

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
    if(action==='admin-list'){
      if(!await adminToken(event))return json(403,{error:'صلاحية المدير مطلوبة'});
      const all=await listAll();return json(200,{ok:true,pending:all.filter((entry)=>pendingStatus(entry.status)),all});
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
