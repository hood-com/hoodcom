import { getAuth, getClient, getDB } from './supabase-client.js';
import { SESSION_VERSION, STORAGE_KEYS } from '../config/settings.js';
import { generateAccountSecret, generateDeviceId, generateUniqueSecretToken, generateWhatsAppVerificationCode } from '../utils/security.js';
import { isValidEmailAddress, isValidPassword, isValidPhone } from '../utils/validators.js';
import { sanitizeInput } from '../utils/sanitizers.js';

const ADMIN_TOKEN_KEY = 'hud_admin_gate_token';
const ADMIN_GATE_COLLECTION = 'settings';
const ADMIN_GATE_DOCUMENT = 'admin_gate';
const ADMIN_GATE_ITERATIONS = 150000;
// Must stay identical to admin-gate.legacy.js. It uses the U+0001 control
// character as the separator for already-persisted hashes.
const ADMIN_GATE_SEPARATOR = '\u0001';
const COUNTRY_CODES = ['967', '966', '971', '965', '974', '973', '968', '20', '962', '964', '961', '963', '970', '212', '216', '213', '249', '252', '222', '253', '269'];

const normalizeAuthUser = (user) => user ? ({
  uid: user.id || user.uid,
  id: user.id || user.uid,
  email: user.email || '',
  displayName: user.user_metadata?.displayName || user.user_metadata?.name || user.displayName || '',
  emailVerified: Boolean(user.email_confirmed_at || user.emailVerified)
}) : null;

// Never put manager-only references or verification codes into a normal user
// session. The database policies supplied with this change remain the real
// security boundary; this prevents accidental disclosure through the UI.
const stripManagerOnlyFields = (user = {}) => {
  const { secretToken, accountPassword, whatsappVerificationCode, ...safeUser } = user || {};
  return safeUser;
};

const normalizePhone = (value) => {
  let digits = String(value ?? '').replace(/\D/gu, '').replace(/^00/u, '');
  for (const code of COUNTRY_CODES.sort((a, b) => b.length - a.length)) {
    if (digits.startsWith(code)) { digits = digits.slice(code.length); break; }
  }
  return digits.replace(/^0+/u, '');
};

const persistUser = (user) => {
  if (!user) return;
  const serialized = JSON.stringify(stripManagerOnlyFields(user));
  try { globalThis.sessionStorage?.setItem(STORAGE_KEYS.auth, serialized); } catch { /* no-op */ }
  try { globalThis.localStorage?.setItem(STORAGE_KEYS.auth, serialized); } catch { /* no-op */ }
};

const clearPersistedUser = () => {
  try { globalThis.sessionStorage?.removeItem(STORAGE_KEYS.auth); } catch { /* no-op */ }
  try { globalThis.localStorage?.removeItem(STORAGE_KEYS.auth); } catch { /* no-op */ }
};

const readPersistedUser = () => {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEYS.auth) || globalThis.localStorage?.getItem(STORAGE_KEYS.auth);
    const user = raw ? JSON.parse(raw) : null;
    return user?.sessionVersion === SESSION_VERSION ? stripManagerOnlyFields(user) : null;
  } catch {
    return null;
  }
};

export const signInWithEmailAndPassword = async (email, password) => {
  try {
    const auth = await getAuth();
    const { data, error } = await auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: normalizeAuthUser(data.user), session: data.session, rawUser: data.user };
  } catch (error) {
    console.error('[auth-service] sign in failed', error);
    throw error;
  }
};

export const createUserWithEmailAndPassword = async (email, password, metadata = {}) => {
  try {
    const auth = await getAuth();
    const { data, error } = await auth.signUp({ email, password, options: { data: metadata } });
    if (error) throw error;
    return { user: normalizeAuthUser(data.user), session: data.session, rawUser: data.user };
  } catch (error) {
    console.error('[auth-service] sign up failed', error);
    throw error;
  }
};

const isValidAccountSecret = (value) => /^ACC-[A-Z2-9]{8,64}$/u.test(String(value || '').trim().toUpperCase());

