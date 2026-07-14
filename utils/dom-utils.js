import { icon } from './icons.js';
import { t, translateMessage } from './i18n.js';

const byId = (id, root = globalThis.document) => root?.getElementById?.(id) || null;

export const injectIcons = (root = globalThis.document) => {
  if (!root?.querySelectorAll) return 0;
  let count = 0;
  root.querySelectorAll('[data-icon]').forEach((element) => {
    const name = element.dataset.icon || 'info';
    const size = Number(element.dataset.size || 20);
    const signature = `${name}:${size}`;
    if (element.dataset.iconInjected === signature) return;
    element.innerHTML = icon(name, size);
    element.dataset.iconInjected = signature;
    count += 1;
  });
  return count;
};

let iconInjectionQueued = false;
export const scheduleIconInjection = (root = globalThis.document) => {
  if (iconInjectionQueued) return;
  iconInjectionQueued = true;
  const schedule = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0));
  schedule(() => { iconInjectionQueued = false; injectIcons(root); });
};

let toastTimer = null;
let activeToastPayload = null;

const ensureToastElement = (root = globalThis.document) => {
  if (!root?.body || !root.createElement) return null;
  let toast = root.getElementById('toast');
  if (!toast) {
    toast = root.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');

    const iconTarget = root.createElement('div');
    iconTarget.className = 'toast-icon';
    const textTarget = root.createElement('span');
    textTarget.id = 'toastText';
    toast.append(iconTarget, textTarget);
    root.body.append(toast);
  }
  return toast;
};

export const showToast = (messageOrKey, type = 'success', options = {}) => {
  const { duration = 4000, sticky = false, replacements = {}, root = globalThis.document } = options;
  const toast = ensureToastElement(root);
  if (!toast) return false;

  let text = root.getElementById('toastText') || toast.querySelector('[data-toast-text]');
  if (!text) {
    text = root.createElement('span');
    text.dataset.toastText = 'true';
    toast.append(text);
  }

  const translated = translateMessage(messageOrKey, replacements);
  const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'success';
  // Ensure text is not empty
  text.textContent = translated || String(messageOrKey || 'تم');
  // Reset classes properly - remove all type classes first
  toast.classList.remove('error', 'success', 'warning', 'info');
  toast.className = `toast show ${safeType}`;
  toast.dataset.messageKey = typeof messageOrKey === 'string' ? messageOrKey : (messageOrKey?.key || '');
  // Force reflow to ensure animation restarts
  void toast.offsetWidth;

  let iconTarget = toast.querySelector('.toast-icon');
  if (!iconTarget) {
    iconTarget = root.createElement('div');
    iconTarget.className = 'toast-icon';
    toast.prepend(iconTarget);
  }
  // Fixed icon logic - success = check, error/warning = alert, info = info
  const iconName = safeType === 'success' ? 'check' : (safeType === 'error' ? 'alert' : (safeType === 'warning' ? 'alert' : 'info'));
  iconTarget.innerHTML = icon(iconName, 18);

  let close = toast.querySelector('.toast-close-btn');
  if (!close) {
    close = root.createElement('button');
    close.type = 'button';
    close.className = 'toast-close-btn';
    close.addEventListener('click', () => {
      toast.classList.remove('show');
      activeToastPayload = null;
      if (toastTimer) {
        globalThis.clearTimeout(toastTimer);
        toastTimer = null;
      }
    });
    toast.append(close);
  }
  close.setAttribute('aria-label', t('toast_close') || 'إغلاق');
  close.textContent = '×';

  activeToastPayload = { messageOrKey, type: safeType, options: { ...options, root } };
  if (toastTimer) {
    globalThis.clearTimeout(toastTimer);
    toastTimer = null;
  }
  // Auto-hide even if sticky, but with longer duration for sticky
  const finalDuration = sticky ? Math.max(duration, 6000) : duration;
  if (finalDuration > 0) {
    toastTimer = globalThis.setTimeout(() => {
      toast.classList.remove('show');
      activeToastPayload = null;
      toastTimer = null;
    }, finalDuration);
  }
  return true;
};

export const refreshActiveToastTranslation = () => {
  if (!activeToastPayload) return false;
  return showToast(activeToastPayload.messageOrKey, activeToastPayload.type, activeToastPayload.options);
};

