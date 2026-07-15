const pageLoaders = Object.freeze({
  'index.html': () => import('./pages/index.js'),
  'login.html': () => import('./pages/login.js'),
  'admin.html': () => import('./pages/admin.js'),
  'deposit.html': () => import('./pages/deposit.js'),
  'account.html': () => import('./pages/account.js'),
  'category.html': () => import('./pages/category.js'),
  'reports.html': () => import('./pages/reports.js'),
  'debug-test.html': () => import('./pages/debug.js')
});

export const getCurrentPage = (pathname = globalThis.location?.pathname || '') =>
  pathname.split('/').filter(Boolean).pop() || 'index.html';

const showFatalError = (error) => {
  console.error('[main] Page initialization failed', error);
  document.documentElement.dataset.appError = 'true';
  const text = error?.message || 'تعذر تشغيل الصفحة. حدّث الصفحة وحاول مجددًا.';
  const toastText = document.getElementById('toastText');
  if (toastText) {
    toastText.textContent = text;
    toastText.parentElement?.classList.add('show', 'error');
  } else {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.style.cssText = 'position:fixed;z-index:999999;left:12px;right:12px;bottom:90px;padding:14px;background:#311;color:#fff;border:1px solid #f55;border-radius:12px;text-align:center;font-family:Tahoma,Arial,sans-serif';
    alert.textContent = text;
    document.body.append(alert);
  }
};

export const bootstrap = async () => {
  const page = getCurrentPage();
  const loader = pageLoaders[page] || pageLoaders['index.html'];
  try {
    const module = await loader();
    const initialize = module.default || module[`init${page.replace(/(?:^|-)(\w)/gu, (_, value) => value.toUpperCase()).replace(/\.html$/u, '')}Page`];
    if (typeof initialize !== 'function') throw new Error(`لا توجد دالة تشغيل صالحة للصفحة: ${page}`);
    await initialize();
    document.documentElement.dataset.appReady = 'true';
  } catch (error) {
    showFatalError(error);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  queueMicrotask(bootstrap);
}

export default Object.freeze({ bootstrap, getCurrentPage });
