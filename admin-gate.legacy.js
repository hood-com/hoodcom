// admin-gate.js
// ============================================================================
// "الباب الخلفي" الخاص بالمدير — نظام دخول مستقل تماماً عن حسابات المستخدمين.
// لا يعتمد على Supabase Auth ولا على حقل role في أي مستند مستخدم.
// يتم التحقق من اسم المستخدم/كلمة المرور السريين عبر تجزئة (PBKDF2) محفوظة
// في قاعدة البيانات (collection: settings, id: admin_gate) — لا يتم تخزين أو
// إرسال كلمة المرور نفسها أبداً بنص صريح.
//
// القيم الافتراضية عند أول تشغيل: اسم المستخدم "hood" وكلمة المرور "hood".
// يمكن تغييرها في أي وقت من لوحة التحكم (تبويب الإعدادات) وستُطبَّق فوراً
// من أي جهاز/متصفح لأنها محفوظة في السحابة وليست محلية.
// ============================================================================
(function () {
  const GATE_COLLECTION = 'settings';
  const GATE_DOC_ID = 'admin_gate';
  const DEFAULT_ITERATIONS = 150000;
  const TOKEN_STORAGE_KEY = 'hud_admin_gate_token';

  function bufToHex(buf) {
    return Array.prototype.map
      .call(new Uint8Array(buf), function (b) { return ('00' + b.toString(16)).slice(-2); })
      .join('');
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
  }

  function randomHex(byteLen) {
    const arr = new Uint8Array(byteLen);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return bufToHex(arr.buffer || arr);
  }

  async function pbkdf2Hash(text, saltHex, iterations) {
    const enc = new TextEncoder();
    const saltBytes = hexToBytes(saltHex);
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(text), { name: 'PBKDF2' }, false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return bufToHex(bits);
  }

  async function ensureClient() {
    if (!window.supabaseClient && window.initSupabaseAdapter) {
      try { await window.initSupabaseAdapter(); } catch (e) { console.error('admin-gate: init failed', e); }
    }
    return window.supabaseClient || null;
  }

  async function getGateDoc() {
    const client = await ensureClient();
    if (!client) return null;
    try {
      const { data, error } = await client
        .from('hud_docs')
        .select('id,data')
        .eq('collection', GATE_COLLECTION)
        .eq('id', GATE_DOC_ID)
        .maybeSingle();
      if (error) { console.warn('admin-gate: read error', error); return null; }
      return (data && data.data) || null;
    } catch (e) {
      console.warn('admin-gate: read exception', e);
      return null;
    }
  }

  async function saveGateDoc(cfg) {
    const client = await ensureClient();
    if (!client) throw new Error('تعذر الاتصال بقاعدة البيانات');
    const { error } = await client.from('hud_docs').upsert({
      collection: GATE_COLLECTION,
      id: GATE_DOC_ID,
      data: cfg
    });
    if (error) throw error;
    return true;
  }

  async function ensureDefaultGate() {
    let cfg = await getGateDoc();
    if (!cfg || !cfg.saltHex || !cfg.hashHex) {
      const saltHex = randomHex(16);
      const iterations = DEFAULT_ITERATIONS;
      const combined = 'hood' + '\u0001' + 'hood';
      const hashHex = await pbkdf2Hash(combined, saltHex, iterations);
      cfg = { saltHex: saltHex, hashHex: hashHex, iterations: iterations, updatedAt: new Date().toISOString() };
      try { await saveGateDoc(cfg); } catch (e) { console.warn('admin-gate: could not persist default gate', e); }
    }
    return cfg;
  }

  async function verifyAdminGate(username, password) {
    try {
      const cfg = await ensureDefaultGate();
      if (!cfg || !cfg.saltHex || !cfg.hashHex) return false;
      const combined = String(username == null ? '' : username) + '\u0001' + String(password == null ? '' : password);
      const hash = await pbkdf2Hash(combined, cfg.saltHex, cfg.iterations || DEFAULT_ITERATIONS);
      // مقارنة بزمن ثابت تقريبي لتقليل مخاطر timing attacks
      if (hash.length !== cfg.hashHex.length) return false;
      let diff = 0;
      for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ cfg.hashHex.charCodeAt(i);
      return diff === 0;
    } catch (e) {
      console.error('admin-gate: verify error', e);
      return false;
    }
  }

  async function setAdminGateCredentials(newUsername, newPassword) {
    const u = String(newUsername || '').trim();
    const p = String(newPassword || '');
    if (!u || !p) throw new Error('يجب إدخال اسم مستخدم وكلمة مرور');
    if (p.length < 4) throw new Error('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
    const saltHex = randomHex(16);
    const iterations = DEFAULT_ITERATIONS;
    const combined = u + '\u0001' + p;
    const hashHex = await pbkdf2Hash(combined, saltHex, iterations);
    const cfg = { saltHex: saltHex, hashHex: hashHex, iterations: iterations, updatedAt: new Date().toISOString() };
    await saveGateDoc(cfg);
    return true;
  }

  function createSession() {
    const token = randomHex(24) + '.' + Date.now().toString(36);
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (e) {}
    return token;
  }

  function hasValidSession() {
    try {
      const t = localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
      return !!(t && t.indexOf('.') > 0);
    } catch (e) {
      return false;
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch (e) {}
  }

  window.HUD_ADMIN_GATE = {
    verifyAdminGate: verifyAdminGate,
    setAdminGateCredentials: setAdminGateCredentials,
    createSession: createSession,
    hasValidSession: hasValidSession,
    clearSession: clearSession
  };
})();