export const openMobileMenu = () => {
  const drawer = byId('menuDrawer'); const overlay = byId('menuOverlay'); const button = byId('menuBtn');
  drawer?.classList.add('open'); overlay?.classList.add('show');
  drawer?.setAttribute('aria-hidden', 'false'); overlay?.setAttribute('aria-hidden', 'false'); button?.setAttribute('aria-expanded', 'true');
  return Boolean(drawer);
};

export const closeMobileMenu = () => {
  const drawer = byId('menuDrawer'); const overlay = byId('menuOverlay'); const button = byId('menuBtn');
  drawer?.classList.remove('open'); overlay?.classList.remove('show');
  drawer?.setAttribute('aria-hidden', 'true'); overlay?.setAttribute('aria-hidden', 'true'); button?.setAttribute('aria-expanded', 'false');
  return Boolean(drawer);
};

export const initNavScroll = () => {
  const navbar = byId('navbar');
  if (!navbar || navbar.dataset.scrollReady) return () => {};
  navbar.dataset.scrollReady = 'true';
  const update = () => navbar.classList.toggle('scrolled', globalThis.scrollY > 24);
  globalThis.addEventListener?.('scroll', update, { passive: true }); update();
  return () => globalThis.removeEventListener?.('scroll', update);
};

export const initBackTop = () => {
  const button = byId('backTop');
  if (!button || button.dataset.backTopReady) return () => {};
  button.dataset.backTopReady = 'true';
  const update = () => button.classList.toggle('show', globalThis.scrollY > 450);
  const click = () => globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  globalThis.addEventListener?.('scroll', update, { passive: true }); button.addEventListener('click', click); update();
  return () => { globalThis.removeEventListener?.('scroll', update); button.removeEventListener('click', click); };
};

export const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
  if (!(file instanceof Blob)) { reject(new TypeError('A File or Blob is required')); return; }
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(reader.error || new Error('Unable to read file'));
  reader.readAsDataURL(file);
});

export const compressImageFile = async (file, options = {}) => {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.82,
    outputType = 'image/webp',
    maxBytes = 10 * 1024 * 1024
  } = options;
  if (!file) return '';
  if (!String(file.type || '').startsWith('image/')) throw new Error('الملف المحدد ليس صورة');
  if (file.size > maxBytes) throw new Error('حجم الصورة أكبر من الحد المسموح');

  const original = await readFileAsDataURL(file);
  if (/image\/(?:svg\+xml|gif)/iu.test(file.type)) return original;
  const root = globalThis.document;
  if (!root?.createElement) return original;

  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    element.src = original;
  });
  const ratio = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = root.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: outputType === 'image/png' });
  if (!context) return original;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  const compressed = canvas.toDataURL(outputType, Math.min(1, Math.max(0.35, Number(quality) || 0.82)));
  return compressed.length < original.length || ratio < 1 ? compressed : original;
};

export const bindImagePreview = (input, preview, options = {}) => {
  if (!input || !preview) return () => {};
  const handler = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const imageData = await compressImageFile(file, options);
      preview.src = imageData;
      preview.dataset.imageValue = imageData;
      preview.style.display = 'block';
      preview.hidden = false;
    } catch (error) {
      if (typeof options.onError === 'function') options.onError(error);
      else console.warn('[dom-utils] image preview failed', error);
    }
  };
  input.addEventListener('change', handler);
  return () => input.removeEventListener('change', handler);
};

export const initMenuControls = () => {
  const openButton = byId('menuBtn'); const closeButton = byId('menuCloseBtn'); const overlay = byId('menuOverlay');
  openButton?.addEventListener('click', openMobileMenu);
  closeButton?.addEventListener('click', closeMobileMenu);
  overlay?.addEventListener('click', closeMobileMenu);
  return () => {
    openButton?.removeEventListener('click', openMobileMenu);
    closeButton?.removeEventListener('click', closeMobileMenu);
    overlay?.removeEventListener('click', closeMobileMenu);
  };
};

const ADMIN_STATUS_ID = 'adminStatusIndicator';

/**
 * Creates or updates the fixed, non-interactive administration status badge.
 * Repeated calls are idempotent so Realtime updates can call this directly.
 */
