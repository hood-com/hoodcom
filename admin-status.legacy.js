// admin-status.js — مكون مؤشر حالة الإدارة
// يظهر في كل صفحة، ويرتبط بمتغير تحكم مركزي من لوحة الإدارة
// يستخدم Supabase Realtime لتحديث الحالة لحظياً

(function () {
  var STATUS_KEY = 'hud_admin_availability';

  // ===== إنشاء عنصر الزر في DOM =====
  function createStatusButton() {
    // منع التكرار إذا كان موجوداً مسبقاً
    if (document.getElementById('hudAdminStatusBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'hudAdminStatusBtn';
    btn.setAttribute('aria-label', 'حالة الإدارة');
    btn.setAttribute('title', 'حالة توفر الإدارة');
    btn.type = 'button';
    btn.style.cssText = [
      'position: fixed',
      'bottom: 78px',
      'left: 12px',
      'z-index: 99998',
      'display: flex',
      'align-items: center',
      'gap: 8px',
      'padding: 10px 16px',
      'border: none',
      'border-radius: 50px',
      'font-family: Tajawal, sans-serif',
      'font-size: 12px',
      'font-weight: 800',
      'cursor: default',
      'user-select: none',
      'box-shadow: 0 4px 20px rgba(0,0,0,0.4)',
      'transition: all 0.4s cubic-bezier(0.4,0,0.2,1)',
      'direction: rtl',
      'white-space: nowrap',
      'line-height: 1',
      'outline: none'
    ].join(';');

    document.body.appendChild(btn);
    applyInitialState(btn);
  }

  // ===== تطبيق الحالة الأولية =====
  function applyInitialState(btn) {
    var available = getLocalStatus();
    renderButtonState(btn, available);
    subscribeToRealtimeChanges();
  }

  // ===== قراءة الحالة المحلية (localStorage) كاحتياطي =====
  function getLocalStatus() {
    try {
      var s = JSON.parse(sessionStorage.getItem(STATUS_KEY) || localStorage.getItem(STATUS_KEY) || 'null');
      if (typeof s === 'boolean') return s;
    } catch (e) {}
    // محاولة القراءة من siteSettings
    try {
      var ss = window.siteSettings;
      if (ss && typeof ss.adminAvailability === 'boolean') return ss.adminAvailability;
    } catch (e) {}
    return false;
  }

  // ===== رسم حالة الزر =====
  function renderButtonState(btn, available) {
    if (!btn) btn = document.getElementById('hudAdminStatusBtn');
    if (!btn) return;

    if (available) {
      btn.style.background = 'linear-gradient(135deg, #00E676, #00C853)';
      btn.style.color = '#000';
      btn.style.boxShadow = '0 4px 20px rgba(0,230,118,0.35), 0 0 40px rgba(0,230,118,0.15)';
      btn.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#000;animation:hudPulseAvail 1.5s ease infinite;"></span>'
        + '<span>الإدارة متاحة الآن</span>';
    } else {
      btn.style.background = 'linear-gradient(135deg, #FF3D57, #D32F2F)';
      btn.style.color = '#fff';
      btn.style.boxShadow = '0 4px 20px rgba(255,61,87,0.35), 0 0 40px rgba(255,61,87,0.15)';
      btn.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#fff;opacity:0.7;"></span>'
        + '<span>الإدارة غير متاحة</span>';
    }

    // حفظ الحالة محلياً
    try {
      sessionStorage.setItem(STATUS_KEY, JSON.stringify(available));
      localStorage.setItem(STATUS_KEY, JSON.stringify(available));
    } catch (e) {}
  }

  // ===== الاشتراك في التغييرات اللحظية عبر Supabase Realtime =====
  function subscribeToRealtimeChanges() {
    try {
      if (!window.supabaseClient) {
        // انتظر حتى يتوفر supabaseClient
        var waitInterval = setInterval(function () {
          if (window.supabaseClient) {
            clearInterval(waitInterval);
            doSubscribe();
          }
        }, 500);
        // انتهِ بعد 15 ثانية إن لم يتوفر
        setTimeout(function () { clearInterval(waitInterval); }, 15000);
      } else {
        doSubscribe();
      }
    } catch (e) {
      console.warn('[admin-status] تعذر الاشتراك في Realtime:', e);
    }
  }

  var _channel = null;

  function doSubscribe() {
    if (!window.supabaseClient || _channel) return;
    try {
      _channel = window.supabaseClient
        .channel('hud_admin_status_' + Math.random().toString(36).substr(2, 6))
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'hud_docs',
          filter: 'collection=eq.settings'
        }, function (payload) {
          try {
            var newData = payload.new && payload.new.data;
            if (newData && typeof newData.adminAvailability === 'boolean') {
              renderButtonState(null, newData.adminAvailability);
            }
          } catch (e) {}
        })
        .subscribe();
    } catch (e) {
      console.warn('[admin-status] خطأ في الاشتراك:', e);
    }
  }

  // ===== تحديث الزر من siteSettings عند تحميل الإعدادات =====
  window.addEventListener('hud:site-settings-loaded', function () {
    try {
      var ss = window.siteSettings;
      if (ss && typeof ss.adminAvailability === 'boolean') {
        renderButtonState(null, ss.adminAvailability);
      }
    } catch (e) {}
  });

  // ===== دوال عامة =====
  window.HUD_ADMIN_STATUS = {
    renderButtonState: renderButtonState,
    getLocalStatus: getLocalStatus
  };

  // ===== حقن أنماط CSS للنبض =====
  var styleEl = document.createElement('style');
  styleEl.textContent = '@keyframes hudPulseAvail{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}';
  document.head.appendChild(styleEl);

  // ===== التهيئة عند تحميل DOM =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { createStatusButton(); });
  } else {
    createStatusButton();
  }

  // تحديث متأخر لالتقاط الإعدادات بعد تحميلها
  setTimeout(function () {
    try {
      var ss = window.siteSettings;
      if (ss && typeof ss.adminAvailability === 'boolean') {
        renderButtonState(null, ss.adminAvailability);
      }
    } catch (e) {}
  }, 2000);
})();
