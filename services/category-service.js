import { getDB } from './supabase-client.js';
import { STORAGE_KEYS } from '../config/settings.js';
import { sanitizeBoolean, sanitizeInput, sanitizeNumber } from '../utils/sanitizers.js';
import { generateOfferSecret } from '../utils/security.js';

let categoryCache = [];

const clone = (value) => JSON.parse(JSON.stringify(value));
const makeId = (prefix) => {
  const random = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(random);
  else random[0] = Math.floor(Math.random() * 0xffffffff);
  return `${prefix}-${Date.now()}-${random[0].toString(36)}`;
};
const validStatus = (status) => ['available', 'unavailable', 'coming_soon'].includes(status) ? status : 'available';
const validSecret = (value, prefix) => {
  const token = String(value || '').trim().toUpperCase();
  return new RegExp(`^${prefix}-[A-Z2-9]{8,64}$`, 'u').test(token) ? token : '';
};

const notify = (name, detail) => {
  if (typeof globalThis.CustomEvent === 'function' && typeof globalThis.dispatchEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent(name, { detail }));
  }
};

const normalizeField = (field = {}, index = 0) => ({
  ...field,
  id: String(field.id || makeId(`field-${index}`)),
  label: sanitizeInput(field.label || field.name || 'حقل مخصص', 120),
  type: ['text', 'number', 'tel', 'email', 'url', 'password', 'note', 'textarea', 'select', 'file', 'id'].includes(field.type) ? field.type : 'text',
  placeholder: sanitizeInput(field.placeholder || field.defaultVal || '', 250),
  required: sanitizeBoolean(field.required),
  enabled: field.enabled !== false,
  order: sanitizeNumber(field.order, { min: 0, max: 10000, integer: true, fallback: index + 1 }),
  options: Array.isArray(field.options) ? field.options.map((option) => sanitizeInput(option, 100)).filter(Boolean) : []
});

const normalizePopup = (popup = {}, index = 0) => ({
  ...popup,
  id: String(popup.id || makeId(`popup-${index}`)),
  title: sanitizeInput(popup.title || '', 150),
  content: sanitizeInput(popup.content || '', 2000),
  type: ['info', 'warning', 'success', 'danger'].includes(popup.type) ? popup.type : 'info',
  buttonText: sanitizeInput(popup.buttonText || '', 80),
  image: String(popup.image || ''),
  order: sanitizeNumber(popup.order, { min: 0, max: 10000, integer: true, fallback: index + 1 })
});

const normalizeOffer = (offer = {}, index = 0) => ({
  ...offer,
  id: String(offer.id || makeId(`offer-${index}`)),
  name: sanitizeInput(offer.name || 'عرض', 150),
  description: sanitizeInput(offer.description ?? offer.desc ?? '', 1000),
  price: sanitizeNumber(offer.price, { min: 0, max: 1_000_000_000, fallback: 0 }),
  oldPrice: sanitizeNumber(offer.oldPrice ?? offer.originalPriceYER, { min: 0, max: 1_000_000_000, fallback: 0 }),
  currency: ['YER', 'SAR', 'USD', 'AED'].includes(offer.currency) ? offer.currency : 'YER',
  image: String(offer.image || ''),
  status: validStatus(offer.status),
  order: sanitizeNumber(offer.order, { min: 0, max: 10000, integer: true, fallback: index + 1 }),
  // Legacy offerPassword values are migrated once and then retained only as
  // secretToken. The admin renderer is the only caller requesting this field.
  secretToken: validSecret(offer.secretToken || offer.offerPassword, 'OFF') || generateOfferSecret(),
  popups: Array.isArray(offer.popups) ? offer.popups.map(normalizePopup).sort((a, b) => a.order - b.order) : []
});

const normalizeItem = (item = {}, index = 0) => ({
  ...item,
  id: String(item.id || makeId(`item-${index}`)),
  name: sanitizeInput(item.name || 'منتج', 150),
  description: sanitizeInput(item.description ?? item.desc ?? '', 1500),
  image: String(item.image || ''),
  status: validStatus(item.status),
  order: sanitizeNumber(item.order, { min: 0, max: 10000, integer: true, fallback: index + 1 }),
  customFields: Array.isArray(item.customFields) ? item.customFields.map(normalizeField).sort((a, b) => a.order - b.order) : [],
  offers: Array.isArray(item.offers) ? item.offers.map(normalizeOffer).sort((a, b) => a.order - b.order) : []
});

const normalizeCategory = (category = {}, index = 0) => ({
  ...category,
  id: String(category.id || makeId(`category-${index}`)),
  name: sanitizeInput(category.name || 'قسم', 120),
  description: sanitizeInput(category.description ?? category.desc ?? '', 1000),
  image: String(category.image || ''),
  enabled: category.enabled !== false,
  order: sanitizeNumber(category.order, { min: 0, max: 10000, integer: true, fallback: index + 1 }),
  updatedAt: category.updatedAt || new Date().toISOString(),
  items: Array.isArray(category.items) ? category.items.map(normalizeItem).sort((a, b) => a.order - b.order) : []
});

