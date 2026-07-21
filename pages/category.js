import { initCommonPage } from './common.js';
import authStore from '../stores/auth-store.js';
import { loadCategories, setCurrentCategory, setCurrentItem } from '../stores/category-store.js';
import { securePurchase } from '../services/order-service.js';
import { getProductFields, getSiteSettings } from '../services/settings-service.js';
import { getUserBalance, refreshBalance } from '../services/balance-service.js';
import CategoryCard from '../components/CategoryCard.js';
import ProductCard from '../components/ProductCard.js';
import { escapeHTML, safeURL } from '../utils/sanitizers.js';
import { formatPrice } from '../utils/formatters.js';
import { hydrateCatalogImages, injectIcons, showToast } from '../utils/dom-utils.js';

let categories = [];
let currentPurchase = null;

const closeItemModal = () => {
  document.getElementById('itemModal')?.classList.remove('show'); document.getElementById('itemModalOverlay')?.classList.remove('show');
  document.getElementById('itemModal')?.setAttribute('aria-hidden', 'true'); document.getElementById('itemModalOverlay')?.setAttribute('aria-hidden', 'true');
};
const closeCustomerModal = () => {
  document.getElementById('customerModal')?.classList.remove('show'); document.getElementById('customerOverlay')?.classList.remove('show');
  document.getElementById('customerModal')?.setAttribute('aria-hidden', 'true'); document.getElementById('customerOverlay')?.setAttribute('aria-hidden', 'true');
};
const openLayer = (id, overlayId) => {
  document.getElementById(id)?.classList.add('show'); document.getElementById(overlayId)?.classList.add('show');
  document.getElementById(id)?.setAttribute('aria-hidden', 'false'); document.getElementById(overlayId)?.setAttribute('aria-hidden', 'false');
};

const findProduct = (productId) => {
  for (const category of categories) {
    const item = (category.items || []).find((entry) => entry.id === String(productId));
    if (item) return { category, item };
  }
  return null;
};

const openProduct = (productId) => {
  const found = findProduct(productId); if (!found) return;
  setCurrentCategory(found.category); setCurrentItem(found.item);
  const { item } = found;
  const imageTarget = document.getElementById('modalImageWrap'); if (imageTarget) imageTarget.innerHTML = `<img src="${escapeHTML(safeURL(/(?:^|\/)logo\.svg(?:[?#]|$)/iu.test(String(item.image || '')) ? '' : item.image, 'content-placeholder.svg'))}" alt="${escapeHTML(item.name)}">`;
  const nameTarget = document.getElementById('modalName'); if (nameTarget) nameTarget.textContent = item.name;
  const descriptionTarget = document.getElementById('modalDesc'); if (descriptionTarget) descriptionTarget.textContent = item.description || item.desc || '';
  const offersTarget = document.getElementById('modalOffers');
  const offers = (item.offers || []).filter((offer) => offer.status !== 'unavailable');
  if (offersTarget) offersTarget.innerHTML = offers.length ? offers.map((offer) => {
    const image = safeURL(offer.image || item.image, 'content-placeholder.svg');
    return `<article class="offer-card catalog-choice-card" role="button" tabindex="0" data-action="buy-offer" data-product-id="${escapeHTML(item.id)}" data-offer-id="${escapeHTML(offer.id || '')}"><div class="offer-image-wrap"><img src="content-placeholder.svg" data-catalog-src="${escapeHTML(image)}" alt="${escapeHTML(offer.name || item.name)}" loading="lazy" decoding="async" width="420" height="300"></div><div class="offer-info"><strong>${escapeHTML(offer.name || item.name)}</strong><p>${escapeHTML(offer.description || offer.desc || '')}</p></div></article>`;
  }).join('') : '<div class="empty-state">لا توجد عروض متاحة</div>';
  openLayer('itemModal', 'itemModalOverlay'); injectIcons();
  requestAnimationFrame(() => hydrateCatalogImages(offersTarget || document));
};

