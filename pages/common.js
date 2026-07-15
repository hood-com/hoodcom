import authStore, { checkSession, logout } from '../stores/auth-store.js';
import uiStore, { toggleTheme } from '../stores/ui-store.js';
import {
  initBackTop, initMenuControls, initNavScroll, injectIcons, showToast,
  refreshActiveToastTranslation, createAdminStatusIndicator, closeMobileMenu,
  initRefreshButton
} from '../utils/dom-utils.js';
import { initTranslationSystem, subscribeLanguage, t } from '../utils/i18n.js';
import { getUserBalance } from '../services/balance-service.js';
import {
  getSiteSettings, getSupportChannels, loadSiteSettingsFromFirebase,
  subscribeAdminAvailability, subscribeSiteSettings
} from '../services/settings-service.js';
import Modal from '../components/Modal.js';
import { escapeHTML, escapeAttr, sanitizeNumber } from '../utils/sanitizers.js';
import { icon } from '../utils/icons.js';

const display = (element, visible, visibleValue = '') => { if (element) element.style.display = visible ? visibleValue : 'none'; };
let adminAvailabilityInitialization = null;
let unsubscribeAdminAvailability = null;
let unsubscribeLanguageChanges = null;
let supportModalKeyHandler = null;
let supportModalReturnFocus = null;

const SUPPORT_TRIGGER_SELECTOR = [
  '.bottom-nav-support-glow', '.bottom-nav-support', '.floating-whatsapp',
  '.float-whatsapp', '.footer-support-link', '#menuSupportLink', '#menuAdminPhoneLink',
  '#menuWhatsappLink', '#menuChannelLink', '.whatsapp-link', '[data-support-modal]'
].join(',');

const supportGroupInfo = Object.freeze({
  platforms: { titleKey: 'support_group_platforms', iconName: 'support' },
  contacts: { titleKey: 'support_group_contacts', iconName: 'phone' },
  about: { titleKey: 'support_group_about', iconName: 'info' },
  official: { titleKey: 'support_group_official', iconName: 'shield' }
});

const genericSupportLabels = Object.freeze({
  'واتساب': 'support_channel_whatsapp', whatsapp: 'support_channel_whatsapp',
  'اتصال': 'support_channel_phone', call: 'support_channel_phone', phone: 'support_channel_phone',
  'تلجرام': 'support_channel_telegram', telegram: 'support_channel_telegram',
  'بريد إلكتروني': 'support_channel_email', email: 'support_channel_email',
  'رابط': 'support_channel_link', link: 'support_channel_link',
  'قناة واتساب': 'support_channel_whatsapp_channel', 'whatsapp channel': 'support_channel_whatsapp_channel'
});

const supportChannelLabel = (channel) => {
  if (channel.labelIsKey) return t(channel.label);
  const translationKey = genericSupportLabels[String(channel.label || '').trim().toLowerCase()];
  return translationKey ? t(translationKey) : channel.label;
};

