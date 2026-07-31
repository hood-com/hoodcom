import{getClient}from'./supabase-client.js';
const call=async(body,auth=true)=>{const headers={'content-type':'application/json'};if(auth){const client=await getClient(),{data}=await client.auth.getSession(),token=data.session?.access_token;if(!token)throw new Error('يجب تسجيل الدخول');headers.authorization=`Bearer ${token}`;}const r=await fetch('/.netlify/functions/deposit-api',{method:'POST',headers,body:JSON.stringify(body)}),p=await r.json().catch(()=>({}));if(!r.ok||!p.ok)throw new Error(p.error||'تعذر تنفيذ العملية');return p;};
export const getDepositConfig=()=>call({action:'public-config'},false);
export const createDepositRequest=(data)=>call({action:'user-create',...data});
export const listMyDeposits=()=>call({action:'user-list'});
export const listDepositsForAdmin=()=>call({action:'admin-list'});
export const saveDepositMethod=(method)=>call({action:'admin-save-method',method});
export const updateDepositRequest=(data)=>call({action:'admin-update',...data});
