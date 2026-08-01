import{getClient}from'./supabase-client.js';
const call=async(body)=>{const client=await getClient(),{data}=await client.auth.getSession(),token=data.session?.access_token;if(!token)throw new Error('يجب تسجيل الدخول');const r=await fetch('/.netlify/functions/notifications-api',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body)}),p=await r.json().catch(()=>({}));if(!r.ok||!p.ok)throw new Error(p.error||'تعذر تنفيذ الإشعارات');return p;};
export const listNotifications=()=>call({action:'user-list'});
export const markNotificationRead=(id)=>call({action:'mark-read',id});
export const listNotificationsForAdmin=()=>call({action:'admin-list'});
export const sendNotification=(data)=>call({action:'admin-send',...data});
export const saveNotificationTemplate=(data)=>call({action:'admin-save-template',...data});
export const askNotificationPermission=async()=>!('Notification'in globalThis)?'unsupported':Notification.permission==='default'?Notification.requestPermission():Notification.permission;
export const showSystemNotification=(title,message,link='')=>{if('Notification'in globalThis&&Notification.permission==='granted'&&document.visibilityState!=='visible'){const n=new Notification(title,{body:message,icon:'/logo.svg',tag:`hud-${title}-${message}`});if(link)n.onclick=()=>{open(link,'_self');n.close();};}};