const supportChannelCard = (channel) => {
  const label = supportChannelLabel(channel);
  const description = t(channel.description || `support_description_${channel.type}`);
  const target = channel.opensNewTab ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${escapeAttr(channel.href)}"${target} class="support-channel-card" data-support-channel="${escapeAttr(channel.id)}">
    <div class="support-channel-info">
      <div class="support-channel-icon type-${escapeAttr(channel.type)}">${icon(channel.icon, 24)}</div>
      <div class="support-channel-texts">
        <strong>${escapeHTML(label)}</strong>
        <span class="support-channel-description">${escapeHTML(description)}</span>
        <small class="support-channel-value">${escapeHTML(channel.value)}</small>
      </div>
    </div>
    <div class="support-channel-action"><span>${escapeHTML(t('support_channel_open'))}</span>${icon('chevron', 17)}</div>
  </a>`;
};

const buildSupportModalBody = (channels) => {
  if (!channels.length) return `<div class="support-channels-empty">${icon('support', 34)}<p>${escapeHTML(t('support_no_channels'))}</p></div>`;
  return Object.keys(supportGroupInfo).map((source) => {
    const entries = channels.filter((channel) => channel.source === source);
    if (!entries.length) return '';
    const group = supportGroupInfo[source];
    return `<section class="support-channel-group" data-support-group="${escapeAttr(source)}">
      <h3>${icon(group.iconName, 17)}<span>${escapeHTML(t(group.titleKey))}</span><b>${entries.length}</b></h3>
      <div class="support-channels-grid">${entries.map(supportChannelCard).join('')}</div>
    </section>`;
  }).join('');
};

export const closeSupportChannelsModal = (options = {}) => {
  const root = document.getElementById('supportChannelsModalRoot');
  if (!root) return false;
  const modal = document.getElementById('supportChannelsModal');
  const overlay = root.querySelector('[data-modal-overlay="supportChannelsModal"]');
  modal?.classList.remove('active', 'show');
  overlay?.classList.remove('active', 'show');
  document.body.classList.remove('support-modal-open');
  if (supportModalKeyHandler) {
    document.removeEventListener('keydown', supportModalKeyHandler);
    supportModalKeyHandler = null;
  }
  const returnFocus = supportModalReturnFocus;
  supportModalReturnFocus = null;
  if (options.immediate) root.remove();
  else globalThis.setTimeout(() => root.remove(), 260);
  if (options.restoreFocus !== false) returnFocus?.focus?.();
  return true;
};

export const openSupportChannelsModal = (event) => {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  closeMobileMenu();
  const previousReturnFocus = supportModalReturnFocus;
  closeSupportChannelsModal({ immediate: true, restoreFocus: false });
  supportModalReturnFocus = event?.currentTarget || event?.target?.closest?.(SUPPORT_TRIGGER_SELECTOR) || previousReturnFocus || null;

  const channels = getSupportChannels();
  const body = buildSupportModalBody(channels);
  const footer = `<button type="button" class="btn btn-outline support-modal-close-button" data-action="close-modal">${icon('close', 16)}<span>${escapeHTML(t('support_channel_close'))}</span></button>`;
  const root = document.createElement('div');
  root.id = 'supportChannelsModalRoot';
  root.innerHTML = Modal({
    id: 'supportChannelsModal',
    title: t('support_modal_title'),
    subtitle: t('support_modal_subtitle'),
    body,
    footer,
    open: true,
    variant: 'support',
    className: 'support-channels-modal',
    overlayClassName: 'support-channels-overlay',
    closeLabel: t('support_channel_close')
  });
  document.body.append(root);
  document.body.classList.add('support-modal-open');

  root.querySelectorAll('[data-action="close-modal"], [data-modal-overlay="supportChannelsModal"]')
    .forEach((control) => control.addEventListener('click', () => closeSupportChannelsModal()));
  root.querySelectorAll('[data-support-channel]')
    .forEach((link) => link.addEventListener('click', () => closeSupportChannelsModal()));
  supportModalKeyHandler = (keyboardEvent) => {
    if (keyboardEvent.key === 'Escape') closeSupportChannelsModal();
  };
  document.addEventListener('keydown', supportModalKeyHandler);
  document.getElementById('supportChannelsModal')?.focus();
  return channels;
};

export const bindSupportModalTriggers = () => {
  if (document.body.dataset.supportModalReady === 'true') return;
  document.body.dataset.supportModalReady = 'true';
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.(SUPPORT_TRIGGER_SELECTOR);
    if (!trigger || trigger.closest('#supportChannelsModalRoot')) return;
    openSupportChannelsModal(event);
  });
};

export const renderAdminMenuLink = () => {
  const selectors = [
    'a[href="admin.html"]',
    'a[href="./admin.html"]',
    'a[href="/admin.html"]',
    '.menu-admin-link'
  ];
  let removed = 0;
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (el.dataset.adminAllowed !== 'true') {
        el.remove();
        removed += 1;
      }
    });
  });
  return removed > 0 ? true : null;
};

let adminLinkPurgeObserver = null;
export const initAdminLinkPurge = () => {
  renderAdminMenuLink();
  if (adminLinkPurgeObserver || typeof MutationObserver === 'undefined') return adminLinkPurgeObserver;
  adminLinkPurgeObserver = new MutationObserver(() => renderAdminMenuLink());
  adminLinkPurgeObserver.observe(document.body, { childList: true, subtree: true });
  return adminLinkPurgeObserver;
};

const applyImageSizeSettings = (settings = getSiteSettings()) => {
  const root = document.documentElement;
  try {
    root.style.setProperty('--product-img-w', `${sanitizeNumber(settings.productImageWidth, { min: 20, max: 500, integer: true, fallback: 140 })}px`);
    root.style.setProperty('--product-img-h', `${sanitizeNumber(settings.productImageHeight, { min: 20, max: 500, integer: true, fallback: 130 })}px`);
    root.style.setProperty('--category-img-w', `${sanitizeNumber(settings.categoryImageWidth, { min: 20, max: 500, integer: true, fallback: 110 })}px`);
    root.style.setProperty('--category-img-h', `${sanitizeNumber(settings.categoryImageHeight, { min: 20, max: 500, integer: true, fallback: 110 })}px`);
    root.style.setProperty('--offer-img-w', `${sanitizeNumber(settings.offerImageWidth, { min: 20, max: 300, integer: true, fallback: 60 })}px`);
    root.style.setProperty('--offer-img-h', `${sanitizeNumber(settings.offerImageHeight, { min: 20, max: 300, integer: true, fallback: 60 })}px`);
    root.style.setProperty('--hero-logo-w', `${sanitizeNumber(settings.heroLogoWidth, { min: 50, max: 800, integer: true, fallback: 320 })}px`);
    root.style.setProperty('--hero-logo-h', `${sanitizeNumber(settings.heroLogoHeight, { min: 50, max: 800, integer: true, fallback: 320 })}px`);
    root.style.setProperty('--img-border-radius', `${sanitizeNumber(settings.imageBorderRadius, { min: 0, max: 50, integer: true, fallback: 16 })}px`);
    root.style.setProperty('--img-fit-mode', settings.imageFitMode || 'cover');
    root.style.setProperty('--general-img-quality', String(settings.generalImageQuality || 82));
    root.style.setProperty('--general-img-max-w', `${settings.generalImageMaxWidth || 100}%`);
  } catch (e) {
    console.warn('[common] applyImageSizeSettings failed', e);
  }
};

export const initAdminAvailabilityIndicator = () => {
  const cachedSettings = getSiteSettings();
  applyImageSizeSettings(cachedSettings);
  createAdminStatusIndicator(cachedSettings.adminAvailability === true);

  if (!adminAvailabilityInitialization) {
    adminAvailabilityInitialization = (async () => {
      try {
        const remoteSettings = await loadSiteSettingsFromFirebase();
        createAdminStatusIndicator(remoteSettings.adminAvailability === true);
        if (!unsubscribeAdminAvailability) {
          unsubscribeAdminAvailability = await subscribeAdminAvailability((available) => {
            createAdminStatusIndicator(available);
            if (document.getElementById('supportChannelsModalRoot')) openSupportChannelsModal();
          }, (error) => console.warn('[common] admin availability realtime failed', error));
        }
      } catch (error) {
        console.warn('[common] admin availability initialization failed', error);
        adminAvailabilityInitialization = null;
      }
    })();
  }
  return adminAvailabilityInitialization;
};

// Check if user is fully verified (email + phone/account active)
const isUserFullyVerified = (user) => {
  if (!user) return false;
  const emailVerified = user.emailVerified === true || user.email_verified === true || user.verified === true;
  const accountActive = ['active', 'verified'].includes(user.accountStatus);
  // Also check whatsapp verification as phone verification proxy
  const phoneVerified = user.whatsappCodeStatus === 'verified' || accountActive;
  return Boolean(emailVerified && (accountActive || phoneVerified));
};

export const renderAuthChrome = (state = authStore.getState()) => {
  const user = state.user;
  const name = user?.displayName || user?.name || user?.username || 'المستخدم';
  const email = user?.email || '';
  for (const id of ['navUserName', 'menuUserName']) { const element = document.getElementById(id); if (element) element.textContent = name; }
  for (const id of ['navUserEmail', 'menuUserEmail']) { const element = document.getElementById(id); if (element) element.textContent = email; }
  for (const id of ['navUserInitial', 'menuUserAvatar']) { const element = document.getElementById(id); if (element) element.textContent = name.trim().charAt(0) || 'م'; }
  display(document.getElementById('navUserSection'), Boolean(user), 'block');
  display(document.getElementById('menuUserSection'), Boolean(user), 'block');
  display(document.getElementById('navLoginBtn'), !user, 'inline-flex');
  display(document.getElementById('menuLoginLink'), !user, 'flex');
  display(document.getElementById('menuAccountLink'), Boolean(user), 'flex');
  
  const balance = getUserBalance(user?.uid || 'guest');
  const isVerified = isUserFullyVerified(user);
  
  // Balance button only shows when logged in AND fully verified (email + phone)
  document.querySelectorAll('#navUserBalanceDisplay, .nav-user-balance-display, .balance-verified-btn').forEach((element) => {
    element.textContent = `${balance.toLocaleString()} ر.ي`;
    // Show only if verified
    if (isVerified) {
      element.classList.add('verified-visible');
      element.style.display = 'inline-flex';
      const parentBtn = element.closest('a.nav-btn') || element;
      if (parentBtn) {
        parentBtn.classList.add('verified-visible');
        parentBtn.style.display = 'inline-flex';
      }
    } else {
      element.classList.remove('verified-visible');
      if (!user) {
        element.style.display = 'none';
        const parentBtn = element.closest('a.nav-btn');
        if (parentBtn && parentBtn.id !== 'navUserBalanceDisplay') parentBtn.style.display = 'none';
        // Keep inner span hidden but parent may be hidden via CSS
        if (element.id === 'navUserBalanceDisplay') {
          const parent = element.closest('a');
          if (parent) parent.style.display = 'none';
        }
      } else {
        // Logged in but not verified - hide balance
        element.style.display = 'none';
        const parent = element.closest('a');
        if (parent) parent.style.display = 'none';
      }
    }
  });
  
  // Special handling for balance link that contains the display
  const balanceLink = document.querySelector('a[href="deposit.html"].nav-btn');
  if (balanceLink) {
    if (isVerified) {
      balanceLink.style.display = 'inline-flex';
      balanceLink.classList.add('verified-visible');
    } else {
      balanceLink.style.display = 'none';
      balanceLink.classList.remove('verified-visible');
    }
  }
  
  renderAdminMenuLink();
  injectIcons();
};

export const initRefreshUI = () => {
  initRefreshButton();
  const navActions = document.querySelector('.nav-actions');
  
  // Create search button
  if (navActions && !document.getElementById('navSearchBtn')) {
    const searchBtn = document.createElement('button');
    searchBtn.id = 'navSearchBtn';
    searchBtn.className = 'nav-btn search-nav-btn';
    searchBtn.type = 'button';
    searchBtn.setAttribute('aria-label', 'بحث');
    searchBtn.setAttribute('title', 'بحث شامل');
    searchBtn.innerHTML = `<span data-icon="search" data-size="18"></span>`;
    searchBtn.addEventListener('click', () => openSearchModal());
    navActions.appendChild(searchBtn);
    injectIcons(searchBtn);
  }
  
  if (navActions && !document.getElementById('navRefreshBtn')) {
    const navBtn = document.createElement('button');
    navBtn.id = 'navRefreshBtn';
    navBtn.className = 'nav-btn refresh-nav-btn';
    navBtn.type = 'button';
    navBtn.setAttribute('aria-label', 'تحديث');
    navBtn.setAttribute('title', 'تحديث البيانات');
    navBtn.innerHTML = `<span data-icon="refresh" data-size="18"></span>`;
    navBtn.addEventListener('click', async (e) => {
      const { handleRefresh } = await import('../utils/dom-utils.js');
      const mainBtn = document.getElementById('hudRefreshBtn');
      if (mainBtn) mainBtn.click();
      else handleRefresh(e);
    });
    // New order: menuBtn first, then refresh, then search, then balance is centered via CSS
    const menuBtn = navActions.querySelector('#menuBtn');
    const searchBtn = navActions.querySelector('#navSearchBtn');
    if (menuBtn) {
      // Insert refresh after menu button
      menuBtn.insertAdjacentElement('afterend', navBtn);
      if (searchBtn) {
        navBtn.insertAdjacentElement('afterend', searchBtn);
      }
    } else {
      navActions.prepend(navBtn);
    }
    injectIcons(navBtn);
  }
  
  // Move theme toggle and language dropdown into sidebar for new design
  const menuBody = document.getElementById('menuDrawer')?.querySelector('.menu-body');
  const themeToggle = document.getElementById('themeToggle');
  const langContainer = document.getElementById('languageDropdownContainer');
  
  if (menuBody && (themeToggle || langContainer)) {
    let settingsSection = menuBody.querySelector('.menu-settings-section');
    if (!settingsSection) {
      settingsSection = document.createElement('div');
      settingsSection.className = 'menu-settings-section';
      settingsSection.innerHTML = `
        <div class="menu-settings-title">⚙️ الإعدادات</div>
        <div class="menu-settings-row" id="menuSettingsRow"></div>
      `;
      menuBody.appendChild(settingsSection);
    }
    const settingsRow = settingsSection.querySelector('#menuSettingsRow') || settingsSection;
    
    if (themeToggle && !settingsRow.contains(themeToggle)) {
      themeToggle.style.display = 'inline-flex';
      settingsRow.appendChild(themeToggle);
    }
    if (langContainer && !settingsRow.contains(langContainer)) {
      langContainer.style.display = 'inline-flex';
      settingsRow.appendChild(langContainer);
    }
  }
  
  // Bind search modal events
  initSearchModal();
};

let searchModalKeyHandler = null;

export const openSearchModal = () => {
  const overlay = document.getElementById('searchModalOverlay');
  const modal = document.getElementById('searchModal');
  const input = document.getElementById('searchModalInput');
  if (!modal) return;
  overlay?.classList.add('open');
  overlay?.setAttribute('aria-hidden', 'false');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('search-modal-open');
  setTimeout(() => input?.focus(), 100);
  injectIcons(modal);
  // Bind ESC
  if (searchModalKeyHandler) document.removeEventListener('keydown', searchModalKeyHandler);
  searchModalKeyHandler = (e) => { if (e.key === 'Escape') closeSearchModal(); };
  document.addEventListener('keydown', searchModalKeyHandler);
};

export const closeSearchModal = () => {
  const overlay = document.getElementById('searchModalOverlay');
  const modal = document.getElementById('searchModal');
  overlay?.classList.remove('open');
  overlay?.setAttribute('aria-hidden', 'true');
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('search-modal-open');
  if (searchModalKeyHandler) {
    document.removeEventListener('keydown', searchModalKeyHandler);
    searchModalKeyHandler = null;
  }
};

const initSearchModal = () => {
  if (document.body.dataset.searchModalReady === 'true') return;
  document.body.dataset.searchModalReady = 'true';
  
  const overlay = document.getElementById('searchModalOverlay');
  const closeBtn = document.getElementById('closeSearchModalBtn');
  const input = document.getElementById('searchModalInput');
  const resultsContainer = document.getElementById('searchResultsContainer');
  
  overlay?.addEventListener('click', closeSearchModal);
  closeBtn?.addEventListener('click', closeSearchModal);
  
  let searchTimeout = null;
  input?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const query = input.value.trim().toLowerCase();
      if (!query) {
        if (resultsContainer) resultsContainer.innerHTML = `<div class="search-empty-state"><span data-icon="search" data-size="32"></span><p>اكتب للبحث في جميع الأقسام والمنتجات والعروض</p></div>`;
        injectIcons(resultsContainer);
        return;
      }
      if (resultsContainer) resultsContainer.innerHTML = `<div style="text-align:center;padding:20px;"><div style="display:inline-block;width:32px;height:32px;border:3px solid var(--gold);border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div><p style="margin-top:8px;color:var(--text-secondary);">جاري البحث...</p></div>`;
      
      try {
        const { getAllCategories } = await import('../services/category-service.js');
        const categories = await getAllCategories().catch(() => []);
        const results = [];
        
        categories.forEach(cat => {
          // Search categories
          if ((cat.name || '').toLowerCase().includes(query) || (cat.description || '').toLowerCase().includes(query)) {
            results.push({ type: 'category', category: cat, name: cat.name, desc: cat.description, id: cat.id });
          }
          // Search products and offers
          (cat.items || []).forEach(item => {
            if ((item.name || '').toLowerCase().includes(query) || (item.description || '').toLowerCase().includes(query)) {
              results.push({ type: 'product', category: cat, item, name: item.name, desc: item.description, id: item.id });
            }
            (item.offers || []).forEach(offer => {
              if ((offer.name || '').toLowerCase().includes(query) || (offer.description || '').toLowerCase().includes(query)) {
                results.push({ type: 'offer', category: cat, item, offer, name: offer.name, desc: offer.description, id: offer.id, price: offer.price });
              }
            });
          });
        });
        
        if (!results.length) {
          resultsContainer.innerHTML = `<div class="search-no-results"><p>لا توجد نتائج لـ "${escapeHTML(query)}"</p><small>جرب كلمات أخرى</small></div>`;
        } else {
          resultsContainer.innerHTML = `
            <div class="search-results-count">تم العثور على ${results.length} نتيجة</div>
            <div class="search-results-grid">
              ${results.slice(0, 50).map(r => {
                if (r.type === 'category') {
                  return `<a href="category.html?id=${encodeURIComponent(r.id)}" class="search-result-card category" onclick="document.getElementById('searchModalOverlay')?.click()">
                    <div class="search-result-icon"><span data-icon="layers" data-size="20"></span></div>
                    <div class="search-result-info"><strong>${escapeHTML(r.name)}</strong><small>قسم • ${escapeHTML(r.desc || '').slice(0,60)}</small></div>
                    <span class="search-result-badge">قسم</span>
                  </a>`;
                } else if (r.type === 'product') {
                  return `<a href="category.html?id=${encodeURIComponent(r.category.id)}&item=${encodeURIComponent(r.id)}" class="search-result-card product" onclick="document.getElementById('searchModalOverlay')?.click()">
                    <div class="search-result-icon"><span data-icon="package" data-size="20"></span></div>
                    <div class="search-result-info"><strong>${escapeHTML(r.name)}</strong><small>منتج في ${escapeHTML(r.category.name)} • ${escapeHTML(r.desc || '').slice(0,60)}</small></div>
                    <span class="search-result-badge">منتج</span>
                  </a>`;
                } else {
                  return `<a href="category.html?id=${encodeURIComponent(r.category.id)}&item=${encodeURIComponent(r.item.id)}" class="search-result-card offer" onclick="document.getElementById('searchModalOverlay')?.click()">
                    <div class="search-result-icon"><span data-icon="tag" data-size="20"></span></div>
                    <div class="search-result-info"><strong>${escapeHTML(r.name)}</strong><small>عرض • ${escapeHTML(r.item.name)} • ${r.price || 0} ر.ي</small></div>
                    <span class="search-result-badge">عرض</span>
                  </a>`;
                }
              }).join('')}
            </div>
          `;
        }
        injectIcons(resultsContainer);
      } catch (e) {
        console.warn('[search] failed', e);
        if (resultsContainer) resultsContainer.innerHTML = `<div class="search-no-results"><p>حدث خطأ أثناء البحث</p></div>`;
      }
    }, 300);
  });
};

