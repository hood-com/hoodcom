import { initCommonPage } from './common.js';
import authStore from '../stores/auth-store.js';
import { loadCategories } from '../stores/category-store.js';
import { getCachedCategories } from '../services/category-service.js';
import { getSnapshot, isFullCatalogReady, setSnapshot } from '../services/catalog-cache.js';
import { getSiteSettings, renderFeaturedOffers, renderDynamicContacts, renderHoodAbout, renderContactPlatforms } from '../services/settings-service.js';
import { initReviews, submitReview } from '../services/review-service.js';
import CategoryCard from '../components/CategoryCard.js';
import ProductCard from '../components/ProductCard.js';
import ReviewForm, { ReviewCard } from '../components/ReviewForm.js';
import { escapeHTML, safeURL } from '../utils/sanitizers.js';
import { hydrateCatalogImages, injectIcons, showToast } from '../utils/dom-utils.js';
import { icon } from '../utils/icons.js';

const byId = (id) => document.getElementById(id);
let categories = [];
let reviewUnsubscribe = null;

const emptyState = (message) => `<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:36px 18px;color:var(--text-secondary)">${icon('info', 28)}<p>${escapeHTML(message)}</p></div>`;

const renderCategories = (items = categories) => {
  const grid = byId('homeCategoriesGrid');
  if (!grid) return;
  const enabled = items.filter((entry) => entry.enabled !== false);
  grid.innerHTML = enabled.length ? enabled.map((category) => CategoryCard({ category })).join('') : emptyState('لا توجد أقسام متاحة حالياً');
  const menu = byId('menuCategories');
  if (menu) menu.innerHTML = enabled.map((category) => `<a class="menu-link" href="category.html?id=${encodeURIComponent(category.id)}"><div class="menu-link-icon">${icon('layers', 17)}</div><span>${escapeHTML(category.name)}</span></a>`).join('');
  injectIcons();
  requestAnimationFrame(() => hydrateCatalogImages(grid));
};

const renderFeatured = () => {
  const section = byId('featuredSection'); const grid = byId('featuredGrid');
  if (!section || !grid) return;
  const entries = renderFeaturedOffers(categories);
  section.style.display = entries.length ? '' : 'none';
  grid.innerHTML = entries.map((item) => ProductCard({ product: item, currency: item.currency || 'YER' })).join('');
  requestAnimationFrame(() => hydrateCatalogImages(grid));
};

const renderContacts = () => {
  const settings = getSiteSettings();
  const contacts = renderDynamicContacts();
  const cards = contacts.map((contact) => {
    const href = safeURL(contact.href || contact.value, '#');
    return `<a class="contact-card" href="${escapeHTML(href)}"${/^https?:/u.test(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}><span>${icon(contact.icon || 'support', 24)}</span><strong>${escapeHTML(contact.label || contact.name || 'تواصل معنا')}</strong><small>${escapeHTML(contact.displayValue || contact.value || '')}</small></a>`;
  }).join('');
  if (byId('dynamicContactGrid')) byId('dynamicContactGrid').innerHTML = cards || emptyState('قنوات التواصل ستتوفر قريباً');
  if (byId('dynamicFooterContact')) byId('dynamicFooterContact').innerHTML = contacts.map((c) => `<a href="${escapeHTML(safeURL(c.href || c.value, '#'))}">${escapeHTML(c.label || c.name || c.value || '')}</a>`).join('');
  const about = renderHoodAbout();
  if (byId('hoodAboutSection')) byId('hoodAboutSection').innerHTML = about.enabled ? `<div class="section-header"><h2 class="section-title">${escapeHTML(about.title || settings.storeName)}</h2><p class="section-desc">${escapeHTML(about.text || '')}</p></div>` : '';
  const platforms = renderContactPlatforms();
  if (byId('contactPlatformsSection')) byId('contactPlatformsSection').innerHTML = platforms.enabled && platforms.platforms.length ? `<div class="section-header"><h2 class="section-title">${escapeHTML(platforms.title)}</h2></div>` : '';
};

