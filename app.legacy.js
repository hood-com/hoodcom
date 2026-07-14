/* ============================================
HUD COM - النظام المحكم v11.0 - APP LAYER
شراء مباشر بدون سلة
الشراء متاح للحسابات المسجلة فقط
تسجيل الطلب داخل الموقع بدون تحويل واتساب
جميع بيانات العميل اختيارية
كشف الزبون المتكرر
نوافذ منبثقة متعددة
خلفية ديناميكية حسب القسم
علامة مائية ذكية
دعم تعدد العملات
دعم الترجمة الكامل
============================================ */

// ===== الطلب الحالي =====
let cart = [];

// ===== عند فتح الصفحة =====
document.addEventListener('DOMContentLoaded', async function() {
  try {
    scheduleIconInjection();
    initUserState();
    initNavScroll();
    initBackTop();
    renderWalletGrid();
    applySiteSettingsToUI();
    try {
      var cachedCat = localStorage.getItem('hud_categories_cache');
      if (cachedCat && (!window.categories || window.categories.length === 0)) {
        window.categories = JSON.parse(cachedCat);
      }
    } catch(e) {}
    if (document.getElementById('homeCategoriesGrid') && typeof renderHomeCategories === 'function') {
      renderHomeCategories();
    }
    if (document.getElementById('pageContent') && typeof renderCategoryPage === 'function') {
      renderCategoryPage();
    }
    // تحديث سنة حقوق النشر تلقائياً
    var __yearEl = document.getElementById('footerYear');
    if (__yearEl) __yearEl.textContent = new Date().getFullYear();
    // تهيئة نظام الترجمة
    if (typeof initTranslationSystem === 'function') {
      initTranslationSystem();
    }
  } catch (e) {
    console.error('خطأ في التهيئة:', e);
  }
});

// ===== تطبيق إعدادات الموقع على واجهة المستخدم =====
function applySiteSettingsToUI() {
  try {
    function formatPhone(num) {
      if (!num) return '';
      const clean = num.replace(/\D/g, '');
      if (clean.length >= 10) {
        return '+' + clean.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1 $2 $3 $4').trim();
      }
      return '+' + clean;
    }

    // تحديث أرقام الهاتف
    document.querySelectorAll('.support-phone-text, .footer-support-link .contact-number').forEach(function(el) {
      el.textContent = formatPhone(SUPPORT_NUMBER);
    });

    document.querySelectorAll('.footer-support-link, #menuSupportLink').forEach(function(link) {
      if (link.href && link.href.indexOf('tel:') === 0) {
        link.href = 'tel:+' + SUPPORT_NUMBER.replace(/\D/g, '');
      }
    });

    document.querySelectorAll('.whatsapp-phone-text, .whatsapp-link .contact-number').forEach(function(el) {
      el.textContent = formatPhone(WHATSAPP_NUMBER);
    });

    document.querySelectorAll('.whatsapp-link, #menuWhatsappLink, .float-whatsapp').forEach(function(link) {
      if (link.href && (link.href.indexOf('wa.me') !== -1 || link.href.indexOf('api.whatsapp.com') !== -1)) {
        link.href = 'https://wa.me/' + WHATSAPP_NUMBER.replace(/\D/g, '');
      }
    });

    document.querySelectorAll('.channel-link, #menuChannelLink').forEach(function(link) {
      link.href = WHATSAPP_CHANNEL;
    });

    renderDynamicContacts();
    renderFeaturedOffers();
    renderHomeCustomFields();
    renderContactSection();
    renderHoodAbout();
    renderContactPlatforms();
    bindSupportModalTriggers();

    // تحديث الترجمة
    if (typeof applyLanguage === 'function') {
      applyLanguage();
    }
  } catch (e) {
    console.error('Error applying site settings:', e);
  }
}

// ===== عرض جهات التواصل =====
function renderDynamicContacts() {
  const grid = document.getElementById('dynamicContactGrid');
  const footerContact = document.getElementById('dynamicFooterContact');
  if (!grid && !footerContact) return;
  const contacts = siteSettings.contacts || [];
  const activeContacts = contacts.filter(function(c) { return c.enabled !== false; });

  function contactHrefFor(c) {
    if (typeof buildContactHref === 'function') return buildContactHref(c.type, c.value);
    return c.type === 'phone' ? safePhoneHref(c.value) : safeURL(c.value, '#');
  }
  function contactNewTab(c) {
    if (typeof contactOpensNewTab === 'function') return contactOpensNewTab(c.type);
    return c.type === 'link';
  }
  function contactDisplayValue(c) {
    if (c.type === 'phone' || c.type === 'whatsapp') {
      return escapeHTML('+' + String(c.value || '').replace(/\D/g, ''));
    }
    if (c.type === 'email') return escapeHTML(String(c.value || '').replace(/^mailto:/i, ''));
    return t('visit_link');
  }
  function defaultIconFor(c) {
    if (c.type === 'phone') return 'phone';
    if (c.type === 'whatsapp') return 'whatsapp';
    if (c.type === 'email') return 'send';
    return 'globe';
  }

  if (grid) {
    grid.innerHTML = activeContacts.map(function(c) {
      var contactHref = contactHrefFor(c);
      var contactIcon = safeIconName(c.icon, defaultIconFor(c));
      return '<a href="' + escapeAttr(contactHref) + '" class="contact-card" target="' + (contactNewTab(c) ? '_blank' : '_self') + '" rel="noopener noreferrer">' +
        '<div class="contact-icon">' +
        '<span data-icon="' + escapeAttr(contactIcon) + '" data-size="28"></span>' +
        '</div>' +
        '<h4>' + escapeHTML(c.name) + '</h4>' +
        '<p dir="ltr" class="contact-number">' + contactDisplayValue(c) + '</p>' +
        '</a>';
    }).join('');
    injectIcons(grid);
  }

  if (footerContact) {
    footerContact.innerHTML = activeContacts.map(function(c) {
      var footerHref = contactHrefFor(c);
      var footerIcon = safeIconName(c.icon, defaultIconFor(c));
      var label = (c.type === 'phone' || c.type === 'whatsapp') ? contactDisplayValue(c) : escapeHTML(c.name);
      return '<a href="' + escapeAttr(footerHref) + '" class="contact-item" target="' + (contactNewTab(c) ? '_blank' : '_self') + '" rel="noopener noreferrer">' +
        '<span data-icon="' + escapeAttr(footerIcon) + '" data-size="20"></span>' +
        '<span dir="ltr">' + label + '</span>' +
        '</a>';
    }).join('');
    injectIcons(footerContact);
  }
}

