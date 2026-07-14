import supabaseConfig from '../config/supabase.js';

let clientPromise = null;
let databaseApi = null;

const loadCreateClient = async () => {
  if (typeof globalThis.supabase?.createClient === 'function') return globalThis.supabase.createClient;
  try {
    const module = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    return module.createClient;
  } catch (error) {
    console.error('[supabase-client] SDK load failed', error);
    throw new Error('تعذر تحميل مكتبة Supabase. تحقق من الاتصال بالإنترنت.');
  }
};
export const getClient = async () => {
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const createClient = await loadCreateClient();
        return createClient(supabaseConfig.url, supabaseConfig.anonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
          realtime: { params: { eventsPerSecond: 10 } }
        });
      } catch (error) {
        clientPromise = null;
        console.error('[supabase-client] initialization failed', error);
        throw error;
      }
    })();
  }
  return clientPromise;
};
export const getAuth = async () => (await getClient()).auth;

const randomChannelSuffix = () => {
  const random = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(random);
  else random[0] = Math.floor(Math.random() * 0xffffffff);
  return random[0].toString(36);
};

const createDatabaseApi = (client) => ({
  async getDocument(collection, id) {
    const { data, error } = await client.from('hud_docs').select('collection,id,data,created_at,updated_at')
      .eq('collection', String(collection)).eq('id', String(id)).maybeSingle();
    if (error) throw error;
    return data ? { id: data.id, ...(data.data || {}) } : null;
  },
  async setDocument(collection, id, data, options = {}) {
    let finalData = { ...(data || {}) };
    if (options.merge) {
      const current = await this.getDocument(collection, id);
      if (current) {
        const { id: ignoredId, ...currentData } = current;
        void ignoredId;
        finalData = { ...currentData, ...finalData };
      }
    }
    const payload = {
      collection: String(collection),
      id: String(id),
      data: finalData,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('hud_docs').upsert(payload, { onConflict: 'collection,id' });
    if (error) throw error;
    return { id: String(id), ...finalData };
  },
  async updateDocument(collection, id, patch) {
    return this.setDocument(collection, id, patch, { merge: true });
  },
  async deleteDocument(collection, id) {
    const { error } = await client.from('hud_docs').delete().eq('collection', String(collection)).eq('id', String(id));
    if (error) throw error;
    return true;
  },
  async getCollection(collection, options = {}) {
    let query = client.from('hud_docs').select('collection,id,data,created_at,updated_at').eq('collection', String(collection));
    if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending !== false });
    else query = query.order('updated_at', { ascending: false });
    if (options.limit) query = query.limit(options.limit);
    // Security: support server-side filtering to prevent IDOR (fetching all orders then filtering client-side)
    if (options.filter && typeof options.filter === 'object') {
      Object.entries(options.filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          // Filter on jsonb data field: data->>key = value
          // This prevents fetching all documents and leaking other users' data
          try {
            query = query.eq(`data->>${key}`, String(value));
          } catch {}
        }
      });
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row) => ({ id: row.id, ...(row.data || {}) }));
  },
  async addDocument(collection, data, id = `doc-${Date.now()}-${randomChannelSuffix()}`) {
    return this.setDocument(collection, id, { id, ...(data || {}) });
  },
  /**
   * Uses one channel per logical subscription, coalesces bursty postgres
   * events, and reports subscription status errors. The first snapshot is
   * always fetched explicitly, so callers render even when Realtime is not
   * enabled in a development project.
   */
  subscribe(collection, callback, onError = console.error) {
    const collectionName = String(collection);
    let active = true;
    let refreshTimer = null;
    let refreshInFlight = false;
    let refreshQueued = false;
    const report = (error) => {
      if (active) onError?.(error instanceof Error ? error : new Error(String(error)));
    };
    const refresh = async () => {
      if (!active) return;
      if (refreshInFlight) { refreshQueued = true; return; }
      refreshInFlight = true;
      try { callback(await this.getCollection(collectionName)); }
      catch (error) { report(error); }
      finally {
        refreshInFlight = false;
        if (refreshQueued) { refreshQueued = false; void refresh(); }
      }
    };
    const scheduleRefresh = () => {
      if (!active || refreshTimer) return;
      refreshTimer = globalThis.setTimeout(() => {
        refreshTimer = null;
        void refresh();
      }, 75);
    };
    const channel = client.channel(`hud-${collectionName}-${randomChannelSuffix()}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'hud_docs', filter: `collection=eq.${collectionName}`
      }, scheduleRefresh)
      .subscribe((status, error) => {
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) report(error || `Realtime ${status} for ${collectionName}`);
      });
    void refresh();
    return () => {
      active = false;
      if (refreshTimer) globalThis.clearTimeout(refreshTimer);
      // removeChannel can return a Promise; deliberately consume its rejection
      // during page teardown so it never becomes an unhandled rejection.
      Promise.resolve(client.removeChannel(channel)).catch(() => {});
    };
  }
});
let adminDatabaseApi = null;
const adminCall = async (operation, payload = {}) => {
  const response = await fetch('/.netlify/functions/admin-api', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || 'فشلت عملية الإدارة الآمنة');
  return data.result;
};
const createAdminDatabaseApi = () => ({
  getDocument: (collection, id) => adminCall('getDocument', { collection, id }),
  setDocument: (collection, id, data, options = {}) => adminCall('setDocument', { collection, id, data, merge: options.merge === true }),
  updateDocument: (collection, id, data) => adminCall('updateDocument', { collection, id, data }),
  deleteDocument: (collection, id) => adminCall('deleteDocument', { collection, id }),
  getCollection: (collection) => adminCall('getCollection', { collection }),
  addDocument(collection, data, id = `doc-${Date.now()}-${randomChannelSuffix()}`) { return this.setDocument(collection, id, { id, ...(data || {}) }); },
  subscribe(collection, callback, onError = console.error) {
    let active = true; let timer = null; let previous = '';
    const refresh = async () => {
      if (!active) return;
      try {
        const rows = await adminCall('getCollection', { collection });
        const signature = JSON.stringify(rows);
        if (signature !== previous) { previous = signature; callback(rows); }
      } catch (error) { onError?.(error); }
      if (active) timer = globalThis.setTimeout(refresh, 5000);
    };
    void refresh();
    return () => { active = false; if (timer) globalThis.clearTimeout(timer); };
  }
});
export const getDB = async () => {
  if (globalThis.__HUD_ADMIN_AUTHENTICATED__ === true) {
    if (!adminDatabaseApi) adminDatabaseApi = createAdminDatabaseApi();
    return adminDatabaseApi;
  }
  if (!databaseApi) databaseApi = createDatabaseApi(await getClient());
  return databaseApi;
};
export const resetClient = () => { clientPromise = null; databaseApi = null; adminDatabaseApi = null; };

export default Object.freeze({ getClient, getAuth, getDB, resetClient });
