import { getDB } from './supabase-client.js';
import { DEFAULT_PRODUCT_FIELDS, DEFAULT_POPUPS, DEFAULT_SITE_SETTINGS } from '../utils/constants.js';
import { STORAGE_KEYS } from '../config/settings.js';
import { safeIconName, safeURL } from '../utils/sanitizers.js';

let siteSettings = { ...DEFAULT_SITE_SETTINGS };
const clone = (value) => JSON.parse(JSON.stringify(value));
const toAvailability = (value) => value === true || value === 1 || value === 'true' || value === '1';
const notify = (name, detail) => {
  if (typeof globalThis.CustomEvent === 'function' && typeof globalThis.dispatchEvent === 'function') {
    globalThis.dispatchEvent(new CustomEvent(name, { detail }));
  }
};

const normalizeSettings = (settings = {}) => ({
  ...clone(DEFAULT_SITE_SETTINGS),
  ...settings,
  adminAvailability: toAvailability(settings.adminAvailability),
  contacts: Array.isArray(settings.contacts) ? settings.contacts.map(normalizeContactEntry) : [],
  contactPlatforms: Array.isArray(settings.contactPlatforms) ? settings.contactPlatforms.map(normalizeContactEntry) : [],
  officialContacts: Array.isArray(settings.officialContacts) ? settings.officialContacts.map(normalizeContactEntry) : []
});

export const applyGlobalSettings = (settings = siteSettings) => ({
  whatsappNumber: settings.whatsappNumber,
  supportNumber: settings.supportNumber,
  whatsappChannel: settings.whatsappChannel,
  currencyMode: settings.currencyMode || 'single',
  activeCurrencies: settings.activeCurrencies || ['YER', 'SAR', 'USD', 'AED'],
  defaultCurrency: settings.defaultCurrency || 'YER',
  adminAvailability: toAvailability(settings.adminAvailability),
  exchangeRates: { YER: 1, SAR: 0.0071, USD: 0.0018, AED: 0.0066, ...(settings.exchangeRates || {}) }
});

export const loadSiteSettings = () => {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEYS.settings) || '{}');
    siteSettings = normalizeSettings(saved);
  } catch (error) {
    console.warn('[settings-service] local load failed', error);
    siteSettings = normalizeSettings();
  }
  return clone(siteSettings);
};

const persistSettings = () => {
  try { globalThis.localStorage?.setItem(STORAGE_KEYS.settings, JSON.stringify(siteSettings)); } catch { /* storage unavailable */ }
};
const commitSettings = async (next, source = 'save') => {
  const db = await getDB();
  // Writing first means an error cannot be misreported as a successful local
  // save that disappears on refresh.
  const saved = normalizeSettings({ ...next, updatedAt: new Date().toISOString() });
  await db.setDocument('settings', 'site', saved);
  siteSettings = saved;
  persistSettings();
  const result = clone(siteSettings);
  notify('hud:site-settings-updated', { settings: result, source });
  return result;
};

export const saveSiteSettings = async (settings = {}, options = {}) => {
  try {
    const patch = { ...settings };
    if (Object.hasOwn(patch, 'adminAvailability')) patch.adminAvailability = toAvailability(patch.adminAvailability);
    const next = normalizeSettings({ ...siteSettings, ...patch });
    if (options.cloud === false) {
      siteSettings = next;
      persistSettings();
      const result = clone(siteSettings);
      notify('hud:site-settings-updated', { settings: result, source: 'local' });
      return result;
    }
    return await commitSettings(next);
  } catch (error) {
    console.error('[settings-service] save failed', error);
    throw error;
  }
};

export const loadSiteSettingsFromFirebase = async () => {
  try {
    const remote = await (await getDB()).getDocument('settings', 'site');
    siteSettings = remote ? normalizeSettings(remote) : loadSiteSettings();
    persistSettings();
    return clone(siteSettings);
  } catch (error) {
    console.error('[settings-service] cloud load failed', error);
    return loadSiteSettings();
  }
};