// ===== عرض العروض المميزة =====
function renderFeaturedOffers() {
  const section = document.getElementById('featuredSection');
  const grid = document.getElementById('featuredGrid');
  if (!section || !grid) return;
  const featured = siteSettings.featuredOffers || [];
  // إذا لم تكن هناك عروض مميزة: نُخفي القسم بدون عرض أي أزرار إدارة
  if (!featured || featured.length === 0) {
    section.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  let itemsHtml = '';
  let foundAny = false;

  featured.forEach(function(feat) {
    let foundItem = null, foundOffer = null, foundCatId = null;
    categories.forEach(function(c) {
      if (!c.items) return;
      c.items.forEach(function(i) {
        if (feat.type === 'offer' && i.offers) {
          const off = i.offers.find(function(o) { return o.id === feat.id; });
          if (off) { foundOffer = off; foundItem = i; foundCatId = c.id; }
        } else if (feat.type === 'item' && i.id === feat.id) {
          foundItem = i; foundCatId = c.id;
        }
      });
    });

    if (foundItem) {
      foundAny = true;
      const isAvailable = (feat.type === 'offer' ? (foundOffer.status !== 'unavailable') : (foundItem.status !== 'unavailable'));
      if (siteSettings.hideUnavailable && !isAvailable) return;

      const badgeHtml = getStatusBadge(feat.type === 'offer' ? foundOffer.status : foundItem.status);
      const priceVal = feat.type === 'offer' ? (foundOffer.price || 0) : (foundItem.offers && foundItem.offers.length > 0 ? (foundItem.offers[0].price || 0) : 0);
      const priceHtml = feat.type === 'offer' ? formatPrice(priceVal, DEFAULT_CURRENCY) : (foundItem.offers && foundItem.offers.length > 0 ? t('starting_from') + ' ' + formatPrice(priceVal, DEFAULT_CURRENCY) : '');

      const img = (feat.type === 'offer' && foundOffer && foundOffer.image) ? foundOffer.image : (foundItem.image || '');
      const title = (feat.type === 'offer' && foundOffer && foundOffer.name) ? foundOffer.name : (foundItem.name || '');

      var itemHref = 'category.html?id=' + encodeURIComponent(foundCatId) + '&item=' + encodeURIComponent(foundItem.id);
      itemsHtml += '<div class="item-card" onclick="window.location.href=\'' + escapeJSString(itemHref) + '\'" style="cursor:pointer">' +
        badgeHtml +
        '<div class="item-image">' +
        '<img src="' + escapeAttr(safeURL(img, '')) + '" alt="' + escapeAttr(title) + '" loading="lazy">' +
        '</div>' +
        '<div class="item-info">' +
        '<h3 class="item-title">' + escapeHTML(title) + '</h3>' +
        '<div class="item-price">' + escapeHTML(priceHtml) + '</div>' +
        '</div>' +
        '</div>';
    }
  });

  if (foundAny) {
    grid.innerHTML = itemsHtml;
    section.style.display = 'block';
    injectIcons(grid);
  } else {
    section.style.display = 'none';
  }
}

// ===== عرض الحقول المخصصة في الصفحة الرئيسية =====
function renderHomeCustomFields() {
  const container = document.getElementById('dynamicCustomFieldsHome');
  if (!container) return;
  const fields = siteSettings.customFields || [];
  const activeFields = fields.filter(function(f) { return f.enabled !== false; }).sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
  if (activeFields.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.innerHTML = activeFields.map(function(f) {
    return '<div class="custom-field-home" style="margin-bottom: 15px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 12px;">' +
      '<h3 style="margin-top:0; color:#FFD700; font-size:16px;">' + escapeHTML(f.name) + '</h3>' +
      '<p style="margin:5px 0 0 0; color:#eee;">' + textWithBreaks(f.defaultVal || '') + '</p>' +
      '</div>';
  }).join('');
  container.style.display = 'block';
}

// ===== عرض قسم نبذة هود كوم (ديناميكي) =====
function renderHoodAbout() {
  const section = document.getElementById('hoodAboutSection');
  if (!section) return;
  const s = (typeof siteSettings !== 'undefined' && siteSettings) ? siteSettings : (window.siteSettings || {});

  if (s.aboutEnabled === false) {
    section.style.display = 'none';
    section.innerHTML = '';
    return;
  }

  const title = s.aboutTitle || s.storeName || 'هود كوم';
  const text = s.aboutText || '';
  const lines = Array.isArray(s.aboutLines) ? s.aboutLines : [];

  let linesHtml = '';
  lines.forEach(function(ln) {
    if (!ln) return;
    const icon = ln.icon ? (escapeHTML(ln.icon) + ' ') : '';
    const label = escapeHTML(ln.label || '');
    const value = escapeHTML(ln.value || '');
    if (!label && !value) return;
    linesHtml += '<div class="hood-about-line">' +
      '<span class="hood-about-line-icon">' + icon + '</span>' +
      '<span class="hood-about-line-label">' + label + '</span>' +
      (value ? '<span class="hood-about-line-value" dir="ltr">' + value + '</span>' : '') +
      '</div>';
  });

  section.style.display = 'block';
  section.innerHTML =
    '<div class="hood-about-title">' + escapeHTML(title) + '</div>' +
    '<div class="hood-about-text">' + textWithBreaks(text) + '</div>' +
    (linesHtml ? '<div class="hood-about-lines">' + linesHtml + '</div>' : '');

  // تحديد مكان ظهور القسم حسب الإعداد
  try {
    var pos = s.aboutPosition || 'middle';
    var hero = document.querySelector('.hero');
    var footer = document.querySelector('.site-footer');
    var cpSection = document.getElementById('contactPlatformsSection');
    if (pos === 'top' && hero && hero.parentNode) {
      hero.parentNode.insertBefore(section, hero.nextSibling);
    } else if (pos === 'bottom' && footer && footer.parentNode) {
      footer.parentNode.insertBefore(section, footer);
    } else if (cpSection && cpSection.parentNode) {
      // الوضع الافتراضي: قبل قسم "تواصل معنا"
      cpSection.parentNode.insertBefore(section, cpSection);
    }
  } catch (e) {}
}

// ===== عرض قسم تواصل معنا (أزرار المنصات الديناميكية) =====
function renderContactPlatforms() {
  const section = document.getElementById('contactPlatformsSection');
  if (!section) return;
  const s = (typeof siteSettings !== 'undefined' && siteSettings) ? siteSettings : (window.siteSettings || {});

  if (s.contactPlatformsEnabled === false) {
    section.style.display = 'none';
    section.innerHTML = '';
    return;
  }

  const title = s.contactPlatformsTitle || t('menu_contact') || 'تواصل معنا';
  const platforms = (Array.isArray(s.contactPlatforms) ? s.contactPlatforms : [])
    .filter(function(p) { return p && p.enabled !== false; });

  if (platforms.length === 0) {
    section.style.display = 'none';
    section.innerHTML = '';
    return;
  }

  const btnsHtml = platforms.map(function(p) {
    const href = (typeof buildContactHref === 'function') ? buildContactHref(p.type, p.value) : safeURL(p.value, '#');
    const newTab = (typeof contactOpensNewTab === 'function') ? contactOpensNewTab(p.type) : (p.type === 'link');
    const iconName = safeIconName(p.icon, 'globe');
    const label = escapeHTML(p.label || '');
    return '<a href="' + escapeAttr(href) + '" class="contact-platform-btn" ' +
      (newTab ? 'target="_blank" rel="noopener noreferrer" ' : '') +
      'aria-label="' + label + '" title="' + label + '">' +
      '<span data-icon="' + escapeAttr(iconName) + '" data-size="24"></span>' +
      '</a>';
  }).join('');

  section.style.display = 'block';
  section.innerHTML =
    '<div class="contact-platforms-title">' + escapeHTML(title) + '</div>' +
    '<div class="contact-platforms-grid">' + btnsHtml + '</div>';
  injectIcons(section);
}

// ===== عرض قسم التواصل =====
function renderContactSection() {
  const section = document.querySelector('.section-dark');
  if (!section) return;
  const eyebrowTextEl = section.querySelector('.section-eyebrow span:last-child');
  const titleEl = section.querySelector('.section-title .gold');
  const descEl = section.querySelector('.section-desc');
  // عنوان واحد فقط بدون تكرار
  if (eyebrowTextEl) eyebrowTextEl.textContent = t('menu_contact');
  if (titleEl) titleEl.textContent = t('home_contact_title');
  if (descEl) descEl.textContent = t('home_contact_subtitle');
}

// ===== حالة المنتج =====
function getStatusBadge(status) {
  if (status === 'unavailable') return '<div style="position:absolute; top:10px; right:10px; background:#e74c3c; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px; z-index:1;">' + t('status_unavailable') + '</div>';
  if (status === 'coming_soon') return '<div style="position:absolute; top:10px; right:10px; background:#f39c12; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px; z-index:1;">' + t('status_coming_soon') + '</div>';
  return '<div style="position:absolute; top:10px; right:10px; background:#2ecc71; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px; z-index:1;">' + t('status_available') + '</div>';
}

// ===== تطبيق وضع العملة =====
function applyCurrencyMode() {
  try {
    if (!siteSettings) return;
    console.log('وضع العملة:', CURRENCY_DISPLAY_MODE, '- العملات النشطة:', ACTIVE_CURRENCIES);
  } catch (e) {
    console.error('خطأ في تطبيق وضع العملة:', e);
  }
}

// ===== تنسيق السعر حسب وضع العملة =====
function renderPriceDisplay(priceInYER, currency) {
  try {
    if (CURRENCY_DISPLAY_MODE === 'multi' && ACTIVE_CURRENCIES.length > 1) {
      const prices = formatPriceMultiCurrency(priceInYER);
      return prices.map(function(p, i) {
        const code = ACTIVE_CURRENCIES[i];
        const flag = getCurrencyFlag(code);
        return '<span class="price-multi-item">' + flag + ' ' + p + '</span>';
      }).join(' • ');
    } else {
      const displayCurrency = currency || siteSettings.defaultCurrency || DEFAULT_CURRENCY;
      const converted = convertPrice(priceInYER, displayCurrency);
      return formatPrice(converted, displayCurrency);
    }
  } catch (e) {
    return priceInYER.toLocaleString() + ' ' + getCurrencyShort(currency || 'YER');
  }
}

// ===== حقن أيقونات SVG - V1 =====
function injectIcons(context) {
  try {
    const root = context || document;
    const fallbackIcons = {
      home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
      support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3zM3 19a2 2 0 0 0 2 2h1v-7H3z"/></svg>',
      shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
      arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>'
    };
    const iconFn = (typeof window.icon === 'function') ? window.icon : function(name) { return fallbackIcons[name] || ''; };
    const elements = root.querySelectorAll('[data-icon]');
    let count = 0;
    elements.forEach(function(el) {
      if (el.dataset.iconDone === 'true') return;
      const name = el.getAttribute('data-icon');
      const size = parseInt(el.getAttribute('data-size')) || 20;
      let svgString = iconFn(name, size) || fallbackIcons[name] || '';
      if (svgString && svgString.indexOf('<svg') !== -1) {
        svgString = svgString.replace('<svg ', '<svg width="' + size + '" height="' + size + '" ');
        const originalContent = el.innerHTML;
        el.innerHTML = svgString + originalContent;
        el.dataset.iconDone = 'true';
        count++;
      }
    });
    if (count > 0) console.log('تم حقن ' + count + ' أيقونة');
  } catch (e) {
    console.error('خطأ في حقن الأيقونات:', e);
  }
}

function scheduleIconInjection() {
  injectIcons();
  if (document.readyState === 'complete') {
    setTimeout(function() { injectIcons(); }, 100);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() { injectIcons(); }, 100);
    });
  }
  [500, 1000, 2000, 3000].forEach(function(delay) {
    setTimeout(function() { injectIcons(); }, delay);
  });
}

// ===== النافبار =====
function initNavScroll() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', function() {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });
}