/** Backfills legacy accounts and returns the manager-only account reference. */
export const ensureUserSecret = async (userId, profile = null) => {
  const db = await getDB();
  const user = profile || await db.getDocument('users', userId);
  if (!user) throw new Error('الحساب غير موجود');
  const existing = String(user.secretToken || user.accountPassword || '').trim().toUpperCase();
  if (isValidAccountSecret(existing)) {
    if (user.secretToken !== existing || user.accountPassword) {
      await db.updateDocument('users', userId, { secretToken: existing, accountPassword: undefined, updatedAt: new Date().toISOString() });
    }
    return existing;
  }
  // Collision probability is negligible with Web Crypto, but we check the
  // collection so "unique" is also enforced in the persisted data model.
  const users = await db.getCollection('users');
  let secretToken = generateAccountSecret();
  while (users.some((entry) => String(entry.secretToken || entry.accountPassword || '').toUpperCase() === secretToken)) {
    secretToken = generateAccountSecret();
  }
  await db.updateDocument('users', userId, { secretToken, accountPassword: undefined, updatedAt: new Date().toISOString() });
  return secretToken;
};

/**
 * Administrative/programmatic account creation. Public registration uses
 * register() below and deliberately does not return the manager secret.
 */
export const createUserWithSecret = async (userData = {}) => {
  const registered = await register(userData);
  const db = await getDB();
  const secretToken = await ensureUserSecret(registered.uid, await db.getDocument('users', registered.uid));
  return { ...registered, secretToken };
};

export const getUserSecret = async (userId) => {
  const user = await (await getDB()).getDocument('users', userId);
  if (!user) return null;
  return ensureUserSecret(userId, user);
};