export const saveSiteSettingsToFirebase = async (settings) => {
  const patch = settings ? { ...settings } : {};
  if (Object.hasOwn(patch, 'adminAvailability')) patch.adminAvailability = toAvailability(patch.adminAvailability);
  return commitSettings(normalizeSettings({ ...siteSettings, ...patch }));
};

export const getSiteSettings = () => clone(siteSettings);

const makeSettingId = (prefix) => {
  const random = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(random);
  else random[0] = Math.floor(Math.random() * 0xffffffff);
  return `${prefix}-${Date.now()}-${random[0].toString(36)}`;
};
const normalizeContactEntry = (entry = {}, index = 0) => ({
  ...entry,
  id: String(entry.id || `contact-${index + 1}`),
  name: String(entry.name || entry.label || 'جهة اتصال').trim().slice(0, 100),
  label: String(entry.label || entry.name || 'جهة اتصال').trim().slice(0, 100),
  type: ['whatsapp', 'phone', 'telegram', 'email', 'link'].includes(entry.type) ? entry.type : 'link',
  value: String(entry.value || '').trim().slice(0, 500),
  icon: safeIconName(entry.icon, 'support'),
  enabled: entry.enabled !== false,
  order: Number.isFinite(Number(entry.order)) ? Math.max(0, Math.round(Number(entry.order))) : index + 1
});
const normalizeCustomField = (field = {}, index = 0) => ({
  ...field,
  id: String(field.id || `field-${index + 1}`),
  name: String(field.name || field.label || 'حقل مخصص').trim().slice(0, 120),
  label: String(field.label || field.name || 'حقل مخصص').trim().slice(0, 120),
  defaultVal: String(field.defaultVal ?? field.value ?? '').trim().slice(0, 2000),
  value: String(field.value ?? field.defaultVal ?? '').trim().slice(0, 2000),
  enabled: field.enabled !== false,
  required: field.required === true,
  order: Number.isFinite(Number(field.order)) ? Math.max(0, Math.round(Number(field.order))) : index + 1
});
const normalizeFeaturedEntry = (entry = {}, index = 0) => ({
  ...entry,
  id: String(entry.id || ''),
  type: entry.type === 'item' ? 'item' : 'offer',
  categoryId: String(entry.categoryId || ''),
  itemId: String(entry.itemId || ''),
  customLabel: String(entry.customLabel ?? entry.label ?? '').trim().slice(0, 120),
  order: Number.isFinite(Number(entry.order)) ? Math.max(0, Math.round(Number(entry.order))) : index + 1
});

const updateSettingsArray = async (key, entries) => saveSiteSettings({ [key]: entries });
export const getContacts = (kind = 'contacts') => clone((siteSettings[kind] || []).map(normalizeContactEntry).sort((a, b) => a.order - b.order));
export const addContact = async (contact, kind = 'contacts') => {
  const entries = getContacts(kind);
  const normalized = normalizeContactEntry({ ...contact, id: contact?.id || makeSettingId('contact') }, entries.length);
  entries.push(normalized);
  await updateSettingsArray(kind, entries);
  return clone(normalized);
};
export const updateContact = async (id, updates, kind = 'contacts') => {
  const entries = getContacts(kind);
  const index = entries.findIndex((entry) => entry.id === String(id));
  if (index < 0) throw new Error('جهة التواصل غير موجودة');
  entries[index] = normalizeContactEntry({ ...entries[index], ...updates, id: entries[index].id }, index);
  await updateSettingsArray(kind, entries);
  return clone(entries[index]);
};
export const deleteContact = async (id, kind = 'contacts') => {
  await updateSettingsArray(kind, getContacts(kind).filter((entry) => entry.id !== String(id)));
  return true;
};
// Official contact numbers are an array, not four hard-coded inputs. This
// retains legacy values while allowing add/remove operations in the panel.
export const getOfficialContacts = () => getContacts('officialContacts');
export const addOfficialContact = async (contact) => addContact(contact, 'officialContacts');
export const updateOfficialContact = async (id, updates) => updateContact(id, updates, 'officialContacts');
export const deleteOfficialContact = async (id) => deleteContact(id, 'officialContacts');

