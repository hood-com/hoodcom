import { getDB } from './supabase-client.js';
import { getCurrentUser } from './auth-service.js';
import { DEFAULT_TOPUP_SERVICES, DEFAULT_TOPUP_SETTINGS, STORAGE_KEYS } from '../config/settings.js';
import { sanitizeBoolean, sanitizeInput, sanitizeNumber } from '../utils/sanitizers.js';

let topupSettings = JSON.parse(JSON.stringify(DEFAULT_TOPUP_SETTINGS));
let services = [];
let transactionsCache = [];

const clone = (value) => JSON.parse(JSON.stringify(value));
const readJSON = (key, fallback) => {
  try { return JSON.parse(globalThis.localStorage?.getItem(key) || JSON.stringify(fallback)); }
  catch { return clone(fallback); }
};
const writeJSON = (key, value) => {
  try { globalThis.localStorage?.setItem(key, JSON.stringify(value)); return true; }
  catch (error) { console.warn(`[balance-service] unable to persist ${key}`, error); return false; }
};
const notify = (name, detail) => {
  if (typeof globalThis.CustomEvent === 'function' && typeof globalThis.dispatchEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent(name, { detail }));
  }
};
const makeId = (prefix) => {
  const random = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(random);
  else random[0] = Math.floor(Math.random() * 0xffffffff);
  return `${prefix}-${Date.now()}-${random[0].toString(36)}`;
};
const sortByOrder = (entries) => entries.slice().sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

const normalizeTopupSettings = (settings = {}) => ({
  ...clone(DEFAULT_TOPUP_SETTINGS),
  ...settings,
  withdrawMethods: Array.isArray(settings.withdrawMethods) ? settings.withdrawMethods : []
});
const normalizeServiceField = (field = {}, index = 0) => ({
  ...field,
  id: String(field.id || makeId(`field-${index}`)),
  label: sanitizeInput(field.label || field.name || 'حقل', 120),
  type: ['text', 'number', 'tel', 'email', 'textarea', 'select', 'file'].includes(field.type) ? field.type : 'text',
  placeholder: sanitizeInput(field.placeholder || '', 250),
  options: Array.isArray(field.options) ? field.options.map((option) => sanitizeInput(option, 100)).filter(Boolean) : [],
  required: sanitizeBoolean(field.required),
  order: sanitizeNumber(field.order, { min: 0, max: 10_000, integer: true, fallback: index + 1 })
});
const normalizeService = (service = {}, index = 0) => ({
  ...service,
  id: String(service.id || makeId('svc')),
  name: sanitizeInput(service.name || service.title || 'خدمة', 100),
  description: sanitizeInput(service.description || '', 1000),
  image: String(service.image || ''),
  type: service.type === 'withdraw' ? 'withdraw' : 'deposit',
  enabled: service.enabled !== false,
  order: sanitizeNumber(service.order, { min: 1, max: 10_000, integer: true, fallback: index + 1 }),
  customFields: Array.isArray(service.customFields) ? service.customFields.map(normalizeServiceField).sort((a, b) => a.order - b.order) : [],
  updatedAt: service.updatedAt || new Date().toISOString()
});
const normalizeTransaction = (transaction = {}) => ({
  ...transaction,
  id: String(transaction.id || makeId('TX')),
  userId: String(transaction.userId || ''),
  type: ['deposit', 'withdraw', 'admin_adjustment'].includes(transaction.type) ? transaction.type : 'deposit',
  status: ['pending', 'approved', 'rejected', 'cancelled'].includes(transaction.status) ? transaction.status : 'pending',
  amount: sanitizeNumber(transaction.amount, { min: 0, max: 1_000_000_000, fallback: 0 }),
  createdAt: transaction.createdAt || new Date().toISOString(),
  updatedAt: transaction.updatedAt || new Date().toISOString()
});