const hasMissingOfferSecret = (category = {}) => (category.items || []).some((item) =>
  (item.offers || []).some((offer) => !validSecret(offer.secretToken || offer.offerPassword, 'OFF')));
const persistCache = () => {
  try { globalThis.localStorage?.setItem(STORAGE_KEYS.categories, JSON.stringify(categoryCache)); } catch { /* storage unavailable */ }
};
const readCache = () => {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEYS.categories) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeCategory) : [];
  } catch { return []; }
};
const cacheCategory = (category) => {
  const index = categoryCache.findIndex((entry) => entry.id === category.id);
  if (index >= 0) categoryCache[index] = category;
  else categoryCache.push(category);
  categoryCache.sort((a, b) => a.order - b.order);
  persistCache();
};

// Secret tokens must not be placed in normal customer page state. This is a
// UI safeguard; production Supabase RLS must additionally deny direct access
// to manager-only data (see the hardening migration supplied with this fix).
const withoutOfferSecrets = (categories) => categories.map((category) => ({
  ...category,
  items: (category.items || []).map((item) => ({
    ...item,
    offers: (item.offers || []).map(({ secretToken, offerPassword, ...offer }) => offer)
  }))
}));
const viewCategories = (includeSecrets = false) => clone(includeSecrets ? categoryCache : withoutOfferSecrets(categoryCache));
const rawCategoryById = (id) => categoryCache.find((category) => category.id === String(id)) || null;

export const loadCategoriesFromFirebase = async () => {
  try {
    const db = await getDB();
    const remote = await db.getCollection('categories');
    const legacyIds = remote.filter(hasMissingOfferSecret).map((category) => String(category.id));
    categoryCache = remote.map(normalizeCategory).sort((a, b) => a.order - b.order);
    persistCache();

    // Backfill legacy offers exactly once. We await this migration so a page
    // refresh cannot replace a newly generated token with an older document.
    await Promise.all(legacyIds.map((id) => {
      const category = rawCategoryById(id);
      return category ? db.setDocument('categories', category.id, category) : Promise.resolve();
    }));
    return viewCategories();
  } catch (error) {
    console.error('[category-service] load failed', error);
    if (!categoryCache.length) categoryCache = readCache();
    return viewCategories();
  }
};

export const saveCategoryToFirebase = async (category) => {
  try {
    const normalized = normalizeCategory({ ...category, updatedAt: new Date().toISOString() }, categoryCache.length);
    const db = await getDB();
    // A successful cloud write is the commit point; this prevents success UI
    // for data that is only present in localStorage.
    await db.setDocument('categories', normalized.id, normalized);
    cacheCategory(normalized);
    const result = clone(normalized);
    notify('hud:categories-updated', { categories: viewCategories(), category: result, source: 'save' });
    return result;
  } catch (error) {
    console.error('[category-service] save failed', error);
    throw error;
  }
};

export const updateCategory = async (id, updates = {}) => {
  const current = rawCategoryById(id) || (await loadCategoriesFromFirebase(), rawCategoryById(id));
  if (!current) throw new Error('القسم غير موجود');
  return saveCategoryToFirebase({ ...current, ...updates, id: current.id, items: current.items });
};

export const deleteCategoryFromFirebase = async (id) => {
  try {
    await (await getDB()).deleteDocument('categories', String(id));
    categoryCache = categoryCache.filter((category) => category.id !== String(id));
    persistCache();
    notify('hud:categories-updated', { categories: viewCategories(), deletedId: String(id), source: 'delete' });
    return true;
  } catch (error) {
    console.error('[category-service] delete failed', error);
    throw error;
  }
};

export const getAllCategories = async (options = {}) => {
  if (!categoryCache.length || options.refresh) await loadCategoriesFromFirebase();
  return viewCategories(options.includeSecrets === true);
};
// Performance: check cache first to avoid full collection scan when possible
export const getCategoryById = async (id, options = {}) => {
  const cached = rawCategoryById(id);
  if (cached && !options.refresh && !options.includeSecrets) {
    // Return sanitized cached version without secrets for performance
    const sanitized = withoutOfferSecrets([cached]);
    return sanitized[0] || null;
  }
  if (cached && options.includeSecrets) return clone(cached);
  return (await getAllCategories(options)).find((category) => category.id === String(id)) || null;
};
export const getCategory = getCategoryById;
export const getItemsByCategory = async (categoryId) => (await getCategoryById(categoryId))?.items || [];

export const getItemById = async (itemId, options = {}) => {
  const all = await getAllCategories(options);
  for (const category of all) {
    const item = category.items.find((entry) => entry.id === String(itemId));
    if (item) return { category, item };
  }
  return null;
};

export const updateItem = async (categoryId, itemId, updates = {}) => {
  let category = rawCategoryById(categoryId);
  if (!category) { await loadCategoriesFromFirebase(); category = rawCategoryById(categoryId); }
  if (!category) throw new Error('القسم غير موجود');
  const item = category.items.find((entry) => entry.id === String(itemId));
  if (!item) throw new Error('المنتج غير موجود');
  const updatedItem = normalizeItem({ ...item, ...updates, id: item.id, offers: updates.offers || item.offers }, category.items.indexOf(item));
  const updatedCategory = { ...category, items: category.items.map((entry) => entry.id === item.id ? updatedItem : entry) };
  await saveCategoryToFirebase(updatedCategory);
  return clone(updatedItem);
};