export const getCustomFields = () => clone((siteSettings.customFields || []).map(normalizeCustomField).sort((a, b) => a.order - b.order));
export const addCustomField = async (field) => {
  const entries = getCustomFields();
  const normalized = normalizeCustomField({ ...field, id: field?.id || makeSettingId('field') }, entries.length);
  entries.push(normalized);
  await updateSettingsArray('customFields', entries);
  return clone(normalized);
};
export const updateCustomField = async (id, updates) => {
  const entries = getCustomFields();
  const index = entries.findIndex((entry) => entry.id === String(id));
  if (index < 0) throw new Error('الحقل غير موجود');
  entries[index] = normalizeCustomField({ ...entries[index], ...updates, id: entries[index].id }, index);
  await updateSettingsArray('customFields', entries);
  return clone(entries[index]);
};
export const deleteCustomField = async (id) => {
  await updateSettingsArray('customFields', getCustomFields().filter((entry) => entry.id !== String(id)));
  return true;
};

export const getFeaturedOffers = () => clone((siteSettings.featuredOffers || []).map((entry, index) =>
  typeof entry === 'string' ? normalizeFeaturedEntry({ id: entry, type: 'offer' }, index) : normalizeFeaturedEntry(entry, index)
).filter((entry) => entry.id).sort((a, b) => a.order - b.order));
export const saveFeaturedOffers = async (entries) => {
  const normalized = (entries || []).map(normalizeFeaturedEntry).filter((entry) => entry.id).sort((a, b) => a.order - b.order)
    .map((entry, index) => ({ ...entry, order: index + 1 }));
  await saveSiteSettings({ featuredOffers: normalized });
  return clone(normalized);
};
export const addFeaturedOffer = async (entry) => {
  const entries = getFeaturedOffers();
  const normalized = normalizeFeaturedEntry(entry, entries.length);
  const key = `${normalized.type}:${normalized.id}`;
  if (!entries.some((item) => `${item.type}:${item.id}` === key)) entries.push(normalized);
  return saveFeaturedOffers(entries);
};
export const updateFeaturedOffer = async (type, id, updates) => saveFeaturedOffers(getFeaturedOffers().map((entry) =>
  entry.type === type && entry.id === String(id) ? { ...entry, ...updates, id: entry.id, type: entry.type } : entry));
export const deleteFeaturedOffer = async (type, id) => saveFeaturedOffers(getFeaturedOffers().filter((entry) =>
  !(entry.type === type && entry.id === String(id))));
export const reorderFeaturedOffers = async (orderedKeys) => {
  const map = new Map(getFeaturedOffers().map((entry) => [`${entry.type}:${entry.id}`, entry]));
  return saveFeaturedOffers((orderedKeys || []).map((key) => map.get(key)).filter(Boolean));
};
export const setFeaturedSectionTitle = async (title) => saveSiteSettings({
  featuredSectionTitle: String(title || 'العروض المميزة').trim().slice(0, 120) || 'العروض المميزة'
});