export const loadTopupSettings = () => {
  topupSettings = normalizeTopupSettings(readJSON(STORAGE_KEYS.topup, {}));
  return clone(topupSettings);
};
export const getTopupSettings = () => clone(topupSettings);
export const saveTopupSettings = async (settings = {}) => {
  try {
    const next = normalizeTopupSettings({ ...topupSettings, ...settings, updatedAt: new Date().toISOString() });
    await (await getDB()).setDocument('settings', 'topup', next);
    topupSettings = next;
    writeJSON(STORAGE_KEYS.topup, topupSettings);
    const result = clone(topupSettings);
    notify('hud:topup-settings-updated', { settings: result, source: 'save' });
    return result;
  } catch (error) {
    console.error('[balance-service] settings save failed', error);
    throw error;
  }
};
export const loadTopupSettingsFromCloud = async () => {
  try {
    const remote = await (await getDB()).getDocument('settings', 'topup');
    if (remote) topupSettings = normalizeTopupSettings(remote);
    else topupSettings = loadTopupSettings();
    writeJSON(STORAGE_KEYS.topup, topupSettings);
    return clone(topupSettings);
  } catch (error) {
    console.error('[balance-service] topup settings load failed', error);
    return loadTopupSettings();
  }
};
export const subscribeTopupSettings = async (listener, onError) => (await getDB()).subscribe('settings', (rows) => {
  const remote = rows.find((row) => row.id === 'topup');
  if (!remote) return;
  topupSettings = normalizeTopupSettings(remote);
  writeJSON(STORAGE_KEYS.topup, topupSettings);
  const result = clone(topupSettings);
  notify('hud:topup-settings-updated', { settings: result, source: 'realtime' });
  listener(result);
}, onError);

export const getWithdrawMethods = () => sortByOrder(topupSettings.withdrawMethods || []).map(clone);
export const saveWithdrawMethod = async (method) => {
  const methods = getWithdrawMethods();
  const entry = { ...method, id: String(method?.id || makeId('wm')) };
  const index = methods.findIndex((item) => item.id === entry.id);
  if (index >= 0) methods[index] = { ...methods[index], ...entry };
  else methods.push({ ...entry, order: entry.order || methods.length + 1 });
  await saveTopupSettings({ withdrawMethods: methods });
  return clone(methods.find((item) => item.id === entry.id));
};
export const deleteWithdrawMethod = async (id) => {
  await saveTopupSettings({ withdrawMethods: getWithdrawMethods().filter((method) => method.id !== String(id)) });
  return true;
};