export const createAdminStatusIndicator = (available = false, root = globalThis.document) => {
  if (!root?.body || !root.createElement) return null;
  let indicator = root.getElementById(ADMIN_STATUS_ID);

  if (!indicator) {
    indicator = root.createElement('div');
    indicator.id = ADMIN_STATUS_ID;
    indicator.className = 'admin-status-indicator';
    indicator.setAttribute('role', 'status');
    indicator.setAttribute('aria-live', 'polite');
    indicator.setAttribute('aria-atomic', 'true');
    indicator.setAttribute('tabindex', '-1');
    indicator.setAttribute('data-non-interactive', 'true');

    const dot = root.createElement('span');
    dot.className = 'admin-status-indicator__dot';
    dot.setAttribute('aria-hidden', 'true');

    const label = root.createElement('span');
    label.className = 'admin-status-indicator__label';
    indicator.append(dot, label);
    root.body.append(indicator);
  }

  const isAvailable = Boolean(available);
  indicator.dataset.available = String(isAvailable);
  indicator.classList.toggle('is-available', isAvailable);
  indicator.classList.toggle('is-unavailable', !isAvailable);
  indicator.setAttribute('aria-label', isAvailable ? 'الإدارة متاحة الآن' : 'الإدارة غير متاحة');
  indicator.title = isAvailable ? 'الإدارة متاحة الآن' : 'الإدارة غير متاحة';

  const label = indicator.querySelector('.admin-status-indicator__label');
  if (label) label.textContent = isAvailable ? '🟢 الإدارة متاحة الآن' : '🔴 الإدارة غير متاحة';
  return indicator;
};

export const updateAdminStatusIndicator = (available, root = globalThis.document) => createAdminStatusIndicator(available, root);

/* ============================
   HUD COM Refresh System v1
   ============================ */

const REFRESH_BTN_ID = 'hudRefreshBtn';

const setRefreshButtonState = (button, refreshing) => {
  if (!button) return;
  const iconEl = button.querySelector('[data-icon="refresh"], .refresh-icon');
  const spinner = button.querySelector('.refresh-spinner');
  button.classList.toggle('refreshing', refreshing);
  button.disabled = refreshing;
  button.setAttribute('aria-busy', String(refreshing));
  if (iconEl) iconEl.style.display = refreshing ? 'none' : 'inline-flex';
  if (spinner) spinner.style.display = refreshing ? 'inline-block' : 'none';
};

export const refreshAllData = async (options = {}) => {
  const { silent = false } = options;
  const tasks = [];

  // Categories
  tasks.push((async () => {
    try {
      const mod = await import('../services/category-service.js');
      if (typeof mod.loadCategoriesFromFirebase === 'function') {
        await mod.loadCategoriesFromFirebase();
      }
      if (typeof globalThis.window !== 'undefined' && typeof globalThis.window.refreshCategories === 'function') {
        await globalThis.window.refreshCategories();
      }
      return { ok: true, key: 'categories' };
    } catch (error) { return { ok: false, key: 'categories', error }; }
  })());

  // Settings
  tasks.push((async () => {
    try {
      const mod = await import('../services/settings-service.js');
      if (typeof mod.loadSiteSettingsFromFirebase === 'function') {
        await mod.loadSiteSettingsFromFirebase();
      }
      if (typeof globalThis.window?.refreshSettings === 'function') {
        await globalThis.window.refreshSettings();
      }
      return { ok: true, key: 'settings' };
    } catch (error) { return { ok: false, key: 'settings', error }; }
  })());

  // Wallets
  tasks.push((async () => {
    try {
      const mod = await import('../services/wallet-service.js');
      if (typeof mod.loadWalletsFromFirebase === 'function') {
        await mod.loadWalletsFromFirebase();
      }
      if (typeof globalThis.window?.refreshWallets === 'function') {
        await globalThis.window.refreshWallets();
      }
      return { ok: true, key: 'wallets' };
    } catch (error) { return { ok: false, key: 'wallets', error }; }
  })());

  // Balance
  tasks.push((async () => {
    try {
      const mod = await import('../services/balance-service.js');
      if (typeof mod.loadAllUserBalancesFromCloud === 'function') {
        await mod.loadAllUserBalancesFromCloud();
      }
      if (typeof mod.loadTopupSettingsFromCloud === 'function') {
        await mod.loadTopupSettingsFromCloud();
      }
      if (typeof globalThis.window?.refreshBalance === 'function') {
        await globalThis.window.refreshBalance();
      }
      return { ok: true, key: 'balance' };
    } catch (error) { return { ok: false, key: 'balance', error }; }
  })());

  // Reviews
  tasks.push((async () => {
    try {
      const mod = await import('../services/review-service.js');
      if (typeof mod.loadReviewsOnce === 'function') {
        await mod.loadReviewsOnce({ refresh: true });
      }
      if (typeof mod.refreshReviews === 'function') {
        await mod.refreshReviews();
      }
      if (typeof globalThis.window?.refreshReviews === 'function') {
        await globalThis.window.refreshReviews();
      }
      return { ok: true, key: 'reviews' };
    } catch (error) { return { ok: false, key: 'reviews', error }; }
  })());

  // Topup services (deposit)
  tasks.push((async () => {
    try {
      const mod = await import('../services/balance-service.js');
      if (typeof mod.loadTopupServicesFromCloud === 'function') {
        await mod.loadTopupServicesFromCloud();
      }
      return { ok: true, key: 'topup_services' };
    } catch (error) { return { ok: false, key: 'topup_services', error }; }
  })());

  const results = await Promise.allSettled(tasks);
  const flattened = results.map(r => r.value || r.reason).flat();
  const failed = flattened.filter(x => x && x.ok === false);

  // Dispatch global refresh event for page-level listeners
  try {
    globalThis.dispatchEvent?.(new CustomEvent('hud:refresh-complete', {
      detail: { success: failed.length === 0, failed: failed.map(f => f.key) }
    }));
  } catch {}

  if (failed.length && !silent) {
    console.warn('[refresh] partial failure', failed);
    throw new Error(`فشل تحديث: ${failed.map(f=>f.key).join(', ')}`);
  }
  return { success: true, failed: [] };
};