// ===== زر العودة للأعلى =====
function initBackTop() {
  const btn = document.getElementById('backTop');
  if (!btn) return;
  window.addEventListener('scroll', function() {
    btn.classList.toggle('show', window.scrollY > 400);
  });
  // ✅ إضافة event listener للزر
  btn.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== القائمة الجانبية =====
function openMobileMenu() {
  const drawer = document.getElementById('menuDrawer');
  const overlay = document.getElementById('menuOverlay');
  if (drawer) drawer.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  const drawer = document.getElementById('menuDrawer');
  const overlay = document.getElementById('menuOverlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ===== دوال السلة (معطلة) =====
function openCart() { /* معطلة - الشراء مباشر */ }
function closeCart() { /* معطلة - الشراء مباشر */ }
function updateCartCount() { /* معطلة */ }
function renderCartItems() { /* معطلة */ }

// ===== بناء واجهة المحافظ بالصور =====
function renderWalletGrid() {
  try {
    const grid = document.getElementById('walletGrid');
    if (!grid || typeof WALLETS === 'undefined') return;
    const activeWallets = getActiveWallets();

    if (activeWallets.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px 20px; color:#888;">' +
        window.icon('wallet', 30) +
        '<p style="margin-top:10px;">' + t('no_wallets') + '</p>' +
        '</div>';
      return;
    }

    grid.innerHTML = activeWallets.map(function(w) {
      const imgHTML = w.image
        ? '<img loading="lazy" src="' + escapeAttr(safeURL(w.image, '')) + '" alt="' + escapeAttr(w.name) + '">'
        : '<div class="wallet-card-placeholder">' + escapeHTML((w.name || '?').charAt(0)) + '</div>';

      return '<div class="wallet-card" data-wallet="' + escapeAttr(safeId(w.id)) + '" onclick="selectWallet(\'' + escapeJSString(w.id) + '\')">' +
        '<div class="wallet-card-image">' + imgHTML + '</div>' +
        '<div class="wallet-card-name">' + escapeHTML(w.name) + '</div>' +
        '<div class="wallet-card-check">' + window.icon('check', 12) + '</div>' +
        '</div>';
    }).join('');

    injectIcons();
  } catch (e) {
    console.error('خطأ في عرض المحافظ:', e);
  }
}

// ===== اختيار محفظة =====
function selectWallet(id) {
  try {
    const wallet = WALLETS.find(function(w) { return w.id === id; });
    if (!wallet) return;
    document.getElementById('custWallet').value = id;
    document.querySelectorAll('.wallet-card').forEach(function(c) {
      c.classList.remove('selected');
    });
    const card = document.querySelector('.wallet-card[data-wallet="' + CSS.escape(safeId(id)) + '"]');
    if (card) card.classList.add('selected');

    const accountInfo = document.getElementById('walletAccountInfo');
    const accountNumber = document.getElementById('walletAccountNumber');
    if (accountInfo && accountNumber) {
      if (wallet.number && wallet.number.trim()) {
        accountNumber.textContent = wallet.name + ': ' + wallet.number;
        accountInfo.style.display = 'flex';
      } else {
        accountNumber.textContent = wallet.name;
        accountInfo.style.display = 'flex';
      }
    }
  } catch (e) {
    console.error('خطأ في اختيار المحفظة:', e);
  }
}

// ===== النوافذ المنبثقة المتعددة =====
function showPopupsSequence(popups, onComplete) {
  try {
    if (!popups || popups.length === 0) {
      if (onComplete) onComplete();
      return;
    }
    currentPopups = popups;
    currentPopupIndex = 0;

    function showNext() {
      if (currentPopupIndex >= currentPopups.length) {
        if (onComplete) onComplete();
        return;
      }

      const popup = currentPopups[currentPopupIndex];
      showSinglePopup(popup, function() {
        currentPopupIndex++;
        if (currentPopupIndex < currentPopups.length) {
          setTimeout(showNext, 400);
        } else {
          if (onComplete) onComplete();
        }
      });
    }

    showNext();
  } catch (e) {
    console.error('خطأ في النوافذ المنبثقة:', e);
    if (onComplete) onComplete();
  }
}

function showSinglePopup(popup, onClose) {
  try {
    const existing = document.getElementById('multiPopupContainer');
    if (existing) existing.remove();
    const container = document.createElement('div');
    container.id = 'multiPopupContainer';
    container.className = 'multi-popup-container';

    const isLast = currentPopupIndex === currentPopups.length - 1;
    const popupIndex = currentPopupIndex + 1;
    const totalPopups = currentPopups.length;

    const typeClass = popup.type || 'info';
    const typeIcons = { warning: 'alert', info: 'info', success: 'check', danger: 'alert' };
    const typeIcon = typeIcons[typeClass] || 'info';

    container.innerHTML = '<div class="multi-popup-overlay" onclick="closeMultiPopup()"></div>' +
      '<div class="multi-popup ' + typeClass + '">' +
      '<div class="multi-popup-header">' +
      '<div class="multi-popup-progress">' +
      '<div class="multi-popup-progress-bar" style="width:' + (popupIndex / totalPopups * 100) + '%"></div>' +
      '</div>' +
      '<div class="multi-popup-step">' + popupIndex + ' / ' + totalPopups + '</div>' +
      '<button class="multi-popup-close" onclick="closeMultiPopup()">' + window.icon('close', 18) + '</button>' +
      '</div>' +
      '<div class="multi-popup-body">' +
      '<div class="multi-popup-icon-wrap">' +
      '<div class="multi-popup-icon">' + window.icon(typeIcon, 32) + '</div>' +
      '</div>' +
      '<h3 class="multi-popup-title">' + escapeHTML(popup.title || '') + '</h3>' +
      (popup.image ? '<div class="multi-popup-image"><img loading="lazy" src="' + escapeAttr(safeURL(popup.image, '')) + '" alt=""></div>' : '') +
      '<div class="multi-popup-content">' + escapeHTML(popup.content || '').replace(/\n/g, '<br>') + '</div>' +
      '</div>' +
      '<div class="multi-popup-footer">' +
      '<button class="btn btn-dark btn-full" onclick="skipMultiPopup()">' +
      window.icon('close', 14) + ' ' + t('btn_cancel') +
      '</button>' +
      '<button class="btn btn-gold btn-full" onclick="closeMultiPopup()">' +
      window.icon('arrow', 14) + ' ' + escapeHTML(popup.buttonText || (isLast ? t('btn_continue') : t('btn_next'))) +
      '</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(container);
    document.body.style.overflow = 'hidden';
    container._onClose = onClose;
    injectIcons();
  } catch (e) {
    console.error('خطأ في عرض النافذة المنبثقة:', e);
    if (onClose) onClose();
  }
}

function closeMultiPopup() {
  try {
    const container = document.getElementById('multiPopupContainer');
    if (container) {
      const onClose = container._onClose;
      container.remove();
      document.body.style.overflow = '';
      if (onClose) onClose();
    }
  } catch (e) {
    console.error('خطأ في إغلاق النافذة:', e);
  }
}

function skipMultiPopup() {
  try {
    currentPopupIndex = currentPopups.length;
    const container = document.getElementById('multiPopupContainer');
    if (container) {
      const onClose = container._onClose;
      container.remove();
      document.body.style.overflow = '';
      if (onClose) onClose();
    }
  } catch (e) {
    console.error('خطأ في تخطي النوافذ:', e);
  }
}

// ===== الشراء المباشر =====
function buyOffer(categoryId, itemId, offerId) {
  try {
    if (!requireLoggedInForPurchase()) {
      return;
    }

    const category = getCategory(categoryId);
    if (!category) {
      showToast(t('error_not_found'));
      return;
    }
    if (!category.items || !Array.isArray(category.items)) {
      showToast(t('no_items'));
      return;
    }

    const item = category.items.find(function(i) { return i && i.id === itemId; });
    if (!item) {
      showToast(t('error_not_found'));
      return;
    }
    if (item.status === 'unavailable') {
      showToast(t('status_unavailable'));
      return;
    }

    if (!item.offers || !Array.isArray(item.offers)) {
      showToast(t('no_offers'));
      return;
    }

    const offer = item.offers.find(function(o) { return o && o.id === offerId; });
    if (!offer) {
      showToast(t('error_not_found'));
      return;
    }
    if (offer.status === 'unavailable') {
      showToast(t('status_unavailable'));
      return;
    }

    // تجهيز الطلب الحالي
    currentOrder = {
      categoryId: categoryId,
      itemId: itemId,
      offerId: offerId,
      categoryName: category.name || '',
      itemTitle: item.name || '',
      offerTitle: offer.name || '',
      image: offer.image || item.image || category.image || '',
      priceYER: offer.price || 0,
      price: offer.price || 0,
      currency: offer.currency || DEFAULT_CURRENCY,
      item: item
    };

    const popups = getOfferPopups(item, offer);

    showPopupsSequence(popups, function() {
      openCustomerModalWithFields(item);
    });
  } catch (e) {
    console.error('خطأ في الشراء:', e);
    showToast(t('toast_error'));
  }
}

// ===== فتح نافذة العميل =====
function openCustomerModalWithFields(item) {
  try {
    if (!requireLoggedInForPurchase()) {
      return;
    }

    const modal = document.getElementById('customerModal');
    const overlay = document.getElementById('customerOverlay');
    if (modal) modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    resetCustomerForm();
    renderDynamicProductFields(item);
    showOrderDetailsInModal(currentOrder);
    updateOrderTotalDisplay();
    renderWalletGrid();
    updateBuyModalBalance();
    checkReturningCustomer();
  } catch (e) {
    console.error('خطأ في فتح نافذة العميل:', e);
    openCustomerModal();
  }
}

// ===== عرض الحقول الديناميكية للمنتج =====
function renderDynamicProductFields(item) {
  try {
    const container = document.getElementById('dynamicFieldsContainer');
    if (!container) return;
    const fields = getProductFields(item);

    if (!fields || fields.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'block';

    const fieldTypeIcons = {
      text: 'edit',
      number: 'list',
      id: 'user',
      link: 'globe',
      note: 'info',
      email: 'send',
      password: 'lock'
    };

    const titleText = t('dynamic_fields_title', { item: item.name || '' });

    container.innerHTML = '<div class="dynamic-fields-header">' +
      '<span class="dynamic-fields-icon">' + window.icon('package', 16) + '</span>' +
      '<span class="dynamic-fields-title">' + escapeHTML(titleText) + '</span>' +
      '</div>' +
      fields.map(function(field) {
        const fieldIcon = fieldTypeIcons[field.type] || 'edit';
        const requiredMark = field.required ? '<span class="required">*</span>' : '<span class="optional">(' + t('form_optional') + ')</span>';
        const inputType = field.type === 'number' ? 'tel' : 'text';
        const placeholderText = field.placeholder || t('field_id_placeholder');

        return '<div class="form-group dynamic-field" data-field-id="' + escapeAttr(field.id) + '">' +
          '<label class="form-label">' +
          '<span data-icon="' + fieldIcon + '" data-size="16"></span>' +
          ' ' + escapeHTML(field.label) + ' ' +
          requiredMark +
          '</label>' +
          '<input type="' + inputType + '" class="form-input dynamic-field-input" ' +
          'data-field-id="' + escapeAttr(field.id) + '" ' +
          'data-field-label="' + escapeAttr(field.label) + '" ' +
          'placeholder="' + escapeAttr(placeholderText) + '"' +
          (field.required ? ' required' : '') +
          '>' +
          '</div>';
      }).join('');

    injectIcons();
  } catch (e) {
    console.error('خطأ في عرض الحقول الديناميكية:', e);
  }
}

// ===== عرض تفاصيل الطلب في النافذة =====
function showOrderDetailsInModal(order) {
  try {
    const wrap = document.getElementById('orderDetailsCard');
    if (!wrap) return;
    if (!order) return;
    const imageHTML = order.image
      ? '<img loading="lazy" src="' + escapeAttr(safeURL(order.image, '')) + '" alt="' + escapeAttr(order.offerTitle || '') + '">'
      : '<div class="placeholder">' + window.icon('package', 24) + '</div>';

    const priceDisplay = renderPriceDisplay(order.priceYER || order.price || 0, order.currency);

    wrap.innerHTML = '<div class="order-card">' +
      '<div class="order-card-image">' + imageHTML + '</div>' +
      '<div class="order-card-info">' +
      '<div class="order-card-category">' + escapeHTML(order.categoryName || '') + '</div>' +
      '<div class="order-card-item">' + escapeHTML(order.itemTitle || '') + '</div>' +
      '<div class="order-card-offer">' + escapeHTML(order.offerTitle || '') + '</div>' +
      '<div class="order-card-price">' + priceDisplay + '</div>' +
      '</div>' +
      '</div>';

    injectIcons();
  } catch (e) {
    console.error('خطأ:', e);
  }
}

// ===== تحديث المجموع =====
function updateOrderTotalDisplay() {
  try {
    const totalEl = document.getElementById('modalTotal');
    if (!totalEl) return;
    if (currentOrder) {
      const priceDisplay = renderPriceDisplay(currentOrder.priceYER || currentOrder.price || 0, currentOrder.currency);
      totalEl.innerHTML = priceDisplay;
    } else {
      totalEl.textContent = '0 ' + getCurrencyShort(DEFAULT_CURRENCY);
    }
  } catch (e) {}
}

// ===== فتح نافذة بيانات العميل =====
function openCustomerModal() {
  try {
    if (!requireLoggedInForPurchase()) {
      return;
    }

    const modal = document.getElementById('customerModal');
    const overlay = document.getElementById('customerOverlay');
    if (modal) modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    resetCustomerForm();
    checkReturningCustomer();
    renderWalletGrid();
    updateBuyModalBalance();
    updateOrderTotalDisplay();
  } catch (e) {
    console.error('خطأ في فتح النافذة:', e);
  }
}

// ===== إغلاق نافذة العميل =====
function closeCustomerModal() {
  try {
    const modal = document.getElementById('customerModal');
    const overlay = document.getElementById('customerOverlay');
    if (modal) modal.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  } catch (e) {}
}

// ===== إعادة ضبط نموذج العميل =====
function resetCustomerForm() {
  try {
    const fields = ['custName', 'custPhone', 'custGov', 'custCity', 'custAddress'];
    fields.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    document.querySelectorAll('.dynamic-field-input').forEach(function(input) {
      input.value = '';
    });

    const walletInput = document.getElementById('custWallet');
    if (walletInput) walletInput.value = 'account_balance';
    if (typeof window.updateBuyModalBalance === 'function') window.updateBuyModalBalance();

    document.querySelectorAll('.wallet-card').forEach(function(c) {
      c.classList.remove('selected');
    });

    const accountInfo = document.getElementById('walletAccountInfo');
    if (accountInfo) accountInfo.style.display = 'none';

    const usePrev = document.getElementById('usePreviousData');
    if (usePrev) usePrev.checked = false;
  } catch (e) {}
}

// ===== التحقق من الزبون المتكرر =====
function checkReturningCustomer() {
  try {
    const box = document.getElementById('returningCustomerBox');
    if (!box) return;
    if (siteSettings.enableReturningCustomer === false) {
      box.style.display = 'none';
      return;
    }

    if (hasPreviousOrder()) {
      const prevData = getPreviousCustomerData();
      const lastDate = localStorage.getItem(LAST_ORDER_KEY);

      let dateText = '';
      if (lastDate) {
        try {
          const d = new Date(lastDate);
          const day = d.getDate();
          const month = d.getMonth() + 1;
          const year = d.getFullYear();
          dateText = ' (' + day + '/' + month + '/' + year + ')';
        } catch (e) {}
      }

      box.innerHTML = '<div class="returning-customer-card">' +
        '<div class="returning-customer-icon">' + window.icon('whatsapp', 22) + '</div>' +
        '<div class="returning-customer-info">' +
        '<div class="returning-customer-title">' + t('buy_returning_customer') + '</div>' +
        '<div class="returning-customer-desc">' + t('buy_returning_desc') + dateText + '.</div>' +
        '</div>' +
        '</div>' +
        '<label class="returning-customer-checkbox">' +
        '<input type="checkbox" id="usePreviousData" onchange="togglePreviousData(this.checked)">' +
        '<span class="checkmark"></span>' +
        '<span class="returning-customer-label">' + t('buy_returning_use') + '</span>' +
        '</label>' +
        '<div class="returning-customer-confirmed" id="returningCustomerConfirmed" style="display:none;">' +
        '<div class="returning-customer-confirmed-icon">' + window.icon('check', 16) + '</div>' +
        '<span>' + t('buy_returning_confirmed') + '</span>' +
        '</div>';

      box.style.display = 'block';
      injectIcons();
    } else {
      box.style.display = 'none';
    }
  } catch (e) {
    console.error('خطأ في التحقق من الزبون المتكرر:', e);
  }
}

// ===== تفعيل/تعطيل استخدام البيانات السابقة =====
function togglePreviousData(checked) {
  try {
    const prevData = getPreviousCustomerData();
    if (!prevData) return;
    const fields = ['custName', 'custPhone', 'custGov', 'custCity', 'custAddress'];

    if (checked) {
      fields.forEach(function(id) {
        const el = document.getElementById(id);
        const fieldName = id.replace('cust', '').toLowerCase();
        if (el && prevData[fieldName]) {
          el.value = prevData[fieldName];
        }
      });

      // ملء الحقول الديناميكية أيضاً
      if (currentOrder && currentOrder.item) {
        renderDynamicProductFields(currentOrder.item);
        document.querySelectorAll('.dynamic-field-input').forEach(function(input) {
          const fieldId = input.getAttribute('data-field-id');
          if (prevData.dynamicFields && prevData.dynamicFields[fieldId]) {
            input.value = prevData.dynamicFields[fieldId];
          }
        });
      }

      const confirmed = document.getElementById('returningCustomerConfirmed');
      if (confirmed) {
        confirmed.style.display = 'flex';
      }

      showToast(t('toast_success'));
    } else {
      fields.forEach(function(id) {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      const confirmed = document.getElementById('returningCustomerConfirmed');
      if (confirmed) {
        confirmed.style.display = 'none';
      }
    }
  } catch (e) {
    console.error('خطأ:', e);
  }
}

// ===== حفظ الطلب في Firestore =====
async function saveOrderToFirestore(orderData) {
  try {
    if (!window.firebaseDB || !window.firebaseDB.db) return false;
    var fb = window.firebaseDB;
    var orderId = 'ord-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
    var createdAt = fb.serverTimestamp ? fb.serverTimestamp() : new Date().toISOString();
    await fb.setDoc(fb.doc(fb.db, 'orders', orderId), Object.assign({ id: orderId, createdAt: createdAt, updatedAt: createdAt, status: 'pending' }, orderData));
    return true;
  } catch (e) {
    console.warn('تعذر حفظ الطلب في Firestore:', e);
    return false;
  }
}

function getCachedAuthUser() {
  try {
    return JSON.parse(sessionStorage.getItem('hud_auth_user') || localStorage.getItem('hud_auth_user') || 'null') || null;
  } catch (e) { return null; }
}



// ===== إدارة حالة المستخدم V1 =====
let currentUser = null;
let isAdmin = false;
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;
const HUD_SESSION_VERSION = 2;

function getCurrentRelativeUrl() {
  try {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    return page + window.location.search + window.location.hash;
  } catch (e) {
    return 'index.html';
  }
}

function getSafeLoginRedirectTarget() {
  const fallback = 'index.html';
  try {
    const target = getCurrentRelativeUrl();
    if (!target || /^https?:\/\//i.test(target) || target.indexOf('//') === 0 || target.indexOf('login.html') !== -1) {
      return fallback;
    }
    return target;
  } catch (e) {
    return fallback;
  }
}

function redirectToLoginForPurchase() {
  const redirectTarget = getSafeLoginRedirectTarget();
  try {
    sessionStorage.setItem('hud_post_login_redirect', redirectTarget);
  } catch (e) {}
  showToast(t('login_required_purchase'));
  setTimeout(function() {
    window.location.href = 'login.html?redirect=' + encodeURIComponent(redirectTarget);
  }, 900);
}

function requireLoggedInForPurchase() {
  const user = getUserFromSession();
  if (!user || !user.uid) {
    redirectToLoginForPurchase();
    return null;
  }
  if (user.timestamp && (Date.now() - Number(user.timestamp) > SESSION_TIMEOUT)) {
    sessionStorage.removeItem('hud_auth_user');
    localStorage.removeItem('hud_auth_user');
    currentUser = null;
    updateUserUI();
    showToast('toast_session_expired', 'error');
    setTimeout(function() {
      window.location.href = 'login.html?redirect=' + encodeURIComponent(getSafeLoginRedirectTarget());
    }, 900);
    return null;
  }
  // حظر صارم: لا يُسمح بأي عملية شراء أو تغذية قبل التوثيق الكامل
  var accStatus = (user.accountStatus || '').toString().toLowerCase();
  if (accStatus !== 'active' && accStatus !== 'verified') {
    showToast('toast_warning_verify_account', 'warning');
    setTimeout(function() {
      window.location.href = 'reports.html';
    }, 1200);
    return null;
  }
  currentUser = user;
  return user;
}

function clearStoredAuthUser() {
  try { sessionStorage.removeItem('hud_auth_user'); } catch(e) {}
  try { localStorage.removeItem('hud_auth_user'); } catch(e) {}
}

function getSafeUserId(user) {
  return user && (user.uid || user.id || user.user_id || user.sub) || '';
}

function getUserFromSession() {
  try {
    const data = sessionStorage.getItem('hud_auth_user') || localStorage.getItem('hud_auth_user');
    if (data) {
      const user = JSON.parse(data);
      if (!user || !getSafeUserId(user) || Number(user.sessionVersion || 0) < HUD_SESSION_VERSION) {
        clearStoredAuthUser();
        currentUser = null;
        return null;
      }

      // محاولة تصحيح معرف المستخدم من قاعدة البيانات (غير متزامن)
      if (window.supabaseClient && user.uid) {
        window.supabaseClient
          .from('hud_docs')
          .select('id, data')
          .eq('collection', 'users')
          .eq('id', user.uid)
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              const dbUser = data[0];
              if (dbUser.id !== user.uid) {
                user.uid = dbUser.id;
                user.id = dbUser.id;
                user.role = dbUser.data?.role || user.role;
                localStorage.setItem('hud_auth_user', JSON.stringify(user));
                sessionStorage.setItem('hud_auth_user', JSON.stringify(user));
              }
            }
          })
          .catch(() => {});
      }

      currentUser = user;
      return user;
    }
  } catch (e) { clearStoredAuthUser(); }
  return null;
}

// ملاحظة: تم إلغاء نظام "صلاحية الإدارة عبر role" نهائياً. لا يوجد أي حساب مستخدم
// (بما في ذلك حساب المدير) يحمل صلاحيات خاصة داخل قاعدة البيانات. الدخول إلى
// لوحة التحكم يتم حصرياً عبر "الباب الخلفي" في صفحة تسجيل الدخول (admin-gate.js)
// وليس له أي علاقة بحسابات Supabase Auth العادية أو بحقل role.


function updateUserUI() {
  const user = getUserFromSession();
  const menuUserSection = document.getElementById('menuUserSection');
  const menuLoginLink = document.getElementById('menuLoginLink');
  const menuAdminLink = document.getElementById('menuAdminLink');
  const menuUserName = document.getElementById('menuUserName');
  const menuUserEmail = document.getElementById('menuUserEmail');
  const menuUserAvatar = document.getElementById('menuUserAvatar');
  const navUserSection = document.getElementById('navUserSection');
  const navLoginBtn = document.getElementById('navLoginBtn');
  const navUserInitial = document.getElementById('navUserInitial');
  const menuAccountLink = document.getElementById('menuAccountLink');
  const navUserName = document.getElementById('navUserName');
  const navUserEmail = document.getElementById('navUserEmail');

  // رابط الإدارة العام أُلغي نهائياً من واجهة المستخدم — الدخول للوحة التحكم
  // يتم فقط عبر الباب الخلفي في صفحة تسجيل الدخول.
  if (menuAdminLink) menuAdminLink.style.display = 'none';

  if (user && user.uid) {
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : '') || 'مستخدم';
    const initial = displayName.charAt(0).toUpperCase();
    const email = user.email || '';
    if (menuUserSection) {
      menuUserSection.style.display = 'block';
      if (menuUserName) menuUserName.textContent = displayName;
      if (menuUserEmail) menuUserEmail.textContent = email;
      if (menuUserAvatar) menuUserAvatar.textContent = initial;
    }
    if (menuLoginLink) menuLoginLink.style.display = 'none';
    if (menuAccountLink) menuAccountLink.style.display = 'flex';
    if (navUserSection) {
      navUserSection.style.display = 'block';
      if (navUserInitial) navUserInitial.textContent = initial;
      if (navUserName) navUserName.textContent = displayName;
      if (navUserEmail) navUserEmail.textContent = email;
    }
    if (navLoginBtn) navLoginBtn.style.display = 'none';
    isAdmin = false;
    if (menuAdminLink) {
      menuAdminLink.style.cssText = 'display:none !important; visibility:hidden;';
      menuAdminLink.setAttribute('aria-hidden', 'true');
    }
  } else {
    if (menuUserSection) menuUserSection.style.display = 'none';
    if (menuLoginLink) menuLoginLink.style.display = 'flex';
    if (menuAccountLink) menuAccountLink.style.display = 'none';
    if (menuAdminLink) menuAdminLink.style.display = 'none';
    if (navUserSection) navUserSection.style.display = 'none';
    if (navLoginBtn) navLoginBtn.style.display = 'flex';
  }
}

function logoutUser() {
  try {
    clearStoredAuthUser();
    try { if (window.firebaseAuth && typeof window.firebaseAuth.signOut === 'function') window.firebaseAuth.signOut(); } catch(e) {}
    try { if (window.supabaseClient && window.supabaseClient.auth) window.supabaseClient.auth.signOut(); } catch(e) {}
    currentUser = null;
    isAdmin = false;
    updateUserUI();
    showToast('toast_logout_success');
    if (window.location.pathname.includes('admin.html')) {
      setTimeout(function() { window.location.href = 'index.html'; }, 1000);
    }
  } catch (e) { console.error('خطأ في تسجيل الخروج:', e); }
}

function checkSessionTimeout() {
  try {
    const data = sessionStorage.getItem('hud_auth_user') || localStorage.getItem('hud_auth_user');
    if (!data) return;
    const user = JSON.parse(data);
    if (user.timestamp && (Date.now() - user.timestamp > SESSION_TIMEOUT)) {
      sessionStorage.removeItem('hud_auth_user');
    localStorage.removeItem('hud_auth_user');
      updateUserUI();
      showToast('toast_session_expired', 'error');
      setTimeout(function() { window.location.href = 'login.html'; }, 2000);
    }
  } catch (e) { console.warn('Session check failed:', e); }
}

function setupUserEventListeners() {
  const menuLogoutBtn = document.getElementById('menuLogoutBtn');
  if (menuLogoutBtn && !menuLogoutBtn.dataset.bound) { menuLogoutBtn.dataset.bound = '1'; menuLogoutBtn.addEventListener('click', logoutUser); }
  const navLogoutBtn = document.getElementById('navLogoutBtn');
  if (navLogoutBtn && !navLogoutBtn.dataset.bound) { navLogoutBtn.dataset.bound = '1'; navLogoutBtn.addEventListener('click', logoutUser); }
  const navUserBtn = document.getElementById('navUserBtn');
  const navUserDropdown = document.getElementById('navUserDropdown');
  if (navUserBtn && navUserDropdown && !navUserBtn.dataset.bound) {
    navUserBtn.dataset.bound = '1';
    navUserBtn.addEventListener('click', function(e) { e.stopPropagation(); navUserDropdown.style.display = navUserDropdown.style.display === 'block' ? 'none' : 'block'; });
    document.addEventListener('click', function() { navUserDropdown.style.display = 'none'; });
  }
}

function initUserState() {
  getUserFromSession();
  checkSessionTimeout();
  updateUserUI();
  setupUserEventListeners();
  window.addEventListener('storage', function(e) { if (e.key === 'hud_auth_user') updateUserUI(); });
}

const rateLimiter = {
  requests: {},
  limit: 5,
  window: 60000,
  check: function(action, identifier) {
    const key = action + ':' + identifier;
    const now = Date.now();
    const windowStart = now - this.window;
    if (!this.requests[key]) this.requests[key] = [];
    this.requests[key] = this.requests[key].filter(function(t) { return t > windowStart; });
    if (this.requests[key].length >= this.limit) return false;
    this.requests[key].push(now);
    return true;
  }
};

function generateUniqueSecretToken(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  const cryptoObj = window.crypto || window.msCrypto;
  if (cryptoObj && cryptoObj.getRandomValues) {
    const vals = new Uint32Array(16);
    cryptoObj.getRandomValues(vals);
    for (let i = 0; i < 16; i++) rand += chars[vals[i] % chars.length];
  } else {
    for (let i = 0; i < 16; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + rand;
}
window.generateUniqueSecretToken = generateUniqueSecretToken;

// ===== تسجيل الطلب وإرسال كلمات المرور السرية إلى واتساب =====
async function submitOrderOnSite(e) {
  e.preventDefault();
  const authenticatedUser = requireLoggedInForPurchase();
  if (!authenticatedUser) {
    return;
  }
  const userKeyForRate = authenticatedUser.uid || (document.getElementById('custPhone') && document.getElementById('custPhone').value) || 'anonymous';
  if (!rateLimiter.check('order', userKeyForRate)) {
    showToast('toast_rate_limit', 'error');
    return;
  }
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span data-icon="send" data-size="18"></span> ' + t('toast_loading');
    injectIcons();
  }
  try {
    const walletSelect = document.getElementById('custWallet');
    if (!walletSelect || !walletSelect.value) {
      showToast(t('select_wallet'));
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; injectIcons(); }
      return;
    }
    if (!currentOrder) {
      showToast(t('error_not_found'));
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; injectIcons(); }
      return;
    }

    const requiredFields = document.querySelectorAll('.dynamic-field-input[required]');
    let missingFields = [];
    requiredFields.forEach(function(input) {
      if (!input.value.trim()) {
        const label = input.getAttribute('data-field-label') || input.getAttribute('placeholder') || t('form_required');
        missingFields.push(label);
        input.style.borderColor = '#FF3D57';
      } else {
        input.style.borderColor = '';
      }
    });

    if (missingFields.length > 0) {
      showToast(t('error_required_fields') + ': ' + missingFields.join('، '));
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; injectIcons(); }
      return;
    }

    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const governorate = document.getElementById('custGov').value.trim();
    const city = document.getElementById('custCity').value.trim();
    const address = document.getElementById('custAddress').value.trim();

    const dynamicFields = {};
    document.querySelectorAll('.dynamic-field-input').forEach(function(input) {
      const fieldId = input.getAttribute('data-field-id');
      const fieldLabel = input.getAttribute('data-field-label');
      if (fieldId && input.value.trim()) {
        dynamicFields[fieldId] = input.value.trim();
        dynamicFields[fieldLabel || fieldId] = input.value.trim();
      }
    });

    const selectedWallet = WALLETS.find(function(w) { return w.id === walletSelect.value; });
    const walletName = selectedWallet ? selectedWallet.name : (walletSelect.value === 'account_balance' ? 'رصيد الحساب (تغذية حسابي)' : walletSelect.value);
    
    var authUserForBal = window.getCachedAuthUser ? window.getCachedAuthUser() : null;
    var curUserIdForBal = authUserForBal ? (authUserForBal.uid || authUserForBal.id || authUserForBal.email) : 'guest';
    var curBal = 0;
    if (typeof window.getUserBalance === 'function') curBal = window.getUserBalance(curUserIdForBal);
    var orderPriceVal = currentOrder ? (currentOrder.priceYER || currentOrder.price || 0) : 0;
    if (orderPriceVal > 0 && curBal >= orderPriceVal) {
      if (typeof window.debitUserBalance === 'function') window.debitUserBalance(curUserIdForBal, orderPriceVal);
    }

    const isReturningCustomer = document.getElementById('usePreviousData') && document.getElementById('usePreviousData').checked;

    // لا يتم إنشاء رابط واتساب هنا؛ الطلب يُحفظ داخل Firestore ولوحة الإدارة فقط.

    showToast(t('order_saving'));

    var cachedUser = authenticatedUser || getCachedAuthUser() || {};
    var accountPassword = cachedUser.accountPassword;
    if (!accountPassword) {
      accountPassword = generateUniqueSecretToken('HUD-ACC');
      cachedUser.accountPassword = accountPassword;
      cachedUser.accountStatus = cachedUser.accountStatus || 'under_confirmation';
      try {
        sessionStorage.setItem('hud_auth_user', JSON.stringify(cachedUser));
        localStorage.setItem('hud_auth_user', JSON.stringify(cachedUser));
        if (window.firebaseDB && window.firebaseDB.db && cachedUser.uid) {
          window.firebaseDB.updateDoc(window.firebaseDB.doc(window.firebaseDB.db, 'users', cachedUser.uid), { accountPassword: accountPassword, accountStatus: 'under_confirmation' });
        }
      } catch(err){}
    }

    const offerPassword = generateUniqueSecretToken('HUD-ORD');

    const orderPayload = {
      userId: cachedUser && cachedUser.uid ? cachedUser.uid : '',
      customerName: name,
      customerPhone: phone,
      customerEmail: cachedUser && cachedUser.email ? cachedUser.email : '',
      customerGovernorate: governorate,
      customerCity: city,
      customerAddress: address,
      accountPassword: accountPassword,
      orderPassword: offerPassword,
      offerPassword: offerPassword,
      status: 'pending',
      orderItems: [{
        categoryId: currentOrder.categoryId || '',
        itemId: currentOrder.itemId || '',
        offerId: currentOrder.offerId || '',
        categoryName: currentOrder.categoryName || '',
        itemName: currentOrder.itemTitle || '',
        name: currentOrder.offerTitle || currentOrder.itemTitle || '',
        priceYER: currentOrder.priceYER || currentOrder.price || 0,
        currency: currentOrder.currency || DEFAULT_CURRENCY
      }],
      totalYER: currentOrder.priceYER || currentOrder.price || 0,
      walletId: selectedWallet ? selectedWallet.id : walletSelect.value,
      walletName: walletName,
      walletNumber: selectedWallet && selectedWallet.number ? selectedWallet.number : '',
      dynamicFields: dynamicFields,
      isReturningCustomer: !!isReturningCustomer,
      source: 'site',
      notificationMethod: 'whatsapp'
    };

    const orderSaved = await saveOrderToFirestore(orderPayload);

    try {
      var locOrders = JSON.parse(localStorage.getItem('hud_local_orders') || '[]');
      locOrders.unshift(Object.assign({ id: 'ord-' + Date.now(), createdAt: new Date().toISOString() }, orderPayload));
      localStorage.setItem('hud_local_orders', JSON.stringify(locOrders));
    } catch(e){}

    if (!orderSaved) {
      showToast(t('order_save_failed'));
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; injectIcons(); }
      return;
    }

    try {
      saveCustomerData({
        name: name,
        phone: phone,
        governorate: governorate,
        city: city,
        address: address,
        dynamicFields: dynamicFields,
        lastOrderAt: new Date().toISOString(),
        isReturningCustomer: isReturningCustomer
      });
    } catch (e) {}

    const defaultWa = (window.siteSettings && window.siteSettings.whatsappNumber) || (typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '967783708724');
    const waClean = String(defaultWa).replace(/\D/g, '');
    const waText = `كلمة مرور الحساب: ${accountPassword}\nكلمة مرور العرض: ${offerPassword}`;
    const waUrl = `https://wa.me/${waClean}?text=${encodeURIComponent(waText)}`;

    showToast('toast_order_whatsapp_redirect', 'info');

    setTimeout(function() {
      closeCustomerModal();
      currentOrder = null;
      window.location.href = waUrl;
    }, 1000);
  } catch (e) {
    console.error('خطأ في الإرسال:', e);
    showToast(t('toast_error'));
  }
  if (submitBtn) {
    setTimeout(function() {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      injectIcons();
    }, 3000);
  }
}