const balanceKey = (userId) => `hud_balance_${userId || 'guest'}`;
const resolveUserId = async (userId) => userId || (await getCurrentUser())?.uid || 'guest';
const getBalanceIndex = () => readJSON(STORAGE_KEYS.balances, {});
const setBalanceIndex = (index) => writeJSON(STORAGE_KEYS.balances, index);
export const getUserBalance = (userId = 'guest') => {
  // Security: prefer indexed balance (synced from cloud) over raw localStorage key to mitigate fake balance via direct localStorage edit
  try {
    const index = getBalanceIndex();
    const indexed = index[userId]?.balance ?? index[String(userId || 'guest')]?.balance;
    if (Number.isFinite(Number(indexed))) return Math.max(0, Number(indexed));
  } catch {}
  const value = Number(globalThis.localStorage?.getItem(balanceKey(userId)) || 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
};
export const updateUserBalance = async (userId, newBalance, metadata = {}) => {
  try {
    const id = await resolveUserId(userId);
    const balance = Math.max(0, Number(newBalance) || 0);
    const index = getBalanceIndex();
    const record = { ...index[id], ...metadata, id, balance, updatedAt: new Date().toISOString() };
    if (id !== 'guest') await (await getDB()).setDocument('user_balances', id, record);
    index[id] = record;
    setBalanceIndex(index);
    globalThis.localStorage?.setItem(balanceKey(id), balance.toFixed(2));
    notify('hud:user-balance-updated', { userId: id, balance, source: 'save' });
    return balance;
  } catch (error) {
    console.error('[balance-service] balance update failed', error);
    throw error;
  }
};
let lastBalanceSync = 0;
const BALANCE_SYNC_INTERVAL = 30 * 1000; // 30 seconds cache to improve performance

const shouldSyncBalances = () => {
  const now = Date.now();
  if (now - lastBalanceSync > BALANCE_SYNC_INTERVAL) {
    lastBalanceSync = now;
    return true;
  }
  return false;
};

export const creditUserBalance = async (userId, amount) => {
  const sanitized = Math.max(0, Number(amount) || 0);
  if (!(sanitized > 0)) throw new Error('المبلغ غير صالح');
  // Performance: only sync if cache expired, otherwise use local cached balance
  if (shouldSyncBalances()) {
    try { await loadAllUserBalancesFromCloud(); } catch {}
  }
  return updateUserBalance(userId, getUserBalance(userId) + sanitized);
};
export const debitUserBalance = async (userId, amount) => {
  const sanitized = Math.max(0, Number(amount) || 0);
  if (!(sanitized > 0)) throw new Error('المبلغ غير صالح');
  // Performance + Security: sync from cloud only if cache expired (30s) to prevent fake balance while avoiding performance hit
  if (shouldSyncBalances()) {
    try { await loadAllUserBalancesFromCloud(); } catch {}
  }
  const current = getUserBalance(userId);
  if (sanitized > current) throw new Error('الرصيد غير كافٍ');
  return updateUserBalance(userId, current - sanitized);
};

const persistTransactions = () => writeJSON(STORAGE_KEYS.transactions, transactionsCache);
export const getTopupTransactions = () => clone(transactionsCache);
export const loadTopupTransactionsLocal = () => {
  const entries = readJSON(STORAGE_KEYS.transactions, []);
  transactionsCache = Array.isArray(entries) ? entries.map(normalizeTransaction).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : [];
  return getTopupTransactions();
};
export const loadTopupTransactionsFromCloud = async () => {
  try {
    const remote = await (await getDB()).getCollection('topup_transactions');
    transactionsCache = remote.map(normalizeTransaction).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    persistTransactions();
    return getTopupTransactions();
  } catch (error) {
    console.error('[balance-service] transaction load failed', error);
    return loadTopupTransactionsLocal();
  }
};
export const saveTopupTransaction = async (transaction) => {
  try {
    const current = transactionsCache.find((entry) => entry.id === String(transaction?.id));
    const tx = normalizeTransaction({ ...current, ...transaction, id: transaction?.id || makeId('TX'), updatedAt: new Date().toISOString() });
    await (await getDB()).setDocument('topup_transactions', tx.id, tx);
    const index = transactionsCache.findIndex((entry) => entry.id === tx.id);
    if (index >= 0) transactionsCache[index] = tx;
    else transactionsCache.unshift(tx);
    transactionsCache.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    persistTransactions();
    const result = clone(tx);
    notify('hud:topup-transactions-updated', { transactions: getTopupTransactions(), transaction: result, source: 'save' });
    return result;
  } catch (error) {
    console.error('[balance-service] transaction save failed', error);
    throw error;
  }
};
export const updateTopupTransactionStatus = async (id, status, adminNotes = '') => {
  try {
    if (!['approved', 'rejected', 'cancelled', 'pending'].includes(status)) throw new Error('حالة العملية غير صالحة');
    const transaction = transactionsCache.find((entry) => entry.id === String(id)) || await (await getDB()).getDocument('topup_transactions', id);
    if (!transaction) throw new Error('المعاملة غير موجودة');
    const previous = transaction.status;
    const next = { ...transaction, status, adminNotes: sanitizeInput(adminNotes, 1000), updatedAt: new Date().toISOString() };
    // Preserve idempotency: a second click cannot credit/debit the account again.
    if (status === 'approved' && previous !== 'approved' && next.type === 'deposit') await creditUserBalance(next.userId, next.amount);
    if (status === 'rejected' && previous !== 'rejected' && next.type === 'withdraw') await creditUserBalance(next.userId, next.amount);
    return saveTopupTransaction(next);
  } catch (error) {
    console.error('[balance-service] transaction status failed', error);
    throw error;
  }
};
export const subscribeTopupTransactions = async (listener, onError) => (await getDB()).subscribe('topup_transactions', (rows) => {
  transactionsCache = rows.map(normalizeTransaction).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  persistTransactions();
  const result = getTopupTransactions();
  notify('hud:topup-transactions-updated', { transactions: result, source: 'realtime' });
  listener(result);
}, onError);

export const loadTopupServicesLocal = () => {
  const stored = readJSON(STORAGE_KEYS.services, []);
  services = Array.isArray(stored) && stored.length ? stored.map(normalizeService) : clone(DEFAULT_TOPUP_SERVICES).map(normalizeService);
  writeJSON(STORAGE_KEYS.services, services);
  return clone(services);
};
const persistServices = () => writeJSON(STORAGE_KEYS.services, services);
export const getTopupServices = (type) => sortByOrder(services.filter((service) => !type || service.type === type)).map(clone);
export const getTopupServiceById = (id) => {
  const found = services.find((service) => service.id === String(id));
  return found ? clone(found) : null;
};
const SERVICES_META_ID = 'topup_services_meta';
const saveServicesMeta = async (db) => db.setDocument('settings', SERVICES_META_ID, { initialized: true, updatedAt: new Date().toISOString() });
export const loadTopupServicesFromCloud = async () => {
  try {
    const db = await getDB();
    const cloud = await db.getCollection('topup_services');
    if (cloud.length) {
      services = cloud.map(normalizeService);
    } else {
      const meta = await db.getDocument('settings', SERVICES_META_ID);
      if (meta?.initialized) {
        // An empty collection is a valid manager choice after deleting the last service.
        services = [];
      } else {
        const initial = services.length ? services : loadTopupServicesLocal();
        const seeded = initial.map(normalizeService);
        await Promise.all(seeded.map((service) => db.setDocument('topup_services', service.id, service)));
        await saveServicesMeta(db);
        services = seeded;
      }
    }
    persistServices();
    const result = getTopupServices();
    notify('hud:topup-services-updated', { services: result, source: 'load' });
    return result;
  } catch (error) {
    console.error('[balance-service] service load failed', error);
    return loadTopupServicesLocal();
  }
};
export const saveTopupService = async (service) => {
  try {
    const existing = services.find((item) => item.id === String(service?.id));
    const sameTypeCount = services.filter((item) => item.type === (service?.type === 'withdraw' ? 'withdraw' : 'deposit')).length;
    let entry = normalizeService({
      ...existing,
      ...service,
      id: service?.id || makeId('svc'),
      order: service?.order || existing?.order || sameTypeCount + 1,
      updatedAt: new Date().toISOString()
    }, sameTypeCount);
    if(String(entry.image||'').startsWith('data:image/')&&globalThis.__HUD_ADMIN_AUTHENTICATED__===true){entry={...entry,image:await import('./image-storage-service.js').then((mod)=>mod.uploadManagedImage(entry.image,'service',entry.id))};}
    const db = await getDB();
    await db.setDocument('topup_services', entry.id, entry);
    await saveServicesMeta(db);
    const index = services.findIndex((item) => item.id === entry.id);
    if (index >= 0) services[index] = entry;
    else services.push(entry);
    services = sortByOrder(services);
    persistServices();
    const result = clone(entry);
    notify('hud:topup-services-updated', { services: getTopupServices(), service: result, source: 'save' });
    return result;
  } catch (error) {
    console.error('[balance-service] service save failed', error);
    throw error;
  }
};
export const deleteTopupService = async (id) => {
  try {
    const serviceId = String(id);
    const db = await getDB();
    await db.deleteDocument('topup_services', serviceId);
    await saveServicesMeta(db);
    services = services.filter((service) => service.id !== serviceId);
    persistServices();
    notify('hud:topup-services-updated', { services: getTopupServices(), deletedId: serviceId, source: 'delete' });
    return true;
  } catch (error) {
    console.error('[balance-service] service delete failed', error);
    throw error;
  }
};
export const subscribeTopupServices = async (listener, onError) => (await getDB()).subscribe('topup_services', (rows) => {
  services = rows.map(normalizeService);
  persistServices();
  const result = getTopupServices();
  notify('hud:topup-services-updated', { services: result, source: 'realtime' });
  listener(result);
}, onError);

export const addServiceField = async (serviceId, field) => {
  const service = getTopupServiceById(serviceId);
  if (!service) throw new Error('الخدمة غير موجودة');
  const entry = normalizeServiceField({ ...field, id: field?.id || makeId('field') }, service.customFields.length);
  await saveTopupService({ ...service, customFields: [...service.customFields, entry] });
  return clone(entry);
};
export const updateServiceField = async (serviceId, fieldId, updates) => {
  const service = getTopupServiceById(serviceId);
  if (!service) throw new Error('الخدمة غير موجودة');
  const fields = service.customFields.map((field, index) => field.id === String(fieldId) ? normalizeServiceField({ ...field, ...updates, id: field.id }, index) : field);
  await saveTopupService({ ...service, customFields: fields });
  return clone(fields.find((field) => field.id === String(fieldId)) || null);
};
export const deleteServiceField = async (serviceId, fieldId) => {
  const service = getTopupServiceById(serviceId);
  if (!service) return false;
  await saveTopupService({ ...service, customFields: service.customFields.filter((field) => field.id !== String(fieldId)) });
  return true;
};

export const loadAllUserBalancesFromCloud = async () => {
  try {
    const records = await (await getDB()).getCollection('user_balances');
    // Rebuild from cloud truth; never retain deleted customers from an old local index.
    const previous = getBalanceIndex();
    const index = {};
    records.forEach((record) => {
      index[record.id] = { ...record };
      globalThis.localStorage?.setItem(balanceKey(record.id), Number(record.balance || 0).toFixed(2));
    });
    Object.keys(previous).filter((id) => !index[id]).forEach((id) => {
      try { globalThis.localStorage?.removeItem(balanceKey(id)); } catch {}
    });
    setBalanceIndex(index);
    return Object.values(index);
  } catch (error) {
    console.error('[balance-service] balances load failed', error);
    return Object.values(getBalanceIndex());
  }
};
export const listRegisteredUsers = async () => {
  try {
    const db = await getDB();
    const [users, balances] = await Promise.all([db.getCollection('users'), loadAllUserBalancesFromCloud()]);
    const index = Object.fromEntries(balances.map((record) => [record.id, record]));
    // A balance without a users document is not a registered customer.
    return users.map((user) => ({
      ...index[user.id], ...user, id: user.id,
      balance: index[user.id]?.balance ?? Number(user.balance || 0)
    })).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (error) {
    console.error('[balance-service] user list failed', error);
    return [];
  }
};
export const adminSetUserBalance = async (userId, amount, reason = 'تعديل رصيد يدوي') => {
  const previous = getUserBalance(userId);
  const balance = await updateUserBalance(userId, amount);
  await saveTopupTransaction({ userId, type: 'admin_adjustment', amount: Math.abs(balance - previous), walletName: sanitizeInput(reason, 300), status: 'approved' });
  return balance;
};

// HUD COM Refresh
export const refreshBalance = async (userId) => {
  try {
    const { getCurrentUser } = await import('./auth-service.js');
    const user = userId ? { uid: userId } : await getCurrentUser().catch(() => null);
    const uid = user?.uid || userId || 'guest';
    // Pull cloud balances
    await loadAllUserBalancesFromCloud();
    await loadTopupTransactionsFromCloud();
    await loadTopupSettingsFromCloud();
    const balance = getUserBalance(uid);
    if (typeof globalThis.CustomEvent === 'function') {
      globalThis.dispatchEvent?.(new CustomEvent('hud:user-balance-updated', { 
        detail: { userId: uid, balance, source: 'refresh' } 
      }));
    }
    return balance;
  } catch (error) {
    console.error('[balance-service] refresh failed', error);
    throw error;
  }
};

if (typeof globalThis.window !== 'undefined') {
  globalThis.window.refreshBalance = refreshBalance;
}

loadTopupSettings();
loadTopupServicesLocal();
loadTopupTransactionsLocal();

export default Object.freeze({
  loadTopupSettings, getTopupSettings, saveTopupSettings, loadTopupSettingsFromCloud, subscribeTopupSettings,
  getWithdrawMethods, saveWithdrawMethod, deleteWithdrawMethod, getUserBalance, updateUserBalance,
  creditUserBalance, debitUserBalance, getTopupTransactions, loadTopupTransactionsLocal,
  loadTopupTransactionsFromCloud, saveTopupTransaction, updateTopupTransactionStatus, subscribeTopupTransactions,
  loadTopupServicesLocal, loadTopupServicesFromCloud, getTopupServices, getTopupServiceById,
  saveTopupService, deleteTopupService, subscribeTopupServices, addServiceField, updateServiceField,
  deleteServiceField, listRegisteredUsers, adminSetUserBalance, loadAllUserBalancesFromCloud,
  refreshBalance
});