const normalizeSupportType = (type, value = '') => {
  const normalized = String(type || '').toLowerCase();
  if (['whatsapp', 'wa'].includes(normalized)) return 'whatsapp';
  if (['phone', 'tel', 'call'].includes(normalized)) return 'phone';
  if (['telegram', 'tg'].includes(normalized)) return 'telegram';
  if (['email', 'mail'].includes(normalized)) return 'email';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(String(value).trim())) return 'email';
  if (/^\+?[\d\s()-]{7,}$/u.test(String(value).trim())) return 'phone';
  return 'link';
};
const buildSupportHref = (type, value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/gu, '');
  if (type === 'whatsapp') return digits ? `https://wa.me/${digits}` : '';
  if (type === 'phone') return digits ? `tel:+${digits}` : '';
  if (type === 'email') return `mailto:${raw.replace(/^mailto:/iu, '')}`;
  if (type === 'telegram') return /^(?:https?:\/\/|tg:\/\/)/iu.test(raw) ? safeURL(raw, '') : `https://t.me/${raw.replace(/^@/u, '')}`;
  if (/^\d{7,}$/u.test(raw)) return `https://wa.me/${raw}`;
  return safeURL(raw, '');
};
const supportDescriptionKey = (type) => `support_description_${type}`;
const supportIcon = (type, requestedIcon) => safeIconName(requestedIcon, ({
  whatsapp: 'whatsapp', phone: 'phone', telegram: 'telegram', email: 'send', link: 'globe'
})[type] || 'support');

export const getSupportChannels = (settings = siteSettings) => {
  const channels = [];
  const seen = new Set();
  const addChannel = ({ label, icon, type, value, source, description }) => {
    const normalizedType = normalizeSupportType(type, value);
    const href = buildSupportHref(normalizedType, value);
    if (!href || href === '#') return;
    const identity = href.toLowerCase().replace(/\/$/u, '');
    if (seen.has(identity)) return;
    seen.add(identity);
    channels.push({
      id: `support-${channels.length + 1}`,
      label: String(label || '').trim() || `support_channel_${normalizedType}`,
      labelIsKey: !String(label || '').trim(),
      icon: supportIcon(normalizedType, icon),
      type: normalizedType,
      value: String(value || '').trim(),
      href,
      source: source || 'official',
      description: description || supportDescriptionKey(normalizedType),
      opensNewTab: ['whatsapp', 'telegram', 'link'].includes(normalizedType)
    });
  };
  const addEntries = (entries, source) => (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry?.enabled !== false)
    .forEach((entry) => addChannel({ label: entry.label || entry.name, icon: entry.icon, type: entry.type, value: entry.value, source }));
  addEntries(settings.contactPlatforms, 'platforms');
  addEntries(settings.contacts, 'contacts');
  addEntries(settings.officialContacts, 'official');
  (Array.isArray(settings.aboutLines) ? settings.aboutLines : []).forEach((line) => addChannel({
    label: line?.label, icon: 'phone', type: normalizeSupportType(line?.type, line?.value), value: line?.value, source: 'about'
  }));
  addChannel({ label: '', icon: 'whatsapp', type: 'whatsapp', value: settings.whatsappNumber, source: 'legacy-official' });
  addChannel({ label: '', icon: 'phone', type: 'phone', value: settings.supportNumber, source: 'legacy-official' });
  addChannel({ label: '', icon: 'broadcast', type: 'link', value: settings.whatsappChannel, source: 'legacy-official' });
  return channels;
};

