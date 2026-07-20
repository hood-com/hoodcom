import { db, json, normalized, verifyAdminJWT } from './_admin-core.mjs';

const allowedOps = new Set(['getDocument', 'getCollection', 'setDocument', 'updateDocument', 'deleteDocument', 'deleteAuthUser']);
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const admin = await verifyAdminJWT(event);
  if (!admin) return json(401, { error: 'جلسة المدير غير صالحة أو لا تحمل دور admin' });
  try {
    const body = JSON.parse(event.body || '{}');
    if (!allowedOps.has(body.operation)) return json(400, { error: 'عملية غير مسموحة' });
    const collection = String(body.collection || ''); const id = String(body.id || '');
    let result;
    if (body.operation === 'getDocument') result = await normalized.get(collection, id);
    if (body.operation === 'getCollection') result = await normalized.list(collection);
    if (body.operation === 'setDocument') {
      let data = { ...(body.data || {}) };
      if (body.merge) data = { ...(await normalized.get(collection, id) || {}), ...data };
      delete data.id; const row = await db.upsert(collection, id, data); result = { id: row.id, ...(row.data || {}) };
    }
    if (body.operation === 'updateDocument') {
      const current = await normalized.get(collection, id); if (!current) throw new Error('السجل غير موجود');
      const data = { ...current, ...(body.data || {}) }; delete data.id;
      const row = await db.upsert(collection, id, data); result = { id: row.id, ...(row.data || {}) };
    }
    if (body.operation === 'deleteDocument') { await db.remove(collection, id); result = true; }
    if (body.operation === 'deleteAuthUser') {
      const key=process.env.SUPABASE_SERVICE_ROLE_KEY,url=process.env.SUPABASE_URL,headers={apikey:key,authorization:`Bearer ${key}`};
      const profile=await normalized.get('users',id),requestedEmail=String(body.email||profile?.email||'').toLowerCase();
      let authId=id,authUser=null;
      const direct=await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`,{headers});
      if(direct.ok)authUser=await direct.json();
      if(!authUser&&requestedEmail){const listing=await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`,{headers});if(listing.ok){const payload=await listing.json(),users=payload.users||payload;authUser=(users||[]).find((user)=>String(user.email||'').toLowerCase()===requestedEmail)||null;authId=authUser?.id||id;}}
      if(authUser?.app_metadata?.role==='admin'||String(authId)===String(admin.id))throw new Error('لا يمكن حذف حساب المدير من داخل لوحة الإدارة');
      if(authUser){const response=await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authId)}?should_soft_delete=false`,{method:'DELETE',headers});if(!response.ok){const detail=await response.text();throw new Error(`تعذر حذف مستخدم المصادقة: ${detail.slice(0,180)}`);}}
      await Promise.all([db.remove('users',id),db.remove('user_balances',id)]);
      for(const collectionName of ['orders','topup_transactions','identity_index']){
        const records=await normalized.list(collectionName);
        await Promise.all(records.filter((entry)=>String(entry.userId||'')===String(id)||String(entry.userId||'')===String(authId)).map((entry)=>db.remove(collectionName,entry.id)));
      }
      result={deletedProfileId:id,deletedAuthId:authUser?authId:null};
    }
    return json(200, { ok: true, result });
  } catch (error) {
    console.error('[admin-api]', error);
    return json(500, { error: error.message || 'فشلت عملية الإدارة' });
  }
};