// ===== التنبيه =====
function showToast(msg, type) {
  try {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const translated = (typeof msg === 'string' && typeof t === 'function' && /^[a-z][a-z0-9_.-]+$/i.test(msg)) ? t(msg) : msg;
    const textEl = document.getElementById('toastText');
    if (textEl) textEl.textContent = translated;
    toast.className = 'toast show ' + (type || 'success');

    // إضافة زر إغلاق إذا لم يكن موجوداً
    const closeBtn = toast.querySelector('.toast-close-btn') || document.createElement('button');
    if (!closeBtn.parentNode) {
      closeBtn.className = 'toast-close-btn';
      closeBtn.type = 'button';
      closeBtn.addEventListener('click', function () { toast.classList.remove('show'); });
      toast.appendChild(closeBtn);
    }
    closeBtn.setAttribute('aria-label', typeof t === 'function' ? t('toast_close') : 'Close');
    closeBtn.textContent = '✕';
  } catch (e) {}
}

// ===== عرض الأقسام في الصفحة الرئيسية =====
function renderHomeCategories() {
  try {
    const grid = document.getElementById('homeCategoriesGrid');
    if (!grid) return;
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      // لا نعرض زر الإدارة هنا — الزر يظهر فقط في القائمة الجانبية للمدير المسجّل
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:50px 20px; color:#888;">' +
        window.icon('layers', 50) +
        '<p style="margin-top:14px; font-weight:700; color:#FFD700;">' + t('no_categories') + '</p>' +
        '<p style="font-size:12px; margin-top:6px;">سيتم عرض الأقسام والمنتجات قريباً...</p>' +
        '</div>';
      return;
    }

    const sorted = categories.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });

    grid.innerHTML = sorted.map(function(cat) {
      if (!cat || !cat.id) return '';

      const imageHTML = cat.image
        ? '<img loading="lazy" src="' + escapeAttr(safeURL(cat.image, '')) + '" alt="' + escapeAttr(cat.name || '') + '">'
        : '<div class="placeholder">' + window.icon('layers', 40) + '</div>';

      const descText = cat.description || cat.desc || '';

      return '<a href="category.html?id=' + encodeURIComponent(cat.id) + '" class="cat-card">' +
        '<div class="cat-image-wrap">' + imageHTML + '</div>' +
        '<h3>' + escapeHTML(cat.name || '') + '</h3>' +
        '<p>' + escapeHTML(descText) + '</p>' +
        '<div class="cat-link">' +
        t('btn_shop') + ' ' + window.icon('arrow', 14) +
        '</div>' +
        '</a>';
    }).join('');

    injectIcons();
  } catch (e) {
    console.error('خطأ في عرض الأقسام:', e);
  }
}

