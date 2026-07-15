const json = (statusCode, body, headers = {}) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }, body: JSON.stringify(body) });
const env = (name) => { const value = process.env[name]; if (!value) throw new Error(`Missing server environment variable: ${name}`); return value; };

export const verifyUserJWT = async (event) => {
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  if (!authorization.startsWith('Bearer ')) return null;
  const response = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: env('SUPABASE_SERVICE_ROLE_KEY'), authorization }
  });
  if (!response.ok) return null;
  return response.json();
};
export const verifyAdminJWT = async (event) => {
  const user = await verifyUserJWT(event);
  return user?.app_metadata?.role === 'admin' ? user : null;
};

const supabaseRequest = async (path, options = {}) => {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: options.prefer || 'return=representation', ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.message || data?.hint || `Supabase HTTP ${response.status}`);
  return data;
};
export const db = {
  get: async (collection, id) => (await supabaseRequest(`hud_docs?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}&select=*`))?.[0] || null,
  list: async (collection) => supabaseRequest(`hud_docs?collection=eq.${encodeURIComponent(collection)}&select=*&order=updated_at.desc`),
  upsert: async (collection, id, data) => (await supabaseRequest('hud_docs?on_conflict=collection,id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: JSON.stringify({ collection, id, data, updated_at: new Date().toISOString() }) }))?.[0],
  remove: async (collection, id) => supabaseRequest(`hud_docs?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' })
};
const normalizeRow = (row) => row ? ({ id: row.id, ...(row.data || {}) }) : null;
export const normalized = { get: async (c, i) => normalizeRow(await db.get(c, i)), list: async (c) => (await db.list(c)).map(normalizeRow) };
export { json };
