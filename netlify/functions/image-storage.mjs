import crypto from 'node:crypto';
import { db, json, normalized, verifyAdminJWT } from './_admin-core.mjs';
const BUCKET='catalog-images';
const dataPattern=/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/su;
const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
const safePart=(v)=>String(v||'item').replace(/[^a-zA-Z0-9_-]/gu,'-').slice(0,100)||'item';
const upload=async(dataUrl,pathBase)=>{
 const match=String(dataUrl||'').match(dataPattern);if(!match)return dataUrl;
 const mime=match[1],bytes=Buffer.from(match[2],'base64');if(bytes.length>5*1024*1024)throw new Error('الصورة أكبر من 5 MB');
 const path=`${pathBase}.${extension[mime]||'webp'}`,key=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.SUPABASE_URL;
 const response=await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`,{method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':mime,'x-upsert':'true','cache-control':'31536000'},body:bytes});
 if(!response.ok)throw new Error(`فشل رفع الصورة: ${await response.text()}`);
 return `${url}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;
};
const processCategory=async(category)=>{
 const copy=structuredClone(category),cid=safePart(copy.id);
 if(dataPattern.test(String(copy.image||'')))copy.image=await upload(copy.image,`categories/${cid}/cover`);
 for(const item of copy.items||[]){const iid=safePart(item.id);if(dataPattern.test(String(item.image||'')))item.image=await upload(item.image,`categories/${cid}/items/${iid}/cover`);for(const offer of item.offers||[]){if(dataPattern.test(String(offer.image||'')))offer.image=await upload(offer.image,`categories/${cid}/items/${iid}/offers/${safePart(offer.id)}`);}}
 return copy;
};
const migrateAll=async()=>{
 let migrated=0;const categories=await normalized.list('categories');
 for(const category of categories){const before=JSON.stringify(category).includes('data:image/'),processed=await processCategory(category);if(before){const{id,...data}=processed;await db.upsert('categories',id,{...data,updatedAt:new Date().toISOString()});migrated++;}}
 const wallet=await normalized.get('wallets','all');if(wallet){for(const entry of wallet.wallets||[])if(dataPattern.test(String(entry.image||''))){entry.image=await upload(entry.image,`wallets/${safePart(entry.id)}`);migrated++;}const{id,...data}=wallet;await db.upsert('wallets','all',data);}
 const services=await normalized.list('topup_services');for(const service of services)if(dataPattern.test(String(service.image||''))){service.image=await upload(service.image,`services/${safePart(service.id)}`);const{id,...data}=service;await db.upsert('topup_services',id,data);migrated++;}
 return migrated;
};
export const handler=async(event)=>{if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});try{if(!await verifyAdminJWT(event))return json(403,{error:'صلاحية المدير مطلوبة'});const body=JSON.parse(event.body||'{}');if(body.action==='process-category')return json(200,{ok:true,category:await processCategory(body.category||{})});if(body.action==='upload'){const path=`misc/${safePart(body.kind)}/${safePart(body.id)}-${crypto.randomBytes(4).toString('hex')}`;return json(200,{ok:true,url:await upload(body.dataUrl,path)});}if(body.action==='migrate-all')return json(200,{ok:true,migrated:await migrateAll()});return json(400,{error:'عملية غير معروفة'});}catch(error){console.error('[image-storage]',error);return json(500,{error:error.message||'تعذر معالجة الصور'});}};