export const getProductFields = (item) => {
  if (Array.isArray(item?.customFields) && item.customFields.length) return clone(item.customFields);
  if (Array.isArray(siteSettings.customFields) && siteSettings.customFields.length) {
    return siteSettings.customFields.filter((field) => field.enabled !== false).map((field, index) => ({
      id: field.id || `custom-${index}`,
      label: field.label || field.name || 'حقل مخصص',
      type: field.type || 'text',
      required: field.required !== false,
      placeholder: field.placeholder || field.defaultVal || ''
    }));
  }
  return clone(DEFAULT_PRODUCT_FIELDS);
};
export const getOfferPopups = (item, offer) => {
  if (Array.isArray(offer?.popups) && offer.popups.length) return clone(offer.popups);
  if (Array.isArray(item?.popups) && item.popups.length) return clone(item.popups);
  if (Array.isArray(siteSettings.defaultPopups) && siteSettings.defaultPopups.length) return clone(siteSettings.defaultPopups);
  return clone(DEFAULT_POPUPS);
};
export const renderDynamicContacts = () => getContacts('contacts').filter((contact) => contact.enabled !== false);
export const renderFeaturedOffers = (categories = []) => getFeaturedOffers().map((featured) => {
  const category = featured.categoryId ? categories.find((entry) => entry.id === featured.categoryId) : null;
  for (const currentCategory of category ? [category] : categories) {
    for (const item of currentCategory.items || []) {
      if (featured.type === 'item' && item.id === featured.id) {
        const firstOffer = item.offers?.[0] || {};
        return { ...firstOffer, ...item, id: item.id, itemId: item.id, itemName: featured.customLabel || item.name, categoryId: currentCategory.id, featured };
      }
      const offer = (item.offers || []).find((entry) => entry.id === featured.id);
      if (featured.type === 'offer' && offer) return { ...offer, itemId: item.id, itemName: featured.customLabel || offer.name || item.name, categoryId: currentCategory.id, featured };
    }
  }
  return null;
}).filter(Boolean);
export const renderHomeCustomFields = () => (siteSettings.customFields || []).filter((field) => field.enabled !== false).map((field) => ({ ...field }));
export const renderHoodAbout = () => ({ enabled: siteSettings.aboutEnabled !== false, title: siteSettings.aboutTitle || siteSettings.storeName, text: siteSettings.aboutText || '', position: siteSettings.aboutPosition || 'middle', lines: clone(siteSettings.aboutLines || []) });
export const renderContactPlatforms = () => ({ enabled: siteSettings.contactPlatformsEnabled !== false, title: siteSettings.contactPlatformsTitle || 'تواصل معنا', platforms: getContacts('contactPlatforms').filter((platform) => platform.enabled !== false) });

export const subscribeSiteSettings = async (listener, onError) => {
  const db = await getDB();
  return db.subscribe('settings', (rows) => {
    const remote = rows.find((row) => row.id === 'site');
    if (!remote) return;
    siteSettings = normalizeSettings(remote);
    persistSettings();
    const result = clone(siteSettings);
    notify('hud:site-settings-updated', { settings: result, source: 'realtime' });
    listener(result);
  }, onError);
};
export const subscribeAdminAvailability = async (listener, onError) => subscribeSiteSettings(
  (settings) => listener(toAvailability(settings.adminAvailability), settings), onError
);

/**
 * HUD COM - Settings Refresh
 */
export const refreshSettings = async (options = {}) => {
  try {
    if (options.clearCache) {
      try { globalThis.localStorage?.removeItem(STORAGE_KEYS.settings); } catch {}
      siteSettings = { ...DEFAULT_SITE_SETTINGS };
    }
    const fresh = await loadSiteSettingsFromFirebase();
    notify('hud:site-settings-updated', { settings: fresh, source: 'refresh' });
    if (typeof globalThis.window !== 'undefined') {
      globalThis.dispatchEvent?.(new CustomEvent('hud:settings-refreshed', { detail: fresh }));
    }
    return fresh;
  } catch (error) {
    console.error('[settings-service] refresh failed', error);
    throw error;
  }
};

if (typeof globalThis.window !== 'undefined') {
  globalThis.window.refreshSettings = refreshSettings;
}

loadSiteSettings();

export default Object.freeze({
  loadSiteSettingsFromFirebase, saveSiteSettingsToFirebase, applyGlobalSettings, saveSiteSettings,
  loadSiteSettings, getSiteSettings, getContacts, addContact, updateContact, deleteContact,
  getOfficialContacts, addOfficialContact, updateOfficialContact, deleteOfficialContact,
  getCustomFields, addCustomField, updateCustomField, deleteCustomField,
  getFeaturedOffers, saveFeaturedOffers, addFeaturedOffer, updateFeaturedOffer, deleteFeaturedOffer,
  reorderFeaturedOffers, setFeaturedSectionTitle, getSupportChannels, getProductFields, getOfferPopups,
  renderDynamicContacts, renderFeaturedOffers, renderHomeCustomFields, renderHoodAbout,
  renderContactPlatforms, subscribeSiteSettings, subscribeAdminAvailability,
  refreshSettings
});