export const updateProfile = async (profile) => {
  try {
    const auth = await getAuth();
    const { data, error } = await auth.updateUser({ data: profile || {} });
    if (error) throw error;
    return normalizeAuthUser(data.user);
  } catch (error) {
    console.error('[auth-service] profile update failed', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email) => {
  try {
    const auth = await getAuth();
    const redirectTo = globalThis.location ? new URL('login.html', globalThis.location.href).href : undefined;
    const { error } = await auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[auth-service] password reset failed', error);
    throw error;
  }
};

export const findUserDocumentByPhone = async (phone) => {
  try {
    const username = normalizePhone(phone);
    if (!username) return null;
    const db = await getDB();
    const users = await db.getCollection('users');
    const found = users.find((user) => [user.username, user.localPhone, user.phoneLoginUsername]
      .some((candidate) => normalizePhone(candidate) === username));
    return found ? { uid: found.id, data: found } : null;
  } catch (error) {
    console.error('[auth-service] phone lookup failed', error);
    return null;
  }
};

export const resolveLoginEmail = async (identifier) => {
  const raw = sanitizeInput(identifier, 160);
  if (raw.includes('@')) throw Object.assign(new Error('تسجيل الدخول يكون برقم الهاتف فقط'), { code: 'phone_login_only' });
  const username = normalizePhone(raw);
  if (!username) throw Object.assign(new Error('رقم الهاتف غير صالح'), { code: 'invalid_phone' });
  const record = await findUserDocumentByPhone(username);
  return record?.data?.email?.toLowerCase() || record?.data?.authEmail?.toLowerCase() || `${username}@hudcom.app`;
};

export const login = async (username, password) => {
  try {
    if (!isValidPhone(username)) throw Object.assign(new Error('رقم الهاتف غير صالح'), { code: 'invalid_phone' });
    if (!String(password ?? '')) throw Object.assign(new Error('كلمة المرور مطلوبة'), { code: 'invalid_password' });
    const email = await resolveLoginEmail(username);
    const credential = await signInWithEmailAndPassword(email, password);
    const db = await getDB();
    const profile = credential.user?.uid ? await db.getDocument('users', credential.user.uid) : null;
    if (profile) await ensureUserSecret(credential.user.uid, profile);
    const user = stripManagerOnlyFields({
      ...credential.user,
      ...profile,
      uid: credential.user.uid,
      id: credential.user.uid,
      role: 'customer',
      deviceId: generateDeviceId(),
      sessionVersion: SESSION_VERSION,
      timestamp: Date.now(),
      accountStatus: profile?.accountStatus || 'under_confirmation'
    });
    persistUser(user);
    return user;
  } catch (error) {
    console.error('[auth-service] login failed', error);
    throw error;
  }
};

export const register = async (userData) => {
  try {
    const email = String(userData?.email ?? '').trim().toLowerCase();
    const password = String(userData?.password ?? '');
    const phone = String(userData?.phone ?? '');
    if (!isValidEmailAddress(email)) throw new Error('البريد الإلكتروني غير صالح');
    if (!isValidPassword(password)) throw new Error('كلمة المرور يجب أن تكون 8 أحرف وتحتوي حرفاً ورقماً');
    if (!isValidPhone(phone)) throw new Error('رقم الهاتف غير صالح');
    let credential;
    if (userData?.verifiedUserId) {
      const auth = await getAuth();
      const { data, error } = await auth.updateUser({ password, data: { name: sanitizeInput(userData.name, 200), displayName: sanitizeInput(userData.name, 200) } });
      if (error) throw error;
      credential = { user: normalizeAuthUser(data.user) };
    } else {
      credential = await createUserWithEmailAndPassword(email, password, { name: sanitizeInput(userData.name, 200) });
    }
    if (!credential.user?.uid) throw new Error('يجب تأكيد البريد الإلكتروني قبل إكمال إنشاء الحساب');
    const localPhone = normalizePhone(phone);
    const profile = {
      ...userData,
      id: credential.user.uid,
      uid: credential.user.uid,
      email,
      password: undefined,
      name: sanitizeInput(userData.name, 200),
      phone,
      localPhone,
      username: localPhone,
      phoneLoginUsername: localPhone,
      role: 'customer',
      accountStatus: 'under_confirmation',
      // The reference is generated once and is intentionally omitted from the
      // session returned to the customer.
      secretToken: generateAccountSecret(),
      whatsappVerificationCode: generateWhatsAppVerificationCode(),
      whatsappCodeStatus: 'pending',
      deviceId: generateDeviceId(),
      createdAt: new Date().toISOString()
    };
    delete profile.password;
    delete profile.verifiedUserId;
    delete profile.emailCode;
    const db = await getDB();
    await db.setDocument('users', credential.user.uid, profile);
    const sessionUser = stripManagerOnlyFields({ ...credential.user, ...profile, sessionVersion: SESSION_VERSION, timestamp: Date.now() });
    persistUser(sessionUser);
    return sessionUser;
  } catch (error) {
    console.error('[auth-service] register failed', error);
    throw error;
  }
};

export const sendEmailVerificationCode = async (email) => {
  const auth = await getAuth();
  const { error } = await auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
  return true;
};

export const verifyEmailCode = async (email, token) => {
  const auth = await getAuth();
  const { data, error } = await auth.verifyOtp({ email, token: String(token ?? '').trim(), type: 'email' });
  if (error) throw error;
  return data;
};

export const loginWithGoogle = async () => {
  const auth = await getAuth();
  const redirectTo = globalThis.location?.href?.split('#')[0];
  const { data, error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } });
  if (error) throw error;
  return data;
};

export const logout = async () => {
  try {
    const auth = await getAuth();
    const { error } = await auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.warn('[auth-service] remote logout failed', error);
  } finally {
    clearPersistedUser();
  }
  return true;
};

export const getCurrentUser = async () => {
  try {
    const auth = await getAuth();
    const { data, error } = await auth.getUser();
    if (error || !data.user) return readPersistedUser();
    const persisted = readPersistedUser() || {};
    return stripManagerOnlyFields({ ...persisted, ...normalizeAuthUser(data.user), uid: data.user.id, id: data.user.id, sessionVersion: SESSION_VERSION });
  } catch (error) {
    console.warn('[auth-service] current user fallback', error);
    return readPersistedUser();
  }
};

