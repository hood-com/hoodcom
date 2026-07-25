import { getClient } from './supabase-client.js';
const call=async(body)=>{const client=await getClient(),{data}=await client.auth.getSession(),token=data.session?.access_token;if(!token)throw new Error('يجب تسجيل الدخول');const r=await fetch('/.netlify/functions/phone-verification',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body)}),p=await r.json().catch(()=>({}));if(!r.ok||!p.ok)throw new Error(p.error||'تعذر تنفيذ العملية');return p;};
export const createPhoneVerification=()=>call({action:'create'});
export const getPhoneVerification=()=>call({action:'status'});
export const listPhoneVerifications=()=>call({action:'admin-list'});
export const decidePhoneVerification=(userId,decision)=>call({action:'admin-decide',userId,decision});
