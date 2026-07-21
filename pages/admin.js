import { initCommonPage } from './common.js';
import {
  hasAdminSession, checkAdminSession, clearAdminSession, deleteUserAccount,
  setUserVerificationStatus, subscribeUsersForAdmin, updateUserAccountStatus, updateUserProfileForAdmin
} from '../services/auth-service.js';
import {
  getAllCategories, saveCategoryToFirebase, updateCategory, deleteCategoryFromFirebase,
  updateItem, deleteItem, updateOffer, deleteOffer, subscribeCategories
} from '../services/category-service.js';
import { loadWalletsFromFirebase, getAllWallets, addWallet, updateWallet, deleteWallet } from '../services/wallet-service.js';
import {
  loadSiteSettingsFromFirebase, saveSiteSettings, getSiteSettings, subscribeSiteSettings,
  getContacts, addContact, updateContact, deleteContact, getOfficialContacts, addOfficialContact,
  updateOfficialContact, deleteOfficialContact, getCustomFields, addCustomField, updateCustomField,
  deleteCustomField, getFeaturedOffers, addFeaturedOffer, updateFeaturedOffer, deleteFeaturedOffer,
  reorderFeaturedOffers, setFeaturedSectionTitle
} from '../services/settings-service.js';
import { loadReviewsOnce, saveReviewEdit, toggleReviewHidden, deleteReview } from '../services/review-service.js';
import {
  adminSetUserBalance, getTopupServices, getTopupSettings, getTopupTransactions,
  loadTopupServicesFromCloud, loadTopupSettingsFromCloud, loadTopupTransactionsFromCloud,
  saveTopupService, saveTopupSettings, deleteTopupService, subscribeTopupServices,
  subscribeTopupSettings, subscribeTopupTransactions, updateTopupTransactionStatus
} from '../services/balance-service.js';
import { confirmOrder, getAllOrdersForAdmin, rejectOrder, subscribeOrdersForAdmin, updateOrderStatus } from '../services/order-service.js';
import { decideRequest, listPendingForAdmin, requestNotificationPermission, systemNotify } from '../services/workflow-service.js';
import { migrateAllImages } from '../services/image-storage-service.js';
import { escapeAttr, escapeHTML, sanitizeBoolean, sanitizeInput, sanitizeNumber } from '../utils/sanitizers.js';
import { formatDate, formatPrice, formatStatus } from '../utils/formatters.js';
import { bindImagePreview, compressImageFile, injectIcons, showToast } from '../utils/dom-utils.js';

let categories = [];
let wallets = [];
let settings = {};
let reviews = [];
let customers = [];
let orders = [];
let activeServiceType = 'deposit';
let pendingEditorSave = null;
let draggedFeaturedKey = null;
let subscriptions = [];

const byId = (id) => document.getElementById(id);
const createId = (prefix) => {
  const random = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(random);
  else random[0] = Math.floor(Math.random() * 0xffffffff);
  return `${prefix}-${Date.now()}-${random[0].toString(36)}`;
};
const setText = (id, value) => { const target = byId(id); if (target) target.textContent = String(value ?? ''); };
const fieldValue = (root, selector) => root?.querySelector(selector)?.value?.trim() || '';
const checked = (root, selector) => Boolean(root?.querySelector(selector)?.checked);
const buttonFor = (event, selector) => event.submitter || event.currentTarget?.querySelector(selector) || null;
const selectOptions = (values, selected) => values.map(([value, label]) =>
  `<option value="${escapeAttr(value)}"${value === selected ? ' selected' : ''}>${escapeHTML(label)}</option>`).join('');
const statusOptions = (selected = 'available') => selectOptions([
  ['available', 'متوفر'], ['unavailable', 'غير متوفر'], ['coming_soon', 'قريباً']
], selected);
const currencyOptions = (selected = 'YER') => selectOptions([
  ['YER', 'ريال يمني'], ['SAR', 'ريال سعودي'], ['USD', 'دولار أمريكي'], ['AED', 'درهم إماراتي']
], selected);
const contactTypeOptions = (selected = 'link') => selectOptions([
  ['whatsapp', 'واتساب'], ['phone', 'اتصال'], ['telegram', 'تلجرام'], ['email', 'بريد إلكتروني'], ['link', 'رابط']
], selected);

/** Gives every write a visible, idempotent saving state. */
export const showSavingIndicator = (button) => {
  if (!button || button.dataset.saving === 'true') return null;
  const originalHTML = button.innerHTML;
  const originalDisabled = button.disabled;
  button.dataset.saving = 'true';
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>جاري الحفظ...</span>';
  return {
    restore: () => {
      button.disabled = originalDisabled;
      button.removeAttribute('aria-busy');
      delete button.dataset.saving;
      button.innerHTML = originalHTML;
      injectIcons(button);
    }
  };
};

/** Wraps a remote save, prevents repeat clicks, and exposes actionable errors. */
export const saveWithFeedback = async (saveFunction, button, ...args) => {
  const indicator = showSavingIndicator(button);
  if (!indicator) return null;
  try {
    const result = await saveFunction(...args);
    showToast('تم الحفظ بنجاح ✅', 'success');
    return result;
  } catch (error) {
    const message = sanitizeInput(error?.message || String(error) || 'خطأ غير معروف', 300);
    showToast(`تعذر الحفظ: ${message}`, 'error', { sticky: true });
    throw error;
  } finally {
    indicator.restore();
  }
};

const saveAction = async (button, operation, successMessage = 'تم الحفظ بنجاح ✅') => {
  const indicator = showSavingIndicator(button);
  if (!indicator) return null;
  try {
    const result = await operation();
    showToast(successMessage, 'success');
    return result;
  } catch (error) {
    console.error('[admin] save failed', error);
    showToast(`تعذر الحفظ: ${sanitizeInput(error?.message || String(error), 300)}`, 'error', { sticky: true });
    throw error;
  } finally { indicator.restore(); }
};

const findCategory = (categoryId) => categories.find((category) => category.id === String(categoryId)) || null;
const findItem = (itemId, categoryId) => {
  const source = categoryId ? [findCategory(categoryId)].filter(Boolean) : categories;
  for (const category of source) {
    const item = (category.items || []).find((entry) => entry.id === String(itemId));
    if (item) return { category, item };
  }
  return null;
};
const findOffer = (categoryId, itemId, offerId) => {
  const found = findItem(itemId, categoryId);
  const offer = found?.item?.offers?.find((entry) => entry.id === String(offerId));
  return offer ? { ...found, offer } : null;
};
const allOfferRecords = () => categories.flatMap((category) => (category.items || []).flatMap((item) =>
  (item.offers || []).map((offer) => ({ category, item, offer }))));

const copyText = async (value) => {
  const text = String(value || '');
  if (!text) throw new Error('لا توجد قيمة للنسخ');
  if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
  else {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    if (!document.execCommand('copy')) throw new Error('تعذر النسخ إلى الحافظة');
    input.remove();
  }
  showToast('تم نسخ الرمز السري ✅', 'success');
};
const secretTokenMarkup = (token) => token ? `<div class="secret-token-container"><code class="secret-token">${escapeHTML(token)}</code><button type="button" class="btn btn-sm btn-outline copy-btn" data-admin-action="copy-token" data-token="${escapeAttr(token)}" aria-label="نسخ الرمز">نسخ</button></div>` : '<small>سيُنشأ تلقائياً عند الحفظ</small>';

const imageEditor = (id, currentImage = '', label = 'الصورة') => `<div class="form-group admin-image-editor">
  <label class="form-label" for="${escapeAttr(id)}Input">${escapeHTML(label)}</label>
  <div class="admin-image-preview-wrap">
    <img id="${escapeAttr(id)}Preview" class="admin-image-preview" src="${escapeAttr(currentImage)}" data-image-value="${escapeAttr(currentImage)}" alt=""${currentImage ? '' : ' hidden'}>
    <div class="admin-image-placeholder"${currentImage ? ' hidden' : ''}>لا توجد صورة</div>
  </div>
  <input type="file" id="${escapeAttr(id)}Input" class="form-input admin-edit-image-input" accept="image/*" data-preview-id="${escapeAttr(id)}Preview">
  <button type="button" class="btn btn-sm btn-dark" data-editor-action="clear-image" data-preview-id="${escapeAttr(id)}Preview">إزالة الصورة</button>
</div>`;
const imageValue = (root, previewId, fallback = '') => {
  // Compatibility: CSS.escape may not exist in older browsers, fallback to getElementById
  try {
    const esc = globalThis.CSS?.escape ? globalThis.CSS.escape(previewId) : previewId.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    return root?.querySelector(`#${esc}`)?.dataset.imageValue ?? document.getElementById(previewId)?.dataset.imageValue ?? fallback;
  } catch {
    return root?.querySelector(`#${previewId}`)?.dataset.imageValue ?? document.getElementById(previewId)?.dataset.imageValue ?? fallback;
  }
};