// ===== القائمة الجانبية =====
function renderMenuCategories() {
  try {
    const container = document.getElementById('menuCategories');
    if (!container) return;
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      container.innerHTML = '<p style="padding:14px; color:#555; font-size:12px; text-align:center;">' + t('no_categories') + '</p>';
      return;
    }

    const currentCat = new URLSearchParams(window.location.search).get('id');
    const sorted = categories.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });

    container.innerHTML = sorted.map(function(cat) {
      if (!cat || !cat.id) return '';
      const active = cat.id === currentCat ? 'active' : '';
      const imgIcon = cat.image
        ? '<img loading="lazy" src="' + escapeAttr(safeURL(cat.image, '')) + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">'
        : window.icon('layers', 18);

      return '<a href="category.html?id=' + encodeURIComponent(cat.id) + '" class="menu-link ' + active + '">' +
        '<div class="menu-link-icon" style="overflow:hidden; padding:0;">' + imgIcon + '</div>' +
        escapeHTML(cat.name || '') +
        '</a>';
    }).join('');
  } catch (e) {
    console.error('خطأ في القائمة:', e);
  }
}

// ===== صفحة القسم =====
let categoryCurrentPage = 1;

function renderAllCategoriesPage(pageContent) {
  try {
    if (!pageContent) return;
    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      pageContent.innerHTML = '<div style="padding:80px 20px; text-align:center;"><div style="display:inline-block; width:50px; height:50px; border:4px solid #FFD700; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div><h2 style="margin:16px 0 8px; color:#FFD700;">' + t('toast_loading') + '</h2></div>';
      return;
    }
    const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = t('categories');
    document.title = t('categories') + ' - ' + t('store_name');
    const sorted = categories.slice().sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
    let html = '';
    html += '<div class="category-header-wrap" style="background:#111;">';
    html += '<div class="category-icon-big">' + window.icon('layers', 40) + '</div>';
    html += '<h1 class="category-title-big">' + t('categories') + '</h1>';
    html += '<p class="category-desc-big">اختر القسم الذي تريد تصفحه</p>';
    html += '</div>';
    html += '<div class="category-container" style="padding:20px;max-width:1200px;margin:0 auto;">';
    html += '<div class="categories-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;">';
    html += sorted.map(function(cat) {
      if (!cat || !cat.id) return '';
      const imageHTML = cat.image
        ? '<img loading="lazy" src="' + escapeAttr(safeURL(cat.image, '')) + '" alt="' + escapeAttr(cat.name || '') + '" style="width:100%;height:120px;object-fit:cover;border-radius:14px;">'
        : '<div class="placeholder" style="height:120px;display:flex;align-items:center;justify-content:center;border-radius:14px;background:rgba(255,215,0,.08);">' + window.icon('layers', 40) + '</div>';
      const descText = cat.description || cat.desc || '';
      return '<a href="category.html?id=' + encodeURIComponent(cat.id) + '" class="cat-card" style="text-decoration:none;">' +
        '<div class="cat-image-wrap">' + imageHTML + '</div>' +
        '<h3>' + escapeHTML(cat.name || '') + '</h3>' +
        '<p>' + escapeHTML(descText) + '</p>' +
        '<div class="cat-link">' + t('btn_shop') + ' ' + window.icon('arrow', 14) + '</div>' +
        '</a>';
    }).join('');
    html += '</div></div>';
    pageContent.innerHTML = html;
    injectIcons();
  } catch (e) {
    console.error('Error rendering all categories:', e);
  }
}

