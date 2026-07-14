import { escapeHTML } from '../utils/sanitizers.js';
import { formatPrice, formatStatus } from '../utils/formatters.js';
import { icon } from '../utils/icons.js';

const actions = (buttons) => `<div class="admin-list-actions">${buttons.join('')}</div>`;
const button = (label, action, data = {}, danger = false) => `<button type="button" class="btn btn-sm${danger ? ' btn-danger' : ''}" data-admin-action="${escapeHTML(action)}" ${Object.entries(data).map(([key, value]) => `data-${key}="${escapeHTML(value)}"`).join(' ')}>${escapeHTML(label)}</button>`;
const section = (id, title, body, active = false) => `<section class="admin-section${active ? ' active' : ''}" id="tab-${id}" data-admin-panel="${id}"><h2>${escapeHTML(title)}</h2>${body}</section>`;

/** Presentation-only admin panel; pages/admin.js owns every behavior and persistence call. */
export const AdminPanel = ({ categories = [], wallets = [], contacts = [], fields = [], featured = [], customers = [], reviews = [], transactions = [], settings = {} } = {}) => {
  const items = categories.flatMap((category) => (category.items || []).map((item) => ({ category, item })));
  const offers = items.flatMap(({ category, item }) => (item.offers || []).map((offer) => ({ category, item, offer })));
  const tabs = [
    ['categories', 'الأقسام'], ['items', 'المنتجات'], ['offers', 'العروض'], ['wallets', 'المحافظ'],
    ['contacts', 'التواصل'], ['fields', 'الحقول'], ['featured', 'المميزة'], ['customers', 'العملاء'],
    ['reviews', 'التعليقات'], ['topup', 'الرصيد'], ['settings', 'الإعدادات']
  ];
  return `<div class="admin-layout" id="adminMainWrap">
    <header class="admin-header"><h1>${icon('shield', 24)} لوحة تحكم هود كوم</h1><button class="btn btn-outline" type="button" data-action="admin-logout">خروج</button></header>
    <nav class="admin-tabs">${tabs.map(([id, label], index) => `<button type="button" class="admin-tab${index === 0 ? ' active' : ''}" data-tab="${id}">${escapeHTML(label)}</button>`).join('')}</nav>
    ${section('categories', 'الأقسام', categories.map((category) => `<article class="admin-list-item"><strong>${escapeHTML(category.name)}</strong><small>ترتيب ${category.order || 0}</small>${actions([button('تعديل كامل', 'edit-category', { 'category-id': category.id }), button('حذف', 'delete-category', { 'category-id': category.id }, true)])}</article>`).join(''), true)}
    ${section('items', 'المنتجات', items.map(({ category, item }) => `<article class="admin-list-item"><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(formatStatus(item.status))} — ${(item.customFields || []).length} حقل</small>${actions([button('تعديل كامل', 'edit-item', { 'category-id': category.id, 'item-id': item.id }), button('حذف', 'delete-item', { 'category-id': category.id, 'item-id': item.id }, true)])}</article>`).join(''))}
    ${section('offers', 'العروض', offers.map(({ category, item, offer }) => `<article class="admin-list-item"><strong>${escapeHTML(offer.name)}</strong><small>${formatPrice(offer.price || 0, offer.currency || 'YER')} — ${(offer.popups || []).length} تنبيه</small>${actions([button('تعديل كامل', 'edit-offer', { 'category-id': category.id, 'item-id': item.id, 'offer-id': offer.id }), button('حذف', 'delete-offer', { 'category-id': category.id, 'item-id': item.id, 'offer-id': offer.id }, true)])}</article>`).join(''))}
    ${section('wallets', 'المحافظ', wallets.map((wallet) => `<article class="admin-list-item"><strong>${escapeHTML(wallet.name)}</strong><small>${wallet.enabled !== false ? 'مفعلة' : 'معطلة'}</small>${actions([button('تعديل كامل', 'edit-wallet', { 'wallet-id': wallet.id }), button('حذف', 'delete-wallet', { 'wallet-id': wallet.id }, true)])}</article>`).join(''))}
    ${section('contacts', 'جهات التواصل', contacts.map((contact) => `<article class="admin-list-item"><strong>${escapeHTML(contact.name || contact.label)}</strong><small>${escapeHTML(contact.type)} — ${escapeHTML(contact.value)}</small>${actions([button('تعديل', 'edit-contact', { kind: 'contacts', 'contact-id': contact.id }), button('حذف', 'delete-contact', { kind: 'contacts', 'contact-id': contact.id }, true)])}</article>`).join(''))}
    ${section('fields', 'الحقول المخصصة', fields.map((field) => `<article class="admin-list-item"><strong>${escapeHTML(field.name)}</strong><small>${field.required ? 'مطلوب' : 'اختياري'} — ${field.enabled !== false ? 'مفعل' : 'معطل'}</small>${actions([button('تعديل', 'edit-field', { 'field-id': field.id }), button('حذف', 'delete-field', { 'field-id': field.id }, true)])}</article>`).join(''))}
    ${section('featured', settings.featuredSectionTitle || 'العروض المميزة', featured.map((entry) => `<article class="admin-list-item" draggable="true" data-featured-key="${escapeHTML(`${entry.type}:${entry.id}`)}"><strong>${escapeHTML(entry.customLabel || entry.id)}</strong>${actions([button('تعديل', 'edit-featured', { 'featured-type': entry.type, 'featured-id': entry.id }), button('حذف', 'delete-featured', { 'featured-type': entry.type, 'featured-id': entry.id }, true)])}</article>`).join(''))}
    ${section('customers', 'العملاء', customers.map((customer) => `<article class="admin-list-item"><strong>${escapeHTML(customer.name || customer.email || customer.id)}</strong><span>${formatPrice(customer.balance || 0)}</span>${actions([button('تعديل الرصيد', 'set-balance', { 'customer-id': customer.id })])}</article>`).join(''))}
    ${section('reviews', 'التعليقات', reviews.map((review) => `<article class="admin-list-item"><strong>${escapeHTML(review.name)}</strong><p>${escapeHTML(review.message)}</p>${actions([button('تعديل كامل', 'edit-review', { 'review-id': review.id }), button('حذف', 'delete-review', { 'review-id': review.id }, true)])}</article>`).join(''))}
    ${section('topup', 'عمليات الرصيد', transactions.map((transaction) => `<article class="admin-list-item"><strong>${escapeHTML(transaction.type)}</strong><span>${formatPrice(transaction.amount || 0)}</span><small>${escapeHTML(transaction.status)}</small></article>`).join(''))}
    ${section('settings', 'الإعدادات', `<form id="adminSettingsForm"><label>اسم المتجر<input class="form-input" name="storeName" value="${escapeHTML(settings.storeName || 'هود كوم')}"></label><label>اسم قسم المميزة<input class="form-input" name="featuredSectionTitle" value="${escapeHTML(settings.featuredSectionTitle || 'العروض المميزة')}"></label><button class="btn btn-gold" type="submit">حفظ</button></form>`)}
  </div>`;
};

export default AdminPanel;
