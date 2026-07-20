import crypto from 'node:crypto';
import { db, json, normalized, verifyUserJWT } from './_admin-core.mjs';

const normalizePhone=(value)=>String(value||'').replace(/\D/gu,'').replace(/^00/u,'').replace(/^967/u,'').replace(/^0+/u,'');
const normalizeName=(value)=>String(value||'').trim().toLocaleLowerCase('ar').replace(/[ـًٌٍَُِّْ\s]+/gu,' ');
const hash=(value)=>crypto.createHash('sha256').update(String(value)).digest('hex');
const key=(kind,value)=>`${kind}-${hash(value)}`;
const authToken=async(email,password)=>{
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.SUPABASE_URL;
  const response=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:service,'content-type':'application/json'},body:JSON.stringify({email,password})});
  const data=await response.json().catch(()=>({}));return{ok:response.ok,data};
};
const findProfile=async(identifier)=>{
  if(String(identifier).includes('@'))return{email:String(identifier).trim().toLowerCase(),profile:null};
  const phone=normalizePhone(identifier),users=await normalized.list('users');
  const profile=users.find((user)=>[user.phone,user.localPhone,user.username,user.phoneLoginUsername].some((candidate)=>normalizePhone(candidate)===phone));
  return{email:profile?.email||profile?.authEmail||`${phone}@hudcom.app`,profile};
};
export const handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  try{
    const body=JSON.parse(event.body||'{}'),action=String(body.action||'');
    if(action==='login'){
      const identifier=String(body.identifier||'').trim(),password=String(body.password||'');
      if(!identifier||!password)return json(400,{error:'بيانات الدخول مطلوبة'});
      const attemptId=key('login',identifier.includes('@')?identifier.toLowerCase():normalizePhone(identifier));
      const attempt=await normalized.get('login_attempts',attemptId),now=Date.now(),lockUntil=Number(attempt?.lockUntil||0);
      if(lockUntil>now)return json(429,{error:'تم إيقاف المحاولات مؤقتًا. حاول بعد خمس دقائق.',retryAfter:Math.ceil((lockUntil-now)/1000)});
      const {email}=await findProfile(identifier),result=await authToken(email,password);
      if(!result.ok){const count=Number(attempt?.count||0)+1;const locked=count>=5;await db.upsert('login_attempts',attemptId,{count:locked?0:count,lockUntil:locked?now+5*60*1000:0,updatedAt:new Date().toISOString()});return json(locked?429:401,{error:locked?'تم حظر المحاولات لمدة خمس دقائق':'بيانات الدخول غير صحيحة',remaining:Math.max(0,5-count)});}
      await db.remove('login_attempts',attemptId).catch(()=>{});
      return json(200,{ok:true,session:{access_token:result.data.access_token,refresh_token:result.data.refresh_token},user:result.data.user});
    }
    if(action==='reserve-identity'){
      const user=await verifyUserJWT(event);if(!user)return json(401,{error:'يجب تأكيد البريد أولًا'});
      const name=normalizeName(body.name),phone=normalizePhone(body.phone);if(!name||phone.length<7)return json(400,{error:'الاسم أو رقم الهاتف غير صالح'});
      const users=await normalized.list('users');
      if(users.some((entry)=>entry.id!==user.id&&normalizeName(entry.name||entry.displayName)===name))return json(409,{error:'هذا الاسم مستخدم في حساب آخر'});
      if(users.some((entry)=>entry.id!==user.id&&[entry.phone,entry.localPhone,entry.username].some((candidate)=>normalizePhone(candidate)===phone)))return json(409,{error:'رقم الهاتف مستخدم في حساب آخر'});
      for(const [kind,value]of[['name',name],['phone',phone]]){const id=key(kind,value),existing=await normalized.get('identity_index',id);if(existing&&existing.userId!==user.id)return json(409,{error:kind==='name'?'هذا الاسم مستخدم في حساب آخر':'رقم الهاتف مستخدم في حساب آخر'});await db.upsert('identity_index',id,{kind,userId:user.id,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()});}
      return json(200,{ok:true});
    }
    return json(400,{error:'عملية غير معروفة'});
  }catch(error){console.error('[auth-guard]',error);return json(500,{error:'تعذر تنفيذ التحقق الآمن'});}
};