export const checkSession = async () => {
  const user = await getCurrentUser();
  if (!user) { clearPersistedUser(); return null; }
  const refreshed = { ...user, timestamp: Date.now(), sessionVersion: SESSION_VERSION };
  persistUser(refreshed);
  return refreshed;
};

const normalizeAdminUser = (user = {}) => ({
  ...user,
  id: String(user.id || user.uid || ''),
  name: user.name || user.fullName || user.displayName || '',
  phone: user.phone || user.localPhone || user.username || '',
  email: user.email || user.authEmail || '',
  address: user.address || user.location || '',
  accountStatus: user.accountStatus || 'under_confirmation',
  createdAt: user.createdAt || user.registeredAt || null
});

/** Returns complete customer documents for the management page only. */
export const listUsersForAdmin = async () => {
  const users = await (await getDB()).getCollection('users');
  const normalized = await Promise.all(users.map(async (user) => {
    const record = normalizeAdminUser(user);
    const secretToken = await ensureUserSecret(record.id, record);
    return { ...record, secretToken };
  }));
  return normalized.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
};

export const searchUsersForAdmin = async (query = '') => {
  const needle = sanitizeInput(query, 160).toLowerCase();
  const users = await listUsersForAdmin();
  if (!needle) return users;
  return users.filter((user) => [
    user.id, user.secretToken, user.name, user.fullName, user.phone, user.localPhone,
    user.email, user.authEmail, user.address
  ].some((value) => String(value || '').toLowerCase().includes(needle)));
};

export const updateUserAccountStatus = async (userId, accountStatus, extra = {}) => {
  const statuses = ['under_confirmation', 'active', 'verified', 'suspended', 'rejected'];
  if (!statuses.includes(accountStatus)) throw new Error('حالة الحساب غير صالحة');
  const patch = {
    ...extra,
    accountStatus,
    verifiedAt: ['active', 'verified'].includes(accountStatus) ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString()
  };
  return (await getDB()).updateDocument('users', String(userId), patch);
};
export const setUserVerificationStatus = async (userId, verified) => updateUserAccountStatus(
  userId,
  verified ? 'verified' : 'under_confirmation',
  { whatsappCodeStatus: verified ? 'verified' : 'pending' }
);
export const subscribeUsersForAdmin = async (listener, onError) => (await getDB()).subscribe('users', async (rows) => {
  try {
    const users = await Promise.all(rows.map(async (user) => {
      const record = normalizeAdminUser(user);
      const secretToken = await ensureUserSecret(record.id, record);
      return { ...record, secretToken };
    }));
    listener(users.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)));
  } catch (error) { onError?.(error); }
}, onError);

/**
 * A true Supabase Auth deletion cannot be safely done with the public anon
 * key. The deployed Edge Function validates an administrator JWT and uses the
 * service role server-side. We intentionally never fall back to deleting only
 * the profile document, because that leaves a login-capable orphan account.
 */
export const deleteUserAccount = async (userId) => {
  const response = await fetch('/.netlify/functions/admin-api', {
    method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operation: 'deleteAuthUser', id: String(userId) })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || 'تعذر حذف الحساب');
  return true;
};

const bytesToHex = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
const hexToBytes = (hex) => {
  const normalized = String(hex || '').trim();
  if (!normalized || normalized.length % 2 !== 0 || !/^[a-f\d]+$/iu.test(normalized)) throw new Error('Invalid admin-gate salt');
  return Uint8Array.from(normalized.match(/.{2}/gu), (value) => Number.parseInt(value, 16));
};

export const hashAdminGateCredentials = async (username, password, saltHex, iterations = ADMIN_GATE_ITERATIONS) => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) throw new Error('Web Crypto API is unavailable');
  const combined = `${String(username ?? '')}${ADMIN_GATE_SEPARATOR}${String(password ?? '')}`;
  const key = await cryptoApi.subtle.importKey(
    'raw', new TextEncoder().encode(combined), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await cryptoApi.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: Number(iterations) || ADMIN_GATE_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
};

