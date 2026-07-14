import { db, hasSession, json, normalized } from './_admin-core.mjs';

const allowedOps = new Set(['getDocument', 'getCollection', 'setDocument', 'updateDocument', 'deleteDocument', 'deleteAuthUser']);
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!hasSession(event)) return json(401, { error: 'انتهت جلسة الإدارة، سجل الدخول مجددًا' });
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
      const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } });
      if (!response.ok) throw new Error('تعذر حذف مستخدم المصادقة');
      await db.remove('users', id); result = true;
    }
    return json(200, { ok: true, result });
  } catch (error) {
    console.error('[admin-api]', error);
    return json(500, { error: error.message || 'فشلت عملية الإدارة' });
  }
};