export const deleteItem = async (categoryId, itemId) => {
  const category = rawCategoryById(categoryId);
  if (!category) throw new Error('القسم غير موجود');
  await saveCategoryToFirebase({ ...category, items: category.items.filter((item) => item.id !== String(itemId)) });
  return true;
};

export const getOffersByItem = async (itemId, options = {}) => (await getItemById(itemId, options))?.item?.offers || [];
export const getAllOffers = async (options = {}) => (await getAllCategories(options)).flatMap((category) => category.items.flatMap((item) =>
  item.offers.map((offer) => ({ categoryId: category.id, categoryName: category.name, itemId: item.id, itemName: item.name, offer }))));

export const getOfferSecret = async (categoryId, itemId, offerId) => {
  if (!categoryCache.length) await loadCategoriesFromFirebase();
  const offer = rawCategoryById(categoryId)?.items?.find((item) => item.id === String(itemId))?.offers?.find((entry) => entry.id === String(offerId));
  return offer?.secretToken || null;
};

export const updateOffer = async (categoryId, itemId, offerId, updates = {}) => {
  const category = rawCategoryById(categoryId);
  if (!category) throw new Error('القسم غير موجود');
  const item = category.items.find((entry) => entry.id === String(itemId));
  if (!item) throw new Error('المنتج غير موجود');
  const offer = item.offers.find((entry) => entry.id === String(offerId));
  if (!offer) throw new Error('العرض غير موجود');
  const updatedOffer = normalizeOffer({ ...offer, ...updates, id: offer.id, secretToken: offer.secretToken }, item.offers.indexOf(offer));
  const updatedItem = { ...item, offers: item.offers.map((entry) => entry.id === offer.id ? updatedOffer : entry) };
  await saveCategoryToFirebase({ ...category, items: category.items.map((entry) => entry.id === item.id ? updatedItem : entry) });
  return clone(updatedOffer);
};

export const deleteOffer = async (categoryId, itemId, offerId) => {
  const category = rawCategoryById(categoryId);
  if (!category) throw new Error('القسم غير موجود');
  const item = category.items.find((entry) => entry.id === String(itemId));
  if (!item) throw new Error('المنتج غير موجود');
  const updatedItem = { ...item, offers: item.offers.filter((offer) => offer.id !== String(offerId)) };
  await saveCategoryToFirebase({ ...category, items: category.items.map((entry) => entry.id === item.id ? updatedItem : entry) });
  return true;
};

export const renderHomeCategories = async () => (await getAllCategories()).filter((category) => category.enabled !== false);
export const renderCategoryPage = async (id) => id ? getCategoryById(id) : getAllCategories();
export const subscribeCategories = async (listener, onError, options = {}) => (await getDB()).subscribe('categories', (rows) => {
  categoryCache = rows.map(normalizeCategory).sort((a, b) => a.order - b.order);
  persistCache();
  const result = viewCategories(options.includeSecrets === true);
  notify('hud:categories-updated', { categories: result, source: 'realtime' });
  listener(result);
}, onError);

/**
 * HUD COM Refresh API
 * Refresh categories from Supabase with cache busting
 */
export const refreshCategories = async (options = {}) => {
  try {
    // Clear local cache to force cloud fetch
    if (options.clearCache) {
      categoryCache = [];
      try { globalThis.localStorage?.removeItem(STORAGE_KEYS.categories); } catch {}
    }
    const fresh = await loadCategoriesFromFirebase();
    notify('hud:categories-updated', { categories: fresh, source: 'refresh' });
    return fresh;
  } catch (error) {
    console.error('[category-service] refresh failed', error);
    throw error;
  }
};

/**
 * Composite refresh - categories + offers + items
 */
export const refreshAllData = async () => {
  const categories = await refreshCategories({ clearCache: true });
  // trigger global event
  notify('hud:all-data-refreshed', { categories, timestamp: Date.now() });
  return {
    categories,
    itemsCount: categories.reduce((sum, c) => sum + (c.items?.length || 0), 0),
    offersCount: categories.reduce((sum, c) => sum + (c.items || []).reduce((s, i) => s + (i.offers?.length || 0), 0), 0)
  };
};

// Expose to window for legacy / global refresh button
if (typeof globalThis.window !== 'undefined') {
  globalThis.window.refreshCategories = refreshCategories;
  globalThis.window.refreshAllData = refreshAllData;
}

export default Object.freeze({
  loadCategoriesFromFirebase, saveCategoryToFirebase, updateCategory, deleteCategoryFromFirebase,
  getCategory, getAllCategories, getCategoryById, getItemsByCategory, getItemById, updateItem,
  deleteItem, getOffersByItem, getAllOffers, getOfferSecret, updateOffer, deleteOffer,
  renderHomeCategories, renderCategoryPage, subscribeCategories,
  refreshCategories, refreshAllData
});