const startPurchase = (productId, offerId) => {
  const found = findProduct(productId); if (!found) return;
  const offer = (found.item.offers || []).find((entry) => String(entry.id || '') === String(offerId)) || found.item.offers?.[0];
  if (!offer) return;
  const user = authStore.getState().user;
  if (!user) {
    globalThis.sessionStorage?.setItem('hud_post_login_redirect', globalThis.location.pathname.split('/').pop() + globalThis.location.search);
    globalThis.location.href = `login.html?redirect=${encodeURIComponent(globalThis.location.pathname.split('/').pop() + globalThis.location.search)}`;
    return;
  }
  currentPurchase = { category: found.category, item: found.item, offer };
  const fields = getProductFields(found.item); const container = document.getElementById('dynamicFieldsContainer');
  if (container) container.innerHTML = fields.map((field) => `<div class="form-group"><label class="form-label" for="field-${escapeHTML(field.id)}">${escapeHTML(field.label)}${field.required ? ' *' : ''}</label>${field.type === 'note' ? `<textarea class="form-input" id="field-${escapeHTML(field.id)}" data-order-field="${escapeHTML(field.id)}" placeholder="${escapeHTML(field.placeholder || '')}" ${field.required ? 'required' : ''}></textarea>` : `<input class="form-input" id="field-${escapeHTML(field.id)}" data-order-field="${escapeHTML(field.id)}" type="${escapeHTML(['email', 'password', 'number', 'url'].includes(field.type) ? field.type : 'text')}" placeholder="${escapeHTML(field.placeholder || '')}" ${field.required ? 'required' : ''}>`}</div>`).join('');
  const details = document.getElementById('orderDetailsCard'); if (details) details.innerHTML = `<strong>${escapeHTML(found.item.name)}</strong><span>${escapeHTML(offer.name || '')}</span><b>${formatPrice(Number(offer.price || 0), offer.currency || 'YER')}</b>`;
  const total = document.getElementById('modalTotal'); if (total) total.textContent = formatPrice(Number(offer.price || 0), offer.currency || 'YER');
  const balance = getUserBalance(user.uid); const balanceTarget = document.getElementById('buyModalUserBalance'); if (balanceTarget) balanceTarget.textContent = formatPrice(balance);
  closeItemModal(); openLayer('customerModal', 'customerOverlay');
};

const submitPurchase = async (event) => {
  event.preventDefault(); if (!currentPurchase) return;
  const form = event.currentTarget; if (!form.reportValidity()) return;
  const user = authStore.getState().user; const price = Number(currentPurchase.offer.price || 0); const balance = getUserBalance(user.uid);
  if (price > balance) { showToast('toast_error_balance', 'error'); return; }
  const fields = Object.fromEntries([...form.querySelectorAll('[data-order-field]')].map((input) => [input.dataset.orderField, input.value.trim()]));
  const button = form.querySelector('[type="submit"]'); if (button) button.disabled = true;
  try {
    const order = await securePurchase({
      categoryId: currentPurchase.category.id, itemId: currentPurchase.item.id,
      offerId: currentPurchase.offer.id, customerFields: fields
    });
    await refreshBalance(user.uid).catch(() => {});
    closeCustomerModal(); form.reset(); currentPurchase = null; showToast('toast_order_saved_with_id', 'success', { replacements: { id: order.id } });
  } catch (error) {
    console.error('[category] secure purchase failed', error);
    showToast(error.message || 'toast_order_save_failed', 'error');
  } finally { if (button) button.disabled = false; }
};

const renderPage = (categoryId) => {
  const target = document.getElementById('pageContent'); if (!target) return;
  const category = categories.find((entry) => entry.id === categoryId);
  if (!category) {
    target.innerHTML = `<section class="section"><div class="section-header"><h1 class="section-title">الأقسام</h1></div><div class="categories-grid">${categories.map((entry) => CategoryCard({ category: entry })).join('')}</div></section>`;
  } else {
    setCurrentCategory(category);
    target.innerHTML = `<section class="section"><div class="section-header"><a href="category.html" class="btn btn-outline">كل الأقسام</a><h1 class="section-title">${escapeHTML(category.name)}</h1><p>${escapeHTML(category.description || category.desc || '')}</p></div><div class="items-grid">${(category.items || []).map((item) => ProductCard({ product: item, categoryId: category.id })).join('')}</div></section>`;
  }
  const menu = document.getElementById('menuCategories'); if (menu) menu.innerHTML = categories.map((entry) => `<a class="menu-link" href="category.html?id=${encodeURIComponent(entry.id)}">${escapeHTML(entry.name)}</a>`).join('');
  injectIcons();
  requestAnimationFrame(() => hydrateCatalogImages(target));
};

const bindEvents = () => {
  document.addEventListener('click', (event) => {
    const productButton = event.target.closest('[data-action="select-product"]'); if (productButton) { event.preventDefault(); openProduct(productButton.dataset.productId); }
    const offerButton = event.target.closest('[data-action="buy-offer"]'); if (offerButton) startPurchase(offerButton.dataset.productId, offerButton.dataset.offerId);
  });
  document.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    const choice = event.target.closest('.catalog-choice-card[data-action]');
    if (choice) { event.preventDefault(); choice.click(); }
  });
  document.getElementById('closeItemModalBtn')?.addEventListener('click', closeItemModal);
  document.getElementById('itemModalOverlay')?.addEventListener('click', closeItemModal);
  document.getElementById('customerOverlay')?.addEventListener('click', closeCustomerModal);
  document.getElementById('customerForm')?.addEventListener('submit', submitPurchase);
};

export const initCategoryPage = async () => {
  await initCommonPage();
  categories = await loadCategories(false);
  const params = new URLSearchParams(globalThis.location.search);
  const categoryId = params.get('id');
  renderPage(categoryId); bindEvents();
  if (params.get('item')) openProduct(params.get('item'));
  // Customer catalog is snapshot-based. New admin changes appear only after the fixed refresh button.
  globalThis.addEventListener('hud:categories-updated', async (event) => {
    if (!event.detail?.categories) return;
    categories = event.detail.categories; renderPage(categoryId);
  });
};

export default initCategoryPage;
