import { getClient } from './supabase-client.js';

const call = async (body) => {
  const client=await getClient(),{data}=await client.auth.getSession(),token=data.session?.access_token;
  if(!token)throw new Error('انتهت الجلسة');
  const response=await fetch('/.netlify/functions/workflow-api',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.ok)throw new Error(payload.error||'تعذر تنفيذ العملية');return payload;
};
export const listPendingForAdmin=()=>call({action:'admin-list'});
export const getPurchaseChannels=async()=>{const response=await fetch('/.netlify/functions/workflow-api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'public-channels'})});const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.ok)throw new Error(payload.error||'تعذر تحميل قنوات التواصل');return payload.channels||[];};
export const selectPurchaseChannel=(orderId,channelId)=>call({action:'select-channel',orderId,channelId});
export const savePurchaseChannels=(channels)=>call({action:'admin-save-channels',channels});
export const decideRequest=(collection,id,decision,reason='')=>call({action:'admin-decide',collection,id,decision,reason});
export const listMyWorkflow=()=>call({action:'user-list'});
export const logActivity=(type,details={})=>call({action:'activity',type,details}).catch(()=>null);
export const requestNotificationPermission=async()=>{
  if(!('Notification'in globalThis))return'unsupported';
  return Notification.permission==='default'?Notification.requestPermission():Notification.permission;
};
export const systemNotify=(title,body)=>{
  if('Notification'in globalThis&&Notification.permission==='granted'&&document.visibilityState!=='visible')new Notification(title,{body,icon:'/logo.svg',tag:`hud-${title}-${body}`});
};
