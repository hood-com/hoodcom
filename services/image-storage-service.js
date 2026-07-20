import { getClient } from './supabase-client.js';
const call=async(body)=>{const client=await getClient(),{data}=await client.auth.getSession(),token=data.session?.access_token;if(!token)throw new Error('انتهت جلسة المدير');const response=await fetch('/.netlify/functions/image-storage',{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(body)});const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.ok)throw new Error(payload.error||'تعذر رفع الصورة');return payload;};
export const processCategoryImages=async(category)=>(await call({action:'process-category',category})).category;
export const uploadManagedImage=async(dataUrl,kind,id)=>(await call({action:'upload',dataUrl,kind,id})).url;
export const migrateAllImages=async()=>call({action:'migrate-all'});
