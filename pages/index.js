import { initCommonPage } from './common.js';
import authStore from '../stores/auth-store.js';
import { loadCategories } from '../stores/category-store.js';
import { getSiteSettings, getFeaturedOffers, renderFeaturedOffers, renderDynamicContacts, renderHoodAbout, renderContactPlatforms } from '../services/settings-service.js';
import { initReviews, submitReview } from '../services/review-service.js';
import CategoryCard from '../components/CategoryCard.js';
import ProductCard from '../components/ProductCard.js';
import ReviewForm, { ReviewCard } from '../components/ReviewForm.js';
import { escapeHTML, safeURL } from '../utils/sanitizers.js';
import { injectIcons, showToast } from '../utils/dom-utils.js';
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
};

const renderFeatured = () => {
  const section = byId('featuredSection'); const grid = byId('featuredGrid');
  if (!section || !grid) return;
  const entries = renderFeaturedOffers(categories);
  section.style.display = entries.length ? '' : 'none';
  grid.innerHTML = entries.map((item) => ProductCard({ product: item, currency: item.currency || 'YER' })).join('');
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

const runWhenIdle = (callback, timeout = 1800) => {
  if ('requestIdleCallback' in globalThis) return globalThis.requestIdleCallback(callback, { timeout });
  return globalThis.setTimeout(callback, Math.min(timeout, 900));
};
const runWhenVisible = (target, callback, rootMargin = '500px') => {
  if (!target || !('IntersectionObserver' in globalThis)) { void callback(); return () => {}; }
  let called = false;
  const observer = new IntersectionObserver((entries) => {
    if (called || !entries.some((entry) => entry.isIntersecting)) return;
    called = true; observer.disconnect(); void callback();
  }, { rootMargin });
  observer.observe(target);
  return () => observer.disconnect();
};
const loadCategorySummaries = async () => {
  const response = await fetch('/.netlify/functions/catalog-api', { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('تعذر تحميل فهرس الأقسام');
  const payload = await response.json();
  return Array.isArray(payload.categories) ? payload.categories : [];
};

export const initHomePage = async () => {
  // Critical UI starts immediately. Network/session work must never block first paint.
  const commonReady = initCommonPage().catch((error) => console.warn('[home] common initialization delayed', error));
  const year = byId('footerYear'); if (year) year.textContent = String(new Date().getFullYear());
  bindSearch(); renderContacts(); injectIcons();

  // Home receives lightweight category summaries; nested products/offers load only when needed.
  void loadCategorySummaries().then((summaries) => {
    categories = summaries; renderCategories();
  }).catch(async (error) => {
    console.warn('[home] summary endpoint fallback', error);
    try { categories = await loadCategories(); renderCategories(); }
    catch (fallbackError) { console.error('[home] categories failed', fallbackError); renderCategories([]); }
  });

  // Auth chrome and the review gate update when session resolution completes.
  void commonReady.then(() => renderReviewGate());
  authStore.subscribe(() => renderReviewGate());

  // Reviews are below the fold: do not request them until the user approaches the section.
  const stopReviewObserver = runWhenVisible(byId('reviewsSection'), async () => {
    try { const initial = await initReviews(renderReviews); renderReviews(initial); }
    catch { renderReviews([]); }
  }, '420px');

  // Full nested catalog is only needed on home when featured entries are configured.
  if (getFeaturedOffers().length) {
    runWhenIdle(async () => {
      try { categories = await loadCategories(); renderCategories(); renderFeatured(); }
      catch (error) { console.warn('[home] featured catalog deferred', error); }
    }, 2200);
  } else {
    const section = byId('featuredSection'); if (section) section.style.display = 'none';
  }

  globalThis.addEventListener('hud:site-settings-updated', () => { renderContacts(); });
  globalThis.addEventListener('hud:categories-updated', (event) => {
    categories = event.detail?.categories || categories; renderCategories(); renderFeatured();
  });
  globalThis.addEventListener('hud:review-submitted', () => void initReviews(renderReviews));
  return () => { stopReviewObserver?.(); reviewUnsubscribe?.(); };
};

export default initHomePage;