function renderCategoryPage(append) {
  try {
    const params = new URLSearchParams(window.location.search);
    const catId = params.get('id');
    const pageContent = document.getElementById('pageContent');
    if (!pageContent) return;

    if (!categories || categories.length === 0) {
      if (!append) {
        pageContent.innerHTML = '<div style="padding:80px 20px; text-align:center;"><div style="display:inline-block; width:50px; height:50px; border:4px solid #FFD700; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div><h2 style="margin:16px 0 8px; color:#FFD700;">' + t('toast_loading') + '</h2></div>';
      }
      return;
    }

    if (!catId) {
      renderAllCategoriesPage(pageContent);
      return;
    }

    const category = getCategory(catId);
    if (!category) {
      renderAllCategoriesPage(pageContent);
      return;
    }

    const breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = category.name || t('categories');
    document.title = (category.name || t('categories')) + ' - ' + t('store_name');

    const items = category.items || [];
    const activeItems = items.filter(function(i) { return !siteSettings.hideUnavailable || i.status !== 'unavailable'; });

    if (activeItems.length === 0) {
      pageContent.innerHTML = '<div style="padding:80px 20px; text-align:center;"><h2 style="color:#FFD700;">' + t('no_items') + '</h2></div>';
      return;
    }

    const perPage = siteSettings.offersPerPage || 10;
    const start = (categoryCurrentPage - 1) * perPage;
    const end = start + perPage;
    const itemsToShow = activeItems.slice(start, end);
    const hasMore = end < activeItems.length;

    let html = '';
    if (!append) {
      const safeCategoryImage = safeURL(category.image, '');
      const coverStyle = safeCategoryImage ? 'background: linear-gradient(rgba(10,10,12,0.8), #0a0a0c), url(\'' + escapeAttr(safeCategoryImage) + '\') center/cover;' : 'background: #111;';
      html += '<div class="category-header-wrap" style="' + coverStyle + '">';
      html += '<div class="category-icon-big">' + window.icon(category.icon || 'package', 40) + '</div>';
      html += '<h1 class="category-title-big">' + escapeHTML(category.name || '') + '</h1>';
      const catDesc = category.description || category.desc || '';
      if (catDesc) html += '<p class="category-desc-big">' + textWithBreaks(catDesc) + '</p>';
      html += '</div>';

      html += '<div class="category-container" style="padding: 20px; max-width: 1200px; margin: 0 auto;">';
      html += '<div class="items-grid" id="categoryItemsGrid">';
    }

    itemsToShow.forEach(function(item) {
      const img = item.image ? '<img src="' + escapeAttr(safeURL(item.image, '')) + '" alt="' + escapeAttr(item.name || '') + '" loading="lazy">' : '<div class="item-placeholder">' + window.icon('image', 40) + '</div>';
      let priceHtml = '';
      if (item.offers && item.offers.length > 0) {
        let minPrice = item.offers[0].price || 0;
        item.offers.forEach(function(o) {
          if ((o.price || 0) < minPrice) minPrice = o.price || 0;
        });
        priceHtml = t('starting_from') + ' ' + formatPrice(minPrice, DEFAULT_CURRENCY);
      }

      const badgeHtml = getStatusBadge(item.status);
      const isUnavailable = item.status === 'unavailable';

      html += '<div class="item-card" ' + (isUnavailable ? '' : 'onclick="openItemModal(\'' + escapeJSString(category.id) + '\', \'' + escapeJSString(item.id) + '\')"') + ' ' + (isUnavailable ? 'style="opacity:0.5;cursor:not-allowed;"' : 'style="cursor:pointer"') + '>';
      html += badgeHtml;
      html += '<div class="item-image">' + img + '</div>';
      html += '<div class="item-info">';
      html += '<h3 class="item-title">' + escapeHTML(item.name || '') + '</h3>';
      if (priceHtml) html += '<div class="item-price">' + priceHtml + '</div>';
      html += '</div></div>';
    });

    if (!append) {
      html += '</div>';
      html += '<div id="loadMoreContainer" style="text-align:center; margin-top:20px;"></div>';
      html += '</div>';
      pageContent.innerHTML = html;
    } else {
      const grid = document.getElementById('categoryItemsGrid');
      if (grid) grid.insertAdjacentHTML('beforeend', itemsToShow.map(function(item) {
        const img = item.image ? '<img src="' + escapeAttr(safeURL(item.image, '')) + '" alt="' + escapeAttr(item.name || '') + '" loading="lazy">' : '<div class="item-placeholder">' + window.icon('image', 40) + '</div>';
        let priceHtml = '';
        if (item.offers && item.offers.length > 0) {
          let minPrice = item.offers[0].price || 0;
          item.offers.forEach(function(o) { if ((o.price || 0) < minPrice) minPrice = o.price || 0; });
          priceHtml = t('starting_from') + ' ' + formatPrice(minPrice, DEFAULT_CURRENCY);
        }
        const badgeHtml = getStatusBadge(item.status);
        const isUnavailable = item.status === 'unavailable';
        return '<div class="item-card" ' + (isUnavailable ? '' : 'onclick="openItemModal(\'' + escapeJSString(category.id) + '\', \'' + escapeJSString(item.id) + '\')"') + ' ' + (isUnavailable ? 'style="opacity:0.5;cursor:not-allowed;"' : 'style="cursor:pointer"') + '>' +
          badgeHtml + '<div class="item-image">' + img + '</div>' +
          '<div class="item-info"><h3 class="item-title">' + escapeHTML(item.name || '') + '</h3>' +
          (priceHtml ? '<div class="item-price">' + priceHtml + '</div>' : '') + '</div></div>';
      }).join(''));
    }

    const loadMoreContainer = document.getElementById('loadMoreContainer');
    if (loadMoreContainer) {
      if (hasMore) {
        loadMoreContainer.innerHTML = '<button class="btn btn-gold" onclick="loadMoreItems()" style="padding:10px 30px;">' + t('btn_load_more') + '</button>';
      } else {
        loadMoreContainer.innerHTML = '';
      }
    }

    if (!append) {
      const itemId = params.get('item');
      if (itemId) {
        setTimeout(function() { openItemModal(catId, itemId); }, 500);
      }
    }

    injectIcons();
  } catch (e) {
    console.error('Error rendering category:', e);
  }
}

function loadMoreItems() {
  categoryCurrentPage++;
  renderCategoryPage(true);
}

// ===== عرض عروض المنتج =====
function renderItemOffers(categoryId, itemId, append) {
  const category = getCategory(categoryId);
  if (!category || !category.items) return;
  const item = category.items.find(function(i) { return i && i.id === itemId; });
  const container = document.getElementById('modalOffers');
  if (!container || !item) return;
  let offers = item.offers || [];
  const activeOffers = offers.filter(function(o) { return !siteSettings.hideUnavailable || o.status !== 'unavailable'; });
  if (activeOffers.length === 0) {
    if (!append) container.innerHTML = '<div style="text-align:center; padding:20px; color:#888;">' + t('no_offers') + '</div>';
    return;
  }
  const perPage = siteSettings.offersPerPage || 10;
  let currentPage = append ? parseInt(container.dataset.page || '1', 10) : 1;
  const start = (currentPage - 1) * perPage;
  const end = start + perPage;
  const offersToShow = activeOffers.slice(start, end);
  const hasMore = end < activeOffers.length;
  let html = '';
  offersToShow.forEach(function(offer) {
    const isUnavailable = offer.status === 'unavailable';
    const badgeHtml = getStatusBadge(offer.status);
    html += '<div class="offer-card" ' + (isUnavailable ? 'style="opacity:0.5; pointer-events:none;"' : '') + '>';
    if (offer.image) {
      html += '<img loading="lazy" src="' + escapeAttr(safeURL(offer.image, '')) + '" alt="' + escapeAttr(offer.name || '') + '" class="offer-image">';
    }
    html += badgeHtml;
    html += '<div class="offer-info">';
    html += '<div class="offer-title">' + escapeHTML(offer.name || '') + '</div>';
    if (offer.description || offer.desc) html += '<div class="offer-desc">' + textWithBreaks(offer.description || offer.desc) + '</div>';
    html += '</div>';

    const originalPrice = offer.oldPrice || offer.originalPriceYER || 0;
    const currentPrice = offer.price || 0;
    let discount = 0;
    if (originalPrice > currentPrice) {
      discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }

    html += '<div class="offer-action">';
    html += '<div class="offer-price-box">';
    if (discount > 0) {
      html += '<div class="offer-original-price">' + formatPrice(originalPrice, DEFAULT_CURRENCY) + '</div>';
    }
    const multiPrices = formatPriceMultiCurrency(currentPrice);
    html += '<div class="offer-price">' + (multiPrices && multiPrices.length > 0 ? multiPrices.join(' | ') : formatPrice(currentPrice, DEFAULT_CURRENCY)) + '</div>';
    if (discount > 0) html += '<span class="offer-discount">' + t('btn_shop') + ' ' + discount + '%</span>';
    html += '</div>';

    if (!isUnavailable) {
      html += '<button class="offer-buy-btn" onclick="buyOffer(\'' + escapeJSString(categoryId) + '\', \'' + escapeJSString(itemId) + '\', \'' + escapeJSString(offer.id) + '\')">';
      html += window.icon('cart2', 14) + ' ' + t('btn_buy') + '</button>';
    } else {
      html += '<button class="offer-buy-btn" style="background:#555; cursor:not-allowed;" disabled>' + t('status_unavailable') + '</button>';
    }

    html += '</div></div>';
  });
  if (!append) {
    container.innerHTML = html + '<div id="loadMoreOffersContainer" style="text-align:center; margin-top:15px;"></div>';
    container.dataset.page = '1';
  } else {
    const loadMore = document.getElementById('loadMoreOffersContainer');
    if (loadMore) loadMore.insertAdjacentHTML('beforebegin', html);
    container.dataset.page = String(currentPage + 1);
  }
  const loadMoreContainer = document.getElementById('loadMoreOffersContainer');
  if (loadMoreContainer) {
    if (hasMore) {
      loadMoreContainer.innerHTML = '<button class="btn btn-gold" onclick="loadMoreOffers(\'' + escapeJSString(categoryId) + '\', \'' + escapeJSString(itemId) + '\')" style="padding:5px 20px; font-size:12px;">' + t('btn_load_more') + '</button>';
    } else {
      loadMoreContainer.innerHTML = '';
    }
  }
  injectIcons();
}

function loadMoreOffers(categoryId, itemId) {
  renderItemOffers(categoryId, itemId, true);
}

// ===== فتح نافذة المنتج =====
function openItemModal(categoryId, itemId) {
  try {
    const category = getCategory(categoryId);
    if (!category) return showToast(t('error_not_found'));
    if (!category.items || !Array.isArray(category.items)) return showToast(t('no_items'));
    const item = category.items.find(function(i) { return i && i.id === itemId; });
    if (!item) return showToast(t('error_not_found'));

    const modal = document.getElementById('itemModal');
    const overlay = document.getElementById('itemModalOverlay');
    if (!modal) return;

    document.getElementById('modalName').textContent = item.name || t('item_details');
    const modalImageWrap = document.getElementById('modalImageWrap');
    if (modalImageWrap) {
      if (item.image) {
        modalImageWrap.innerHTML = '<img src="' + escapeAttr(safeURL(item.image, '')) + '" alt="" style="width:100%;height:100%;object-fit:cover;">';
      } else {
        modalImageWrap.innerHTML = '<div class="placeholder">' + window.icon('image', 40) + '</div>';
      }
    }

    const descText = item.description || item.desc || '';
    document.getElementById('modalDesc').innerHTML = descText ? textWithBreaks(descText) : '';

    const modalOffersContainer = document.getElementById('modalOffers');
    if (modalOffersContainer) modalOffersContainer.dataset.page = '1';

    renderItemOffers(categoryId, itemId, false);

    modal.classList.add('open');
    if (overlay) overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    injectIcons();
  } catch (e) {
    console.error('خطأ في فتح النافذة:', e);
  }
}