export const initCommonPage = async () => {
  const theme = uiStore.getState().theme;
  document.documentElement.dataset.theme = theme;
  initTranslationSystem(); initNavScroll(); initBackTop(); initMenuControls(); injectIcons();
  renderAdminMenuLink();
  initAdminLinkPurge();
  initRefreshUI();
  bindSupportModalTriggers();
  if (!unsubscribeLanguageChanges) {
    unsubscribeLanguageChanges = subscribeLanguage(() => {
      refreshActiveToastTranslation();
      if (document.getElementById('supportChannelsModalRoot')) openSupportChannelsModal();
    });
  }
  void initAdminAvailabilityIndicator();
  // Apply image size settings on realtime updates
  try {
    const { subscribeSiteSettings: subSettings } = await import('../services/settings-service.js');
    subSettings((newSettings) => {
      applyImageSizeSettings(newSettings);
    });
  } catch {}

  if (!document.body.dataset.commonReady) {
    document.body.dataset.commonReady = 'true';
    document.getElementById('themeToggle')?.addEventListener('click', () => {
      document.documentElement.dataset.theme = toggleTheme();
      injectIcons();
    });
    for (const id of ['navLogoutBtn', 'menuLogoutBtn']) {
      document.getElementById(id)?.addEventListener('click', async () => { await logout(); globalThis.location.href = 'login.html'; });
    }
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.getElementById('menuCloseBtn')?.click(); });
  }

  authStore.subscribe(renderAuthChrome);
  uiStore.subscribe((state) => { document.documentElement.dataset.theme = state.theme; });
  try { await checkSession(); } catch (error) { 
    // Fixed toast: show error correctly, not opposite
    console.warn('[common] session check failed', error);
    // Don't show error toast on initial load to avoid stuck notifications
  }
  renderAuthChrome();
  renderAdminMenuLink();
  const year = document.getElementById('footerYear'); if (year) year.textContent = String(new Date().getFullYear());
  return { auth: authStore.getState(), ui: uiStore.getState() };
};

export default Object.freeze({
  initCommonPage, renderAuthChrome, renderAdminMenuLink, initAdminAvailabilityIndicator,
  openSupportChannelsModal, closeSupportChannelsModal, bindSupportModalTriggers,
  initRefreshUI, initAdminLinkPurge
});