const bindReviewForm = () => {
  const form = byId('reviewForm'); if (!form) return;
  const rating = byId('reviewRating');
  form.querySelectorAll('[data-value]').forEach((button) => button.addEventListener('click', () => {
    const value = Number(button.dataset.value); if (rating) rating.value = String(value);
    form.querySelectorAll('[data-value]').forEach((star) => star.classList.toggle('active', Number(star.dataset.value) <= value));
  }));
  byId('reviewMessage')?.addEventListener('input', (event) => { if (byId('reviewCharCount')) byId('reviewCharCount').textContent = String(event.target.value.length); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const button = byId('reviewSubmitBtn');
    if (button) button.disabled = true;
    try {
      await submitReview({ message: byId('reviewMessage')?.value || '', rating: Number(rating?.value || 5) });
      form.reset(); if (rating) rating.value = '5'; showToast('تم نشر تعليقك بنجاح', 'success');
    } catch (error) { showToast(error.message || 'تعذر نشر التعليق', 'error', { sticky: true }); }
    finally { if (button) button.disabled = false; }
  });
};

const renderReviewGate = () => {
  const host = byId('reviewFormContainer'); if (!host) return;
  host.innerHTML = ReviewForm({ user: authStore.getState().user, rating: 5 });
  bindReviewForm(); injectIcons();
};
const renderReviews = (reviews = []) => {
  const list = byId('reviewsList'); if (!list) return;
  list.innerHTML = reviews.length ? reviews.map((review) => ReviewCard({ review })).join('') : emptyState('لا توجد تعليقات بعد — كن أول من يشارك تجربته');
};

const bindSearch = () => {
  const input = byId('searchModalInput'); if (!input) return;
  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase(); const target = byId('searchResultsContainer'); if (!target) return;
    if (!term) { target.innerHTML = emptyState('اكتب للبحث في الأقسام والمنتجات والعروض'); return; }
    const found = categories.filter((category) => `${category.name} ${category.description}`.toLowerCase().includes(term));
    target.innerHTML = found.length ? found.map((category) => CategoryCard({ category })).join('') : emptyState('لا توجد نتائج مطابقة');
  });
};


export const initHomePage = async () => {
  const commonReady = initCommonPage().catch((error) => console.warn('[home] common initialization delayed', error));
  const year = byId('footerYear'); if (year) year.textContent = String(new Date().getFullYear());
  bindSearch(); renderContacts(); injectIcons();

  // Cache-first: after the first complete download, navigation never refetches the catalog.
  const cached = await getCachedCategories();
  if (cached.length && isFullCatalogReady()) {
    categories = cached; renderCategories(); renderFeatured();
    const reviewCache = await getSnapshot('public-reviews-v1');
    if (Array.isArray(reviewCache?.reviews)) renderReviews(reviewCache.reviews);
  } else {
    // First visit intentionally downloads every public shared dataset once.
    const [catalog, reviews] = await Promise.all([
      loadCategories(true),
      initReviews().catch(() => []),
      import('../services/settings-service.js').then((mod) => mod.loadSiteSettingsFromFirebase()).catch(() => null),
      import('../services/wallet-service.js').then((mod) => mod.loadWalletsFromFirebase()).catch(() => []),
      import('../services/balance-service.js').then((mod) => Promise.all([
        mod.loadTopupServicesFromCloud(), mod.loadTopupSettingsFromCloud()
      ])).catch(() => [])
    ]);
    categories = catalog;
    if (categories.length) { renderCategories(); renderFeatured(); }
    renderContacts(); renderReviews(reviews);
    await setSnapshot('public-reviews-v1', { reviews, cachedAt: Date.now() });
  }

  await commonReady;
  renderReviewGate();
  authStore.subscribe(() => renderReviewGate());
  globalThis.addEventListener('hud:site-settings-updated', () => renderContacts());
  globalThis.addEventListener('hud:categories-updated', async (event) => {
    if (event.detail?.categories) { categories = event.detail.categories; renderCategories(); renderFeatured(); }
  });
  globalThis.addEventListener('hud:reviews-updated', async (event) => {
    const reviews = event.detail?.reviews || []; renderReviews(reviews);
    await setSnapshot('public-reviews-v1', { reviews, cachedAt: Date.now() });
  });
  globalThis.addEventListener('hud:review-submitted', () => void initReviews(renderReviews));
};

export default initHomePage;