function closeItemModal() {
  const modal = document.getElementById('itemModal');
  const overlay = document.getElementById('itemModalOverlay');
  if (modal) modal.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ===== حساب نسبة الخصم =====
function calcDiscount(price, oldPrice) {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

// ===== دالة الجاهزية =====
window.onFirebaseReady = async function() {
  console.log('Supabase جاهز - بدء العرض');
  if (document.getElementById('homeCategoriesGrid')) {
    renderHomeCategories();
  }
  if (document.getElementById('pageContent')) {
    renderCategoryPage();
  }
  renderMenuCategories();
  injectIcons();
  renderWalletGrid();
  applySiteSettingsToUI();
  initUserState();
  setupUserEventListeners();
  // تهيئة قسم التعليقات/الآراء (المزامنة اللحظية)
  if (document.getElementById('reviewsSection')) {
    initReviews();
  }
  // تحديث الترجمة بعد تحميل البيانات
  if (typeof applyLanguage === 'function') {
    applyLanguage();
  }
};

// ============================================
//   نظام آراء وتعليقات العملاء (Reviews)
// ============================================
let __reviewsListenerStarted = false;

function initReviews() {
  setupReviewForm();
  startReviewsListener();
}

function setupReviewForm() {
  const form = document.getElementById('reviewForm');
  if (!form || form.dataset.bound === 'true') return;
  form.dataset.bound = 'true';

  // نجوم التقييم
  const starsWrap = document.getElementById('reviewStarsInput');
  const ratingInput = document.getElementById('reviewRating');
  function paintStars(val) {
    if (!starsWrap) return;
    starsWrap.querySelectorAll('.review-star-btn').forEach(function(btn) {
      const v = parseInt(btn.getAttribute('data-value'));
      btn.classList.toggle('active', v <= val);
    });
  }
  if (starsWrap) {
    starsWrap.querySelectorAll('.review-star-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const v = parseInt(this.getAttribute('data-value'));
        if (ratingInput) ratingInput.value = v;
        paintStars(v);
      });
    });
    paintStars(parseInt((ratingInput && ratingInput.value) || '5'));
  }

  form.addEventListener('submit', submitReview);
}

async function submitReview(e) {
  e.preventDefault();
  const nameEl = document.getElementById('reviewName');
  const msgEl = document.getElementById('reviewMessage');
  const ratingEl = document.getElementById('reviewRating');
  const btn = document.getElementById('reviewSubmitBtn');

  const message = (msgEl && msgEl.value || '').trim();
  if (!message) {
    showToast('toast_review_message_required', 'warning');
    if (msgEl) msgEl.focus();
    return;
  }

  let name = (nameEl && nameEl.value || '').trim();
  // استخدم اسم المستخدم المسجّل إن وُجد
  if (!name) {
    var cu = (typeof getCachedAuthUser === 'function') ? getCachedAuthUser() : null;
    name = (cu && (cu.name || cu.displayName)) ? (cu.name || cu.displayName) : 'زائر';
  }

  const rating = Math.max(1, Math.min(5, parseInt((ratingEl && ratingEl.value) || '5') || 5));

  if (!window.firebaseDB || !window.firebaseDB.db) {
    showToast('toast_database_unavailable', 'error');
    return;
  }

  if (btn) { btn.disabled = true; }
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '<span>جاري الإرسال...</span>'; }

  try {
    const fb = window.firebaseDB;
    const cu = (typeof getCachedAuthUser === 'function') ? getCachedAuthUser() : null;
    const id = 'rev-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
    const createdAtIso = new Date().toISOString();
    const data = {
      id: id,
      name: String(name).slice(0, 50),
      message: String(message).slice(0, 500),
      rating: rating,
      userId: cu && cu.uid ? cu.uid : '',
      userEmail: cu && cu.email ? cu.email : '',
      approved: true,
      hidden: false,
      createdAt: fb.serverTimestamp ? fb.serverTimestamp() : createdAtIso,
      createdAtIso: createdAtIso
    };
    await fb.setDoc(fb.doc(fb.db, 'reviews', id), data);
    showToast('toast_review_submitted');
    // تفريغ النموذج
    if (msgEl) msgEl.value = '';
    if (nameEl) nameEl.value = '';
    if (ratingEl) ratingEl.value = '5';
    const starsWrap = document.getElementById('reviewStarsInput');
    if (starsWrap) starsWrap.querySelectorAll('.review-star-btn').forEach(function(b) {
      b.classList.toggle('active', parseInt(b.getAttribute('data-value')) <= 5);
    });
  } catch (err) {
    console.error('خطأ في إرسال التعليق:', err);
    showToast('toast_review_submit_failed', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      injectIcons();
    }
  }
}

function reviewStarsHtml(rating) {
  const r = Math.max(0, Math.min(5, parseInt(rating) || 0));
  let out = '';
  for (let i = 1; i <= 5; i++) {
    out += '<span class="' + (i <= r ? '' : 'empty') + '">★</span>';
  }
  return out;
}

function formatReviewDate(rev) {
  try {
    let d;
    if (rev.createdAt && rev.createdAt.seconds) d = new Date(rev.createdAt.seconds * 1000);
    else if (rev.createdAtIso) d = new Date(rev.createdAtIso);
    else if (rev.createdAt) d = new Date(rev.createdAt);
    else return '';
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) { return ''; }
}

function renderReviews(reviews) {
  const list = document.getElementById('reviewsList');
  if (!list) return;

  const visible = (reviews || []).filter(function(r) { return r && r.hidden !== true; });
  // ترتيب من الأحدث للأقدم
  visible.sort(function(a, b) {
    const ta = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds * 1000 : (a.createdAtIso ? new Date(a.createdAtIso).getTime() : 0);
    const tb = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds * 1000 : (b.createdAtIso ? new Date(b.createdAtIso).getTime() : 0);
    return tb - ta;
  });

  if (visible.length === 0) {
    list.innerHTML = '<div class="reviews-empty"><p>لا توجد تعليقات بعد. كن أول من يشاركنا رأيه! 🌟</p></div>';
    return;
  }

  list.innerHTML = visible.map(function(r) {
    const initial = escapeHTML((r.name || '?').charAt(0).toUpperCase());
    return '<div class="review-card">' +
      '<div class="review-card-head">' +
        '<div class="review-card-avatar">' + initial + '</div>' +
        '<div class="review-card-meta">' +
          '<div class="review-card-name">' + escapeHTML(r.name || 'زائر') + '</div>' +
          '<div class="review-card-date">' + escapeHTML(formatReviewDate(r)) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="review-card-stars">' + reviewStarsHtml(r.rating) + '</div>' +
      '<div class="review-card-text">' + textWithBreaks(r.message || '') + '</div>' +
    '</div>';
  }).join('');
}

function startReviewsListener() {
  if (__reviewsListenerStarted) return;
  if (!window.firebaseDB || !window.firebaseDB.db) return;
  const fb = window.firebaseDB;
  try {
    if (fb.onSnapshot && fb.collection) {
      __reviewsListenerStarted = true;
      fb.onSnapshot(fb.collection(fb.db, 'reviews'), function(snapshot) {
        const reviews = [];
        snapshot.forEach(function(d) { reviews.push(Object.assign({ id: d.id }, d.data())); });
        renderReviews(reviews);
      }, function(err) {
        console.warn('reviews listener error', err);
        loadReviewsOnce();
      });
    } else {
      loadReviewsOnce();
    }
  } catch (e) {
    console.warn('startReviewsListener failed', e);
    loadReviewsOnce();
  }
}

async function loadReviewsOnce() {
  try {
    const fb = window.firebaseDB;
    if (!fb || !fb.getDocs || !fb.collection) return;
    const snap = await fb.getDocs(fb.collection(fb.db, 'reviews'));
    const reviews = [];
    snap.forEach(function(d) { reviews.push(Object.assign({ id: d.id }, d.data())); });
    renderReviews(reviews);
  } catch (e) {
    console.warn('loadReviewsOnce failed', e);
    const list = document.getElementById('reviewsList');
    if (list) list.innerHTML = '<div class="reviews-empty"><p>تعذر تحميل التعليقات</p></div>';
  }
}

// ===== إضافات جديدة - الترجمة والوضع الليلي والبحث =====
// ===== تبديل الوضع الليلي =====
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('hud_theme', newTheme);
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const iconName = newTheme === 'light' ? 'moon' : 'sun';
    themeBtn.setAttribute('data-icon', iconName);
    // ✅ الإصلاح: إزالة dataset.iconDone ليتم إعادة الحقن
    themeBtn.removeAttribute('data-icon-done');
    if (typeof injectIcons === 'function') {
      injectIcons();
    }
  }
}

function loadTheme() {
  try {
    const savedTheme = localStorage.getItem('hud_theme');
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    }
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

// ===== عرض نتائج البحث المتقدم =====
function renderAdvancedSearchResults(query, filters) {
  const container = document.getElementById('searchResultsContainer');
  if (!container) return;
  const results = advancedSearch(query, filters);
  if (results.length === 0) {
    container.innerHTML = '<div class="no-results">' +
      window.icon('search', 48) +
      '<h3>' + t('no_results') + '</h3>' +
      '<p style="color:var(--text-secondary);font-size:14px;">' +
      (query ? t('search_for') + ' "' + escapeHTML(query) + '" ' + t('no_results') : t('clear_filters')) +
      '</p></div>';
    injectIcons();
    return;
  }
  const resultText = results.length === 1 ? t('results_found') : t('results_found_plural');
  let html = '<div class="search-results-count">' +
    window.icon('search', 14) + ' ' + results.length + ' ' + resultText +
    (query ? ' ' + t('search_for') + ' "' + escapeHTML(query) + '"' : '') +
    '</div>';
  html += '<div class="items-grid">';
  results.forEach(function(result) {
    const img = result.image ?
      '<img src="' + escapeAttr(safeURL(result.image, '')) + '" alt="' + escapeAttr(result.itemName) + '" loading="lazy">' :
      '<div class="item-placeholder">' + window.icon('image', 40) + '</div>';
    const badgeHtml = getStatusBadge(result.status);
    const isUnavailable = result.status === 'unavailable';
    const priceHtml = result.minPrice > 0 ?
      t('starting_from') + ' ' + formatPrice(result.minPrice, DEFAULT_CURRENCY) : '';

    let displayName = result.itemName;
    let displayDesc = result.itemDescription;
    if (query) {
      const regex = new RegExp('(' + escapeRegex(query) + ')', 'gi');
      displayName = displayName.replace(regex, '<span class="search-highlight">$1</span>');
      displayDesc = displayDesc.replace(regex, '<span class="search-highlight">$1</span>');
    }

    html += '<div class="item-card" ' +
      (isUnavailable ? '' : 'onclick="openItemModal(\'' + escapeJSString(result.categoryId) + '\', \'' + escapeJSString(result.itemId) + '\')"') +
      ' ' + (isUnavailable ? 'style="opacity:0.5;cursor:not-allowed;"' : 'style="cursor:pointer"') + '>';
    html += badgeHtml;
    html += '<div class="item-image">' + img + '</div>';
    html += '<div class="item-info">';
    html += '<h3 class="item-title">' + displayName + '</h3>';
    if (displayDesc) html += '<p style="font-size:11px;color:var(--text-secondary);">' + displayDesc + '</p>';
    if (priceHtml) html += '<div class="item-price">' + priceHtml + '</div>';
    html += '</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
  injectIcons();
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function initAdvancedSearch() {
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  const searchFilters = document.getElementById('searchFilters');
  if (!searchBtn || !searchInput) return;

  function performSearch() {
    const query = searchInput.value;
    const filters = {};
    if (searchFilters) {
      const filterInputs = searchFilters.querySelectorAll('[data-filter]');
      filterInputs.forEach(function(input) {
        const key = input.getAttribute('data-filter');
        let value = input.value;
        if (input.type === 'checkbox' || input.type === 'radio') {
          if (input.checked) value = input.value;
          else return;
        }
        if (value && value !== '') {
          filters[key] = value;
        }
      });
    }

    renderAdvancedSearchResults(query, filters);
  }

  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') performSearch();
  });

  if (searchFilters) {
    searchFilters.querySelectorAll('input, select').forEach(function(input) {
      input.addEventListener('change', function() {
        clearTimeout(window._searchTimeout);
        window._searchTimeout = setTimeout(performSearch, 300);
      });
    });
  }
}

function generateStructuredData() {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: t('store_name'),
    description: t('store_description'),
    url: window.location.origin,
    logo: window.location.origin + '/logo.svg',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'YE'
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+967712423773',
      contactType: 'customer service'
    },
    sameAs: [
      'https://wa.me/967712423773',
      'https://whatsapp.com/channel/0029Vb8al5Y0LKZA4hbrLE19'
    ]
  };
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

function updateMetaTags(title, description, keywords) {
  if (title) {
    document.title = title + ' - ' + t('store_name');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title + ' - ' + t('store_name'));
  }
  if (description) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', description);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', description);
  }
  if (keywords) {
    const metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) metaKeywords.setAttribute('content', keywords);
  }
}