const constantTimeEqual = (left, right) => {
  const first = String(left || '');
  const second = String(right || '');
  let difference = first.length ^ second.length;
  const length = Math.max(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (first.charCodeAt(index) || 0) ^ (second.charCodeAt(index) || 0);
  }
  return difference === 0;
};

const createDefaultAdminGate = async (db) => {
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const config = {
    saltHex: bytesToHex(salt),
    iterations: ADMIN_GATE_ITERATIONS,
    updatedAt: new Date().toISOString()
  };
  config.hashHex = await hashAdminGateCredentials('hood', 'hood', config.saltHex, config.iterations);
  await db.setDocument(ADMIN_GATE_COLLECTION, ADMIN_GATE_DOCUMENT, config);
  return config;
};

const adminAuthRequest = async (method = 'GET', body) => {
  const response = await fetch('/.netlify/functions/admin-auth', {
    method, credentials: 'same-origin', headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 401) throw new Error(data.error || 'تعذر الاتصال بخدمة الإدارة');
  return { response, data };
};

export const verifyAdminGate = async (username, password) => {
  try {
    const { response, data } = await adminAuthRequest('POST', { username: String(username || '').trim(), password: String(password || '') });
    globalThis.__HUD_ADMIN_AUTHENTICATED__ = response.ok && data.authenticated === true;
    return globalThis.__HUD_ADMIN_AUTHENTICATED__;
  } catch (error) { console.error('[auth-service] secure admin login failed', error); return false; }
};

export const setAdminGateCredentials = async (username, password) => {
  const { response, data } = await adminAuthRequest('POST', { action: 'change-credentials', username: String(username || '').trim(), password: String(password || '') });
  if (!response.ok) throw new Error(data.error || 'تعذر تغيير بيانات الإدارة');
  return true;
};

export const checkAdminSession = async () => {
  try {
    const { response, data } = await adminAuthRequest('GET');
    globalThis.__HUD_ADMIN_AUTHENTICATED__ = response.ok && data.authenticated === true;
    return globalThis.__HUD_ADMIN_AUTHENTICATED__;
  } catch { globalThis.__HUD_ADMIN_AUTHENTICATED__ = false; return false; }
};
export const createAdminSession = () => globalThis.__HUD_ADMIN_AUTHENTICATED__ ? 'secure-http-only-session' : '';
export const hasAdminSession = () => globalThis.__HUD_ADMIN_AUTHENTICATED__ === true;
export const clearAdminSession = async () => {
  globalThis.__HUD_ADMIN_AUTHENTICATED__ = false;
  try { await adminAuthRequest('DELETE'); } catch (error) { console.warn('[auth-service] admin logout failed', error); }
};

// admin-gate.legacy.js is loaded before main.js on login.html for backward
// compatibility. Replace its implementation with this canonical module API so
// both entry points use one PBKDF2 implementation and one session key.
const legacyAdminGate = globalThis.HUD_ADMIN_GATE;
if (legacyAdminGate && typeof legacyAdminGate === 'object') {
  Object.assign(legacyAdminGate, {
    verifyAdminGate,
    setAdminGateCredentials,
    createSession: createAdminSession,
    hasValidSession: hasAdminSession,
    clearSession: clearAdminSession
  });
}

export { generateUniqueSecretToken };

export default Object.freeze({
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail,
  login, register, logout, getCurrentUser, checkSession, resolveLoginEmail, findUserDocumentByPhone,
  createUserWithSecret, ensureUserSecret, getUserSecret, listUsersForAdmin, searchUsersForAdmin,
  updateUserAccountStatus, setUserVerificationStatus, subscribeUsersForAdmin, deleteUserAccount,
  sendEmailVerificationCode, verifyEmailCode, loginWithGoogle, generateUniqueSecretToken,
  hashAdminGateCredentials, verifyAdminGate, setAdminGateCredentials,
  createAdminSession, hasAdminSession, checkAdminSession, clearAdminSession
});
