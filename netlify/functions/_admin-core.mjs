import crypto from 'node:crypto';

const COOKIE = 'hud_admin_session';
const MAX_AGE = 30 * 60;
const json = (statusCode, body, headers = {}) => ({ statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }, body: JSON.stringify(body) });
const env = (name) => { const value = process.env[name]; if (!value) throw new Error(`Missing server environment variable: ${name}`); return value; };
const b64url = (value) => Buffer.from(value).toString('base64url');
const sign = (value) => crypto.createHmac('sha256', env('ADMIN_SESSION_SECRET')).update(value).digest('base64url');
const safeEqual = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export const makeSession = () => {
  const payload = b64url(JSON.stringify({ exp: Date.now() + MAX_AGE * 1000, nonce: crypto.randomBytes(18).toString('hex') }));
  return `${payload}.${sign(payload)}`;
};
export const sessionCookie = (token, clear = false) => `${COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${clear ? 0 : MAX_AGE}`;
export const hasSession = (event) => {
  const raw = event.headers.cookie || event.headers.Cookie || '';
  const token = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch { return false; }
};

const supabaseRequest = async (path, options = {}) => {
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'content-type': 'application/json',
      prefer: options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
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

const pbkdf = (username, password, salt, iterations = 150000) => crypto.pbkdf2Sync(`${username}\u0001${password}`, salt, iterations, 32, 'sha256').toString('hex');
export const verifyCredentials = async (username, password) => {
  const record = await normalized.get('settings', 'admin_gate').catch(() => null);
  if (record?.saltHex && record?.hashHex) return safeEqual(pbkdf(username, password, Buffer.from(record.saltHex, 'hex'), record.iterations), record.hashHex);
  return safeEqual(username, env('ADMIN_USERNAME')) && safeEqual(password, env('ADMIN_PASSWORD'));
};
export const changeCredentials = async (username, password) => {
  if (username.length < 4 || password.length < 12) throw new Error('اسم المستخدم 4 أحرف على الأقل وكلمة المرور 12 حرفاً على الأقل');
  const salt = crypto.randomBytes(16); const iterations = 150000;
  await db.upsert('settings', 'admin_gate', { saltHex: salt.toString('hex'), hashHex: pbkdf(username, password, salt, iterations), iterations, updatedAt: new Date().toISOString() });
};
export { json };