function populateCategoryFilter() {
  const select = document.querySelector('[data-filter="category"]');
  if (!select || !categories) return;
  const allOption = select.querySelector('option[value="all"]');
  select.innerHTML = '';
  if (allOption) select.appendChild(allOption);
  categories.forEach(function(cat) {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name || '';
    select.appendChild(option);
  });
}

// ===== تهيئة الوضع الليلي =====
loadTheme();

// ===== تهيئة اللغة =====
document.addEventListener('DOMContentLoaded', function() {
  if (typeof applyLanguage === 'function') {
    applyLanguage();
  }
  if (document.getElementById('searchInput')) {
    initAdvancedSearch();
  }
  generateStructuredData();
  // تعبئة فلاتر البحث عند تحميل البيانات
  if (categories && categories.length > 0) {
    populateCategoryFilter();
  }
});

setInterval(checkSessionTimeout, 5 * 60 * 1000);

// ============================================
// ✅ تصدير جميع الدوال المستخدمة في onclick
// هذا هو الإصلاح الرئيسي للمشكلة
// ============================================
window.selectWallet = selectWallet;
window.buyOffer = buyOffer;
window.openItemModal = openItemModal;
window.closeItemModal = closeItemModal;
window.loadMoreItems = loadMoreItems;
window.loadMoreOffers = loadMoreOffers;
window.closeMultiPopup = closeMultiPopup;
window.skipMultiPopup = skipMultiPopup;
window.togglePreviousData = togglePreviousData;
window.openMobileMenu = openMobileMenu;
window.closeMobileMenu = closeMobileMenu;
window.showToast = showToast;
window.openCustomerModal = openCustomerModal;
window.closeCustomerModal = closeCustomerModal;
window.openCustomerModalWithFields = openCustomerModalWithFields;
window.submitOrderOnSite = submitOrderOnSite;
window.injectIcons = injectIcons;
window.renderHomeCategories = renderHomeCategories;
window.renderMenuCategories = renderMenuCategories;
window.renderCategoryPage = renderCategoryPage;
window.renderAllCategoriesPage = renderAllCategoriesPage;
window.renderItemOffers = renderItemOffers;
window.renderWalletGrid = renderWalletGrid;
window.renderDynamicContacts = renderDynamicContacts;
window.renderFeaturedOffers = renderFeaturedOffers;
window.renderHomeCustomFields = renderHomeCustomFields;
window.renderHoodAbout = renderHoodAbout;
window.renderContactPlatforms = renderContactPlatforms;
window.applySiteSettingsToUI = applySiteSettingsToUI;
window.initReviews = initReviews;
window.renderReviews = renderReviews;
window.loadReviewsOnce = loadReviewsOnce;
window.checkReturningCustomer = checkReturningCustomer;
window.toggleTheme = toggleTheme;
window.renderAdvancedSearchResults = renderAdvancedSearchResults;
window.initAdvancedSearch = initAdvancedSearch;
window.populateCategoryFilter = populateCategoryFilter;
window.generateStructuredData = generateStructuredData;
window.updateMetaTags = updateMetaTags;
window.getStatusBadge = getStatusBadge;
window.calcDiscount = calcDiscount;
window.renderPriceDisplay = renderPriceDisplay;
window.applyCurrencyMode = applyCurrencyMode;
window.resetCustomerForm = resetCustomerForm;
window.initUserState = initUserState;
window.updateUserUI = updateUserUI;
window.logoutUser = logoutUser;
window.rateLimiter = rateLimiter;

// ===== قائمة قنوات الدعم والتواصل المنبثقة =====
function bindSupportModalTriggers() {
  document.querySelectorAll('.floating-whatsapp, .float-whatsapp, .bottom-nav-support, .bottom-nav-support-glow, .footer-support-link, #menuSupportLink, #menuAdminPhoneLink, #menuWhatsappLink, #menuChannelLink, .whatsapp-link').forEach(function(btn) {
    if (btn.dataset.supportBound === 'true') return;
    btn.dataset.supportBound = 'true';
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      openSupportChannelsModal(e);
    });
  });
}

window.openSupportChannelsModal = function(e) {
  if (e && e.preventDefault) e.preventDefault();
  const s = (typeof siteSettings !== 'undefined' && siteSettings) ? siteSettings : (window.siteSettings || {});
  
  let modal = document.getElementById('supportChannelsModal');
  let overlay = document.getElementById('supportChannelsOverlay');
  if (!modal) {
    overlay = document.createElement('div');
    overlay.className = 'support-channels-overlay';
    overlay.id = 'supportChannelsOverlay';
    overlay.onclick = window.closeSupportChannelsModal;
    
    modal = document.createElement('div');
    modal.className = 'support-channels-modal';
    modal.id = 'supportChannelsModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-labelledby', 'supportModalTitle');
    modal.innerHTML = `
      <div class="modal-header" style="margin-bottom:12px; position:relative;">
        <div class="modal-handle" style="margin:0 auto 12px; width:40px; height:4px; background:rgba(255,255,255,0.2); border-radius:4px;"></div>
        <button class="modal-close" onclick="closeSupportChannelsModal()" style="position:absolute; top:0; left:0; background:transparent; border:none; color:var(--text-secondary); cursor:pointer;" aria-label="إغلاق">
          <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h3 id="supportModalTitle" style="color:var(--gold); display:flex; align-items:center; justify-content:center; gap:8px; margin:0; font-size:18px; font-weight:800;">
          <span>🛡️</span> <span>${escapeHTML(t('support_modal_title'))}</span>
        </h3>
      </div>
      <p style="text-align:center; color:var(--text-secondary); font-size:13px; margin:0 16px 18px; line-height:1.6;">
        ${escapeHTML(t('support_modal_subtitle'))}
      </p>
      <div class="support-channels-grid" id="supportChannelsGrid"></div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
  }
  
  const grid = document.getElementById('supportChannelsGrid');
  let items = [];
  
  // 1. Contact Platforms
  if (Array.isArray(s.contactPlatforms)) {
    s.contactPlatforms.forEach(p => {
      if (p && p.enabled !== false && p.value && p.value.trim()) {
        items.push({
          label: p.label || 'تواصل معنا',
          icon: p.icon || 'support',
          type: p.type || 'link',
          value: p.value.trim()
        });
      }
    });
  }
  
  // 2. Contacts
  if (Array.isArray(s.contacts)) {
    s.contacts.forEach(c => {
      if (c && c.enabled !== false && c.value && c.value.trim()) {
        if (!items.some(it => it.value === c.value.trim() && it.label === c.name)) {
          items.push({
            label: c.name || 'جهة اتصال',
            icon: c.icon || (c.type === 'phone' ? 'phone' : 'whatsapp'),
            type: c.type || 'phone',
            value: c.value.trim()
          });
        }
      }
    });
  }
  
  // 3. About lines
  if (Array.isArray(s.aboutLines)) {
    s.aboutLines.forEach(ln => {
      if (ln && ln.value && ln.value.trim()) {
        if (!items.some(it => it.value.includes(ln.value.trim()))) {
          items.push({
            label: ln.label || 'إدارة المتجر',
            icon: 'phone',
            type: 'phone',
            value: ln.value.trim()
          });
        }
      }
    });
  }

  // 4. Fallbacks if empty
  if (items.length === 0) {
    const defaultWa = s.whatsappNumber || (typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '967783708724');
    items.push({ label: 'واتساب خدمة العملاء', icon: 'whatsapp', type: 'whatsapp', value: defaultWa });
    const defaultCh = s.whatsappChannel || (typeof WHATSAPP_CHANNEL !== 'undefined' ? WHATSAPP_CHANNEL : '');
    if (defaultCh) {
      items.push({ label: 'قناة الواتساب الرسمية', icon: 'broadcast', type: 'link', value: defaultCh });
    }
  }

  grid.innerHTML = items.map(item => {
    const href = (typeof buildContactHref === 'function') ? buildContactHref(item.type, item.value) : safeURL(item.value, '#');
    const typeClass = 'type-' + (item.type || 'link');
    const iconName = (typeof safeIconName === 'function') ? safeIconName(item.icon, 'support') : 'support';
    const subDesc = getContactSubDesc(item.type, item.value);
    const newTab = (typeof contactOpensNewTab === 'function') ? contactOpensNewTab(item.type) : true;
    
    return `
      <a href="${escapeAttr(href)}" ${newTab ? 'target="_blank" rel="noopener noreferrer"' : ''} class="support-channel-card" onclick="closeSupportChannelsModal()">
        <div class="support-channel-info">
          <div class="support-channel-icon ${typeClass}"><span data-icon="${escapeAttr(iconName)}" data-size="24"></span></div>
          <div class="support-channel-texts">
            <strong>${escapeHTML(item.label)}</strong>
            <span>${escapeHTML(subDesc)}</span>
          </div>
        </div>
        <div class="support-channel-arrow">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="15 18 9 12 15 6"/></svg>
        </div>
      </a>
    `;
  }).join('');

  if (typeof injectIcons === 'function') injectIcons(grid);
  
  setTimeout(() => {
    overlay.classList.add('active');
    modal.classList.add('active');
  }, 10);
};

window.closeSupportChannelsModal = function() {
  const modal = document.getElementById('supportChannelsModal');
  const overlay = document.getElementById('supportChannelsOverlay');
  if (modal) modal.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
};

function getContactSubDesc(type, val) {
  switch(type) {
    case 'whatsapp': return t('support_description_whatsapp');
    case 'phone': return t('support_description_phone');
    case 'telegram': return t('support_description_telegram');
    case 'email': return t('support_description_email');
    default: return t('support_description_link');
  }
}


function updateBuyModalBalance() {
  try {
    const authUser = window.getCachedAuthUser ? window.getCachedAuthUser() : null;
    const userId = authUser ? (authUser.uid || authUser.id || authUser.email) : 'guest';
    let bal = 0;
    if (typeof window.getUserBalance === 'function') bal = window.getUserBalance(userId);
    const el = document.getElementById('buyModalUserBalance');
    if (el) el.textContent = Number(bal).toLocaleString() + ' ر.ي';
    // كل عناصر عرض الرصيد في النافبار (كل الصفحات)
    document.querySelectorAll('#navUserBalanceDisplay, .nav-user-balance-display').forEach(function(n){
      n.textContent = Number(bal).toLocaleString() + ' ر.ي';
    });
    const pageEl = document.getElementById('userCurrentBalanceDisplay');
    if (pageEl) pageEl.textContent = Number(bal).toLocaleString() + ' ر.ي';
  } catch(e) {}
}
window.updateBuyModalBalance = updateBuyModalBalance;
window.updateNavBalanceDisplay = updateBuyModalBalance;

// تشغيل تلقائي في كل الصفحات لتحديث عرض الرصيد
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){ try { updateBuyModalBalance(); } catch(e){} }, 300);
  setTimeout(function(){ try { updateBuyModalBalance(); } catch(e){} }, 1500);
});

// عند تغيّر جلسة المصادقة، حدّث الرصيد
try {
  if (window.firebaseAuth && typeof window.firebaseAuth.onAuthStateChanged === 'function') {
    window.firebaseAuth.onAuthStateChanged(function(){
      setTimeout(function(){ try { updateBuyModalBalance(); } catch(e){} }, 200);
      try { if (typeof window.registerCurrentAuthUserInBalanceIndex === 'function') window.registerCurrentAuthUserInBalanceIndex(); } catch(e){}
    });
  }
} catch(e) {}

// تحديث دوري خفيف كل 10 ثوان لالتقاط تحديثات الأدمن السحابية
setInterval(function(){ try { updateBuyModalBalance(); } catch(e){} }, 10000);