const dynamicFieldRow = (field = {}, index = 0) => `<div class="admin-editor-row" data-dynamic-field-id="${escapeAttr(field.id || createId('field'))}">
  <div class="admin-editor-grid">
    <label>اسم الحقل<input class="form-input" data-field-prop="label" value="${escapeAttr(field.label || field.name || '')}" required></label>
    <label>النوع<select class="form-input" data-field-prop="type">${selectOptions([
      ['text', 'نص'], ['number', 'رقم'], ['tel', 'هاتف'], ['email', 'بريد'], ['textarea', 'نص طويل'], ['select', 'قائمة'], ['file', 'ملف']
    ], field.type || 'text')}</select></label>
    <label class="admin-editor-span-2">النص التوضيحي<input class="form-input" data-field-prop="placeholder" value="${escapeAttr(field.placeholder || '')}"></label>
    <label class="admin-editor-span-2">خيارات القائمة (بفواصل)<input class="form-input" data-field-prop="options" value="${escapeAttr((field.options || []).join(', '))}"></label>
    <label>الترتيب<input type="number" class="form-input" data-field-prop="order" min="0" value="${Number(field.order ?? index + 1)}"></label>
    <label class="admin-check"><input type="checkbox" data-field-prop="required"${field.required ? ' checked' : ''}> مطلوب</label>
  </div>
  <button type="button" class="admin-row-remove" data-editor-action="remove-row">حذف الحقل</button>
</div>`;
const popupRow = (popup = {}, index = 0) => `<div class="admin-editor-row" data-popup-id="${escapeAttr(popup.id || createId('popup'))}">
  <div class="admin-editor-grid">
    <label>العنوان<input class="form-input" data-popup-prop="title" value="${escapeAttr(popup.title || '')}"></label>
    <label>النوع<select class="form-input" data-popup-prop="type">${selectOptions([['info', 'معلومة'], ['warning', 'تنبيه'], ['success', 'نجاح'], ['danger', 'خطر']], popup.type || 'info')}</select></label>
    <label class="admin-editor-span-2">المحتوى<textarea class="form-input" data-popup-prop="content" rows="3">${escapeHTML(popup.content || '')}</textarea></label>
    <label>نص الزر<input class="form-input" data-popup-prop="buttonText" value="${escapeAttr(popup.buttonText || '')}"></label>
    <label>الترتيب<input type="number" class="form-input" data-popup-prop="order" min="0" value="${Number(popup.order ?? index + 1)}"></label>
  </div>
  <button type="button" class="admin-row-remove" data-editor-action="remove-row">حذف التنبيه</button>
</div>`;
const collectDynamicFields = (root) => [...root.querySelectorAll('[data-dynamic-field-id]')].map((row, index) => ({
  id: row.dataset.dynamicFieldId,
  label: fieldValue(row, '[data-field-prop="label"]'),
  type: fieldValue(row, '[data-field-prop="type"]') || 'text',
  placeholder: fieldValue(row, '[data-field-prop="placeholder"]'),
  options: fieldValue(row, '[data-field-prop="options"]').split(',').map((option) => sanitizeInput(option, 100)).filter(Boolean),
  order: sanitizeNumber(fieldValue(row, '[data-field-prop="order"]'), { min: 0, integer: true, fallback: index + 1 }),
  required: checked(row, '[data-field-prop="required"]')
}));
const collectPopups = (root) => [...root.querySelectorAll('[data-popup-id]')].map((row, index) => ({
  id: row.dataset.popupId,
  title: fieldValue(row, '[data-popup-prop="title"]'),
  content: fieldValue(row, '[data-popup-prop="content"]'),
  type: fieldValue(row, '[data-popup-prop="type"]') || 'info',
  buttonText: fieldValue(row, '[data-popup-prop="buttonText"]'),
  order: sanitizeNumber(fieldValue(row, '[data-popup-prop="order"]'), { min: 0, integer: true, fallback: index + 1 })
}));

const closeEditModal = () => {
  const modal = byId('editModal');
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('admin-editor-open');
  pendingEditorSave = null;
};
const openEditModal = (title, body, onSave) => {
  setText('editModalTitle', title);
  byId('editModalBody').innerHTML = `<form id="adminEditForm" class="admin-edit-form">${body}</form>`;
  pendingEditorSave = onSave;
  const modal = byId('editModal');
  modal?.classList.add('open');
  modal?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('admin-editor-open');
  injectIcons(modal);
  modal?.querySelector('input, textarea, select')?.focus();
};

export const editCategoryModal = (categoryId) => {
  const category = findCategory(categoryId); if (!category) return;
  openEditModal('تعديل القسم', `<div class="admin-editor-grid">
    <label>اسم القسم<input class="form-input" name="name" value="${escapeAttr(category.name)}" required maxlength="120"></label>
    <label>الترتيب<input type="number" class="form-input" name="order" min="0" value="${Number(category.order || 0)}"></label>
    <label class="admin-editor-span-2">الوصف<textarea class="form-input" name="description" rows="4" maxlength="1000">${escapeHTML(category.description || '')}</textarea></label>
  </div>${imageEditor('editCategoryImage', category.image, 'صورة القسم')}`, async (form) => {
    await updateCategory(category.id, {
      name: sanitizeInput(form.elements.name.value, 120), description: sanitizeInput(form.elements.description.value, 1000),
      order: sanitizeNumber(form.elements.order.value, { min: 0, integer: true }), image: imageValue(form, 'editCategoryImagePreview', category.image)
    });
    await refreshCategories();
  });
};
export const editItemModal = (categoryId, itemId) => {
  const found = findItem(itemId, categoryId); if (!found) return;
  const { category, item } = found;
  openEditModal('تعديل المنتج', `<div class="admin-editor-grid">
    <label>اسم المنتج<input class="form-input" name="name" value="${escapeAttr(item.name)}" required maxlength="150"></label>
    <label>الحالة<select class="form-input" name="status">${statusOptions(item.status)}</select></label>
    <label>الترتيب<input type="number" class="form-input" name="order" min="0" value="${Number(item.order || 0)}"></label>
    <label class="admin-editor-span-2">الوصف<textarea class="form-input" name="description" rows="4">${escapeHTML(item.description || '')}</textarea></label>
  </div>${imageEditor('editItemImage', item.image, 'صورة المنتج')}
  <div class="admin-editor-section"><div class="admin-editor-section-head"><h4>الحقول الديناميكية</h4><button type="button" class="btn btn-sm btn-outline" data-editor-action="add-field">+ حقل</button></div><div id="editItemFields">${(item.customFields || []).map(dynamicFieldRow).join('')}</div></div>`, async (form) => {
    await updateItem(category.id, item.id, {
      name: sanitizeInput(form.elements.name.value, 150), description: sanitizeInput(form.elements.description.value, 1500),
      status: form.elements.status.value, order: sanitizeNumber(form.elements.order.value, { min: 0, integer: true }),
      image: imageValue(form, 'editItemImagePreview', item.image), customFields: collectDynamicFields(form)
    });
    await refreshCategories();
  });
};
export const editOfferModal = (categoryId, itemId, offerId) => {
  const found = findOffer(categoryId, itemId, offerId); if (!found) return;
  const { category, item, offer } = found;
  openEditModal('تعديل العرض', `<div class="admin-editor-grid">
    <label>اسم العرض<input class="form-input" name="name" value="${escapeAttr(offer.name)}" required maxlength="150"></label>
    <label>الحالة<select class="form-input" name="status">${statusOptions(offer.status)}</select></label>
    <label>السعر<input type="number" class="form-input" name="price" min="0" step="0.01" value="${Number(offer.price || 0)}" required></label>
    <label>السعر القديم<input type="number" class="form-input" name="oldPrice" min="0" step="0.01" value="${Number(offer.oldPrice || 0)}"></label>
    <label>العملة<select class="form-input" name="currency">${currencyOptions(offer.currency)}</select></label>
    <label>الترتيب<input type="number" class="form-input" name="order" min="0" value="${Number(offer.order || 0)}"></label>
    <label class="admin-editor-span-2">الوصف<textarea class="form-input" name="description" rows="4">${escapeHTML(offer.description || '')}</textarea></label>
  </div>${imageEditor('editOfferImage', offer.image, 'صورة العرض')}
  <div class="admin-secret-panel"><strong>رمز العرض السري (للمدير فقط)</strong>${secretTokenMarkup(offer.secretToken)}</div>
  <div class="admin-editor-section"><div class="admin-editor-section-head"><h4>تنبيهات العرض قبل الشراء</h4><button type="button" class="btn btn-sm btn-outline" data-editor-action="add-popup">+ تنبيه</button></div><div id="editOfferPopups">${(offer.popups || []).map(popupRow).join('')}</div></div>`, async (form) => {
    await updateOffer(category.id, item.id, offer.id, {
      name: sanitizeInput(form.elements.name.value, 150), description: sanitizeInput(form.elements.description.value, 1000),
      price: sanitizeNumber(form.elements.price.value, { min: 0 }), oldPrice: sanitizeNumber(form.elements.oldPrice.value, { min: 0 }),
      currency: form.elements.currency.value, status: form.elements.status.value,
      order: sanitizeNumber(form.elements.order.value, { min: 0, integer: true }), image: imageValue(form, 'editOfferImagePreview', offer.image),
      popups: collectPopups(form)
    });
    await refreshCategories();
  });
};
export const editWalletModal = (walletId) => {
  const wallet = wallets.find((entry) => entry.id === String(walletId)); if (!wallet) return;
  openEditModal('تعديل المحفظة', `<div class="admin-editor-grid">
    <label>اسم المحفظة<input class="form-input" name="name" value="${escapeAttr(wallet.name)}" required></label>
    <label>رقم الحساب<input class="form-input" name="number" value="${escapeAttr(wallet.number || '')}" dir="ltr"></label>
    <label>الترتيب<input type="number" class="form-input" name="order" value="${Number(wallet.order || 0)}"></label>
    <label class="admin-check"><input type="checkbox" name="enabled"${wallet.enabled !== false ? ' checked' : ''}> المحفظة مفعلة</label>
  </div>${imageEditor('editWalletImage', wallet.image, 'صورة المحفظة')}`, async (form) => {
    await updateWallet(wallet.id, { name: sanitizeInput(form.elements.name.value, 100), number: sanitizeInput(form.elements.number.value, 100),
      order: sanitizeNumber(form.elements.order.value, { min: 0, integer: true }), enabled: form.elements.enabled.checked,
      image: imageValue(form, 'editWalletImagePreview', wallet.image) });
    await refreshWallets();
  });
};
export const editContactModal = (contactId, kind = 'contacts') => {
  const contact = getContacts(kind).find((entry) => entry.id === String(contactId));
  const isNew = !contact;
  const current = contact || { name: '', type: 'whatsapp', value: '', icon: 'support', enabled: true, order: getContacts(kind).length + 1 };
  openEditModal(isNew ? 'إضافة جهة تواصل' : 'تعديل جهة التواصل', `<div class="admin-editor-grid">
    <label>الاسم<input class="form-input" name="name" value="${escapeAttr(current.name || current.label || '')}" required></label>
    <label>النوع<select class="form-input" name="type">${contactTypeOptions(current.type)}</select></label>
    <label class="admin-editor-span-2">القيمة<input class="form-input" name="value" value="${escapeAttr(current.value || '')}" required dir="ltr"></label>
    <label>الأيقونة<input class="form-input" name="icon" value="${escapeAttr(current.icon || 'support')}"></label>
    <label>الترتيب<input type="number" class="form-input" name="order" value="${Number(current.order || 0)}"></label>
    <label class="admin-check"><input type="checkbox" name="enabled"${current.enabled !== false ? ' checked' : ''}> مفعل</label>
  </div>`, async (form) => {
    const payload = { name: sanitizeInput(form.elements.name.value, 100), label: sanitizeInput(form.elements.name.value, 100), type: form.elements.type.value,
      value: sanitizeInput(form.elements.value.value, 500), icon: sanitizeInput(form.elements.icon.value, 50), enabled: form.elements.enabled.checked,
      order: sanitizeNumber(form.elements.order.value, { min: 0, integer: true }) };
    if (kind === 'officialContacts') {
      if (isNew) await addOfficialContact(payload); else await updateOfficialContact(current.id, payload);
    } else if (isNew) await addContact(payload, kind); else await updateContact(current.id, payload, kind);
    refreshSettings();
  });
};
export const editFieldModal = (fieldId) => {
  const field = getCustomFields().find((entry) => entry.id === String(fieldId));
  const isNew = !field;
  const current = field || { name: '', defaultVal: '', enabled: true, required: false, order: getCustomFields().length + 1 };
  openEditModal(isNew ? 'إضافة حقل مخصص' : 'تعديل الحقل المخصص', `<div class="admin-editor-grid">
    <label>اسم الحقل<input class="form-input" name="name" value="${escapeAttr(current.name || current.label || '')}" required></label>
    <label>الترتيب<input type="number" class="form-input" name="order" value="${Number(current.order || 0)}"></label>
    <label class="admin-editor-span-2">القيمة<textarea class="form-input" name="defaultVal" rows="3">${escapeHTML(current.defaultVal || '')}</textarea></label>
    <label class="admin-check"><input type="checkbox" name="enabled"${current.enabled !== false ? ' checked' : ''}> مفعل</label>
    <label class="admin-check"><input type="checkbox" name="required"${current.required ? ' checked' : ''}> مطلوب</label>
  </div>`, async (form) => {
    const payload = { name: sanitizeInput(form.elements.name.value, 120), label: sanitizeInput(form.elements.name.value, 120),
      defaultVal: sanitizeInput(form.elements.defaultVal.value, 2000), enabled: form.elements.enabled.checked,
      required: form.elements.required.checked, order: sanitizeNumber(form.elements.order.value, { min: 0, integer: true }) };
    if (isNew) await addCustomField(payload); else await updateCustomField(current.id, payload);
    refreshSettings();
  });
};
export const editFeaturedModal = (type, id) => {
  const featured = getFeaturedOffers().find((entry) => entry.type === type && entry.id === String(id)); if (!featured) return;
  openEditModal('تعديل العرض المميز', `<div class="admin-editor-grid">
    <label class="admin-editor-span-2">الاسم المعروض<input class="form-input" name="customLabel" value="${escapeAttr(featured.customLabel || '')}" placeholder="اتركه فارغاً لاستخدام الاسم الأصلي"></label>
    <label>الترتيب<input type="number" class="form-input" name="order" min="1" value="${Number(featured.order || 1)}"></label>
  </div>`, async (form) => {
    await updateFeaturedOffer(featured.type, featured.id, { customLabel: sanitizeInput(form.elements.customLabel.value, 120), order: sanitizeNumber(form.elements.order.value, { min: 1, integer: true }) });
    refreshSettings();
  });
};
export const editReviewModal = (reviewId) => {
  const review = reviews.find((entry) => entry.id === String(reviewId)); if (!review) return;
  openEditModal('تعديل التعليق', `<div class="admin-editor-grid">
    <label>الاسم<input class="form-input" name="name" value="${escapeAttr(review.name || '')}" required></label>
    <label>التقييم<input type="number" class="form-input" name="rating" min="1" max="5" value="${Number(review.rating || 5)}"></label>
    <label class="admin-editor-span-2">المحتوى<textarea class="form-input" name="message" rows="5" required>${escapeHTML(review.message || '')}</textarea></label>
    <label class="admin-check"><input type="checkbox" name="hidden"${review.hidden ? ' checked' : ''}> مخفي</label>
  </div>`, async (form) => {
    await saveReviewEdit(review.id, { name: sanitizeInput(form.elements.name.value, 50), message: sanitizeInput(form.elements.message.value, 500),
      rating: sanitizeNumber(form.elements.rating.value, { min: 1, max: 5, integer: true, fallback: 5 }), hidden: form.elements.hidden.checked });
    await refreshReviews();
  });
};
const editServiceModal = (serviceId) => {
  const service = getTopupServices().find((entry) => entry.id === String(serviceId)); if (!service) return;
  openEditModal('تعديل خدمة التغذية/الاسترداد', `<div class="admin-editor-grid">
    <label>اسم الخدمة<input class="form-input" name="name" value="${escapeAttr(service.name)}" required></label>
    <label>النوع<select class="form-input" name="type">${selectOptions([['deposit', 'تغذية'], ['withdraw', 'استرداد']], service.type)}</select></label>
    <label>الترتيب<input type="number" class="form-input" name="order" min="1" value="${Number(service.order || 1)}"></label>
    <label class="admin-check"><input type="checkbox" name="enabled"${service.enabled !== false ? ' checked' : ''}> مفعلة للمستخدمين</label>
    <label class="admin-editor-span-2">الوصف<textarea class="form-input" name="description" rows="3">${escapeHTML(service.description || '')}</textarea></label>
  </div>${imageEditor('editServiceImage', service.image, 'صورة الخدمة')}
  <div class="admin-editor-section"><div class="admin-editor-section-head"><h4>حقول النموذج</h4><button type="button" class="btn btn-sm btn-outline" data-editor-action="add-service-field">+ حقل</button></div><div id="editServiceFields">${(service.customFields || []).map(dynamicFieldRow).join('')}</div></div>`, async (form) => {
    await saveTopupService({ ...service, name: sanitizeInput(form.elements.name.value, 100), type: form.elements.type.value,
      order: sanitizeNumber(form.elements.order.value, { min: 1, integer: true }), enabled: form.elements.enabled.checked,
      description: sanitizeInput(form.elements.description.value, 1000), image: imageValue(form, 'editServiceImagePreview', service.image), customFields: collectDynamicFields(form) });
    renderTopup();
  });
};