export const handleRefresh = async (event) => {
  event?.preventDefault?.();
  const button = byId(REFRESH_BTN_ID) || event?.currentTarget;
  if (!button || button.disabled) return false;

  setRefreshButtonState(button, true);

  try {
    showToast('toast_info_loading', 'info', { duration: 1800 });
    await refreshAllData();
    showToast('✅ تم تحديث الموقع بنجاح', 'success');
    // Soft re-render hooks
    try {
      globalThis.dispatchEvent?.(new CustomEvent('hud:categories-updated', { detail: { source: 'refresh-btn' } }));
    } catch {}
    return true;
  } catch (error) {
    console.error('[refresh] failed', error);
    showToast('❌ حدث خطأ أثناء التحديث', 'error');
    return false;
  } finally {
    setRefreshButtonState(button, false);
  }
};

export const createRefreshButton = (options = {}) => {
  const root = options.root || globalThis.document;
  if (!root?.body || !root.createElement) return null;
  let button = root.getElementById(REFRESH_BTN_ID);
  if (button) return button;

  button = root.createElement('button');
  button.id = REFRESH_BTN_ID;
  button.className = 'refresh-btn hud-refresh-btn';
  button.type = 'button';
  button.setAttribute('aria-label', 'تحديث الموقع');
  button.setAttribute('title', 'تحديث جميع بيانات الموقع');
  button.innerHTML = `
    <span class="refresh-icon" data-icon="refresh" data-size="22" aria-hidden="true"></span>
    <span class="refresh-spinner" style="display:none;" aria-hidden="true"></span>
  `;
  button.addEventListener('click', handleRefresh);

  // Insert before back-top if exists, else append to body
  const backTop = root.getElementById('backTop');
  if (backTop?.parentNode) {
    backTop.parentNode.insertBefore(button, backTop);
  } else {
    root.body.appendChild(button);
  }

  injectIcons(button);
  return button;
};

export const destroyRefreshButton = (root = globalThis.document) => {
  const button = root.getElementById?.(REFRESH_BTN_ID);
  if (button) {
    button.removeEventListener('click', handleRefresh);
    button.remove();
    return true;
  }
  return false;
};

export const initRefreshButton = (options = {}) => {
  const button = createRefreshButton(options);
  // Expose global refresh helpers for legacy callers
  if (typeof globalThis.window !== 'undefined') {
    globalThis.window.refreshAllData = refreshAllData;
    globalThis.window.handleRefresh = handleRefresh;
  }
  return button;
};

export default Object.freeze({
  injectIcons, scheduleIconInjection, showToast, refreshActiveToastTranslation,
  readFileAsDataURL, compressImageFile, bindImagePreview,
  openMobileMenu, closeMobileMenu, initNavScroll, initBackTop, initMenuControls, createAdminStatusIndicator,
  updateAdminStatusIndicator,
  createRefreshButton, destroyRefreshButton, handleRefresh, refreshAllData, initRefreshButton
});