const renderCategories = () => {
  const target = byId('categoriesList'); if (!target) return;
  target.innerHTML = categories.map((category) => `<article class="admin-list-item"><div class="admin-list-media">${category.image ? `<img src="${escapeAttr(category.image)}" alt="">` : ''}</div><div class="admin-list-content"><strong>${escapeHTML(category.name)}</strong><p>${escapeHTML(category.description || '')}</p><small>الترتيب: ${category.order || 0} — ${category.items?.length || 0} منتج</small></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-category" data-category-id="${escapeAttr(category.id)}">تعديل</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-category" data-category-id="${escapeAttr(category.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">لا توجد أقسام</div>';
};
const renderItems = () => {
  const target = byId('itemsList');
  if (target) target.innerHTML = categories.flatMap((category) => (category.items || []).map((item) => `<article class="admin-list-item"><div class="admin-list-media">${item.image ? `<img src="${escapeAttr(item.image)}" alt="">` : ''}</div><div class="admin-list-content"><strong>${escapeHTML(item.name)}</strong><p>${escapeHTML(item.description || '')}</p><small>${escapeHTML(category.name)} — ${escapeHTML(formatStatus(item.status))} — ${(item.customFields || []).length} حقل</small></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-item" data-category-id="${escapeAttr(category.id)}" data-item-id="${escapeAttr(item.id)}">تعديل</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-item" data-category-id="${escapeAttr(category.id)}" data-item-id="${escapeAttr(item.id)}">حذف</button></div></article>`)).join('') || '<div class="empty-state">لا توجد منتجات</div>';
  const select = byId('addItemCategory');
  if (select) { select.replaceChildren(new Option('-- اختر القسم --', '')); categories.forEach((category) => select.add(new Option(category.name, category.id))); }
};
const renderOffers = () => {
  const target = byId('offersList'); const select = byId('addOfferItem'); const records = allOfferRecords();
  if (target) target.innerHTML = records.map(({ category, item, offer }) => `<article class="admin-list-item"><div class="admin-list-media">${offer.image ? `<img src="${escapeAttr(offer.image)}" alt="">` : ''}</div><div class="admin-list-content"><strong>${escapeHTML(offer.name)}</strong><p>${escapeHTML(offer.description || '')}</p><small>${escapeHTML(item.name)} — ${formatPrice(offer.price || 0, offer.currency || 'YER')} — ${escapeHTML(formatStatus(offer.status))}</small><small class="admin-secret-inline">رمز العرض: ${escapeHTML(offer.secretToken || '')}</small></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="copy-token" data-token="${escapeAttr(offer.secretToken || '')}">نسخ الرمز</button><button type="button" class="btn btn-sm" data-admin-action="edit-offer" data-category-id="${escapeAttr(category.id)}" data-item-id="${escapeAttr(item.id)}" data-offer-id="${escapeAttr(offer.id)}">تعديل</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-offer" data-category-id="${escapeAttr(category.id)}" data-item-id="${escapeAttr(item.id)}" data-offer-id="${escapeAttr(offer.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">لا توجد عروض</div>';
  if (select) { select.replaceChildren(new Option('-- اختر المنتج --', '')); categories.forEach((category) => (category.items || []).forEach((item) => select.add(new Option(`${category.name} — ${item.name}`, `${category.id}::${item.id}`)))); }
};
const renderWallets = () => {
  const target = byId('walletsList'); if (!target) return;
  target.innerHTML = wallets.map((wallet) => `<article class="admin-list-item${wallet.enabled === false ? ' is-disabled' : ''}"><div class="admin-list-media">${wallet.image ? `<img src="${escapeAttr(wallet.image)}" alt="">` : ''}</div><div class="admin-list-content"><strong>${escapeHTML(wallet.name)}</strong><small dir="ltr">${escapeHTML(wallet.number || '')}</small><small>${wallet.enabled !== false ? 'مفعلة' : 'معطلة'}</small></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-wallet" data-wallet-id="${escapeAttr(wallet.id)}">تعديل</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-wallet" data-wallet-id="${escapeAttr(wallet.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">لا توجد محافظ</div>';
};
const renderContactList = (kind, targetId) => {
  const target = byId(targetId); if (!target) return;
  const entries = kind === 'officialContacts' ? getOfficialContacts() : getContacts(kind);
  target.innerHTML = entries.map((contact) => `<article class="admin-list-item${contact.enabled === false ? ' is-disabled' : ''}"><div class="admin-list-content"><strong>${escapeHTML(contact.name || contact.label)}</strong><small>${escapeHTML(contact.type)} — ${escapeHTML(contact.value)}</small></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-contact" data-kind="${escapeAttr(kind)}" data-contact-id="${escapeAttr(contact.id)}">تعديل</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-contact" data-kind="${escapeAttr(kind)}" data-contact-id="${escapeAttr(contact.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">لا توجد بيانات</div>';
};
const renderCustomFields = () => {
  const target = byId('customFieldsList'); if (!target) return;
  target.innerHTML = getCustomFields().map((field) => `<article class="admin-list-item${field.enabled === false ? ' is-disabled' : ''}"><div class="admin-list-content"><strong>${escapeHTML(field.name)}</strong><p>${escapeHTML(field.defaultVal || '')}</p><small>الترتيب: ${field.order} — ${field.required ? 'مطلوب' : 'اختياري'}</small></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-field" data-field-id="${escapeAttr(field.id)}">تعديل</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-field" data-field-id="${escapeAttr(field.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">لا توجد حقول</div>';
};
const featuredDisplay = (featured) => {
  if (featured.type === 'item') { const found = findItem(featured.id, featured.categoryId); return found ? `${found.category.name} — ${found.item.name}` : featured.id; }
  const found = allOfferRecords().find((record) => record.offer.id === featured.id);
  return found ? `${found.item.name} — ${found.offer.name}` : featured.id;
};
const renderFeatured = () => {
  const target = byId('featuredList'); const select = byId('addFeaturedSelect'); const featured = getFeaturedOffers();
  if (target) target.innerHTML = featured.map((entry) => `<article class="admin-list-item admin-featured-row" draggable="true" data-featured-key="${escapeAttr(`${entry.type}:${entry.id}`)}"><div class="admin-drag-handle">⋮⋮</div><div class="admin-list-content"><strong>${escapeHTML(entry.customLabel || featuredDisplay(entry))}</strong><small>${escapeHTML(featuredDisplay(entry))} — الترتيب: ${entry.order}</small></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-featured" data-featured-type="${entry.type}" data-featured-id="${escapeAttr(entry.id)}">تعديل</button><button type="button" class="btn btn-sm" data-admin-action="move-featured-up" data-featured-key="${escapeAttr(`${entry.type}:${entry.id}`)}">↑</button><button type="button" class="btn btn-sm" data-admin-action="move-featured-down" data-featured-key="${escapeAttr(`${entry.type}:${entry.id}`)}">↓</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-featured" data-featured-type="${entry.type}" data-featured-id="${escapeAttr(entry.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">لا توجد عناصر مميزة</div>';
  if (select) {
    select.replaceChildren(new Option('-- اختر من القائمة --', ''));
    categories.forEach((category) => (category.items || []).forEach((item) => {
      select.add(new Option(`منتج: ${category.name} — ${item.name}`, `item|${category.id}|${item.id}|${item.id}`));
      (item.offers || []).forEach((offer) => select.add(new Option(`عرض: ${item.name} — ${offer.name}`, `offer|${category.id}|${item.id}|${offer.id}`)));
    }));
  }
  const title = byId('featuredSectionTitle'); if (title) title.value = settings.featuredSectionTitle || 'العروض المميزة';
};
const renderReviews = () => {
  const target = byId('adminReviewsList'); if (!target) return;
  target.innerHTML = reviews.map((review) => `<article class="admin-list-item${review.hidden ? ' is-disabled' : ''}"><div class="admin-list-content"><strong>${escapeHTML(review.name)} — ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</strong><p>${escapeHTML(review.message)}</p><small>${escapeHTML(formatDate(review.createdAt))} — ${review.hidden ? 'مخفي' : 'ظاهر'}</small></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-review" data-review-id="${escapeAttr(review.id)}">تعديل</button><button type="button" class="btn btn-sm" data-admin-action="toggle-review" data-review-id="${escapeAttr(review.id)}">${review.hidden ? 'إظهار' : 'إخفاء'}</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-review" data-review-id="${escapeAttr(review.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">لا توجد تعليقات</div>';
};
const customerSearchMatches = (customer, query) => {
  if (!query) return true;
  const relatedOrders = orders.filter((order) => String(order.userId) === String(customer.id));
  const haystack = [customer.id, customer.secretToken, customer.accountPassword, customer.name, customer.fullName, customer.phone, customer.localPhone, customer.email, customer.address,
    ...relatedOrders.flatMap((order) => [order.id, order.orderId, order.offerSecretToken, order.orderSecretToken, order.offerName])].join(' ').toLowerCase();
  return haystack.includes(query);
};
const renderOrderCard = (order) => `<article class="admin-order-card"><header><strong>${escapeHTML(order.itemName || order.offerName || order.id)}</strong><span class="admin-status-badge">${escapeHTML(order.status)}</span></header><small>الطلب: ${escapeHTML(order.id)} — ${escapeHTML(formatDate(order.createdAt))}</small><small>${formatPrice(order.total || order.price || 0, order.currency || 'YER')}</small>${secretTokenMarkup(order.offerSecretToken)}${order.orderSecretToken ? `<small>مرجع الطلب: ${escapeHTML(order.orderSecretToken)}</small>` : ''}<div class="admin-list-actions">${order.status === 'pending' || order.status === 'processing' ? `<button type="button" class="btn btn-sm" data-admin-action="confirm-order" data-order-id="${escapeAttr(order.id)}">تأكيد</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="reject-order" data-order-id="${escapeAttr(order.id)}">رفض</button>` : ''}</div></article>`;
const renderCustomers = () => {
  const target = byId('customersList'); if (!target) return;
  const query = byId('adminVerificationInput')?.value?.trim().toLowerCase() || '';
  const visible = customers.filter((customer) => customerSearchMatches(customer, query));
  target.innerHTML = visible.map((customer) => {
    const customerOrders = orders.filter((order) => String(order.userId) === String(customer.id));
    const status = customer.accountStatus || 'under_confirmation';
    return `<article class="admin-customer-card"><div class="admin-customer-header"><div class="admin-customer-info"><strong class="admin-customer-name">${escapeHTML(customer.name || customer.fullName || customer.email || customer.id)}</strong><small class="admin-customer-email">${escapeHTML(customer.email || '')}</small></div><span class="admin-customer-badge">${escapeHTML(status)}</span></div><div class="admin-customer-meta"><span>المعرف: ${escapeHTML(customer.id)}</span><span>الهاتف: ${escapeHTML(customer.phone || customer.localPhone || '—')}</span><span>العنوان: ${escapeHTML(customer.address || '—')}</span><span>التسجيل: ${escapeHTML(formatDate(customer.createdAt))}</span><span>الرصيد: ${formatPrice(customer.balance || 0)}</span></div><div class="admin-secret-panel"><strong>رمز الحساب السري (للمدير فقط)</strong>${secretTokenMarkup(customer.secretToken || customer.accountPassword)}</div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-customer-profile" data-customer-id="${escapeAttr(customer.id)}">تعديل بيانات الحساب</button><button type="button" class="btn btn-sm" data-admin-action="set-balance" data-customer-id="${escapeAttr(customer.id)}">تعديل الرصيد</button><button type="button" class="btn btn-sm" data-admin-action="verify-user" data-customer-id="${escapeAttr(customer.id)}">توثيق</button><button type="button" class="btn btn-sm" data-admin-action="unverify-user" data-customer-id="${escapeAttr(customer.id)}">إلغاء التوثيق</button><button type="button" class="btn btn-sm" data-admin-action="suspend-user" data-customer-id="${escapeAttr(customer.id)}">تعليق</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-user" data-customer-id="${escapeAttr(customer.id)}">حذف الحساب</button></div><section class="admin-customer-orders"><h4 class="admin-customer-orders-title">طلبات الحساب (${customerOrders.length})</h4>${customerOrders.map(renderOrderCard).join('') || '<small>لا توجد طلبات</small>'}</section></article>`;
  }).join('') || '<div class="empty-state">لا توجد حسابات مطابقة</div>';
};
const renderTopup = () => {
  const serviceTarget = byId('adminServicesList');
  const services = getTopupServices(activeServiceType);
  if (serviceTarget) serviceTarget.innerHTML = services.map((service) => `<article class="admin-list-item${service.enabled === false ? ' is-disabled' : ''}"><div class="admin-list-content"><strong>${escapeHTML(service.name)}</strong><small>${service.enabled !== false ? 'مفعلة للمستخدمين' : 'معطلة'} — ${(service.customFields || []).length} حقل</small><p>${escapeHTML(service.description || '')}</p></div><div class="admin-list-actions"><button type="button" class="btn btn-sm" data-admin-action="edit-service" data-service-id="${escapeAttr(service.id)}">تعديل كامل</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="delete-service" data-service-id="${escapeAttr(service.id)}">حذف</button></div></article>`).join('') || '<div class="empty-state">لا توجد خدمات لهذا القسم</div>';
  const transactions = getTopupTransactions();
  const rows = (entries) => entries.map((tx) => `<article class="admin-list-item"><div class="admin-list-content"><strong>${escapeHTML(tx.userName || tx.userId || 'عميل')}</strong><small>${escapeHTML(tx.serviceName || tx.type)} — ${formatPrice(tx.amount)}</small><small>${escapeHTML(formatDate(tx.createdAt))}</small></div><div class="admin-list-actions">${tx.status === 'pending' ? `<button type="button" class="btn btn-sm" data-admin-action="transaction-approve" data-transaction-id="${escapeAttr(tx.id)}">قبول</button><button type="button" class="btn btn-sm btn-danger" data-admin-action="transaction-reject" data-transaction-id="${escapeAttr(tx.id)}">رفض</button>` : `<span>${escapeHTML(tx.status)}</span>`}</div></article>`).join('') || '<div class="empty-state">لا توجد عمليات</div>';
  if (byId('adminPendingTopupRequestsList')) byId('adminPendingTopupRequestsList').innerHTML = rows(transactions.filter((tx) => tx.status === 'pending'));
  if (byId('adminCompletedTopupRequestsList')) byId('adminCompletedTopupRequestsList').innerHTML = rows(transactions.filter((tx) => tx.status !== 'pending'));
};
const renderAboutLines = () => {
  const target = byId('aboutLinesList'); if (!target) return;
  target.innerHTML = (settings.aboutLines || []).map((line) => `<div class="admin-editor-row" data-about-line><div class="admin-editor-grid"><label>الأيقونة<input class="form-input" data-about-prop="icon" value="${escapeAttr(line.icon || '')}"></label><label>العنوان<input class="form-input" data-about-prop="label" value="${escapeAttr(line.label || '')}"></label><label class="admin-editor-span-2">القيمة<input class="form-input" data-about-prop="value" value="${escapeAttr(line.value || '')}"></label></div><button type="button" class="admin-row-remove" data-admin-action="remove-about-line">حذف</button></div>`).join('');
};
const renderDefaultPopups = () => {
  const target = byId('defaultPopupsList'); if (target) target.innerHTML = (settings.defaultPopups || []).map(popupRow).join('') || '<div class="empty-state">لا توجد تنبيهات افتراضية</div>';
};
const renderStats = () => {
  setText('statCategories', categories.length);
  setText('statItems', categories.reduce((sum, category) => sum + (category.items?.length || 0), 0));
  setText('statOffers', categories.reduce((sum, category) => sum + (category.items || []).reduce((count, item) => count + (item.offers?.length || 0), 0), 0));
  setText('statCustomers', customers.length);
};
const renderAll = () => {
  settings = getSiteSettings();
  renderCategories(); renderItems(); renderOffers(); renderWallets(); renderContactList('contactPlatforms', 'platformsList'); renderContactList('contacts', 'contactsList');
  renderContactList('officialContacts', 'officialContactsList'); renderCustomFields(); renderFeatured(); renderCustomers(); renderReviews(); renderTopup(); renderAboutLines(); renderDefaultPopups(); renderStats(); injectIcons();
};

const syncAdminAvailabilityPreview = () => {
  const available = Boolean(byId('settingsAdminAvailability')?.checked);
  if (byId('adminAvailPreviewDot')) { byId('adminAvailPreviewDot').style.background = available ? '#00E676' : '#FF3D57'; byId('adminAvailPreviewDot').style.boxShadow = available ? '0 0 14px rgba(0,230,118,.9)' : '0 0 8px rgba(255,61,87,.38)'; }
  if (byId('adminAvailPreviewText')) byId('adminAvailPreviewText').textContent = available ? '🟢 الإدارة متاحة الآن' : '🔴 الإدارة غير متاحة';
  if (byId('adminAvailToggleTrack')) byId('adminAvailToggleTrack').style.background = available ? '#00C853' : '#444';
  if (byId('adminAvailToggleThumb')) byId('adminAvailToggleThumb').style.transform = available ? 'translateX(26px)' : 'translateX(0)';
};
const populateSettings = () => {
  settings = getSiteSettings();
  const values = { settingsWhatsapp: settings.whatsappNumber, settingsSupport: settings.supportNumber, settingsAdmin: settings.adminPhone, settingsChannel: settings.whatsappChannel,
    settingsCurrencyMode: settings.currencyMode, settingsDefaultCurrency: settings.defaultCurrency, settingsOffersPerPage: settings.offersPerPage,
    settingsAboutTitle: settings.aboutTitle, settingsAboutText: settings.aboutText, settingsAboutPosition: settings.aboutPosition,
    settingsWatermarkOpacity: Math.round(Number(settings.watermarkOpacity || 0.15) * 100), settingsContactPlatformsTitle: settings.contactPlatformsTitle,
    featuredSectionTitle: settings.featuredSectionTitle,
    settingsProductImageWidth: settings.productImageWidth || 140,
    settingsProductImageHeight: settings.productImageHeight || 130,
    settingsCategoryImageWidth: settings.categoryImageWidth || 110,
    settingsCategoryImageHeight: settings.categoryImageHeight || 110,
    settingsOfferImageWidth: settings.offerImageWidth || 60,
    settingsOfferImageHeight: settings.offerImageHeight || 60,
    settingsHeroLogoWidth: settings.heroLogoWidth || 320,
    settingsHeroLogoHeight: settings.heroLogoHeight || 320,
    settingsImageBorderRadius: settings.imageBorderRadius || 16,
    settingsImageFitMode: settings.imageFitMode || 'cover',
    settingsGeneralImageQuality: settings.generalImageQuality || 82,
    settingsGeneralImageMaxWidth: settings.generalImageMaxWidth || 100
  };
  Object.entries(values).forEach(([id, value]) => { if (byId(id) && value !== undefined && document.activeElement !== byId(id)) byId(id).value = value; });
  const checks = { settingsHideUnavailable: settings.hideUnavailable, settingsAboutEnabled: settings.aboutEnabled, settingsWatermark: settings.showWatermark,
    settingsReturningCustomer: settings.enableReturningCustomer, settingsContactPlatformsEnabled: settings.contactPlatformsEnabled, settingsAdminAvailability: settings.adminAvailability };
  Object.entries(checks).forEach(([id, value]) => { if (byId(id)) byId(id).checked = Boolean(value); });
  for (const code of ['SAR', 'USD', 'AED']) if (byId(`rate${code}`)) byId(`rate${code}`).value = Number(settings.exchangeRates?.[code] || 0) * 100;
  document.querySelectorAll('.active-currency-check').forEach((input) => { input.checked = (settings.activeCurrencies || []).includes(input.value); });
  setText('watermarkOpacityValue', Math.round(Number(settings.watermarkOpacity || 0.15) * 100));
  syncAdminAvailabilityPreview();
};
const populateTopupSettings = () => {
  const topup = getTopupSettings();
  const values = { adminTopupNameInput: topup.accountName, adminTopupPhone1Input: topup.phone1, adminTopupPhone2Input: topup.phone2, adminTopupDepInstInput: topup.depositInstructions, adminTopupWthInstInput: topup.withdrawInstructions };
  Object.entries(values).forEach(([id, value]) => { if (byId(id) && document.activeElement !== byId(id)) byId(id).value = value || ''; });
};
const IMAGE_PREVIEWS = Object.freeze({
  newCatImage: 'newCatImagePreview', newItemImage: 'newItemImagePreview',
  newOfferImage: 'newOfferImagePreview', newWalletImage: 'newWalletImagePreview',
  newSvcImageFile: 'newSvcImagePreview'
});
const compressedImageFromInput = async (id) => {
  const input = byId(id);
  if (!input) return '';
  if (input.__imageCompressionPromise) await input.__imageCompressionPromise;
  if (input.__compressedImageData) return input.__compressedImageData;
  const preview = byId(IMAGE_PREVIEWS[id]);
  if (preview?.dataset.imageValue) return preview.dataset.imageValue;
  // Fallback only when the change handler did not run (older browsers).
  const file = input.files?.[0];
  if (!file) return '';
  const imageData = await compressImageFile(file);
  input.__compressedImageData = imageData;
  return imageData;
};
const resetPreview = (id) => {
  const preview = byId(id);
  if (preview) { preview.removeAttribute('src'); preview.style.display = 'none'; delete preview.dataset.imageValue; }
  const inputId = Object.keys(IMAGE_PREVIEWS).find((key) => IMAGE_PREVIEWS[key] === id);
  const input = inputId ? byId(inputId) : null;
  if (input) { input.__compressedImageData = ''; input.__imageCompressionPromise = null; }
};

const refreshCategories = async () => { categories = await getAllCategories({ refresh: true, includeSecrets: true }); };
const refreshWallets = async () => { await loadWalletsFromFirebase(); wallets = getAllWallets(); };
const refreshReviews = async () => { reviews = await loadReviewsOnce({ includeHidden: true }); };
const refreshCustomers = async () => {
  const { listRegisteredUsers } = await import('../services/balance-service.js');
  customers = await listRegisteredUsers();
};

const bindStaticImagePreviews = () => {
  [['newCatImage', 'newCatImagePreview'], ['newItemImage', 'newItemImagePreview'], ['newOfferImage', 'newOfferImagePreview'], ['newWalletImage', 'newWalletImagePreview'], ['newSvcImageFile', 'newSvcImagePreview']].forEach(([inputId, previewId]) => {
    const input = byId(inputId); const preview = byId(previewId);
    if (!input || !preview || input.dataset.previewReady) return;
    input.dataset.previewReady = 'true';
    bindImagePreview(input, preview, {
      onError: (error) => showToast(`تعذر قراءة الصورة: ${sanitizeInput(error?.message || String(error), 240)}`, 'error', { sticky: true })
    });
  });
};
const bindEditModal = () => {
  byId('editCancelBtn')?.addEventListener('click', closeEditModal);
  byId('editModal')?.addEventListener('click', (event) => { if (event.target.id === 'editModal') closeEditModal(); });
  byId('editModalBody')?.addEventListener('change', async (event) => {
    const input = event.target.closest('.admin-edit-image-input'); if (!input) return;
    try {
      const preview = byId(input.dataset.previewId); const image = await compressImageFile(input.files?.[0]);
      if (preview && image) { preview.src = image; preview.dataset.imageValue = image; preview.hidden = false; preview.nextElementSibling?.setAttribute('hidden', ''); }
    } catch (error) { showToast(`تعذر معالجة الصورة: ${error.message}`, 'error'); }
  });
  byId('editModalBody')?.addEventListener('click', (event) => {
    const action = event.target.closest('[data-editor-action]')?.dataset.editorAction; if (!action) return;
    if (action === 'remove-row') event.target.closest('.admin-editor-row')?.remove();
    if (action === 'add-field') byId('editItemFields')?.insertAdjacentHTML('beforeend', dynamicFieldRow({}, byId('editItemFields').children.length));
    if (action === 'add-service-field') byId('editServiceFields')?.insertAdjacentHTML('beforeend', dynamicFieldRow({}, byId('editServiceFields').children.length));
    if (action === 'add-popup') byId('editOfferPopups')?.insertAdjacentHTML('beforeend', popupRow({}, byId('editOfferPopups').children.length));
    if (action === 'clear-image') { const preview = byId(event.target.closest('[data-preview-id]').dataset.previewId); if (preview) { preview.src = ''; preview.dataset.imageValue = ''; preview.hidden = true; preview.nextElementSibling?.removeAttribute('hidden'); } }
  });
  byId('editSaveBtn')?.addEventListener('click', async () => {
    const form = byId('adminEditForm'); const button = byId('editSaveBtn');
    if (!form || !pendingEditorSave || !form.reportValidity()) return;
    try { await saveAction(button, async () => { await pendingEditorSave(form); closeEditModal(); renderAll(); }); }
    catch { /* saveAction displayed a detailed error */ }
  });
};

const bindAddForms = () => {
  byId('addCategoryForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await saveAction(buttonFor(event, '[type="submit"]'), async () => {
      await saveCategoryToFirebase({ id: createId('cat'), name: sanitizeInput(byId('newCatName').value, 120), description: sanitizeInput(byId('newCatDesc').value, 1000), image: await compressedImageFromInput('newCatImage'), order: categories.length + 1, items: [] });
      await refreshCategories(); event.target.reset(); resetPreview('newCatImagePreview'); renderAll();
    }, 'تمت إضافة القسم ✅'); } catch { /* displayed */ }
  });
  byId('addItemForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await saveAction(buttonFor(event, '[type="submit"]'), async () => {
      const category = findCategory(byId('addItemCategory').value); if (!category) throw new Error('اختر القسم أولاً');
      await saveCategoryToFirebase({ ...category, items: [...category.items, { id: createId('item'), name: sanitizeInput(byId('newItemName').value, 150), description: sanitizeInput(byId('newItemDesc').value, 1500), image: await compressedImageFromInput('newItemImage'), status: 'available', order: category.items.length + 1, customFields: [], offers: [] }] });
      await refreshCategories(); event.target.reset(); resetPreview('newItemImagePreview'); renderAll();
    }, 'تمت إضافة المنتج ✅'); } catch { /* displayed */ }
  });
  byId('addOfferForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await saveAction(buttonFor(event, '[type="submit"]'), async () => {
      const [categoryId, itemId] = byId('addOfferItem').value.split('::'); const found = findItem(itemId, categoryId); if (!found) throw new Error('اختر المنتج أولاً');
      const offer = { id: createId('offer'), name: sanitizeInput(byId('newOfferName').value, 150), price: sanitizeNumber(byId('newOfferPrice').value, { min: 0 }), oldPrice: sanitizeNumber(byId('newOfferOldPrice').value, { min: 0 }), description: sanitizeInput(byId('newOfferDesc').value, 1000), currency: byId('newOfferCurrency').value, image: await compressedImageFromInput('newOfferImage'), status: 'available', order: found.item.offers.length + 1, popups: [] };
      const updatedItem = { ...found.item, offers: [...found.item.offers, offer] };
      await saveCategoryToFirebase({ ...found.category, items: found.category.items.map((entry) => entry.id === found.item.id ? updatedItem : entry) });
      await refreshCategories(); event.target.reset(); resetPreview('newOfferImagePreview'); renderAll();
    }, 'تمت إضافة العرض ورمزه السري ✅'); } catch { /* displayed */ }
  });
  byId('addWalletForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await saveAction(buttonFor(event, '[type="submit"]'), async () => {
      await addWallet({ name: sanitizeInput(byId('newWalletName').value, 100), number: sanitizeInput(byId('newWalletNumber').value, 100), image: await compressedImageFromInput('newWalletImage'), enabled: true, order: wallets.length + 1 });
      await refreshWallets(); event.target.reset(); resetPreview('newWalletImagePreview'); renderWallets();
    }, 'تمت إضافة المحفظة ✅'); } catch { /* displayed */ }
  });
};

const collectAboutLines = () => [...document.querySelectorAll('[data-about-line]')].map((row) => ({ icon: fieldValue(row, '[data-about-prop="icon"]'), label: fieldValue(row, '[data-about-prop="label"]'), value: fieldValue(row, '[data-about-prop="value"]') })).filter((line) => line.label || line.value);
const bindSettingsForms = () => {
  const bindFormSave = (id, operation, message) => byId(id)?.addEventListener('submit', async (event) => {
    event.preventDefault(); try { settings = await saveAction(buttonFor(event, '[type="submit"]'), operation, message); renderAll(); } catch { /* displayed */ }
  });
  bindFormSave('currencySettingsForm', () => saveSiteSettings({ currencyMode: byId('settingsCurrencyMode').value, defaultCurrency: byId('settingsDefaultCurrency').value, activeCurrencies: [...document.querySelectorAll('.active-currency-check:checked')].map((input) => input.value), exchangeRates: { YER: 1, SAR: Number(byId('rateSAR').value) / 100, USD: Number(byId('rateUSD').value) / 100, AED: Number(byId('rateAED').value) / 100 } }), 'تم حفظ إعدادات العملة ✅');
  bindFormSave('displaySettingsForm', () => saveSiteSettings({ offersPerPage: sanitizeNumber(byId('settingsOffersPerPage').value, { min: 4, max: 50, integer: true, fallback: 10 }), hideUnavailable: byId('settingsHideUnavailable').checked }), 'تم حفظ إعدادات العرض ✅');
  bindFormSave('aboutSettingsForm', () => saveSiteSettings({ aboutEnabled: byId('settingsAboutEnabled').checked, aboutTitle: sanitizeInput(byId('settingsAboutTitle').value, 60), aboutText: sanitizeInput(byId('settingsAboutText').value, 2000), aboutPosition: byId('settingsAboutPosition').value, aboutLines: collectAboutLines() }), 'تم حفظ معلومات المتجر ✅');
  bindFormSave('generalSettingsForm', () => saveSiteSettings({ showWatermark: byId('settingsWatermark').checked, watermarkOpacity: Number(byId('settingsWatermarkOpacity').value) / 100, enableReturningCustomer: byId('settingsReturningCustomer').checked }));
  bindFormSave('imageSettingsForm', () => saveSiteSettings({
    productImageWidth: sanitizeNumber(byId('settingsProductImageWidth').value, { min: 20, max: 500, integer: true, fallback: 140 }),
    productImageHeight: sanitizeNumber(byId('settingsProductImageHeight').value, { min: 20, max: 500, integer: true, fallback: 130 }),
    categoryImageWidth: sanitizeNumber(byId('settingsCategoryImageWidth').value, { min: 20, max: 500, integer: true, fallback: 110 }),
    categoryImageHeight: sanitizeNumber(byId('settingsCategoryImageHeight').value, { min: 20, max: 500, integer: true, fallback: 110 }),
    offerImageWidth: sanitizeNumber(byId('settingsOfferImageWidth').value, { min: 20, max: 300, integer: true, fallback: 60 }),
    offerImageHeight: sanitizeNumber(byId('settingsOfferImageHeight').value, { min: 20, max: 300, integer: true, fallback: 60 }),
    heroLogoWidth: sanitizeNumber(byId('settingsHeroLogoWidth').value, { min: 50, max: 800, integer: true, fallback: 320 }),
    heroLogoHeight: sanitizeNumber(byId('settingsHeroLogoHeight').value, { min: 50, max: 800, integer: true, fallback: 320 }),
    imageBorderRadius: sanitizeNumber(byId('settingsImageBorderRadius').value, { min: 0, max: 50, integer: true, fallback: 16 }),
    imageFitMode: byId('settingsImageFitMode').value,
    generalImageQuality: sanitizeNumber(byId('settingsGeneralImageQuality').value, { min: 10, max: 100, integer: true, fallback: 82 }),
    generalImageMaxWidth: sanitizeNumber(byId('settingsGeneralImageMaxWidth').value, { min: 10, max: 100, integer: true, fallback: 100 })
  }), 'تم حفظ إعدادات أحجام الصور وتطبيقها فوراً ✅');
  bindFormSave('contactNumbersForm', () => saveSiteSettings({ whatsappNumber: sanitizeInput(byId('settingsWhatsapp').value, 30), supportNumber: sanitizeInput(byId('settingsSupport').value, 30), adminPhone: sanitizeInput(byId('settingsAdmin').value, 30), whatsappChannel: sanitizeInput(byId('settingsChannel').value, 500) }), 'تم حفظ أرقام التواصل ✅');
  byId('settingsWatermarkOpacity')?.addEventListener('input', (event) => setText('watermarkOpacityValue', event.target.value));
  byId('settingsAdminAvailability')?.addEventListener('change', syncAdminAvailabilityPreview);
  byId('saveAdminAvailabilityBtn')?.addEventListener('click', async (event) => { try { settings = await saveAction(event.currentTarget, () => saveSiteSettings({ adminAvailability: byId('settingsAdminAvailability').checked }), byId('settingsAdminAvailability').checked ? 'تم إعلان الإدارة متاحة ✅' : 'تم إعلان الإدارة غير متاحة ✅'); syncAdminAvailabilityPreview(); } catch { /* displayed */ } });
  byId('savePlatformsBtn')?.addEventListener('click', async (event) => { try { settings = await saveAction(event.currentTarget, () => saveSiteSettings({ contactPlatformsEnabled: byId('settingsContactPlatformsEnabled').checked, contactPlatformsTitle: sanitizeInput(byId('settingsContactPlatformsTitle').value, 60), contactPlatforms: getContacts('contactPlatforms') })); } catch { /* displayed */ } });
  byId('saveContactsBtn')?.addEventListener('click', async (event) => { try { settings = await saveAction(event.currentTarget, () => saveSiteSettings({ contacts: getContacts('contacts') })); } catch { /* displayed */ } });
  byId('saveFieldsBtn')?.addEventListener('click', async (event) => { try { settings = await saveAction(event.currentTarget, () => saveSiteSettings({ customFields: getCustomFields() })); } catch { /* displayed */ } });
  byId('saveFeaturedTitleBtn')?.addEventListener('click', async (event) => { try { settings = await saveAction(event.currentTarget, () => setFeaturedSectionTitle(byId('featuredSectionTitle').value)); } catch { /* displayed */ } });
  byId('addPlatformBtn')?.addEventListener('click', () => editContactModal('', 'contactPlatforms'));
  byId('addContactBtn')?.addEventListener('click', () => editContactModal('', 'contacts'));
  byId('addOfficialContactBtn')?.addEventListener('click', () => editContactModal('', 'officialContacts'));
  byId('addFieldBtn')?.addEventListener('click', () => editFieldModal(''));
  byId('addFeaturedBtn')?.addEventListener('click', async (event) => {
    const [type, categoryId, itemId, id] = byId('addFeaturedSelect').value.split('|'); if (!id) return;
    try { await saveAction(event.currentTarget, async () => { await addFeaturedOffer({ type, categoryId, itemId, id, order: getFeaturedOffers().length + 1 }); settings = getSiteSettings(); renderFeatured(); }, 'تمت الإضافة إلى المميزة ✅'); } catch { /* displayed */ }
  });
  byId('addAboutLineBtn')?.addEventListener('click', () => byId('aboutLinesList')?.insertAdjacentHTML('beforeend', `<div class="admin-editor-row" data-about-line><div class="admin-editor-grid"><label>الأيقونة<input class="form-input" data-about-prop="icon"></label><label>العنوان<input class="form-input" data-about-prop="label"></label><label class="admin-editor-span-2">القيمة<input class="form-input" data-about-prop="value"></label></div><button type="button" class="admin-row-remove" data-admin-action="remove-about-line">حذف</button></div>`));
  byId('addDefaultPopupBtn')?.addEventListener('click', () => { const target = byId('defaultPopupsList'); if (!target) return; if (target.querySelector('.empty-state')) target.innerHTML = ''; target.insertAdjacentHTML('beforeend', popupRow({}, target.children.length)); });
  byId('defaultPopupsList')?.addEventListener('click', (event) => { if (event.target.closest('[data-editor-action="remove-row"]')) event.target.closest('.admin-editor-row')?.remove(); });
  byId('saveDefaultPopupsBtn')?.addEventListener('click', async (event) => { try { settings = await saveAction(event.currentTarget, () => saveSiteSettings({ defaultPopups: collectPopups(byId('defaultPopupsList')) }), 'تم حفظ تنبيهات ما قبل الشراء ✅'); } catch { /* displayed */ } });
};
const bindTopupForms = () => {
  byId('saveTopupSettingsBtn')?.addEventListener('click', async (event) => { try { await saveAction(event.currentTarget, () => saveTopupSettings({ accountName: sanitizeInput(byId('adminTopupNameInput').value, 120), phone1: sanitizeInput(byId('adminTopupPhone1Input').value, 40), phone2: sanitizeInput(byId('adminTopupPhone2Input').value, 40), depositInstructions: sanitizeInput(byId('adminTopupDepInstInput').value, 2000), withdrawInstructions: sanitizeInput(byId('adminTopupWthInstInput').value, 2000) }), 'تم حفظ إعدادات التغذية ✅'); } catch { /* displayed */ } });
  byId('adminInstantCreditBtn')?.addEventListener('click', async (event) => {
    try { await saveAction(event.currentTarget, async () => {
      const query = sanitizeInput(byId('adminInstantUserInput').value, 200); const amount = Number(byId('adminInstantAmountInput').value);
      if (!query || !(amount > 0)) throw new Error('أدخل معرف العميل ومبلغاً أكبر من صفر');
      const customer = customers.find((entry) => [entry.id, entry.email, entry.phone, entry.localPhone, entry.name].some((value) => String(value || '').toLowerCase() === query.toLowerCase()));
      const userId = customer?.id || (query === 'guest' ? 'guest' : '');
      if (!userId) throw new Error('لم يتم العثور على العميل');
      await adminSetUserBalance(userId, Number(customer?.balance || 0) + amount, 'تغذية مباشرة من الإدارة');
      await refreshCustomers(); renderCustomers(); byId('adminInstantAmountInput').value = '';
    }, 'تمت إضافة الرصيد فوراً ✅'); } catch { /* displayed */ }
  });
  const switchServiceType = (type) => { activeServiceType = type; setText('newSvcTypeLabel', type === 'deposit' ? 'للتغذية' : 'للاسترداد'); byId('svcTabDeposit')?.classList.toggle('active', type === 'deposit'); byId('svcTabWithdraw')?.classList.toggle('active', type === 'withdraw'); renderTopup(); };
  byId('svcTabDeposit')?.addEventListener('click', () => switchServiceType('deposit'));
  byId('svcTabWithdraw')?.addEventListener('click', () => switchServiceType('withdraw'));
  byId('addServiceBtn')?.addEventListener('click', async (event) => {
    try { await saveAction(event.currentTarget, async () => {
      const name = sanitizeInput(byId('newSvcName').value, 100); if (!name) throw new Error('أدخل اسم الخدمة');
      const preview = byId('newSvcImagePreview'); const image = preview?.dataset.imageValue || sanitizeInput(byId('newSvcImage').value, 2000);
      await saveTopupService({ name, type: activeServiceType, image, description: sanitizeInput(byId('newSvcDesc').value, 1000), enabled: byId('newSvcEnabled')?.checked !== false, order: getTopupServices(activeServiceType).length + 1, customFields: [] });
      byId('newSvcName').value = ''; byId('newSvcImage').value = ''; byId('newSvcDesc').value = ''; resetPreview('newSvcImagePreview'); renderTopup();
    }, 'تمت إضافة الخدمة وستظهر للمستخدمين فوراً ✅'); } catch { /* displayed */ }
  });
};

const moveFeatured = async (key, delta) => {
  const keys = getFeaturedOffers().map((entry) => `${entry.type}:${entry.id}`); const index = keys.indexOf(key); const target = index + delta;
  if (index < 0 || target < 0 || target >= keys.length) return;
  [keys[index], keys[target]] = [keys[target], keys[index]];
  await reorderFeaturedOffers(keys); settings = getSiteSettings(); renderFeatured();
};
const bindActions = () => document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-admin-action]'); if (!button) return;
  const action = button.dataset.adminAction;
  try {
    if (action === 'copy-token') await copyText(button.dataset.token);
    if (action === 'edit-category') editCategoryModal(button.dataset.categoryId);
    if (action === 'delete-category' && globalThis.confirm('حذف القسم وجميع محتوياته؟')) await saveAction(button, async () => { await deleteCategoryFromFirebase(button.dataset.categoryId); await refreshCategories(); renderAll(); }, 'تم حذف القسم ✅');
    if (action === 'edit-item') editItemModal(button.dataset.categoryId, button.dataset.itemId);
    if (action === 'delete-item' && globalThis.confirm('حذف المنتج؟')) await saveAction(button, async () => { await deleteItem(button.dataset.categoryId, button.dataset.itemId); await refreshCategories(); renderAll(); }, 'تم حذف المنتج ✅');
    if (action === 'edit-offer') editOfferModal(button.dataset.categoryId, button.dataset.itemId, button.dataset.offerId);
    if (action === 'delete-offer' && globalThis.confirm('حذف العرض؟')) await saveAction(button, async () => { await deleteOffer(button.dataset.categoryId, button.dataset.itemId, button.dataset.offerId); await refreshCategories(); renderAll(); }, 'تم حذف العرض ✅');
    if (action === 'edit-wallet') editWalletModal(button.dataset.walletId);
    if (action === 'delete-wallet' && globalThis.confirm('حذف المحفظة؟')) await saveAction(button, async () => { await deleteWallet(button.dataset.walletId); await refreshWallets(); renderWallets(); }, 'تم حذف المحفظة ✅');
    if (action === 'edit-contact') editContactModal(button.dataset.contactId, button.dataset.kind);
    if (action === 'delete-contact' && globalThis.confirm('حذف جهة التواصل؟')) await saveAction(button, async () => { const kind = button.dataset.kind; if (kind === 'officialContacts') await deleteOfficialContact(button.dataset.contactId); else await deleteContact(button.dataset.contactId, kind); settings = getSiteSettings(); renderAll(); }, 'تم حذف جهة التواصل ✅');
    if (action === 'edit-field') editFieldModal(button.dataset.fieldId);
    if (action === 'delete-field' && globalThis.confirm('حذف الحقل؟')) await saveAction(button, async () => { await deleteCustomField(button.dataset.fieldId); settings = getSiteSettings(); renderCustomFields(); }, 'تم حذف الحقل ✅');
    if (action === 'edit-featured') editFeaturedModal(button.dataset.featuredType, button.dataset.featuredId);
    if (action === 'delete-featured') await saveAction(button, async () => { await deleteFeaturedOffer(button.dataset.featuredType, button.dataset.featuredId); settings = getSiteSettings(); renderFeatured(); }, 'تم حذف العنصر المميز ✅');
    if (action === 'move-featured-up') await saveAction(button, () => moveFeatured(button.dataset.featuredKey, -1), 'تم تغيير الترتيب ✅');
    if (action === 'move-featured-down') await saveAction(button, () => moveFeatured(button.dataset.featuredKey, 1), 'تم تغيير الترتيب ✅');
    if (action === 'edit-review') editReviewModal(button.dataset.reviewId);
    if (action === 'toggle-review') await saveAction(button, async () => { await toggleReviewHidden(button.dataset.reviewId); await refreshReviews(); renderReviews(); }, 'تم تحديث التعليق ✅');
    if (action === 'delete-review' && globalThis.confirm('حذف التعليق؟')) await saveAction(button, async () => { await deleteReview(button.dataset.reviewId); await refreshReviews(); renderReviews(); }, 'تم حذف التعليق ✅');
    if (action === 'remove-about-line') button.closest('[data-about-line]')?.remove();
    if (action === 'edit-customer-profile') { const customer=customers.find((entry)=>entry.id===button.dataset.customerId); if(customer){const name=prompt('الاسم الكامل الرباعي',customer.name||customer.fullName||'');if(name!==null){const phone=prompt('رقم الهاتف',customer.phone||customer.localPhone||'');const country=prompt('الدولة',customer.country||'');const city=prompt('المدينة',customer.city||'');const district=prompt('المنطقة',customer.district||'');const address=prompt('العنوان',customer.address||'');await saveAction(button,async()=>{await updateUserProfileForAdmin(customer.id,{name,fullName:name,phone,localPhone:phone,username:phone,country,city,district,address});await refreshCustomers();renderCustomers();},'تم تحديث بيانات الحساب ✅');}} }
    if (action === 'set-balance') { const customer = customers.find((entry) => entry.id === button.dataset.customerId); const amount = globalThis.prompt('الرصيد الجديد', String(customer?.balance || 0)); if (amount !== null) await saveAction(button, async () => { await adminSetUserBalance(button.dataset.customerId, Number(amount), 'تعديل رصيد من الإدارة'); await refreshCustomers(); renderCustomers(); }, 'تم تحديث الرصيد ✅'); }
    if (action === 'verify-user') await saveAction(button, async () => { await setUserVerificationStatus(button.dataset.customerId, true); await refreshCustomers(); renderCustomers(); }, 'تم توثيق الحساب ✅');
    if (action === 'unverify-user') await saveAction(button, async () => { await setUserVerificationStatus(button.dataset.customerId, false); await refreshCustomers(); renderCustomers(); }, 'تم إلغاء توثيق الحساب ✅');
    if (action === 'suspend-user') await saveAction(button, async () => { await updateUserAccountStatus(button.dataset.customerId, 'suspended'); await refreshCustomers(); renderCustomers(); }, 'تم تعليق الحساب ✅');
    if (action === 'delete-user' && globalThis.confirm('سيُحذف الحساب من Supabase Auth نهائياً. هل تريد المتابعة؟')) await saveAction(button, async () => { const customer=customers.find((entry)=>entry.id===button.dataset.customerId); await deleteUserAccount(button.dataset.customerId,customer?.email||''); customers = customers.filter((entry) => entry.id !== button.dataset.customerId); orders = orders.filter((order) => String(order.userId) !== String(button.dataset.customerId)); renderCustomers(); }, 'تم حذف الحساب نهائياً ✅');
    if (action === 'confirm-order') await saveAction(button, async () => { await confirmOrder(button.dataset.orderId, 'تم التأكيد يدوياً من الإدارة'); orders = await getAllOrdersForAdmin(); renderCustomers(); }, 'تم تأكيد الطلب ✅');
    if (action === 'reject-order') await saveAction(button, async () => { await rejectOrder(button.dataset.orderId, 'تم الرفض يدوياً من الإدارة'); orders = await getAllOrdersForAdmin(); renderCustomers(); }, 'تم رفض الطلب ✅');
    if (action === 'transaction-approve') await saveAction(button, async () => { await updateTopupTransactionStatus(button.dataset.transactionId, 'approved', 'تمت الموافقة من الإدارة'); renderTopup(); }, 'تمت الموافقة على العملية ✅');
    if (action === 'transaction-reject') await saveAction(button, async () => { await updateTopupTransactionStatus(button.dataset.transactionId, 'rejected', 'تم الرفض من الإدارة'); renderTopup(); }, 'تم رفض العملية ✅');
    if (action === 'delete-service' && globalThis.confirm('حذف الخدمة؟')) await saveAction(button, async () => { await deleteTopupService(button.dataset.serviceId); renderTopup(); }, 'تم حذف الخدمة ✅');
    if (action === 'edit-service') editServiceModal(button.dataset.serviceId);
  } catch { /* each wrapper already reported a detailed error */ }
});
const bindFeaturedDragDrop = () => {
  const target = byId('featuredList'); if (!target) return;
  target.addEventListener('dragstart', (event) => { const row = event.target.closest('[data-featured-key]'); if (row) { draggedFeaturedKey = row.dataset.featuredKey; row.classList.add('is-dragging'); } });
  target.addEventListener('dragend', (event) => { event.target.closest('[data-featured-key]')?.classList.remove('is-dragging'); draggedFeaturedKey = null; });
  target.addEventListener('dragover', (event) => { if (event.target.closest('[data-featured-key]')) event.preventDefault(); });
  target.addEventListener('drop', async (event) => {
    event.preventDefault(); const destination = event.target.closest('[data-featured-key]')?.dataset.featuredKey;
    if (!draggedFeaturedKey || !destination || draggedFeaturedKey === destination) return;
    const keys = getFeaturedOffers().map((entry) => `${entry.type}:${entry.id}`); const from = keys.indexOf(draggedFeaturedKey); const to = keys.indexOf(destination);
    if (from < 0 || to < 0) return;
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    try { await saveAction(event.target.closest('[data-featured-key]'), () => reorderFeaturedOffers(keys), 'تم تغيير الترتيب ✅'); settings = getSiteSettings(); renderFeatured(); } catch { /* displayed */ }
  });
};
let workflowTimer=null,knownPendingIds=new Set();
const renderPendingCenter=async()=>{
  const target=byId('pendingWorkflowRows');if(!target)return;
  try{
    const payload=await listPendingForAdmin(),pending=payload.pending||[];
    const currentIds=new Set(pending.map((entry)=>`${entry.workflowCollection}:${entry.id}`));
    pending.forEach((entry)=>{const key=`${entry.workflowCollection}:${entry.id}`;if(knownPendingIds.size&&!knownPendingIds.has(key))systemNotify('طلب جديد في هود كوم',`${entry.itemName||entry.serviceName||entry.type||'عملية'} — ${entry.amount||entry.total||entry.price||''}`);});
    knownPendingIds=currentIds;
    setText('pendingWorkflowCount',pending.length);
    target.innerHTML=pending.map((entry)=>`<article class="workflow-row"><div class="workflow-row__main"><strong>${escapeHTML(entry.itemName||entry.serviceName||entry.type||'طلب')}</strong><span>${escapeHTML(entry.userName||entry.userEmail||entry.userId||'مستخدم')}</span><small>${escapeHTML(formatDate(entry.createdAt))}</small></div><div class="workflow-row__amount">${formatPrice(Number(entry.amount||entry.total||entry.price||0),entry.currency||'YER')}</div><div class="workflow-row__actions"><button class="btn btn-sm" data-workflow-decision="approve" data-collection="${escapeAttr(entry.workflowCollection)}" data-id="${escapeAttr(entry.id)}">تأكيد</button><button class="btn btn-sm btn-danger" data-workflow-decision="reject" data-collection="${escapeAttr(entry.workflowCollection)}" data-id="${escapeAttr(entry.id)}">رفض</button></div><details><summary>التفاصيل</summary><pre>${escapeHTML(JSON.stringify(entry,null,2))}</pre></details></article>`).join('')||'<div class="empty-state">لا توجد طلبات معلّقة</div>';
  }catch(error){target.innerHTML=`<div class="error-message">${escapeHTML(error.message)}</div>`;}
};
const installImageMigration=()=>{const header=document.querySelector('.admin-header');if(!header||byId('migrateCatalogImagesBtn'))return;const button=document.createElement('button');button.id='migrateCatalogImagesBtn';button.type='button';button.className='btn btn-outline';button.textContent='⚡ نقل الصور إلى CDN';button.addEventListener('click',async()=>{if(!confirm('سيتم نقل صور Base64 الحالية إلى Supabase Storage مع الإبقاء على البيانات آمنة. متابعة؟'))return;try{await saveAction(button,async()=>{const result=await migrateAllImages();await loadAll();renderAll();return result;},'تم نقل الصور إلى CDN بنجاح ✅');}catch{}});header.append(button);};
const installPendingCenter=()=>{
  const tabs=document.querySelector('.admin-tabs');if(!tabs||byId('tab-pending-workflow'))return;
  const button=document.createElement('button');button.type='button';button.className='admin-tab';button.dataset.tab='pending-workflow';button.innerHTML='🔔 الطلبات المعلّقة <b id="pendingWorkflowCount">0</b>';tabs.prepend(button);
  const panel=document.createElement('div');panel.className='admin-section';panel.id='tab-pending-workflow';panel.innerHTML='<div class="admin-form"><div class="workflow-head"><h2>مركز الطلبات المعلّقة</h2><button type="button" class="btn btn-outline" id="enableAdminNotifications">تفعيل إشعارات الإدارة</button></div><div id="pendingWorkflowRows"></div></div>';
  tabs.parentNode.insertBefore(panel,tabs.nextSibling);
  byId('enableAdminNotifications')?.addEventListener('click',async()=>{const result=await requestNotificationPermission();showToast(result==='granted'?'تم تفعيل الإشعارات ✅':'تعذر تفعيل الإشعارات','info');});
  panel.addEventListener('click',async(event)=>{const control=event.target.closest('[data-workflow-decision]');if(!control)return;const decision=control.dataset.workflowDecision;const reason=decision==='reject'?(globalThis.prompt('سبب الرفض (اختياري)','')||''):'';try{control.disabled=true;await decideRequest(control.dataset.collection,control.dataset.id,decision,reason);showToast(decision==='approve'?'تم تجهيز العملية ✅':'تم رفض العملية','success');await renderPendingCenter();}catch(error){showToast(error.message,'error');}finally{control.disabled=false;}});
  void renderPendingCenter();workflowTimer=globalThis.setInterval(renderPendingCenter,4000);
};
const bindTabs = () => document.querySelectorAll('.admin-tab').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.admin-tab').forEach((entry) => entry.classList.remove('active')); document.querySelectorAll('.admin-section').forEach((section) => section.classList.remove('active'));
  button.classList.add('active'); byId(`tab-${button.dataset.tab}`)?.classList.add('active');
}));
const bindBackup = () => {
  byId('exportDataBtn')?.addEventListener('click', async (event) => { try { await saveAction(event.currentTarget, async () => { byId('exportDataArea').value = JSON.stringify({ categories, wallets, settings, orders, exportedAt: new Date().toISOString() }, null, 2); }, 'تم تجهيز النسخة الاحتياطية ✅'); } catch { /* displayed */ } });
  byId('importDataBtn')?.addEventListener('click', async (event) => { try { await saveAction(event.currentTarget, async () => { const data = JSON.parse(byId('importDataArea').value); if (Array.isArray(data.categories)) for (const category of data.categories) await saveCategoryToFirebase(category); if (data.settings) await saveSiteSettings(data.settings); await loadAll(); populateSettings(); populateTopupSettings(); renderAll(); }, 'تم استيراد النسخة الاحتياطية ✅'); } catch (error) { if (error instanceof SyntaxError) showToast('ملف النسخة الاحتياطية غير صالح', 'error'); } });
  byId('deleteAllDataBtn')?.addEventListener('click', async (event) => { if (!globalThis.confirm('حذف جميع الأقسام نهائياً؟')) return; try { await saveAction(event.currentTarget, async () => { await Promise.all(categories.map((category) => deleteCategoryFromFirebase(category.id))); categories = []; renderAll(); }, 'تم حذف كل الأقسام ✅'); } catch { /* displayed */ } });
};

const loadAll = async () => {
  const [loadedCategories, loadedSettings, loadedReviews, loadedOrders] = await Promise.all([
    getAllCategories({ refresh: true, includeSecrets: true }), loadSiteSettingsFromFirebase(), loadReviewsOnce({ includeHidden: true }), getAllOrdersForAdmin(),
    loadTopupServicesFromCloud(), loadTopupSettingsFromCloud(), loadTopupTransactionsFromCloud(), refreshWallets(), refreshCustomers()
  ]);
  categories = loadedCategories; settings = loadedSettings; reviews = loadedReviews; orders = loadedOrders;
};
const startRealtime = async () => {
  const register = async (promise) => { try { subscriptions.push(await promise); } catch (error) { console.warn('[admin] realtime subscription failed', error); } };
  await Promise.all([
    register(subscribeCategories((rows) => { categories = rows; renderAll(); }, console.warn, { includeSecrets: true })),
    register(subscribeSiteSettings((next) => { settings = next; populateSettings(); renderAll(); }, console.warn)),
    register(subscribeTopupServices(() => renderTopup(), console.warn)),
    register(subscribeTopupSettings(() => populateTopupSettings(), console.warn)),
    register(subscribeTopupTransactions(() => renderTopup(), console.warn)),
    register(subscribeUsersForAdmin(async () => { await refreshCustomers(); renderCustomers(); }, console.warn)),
    register(subscribeOrdersForAdmin((next) => { orders = next; renderCustomers(); }, console.warn))
  ]);
};
const stopRealtime = () => { subscriptions.forEach((unsubscribe) => unsubscribe?.()); subscriptions = []; };

export const initAdminPage = async () => {
  if (!await checkAdminSession()) { globalThis.location.replace('login.html'); return; }
  await initCommonPage();
  if (!hasAdminSession()) { globalThis.location.replace('login.html'); return; }
  byId('adminAuthScreen')?.remove(); if (byId('adminMainWrap')) byId('adminMainWrap').style.display = '';
  byId('logoutBtn')?.addEventListener('click', () => { stopRealtime(); clearAdminSession(); globalThis.location.href = 'login.html'; });
  try {
    await loadAll(); populateSettings(); populateTopupSettings(); renderAll(); installImageMigration(); installPendingCenter(); bindTabs(); bindEditModal(); bindStaticImagePreviews(); bindAddForms(); bindSettingsForms(); bindTopupForms(); bindActions(); bindFeaturedDragDrop(); bindBackup();
    byId('adminVerificationInput')?.addEventListener('input', renderCustomers);
    byId('clearCustomerSearchBtn')?.addEventListener('click', () => { if (byId('adminVerificationInput')) byId('adminVerificationInput').value = ''; renderCustomers(); });
    byId('refreshCustomersBtn')?.addEventListener('click', async (event) => { try { await saveAction(event.currentTarget, async () => { await refreshCustomers(); orders = await getAllOrdersForAdmin(); renderCustomers(); }, 'تم تحديث الحسابات والطلبات ✅'); } catch { /* displayed */ } });
    byId('refreshReviewsBtn')?.addEventListener('click', async () => { await refreshReviews(); renderReviews(); });
    await startRealtime();
    globalThis.addEventListener('pagehide', () => { stopRealtime(); if(workflowTimer) clearInterval(workflowTimer); }, { once: true });
  } catch (error) {
    console.error('[admin] initialization failed', error);
    showToast(`تعذر تحميل لوحة التحكم: ${sanitizeInput(error?.message || String(error), 300)}`, 'error', { sticky: true });
  }
};

export default initAdminPage;
