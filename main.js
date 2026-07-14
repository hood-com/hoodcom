import { createStore, combineReducers } from './stores/index.js';
import authStore from './stores/auth-store.js';
import categoryStore from './stores/category-store.js';
import orderStore from './stores/order-store.js';
import walletStore from './stores/wallet-store.js';
import balanceStore from './stores/balance-store.js';
import uiStore from './stores/ui-store.js';
import { loadSiteSettings } from './services/settings-service.js';
import initHomePage from './pages/index.js';
import initLoginPage from './pages/login.js';
import initAdminPage from './pages/admin.js';
import initDepositPage from './pages/deposit.js';
import initAccountPage from './pages/account.js';
import initCategoryPage from './pages/category.js';
import initReportsPage from './pages/reports.js';
import initDebugPage from './pages/debug.js';

const passthrough = (state = {}) => state;
export const rootStore = createStore({
  auth: authStore.getState(), category: categoryStore.getState(), order: orderStore.getState(),
  wallet: walletStore.getState(), balance: balanceStore.getState(), ui: uiStore.getState()
}, combineReducers({ auth: passthrough, category: passthrough, order: passthrough, wallet: passthrough, balance: passthrough, ui: passthrough }));

const stores = { auth: authStore, category: categoryStore, order: orderStore, wallet: walletStore, balance: balanceStore, ui: uiStore };
Object.entries(stores).forEach(([key, store]) => store.subscribe((state) => rootStore.setState({ [key]: state })));

const routeInitializers = Object.freeze({
  '': initHomePage,
  'index.html': initHomePage,
  'login.html': initLoginPage,
  'admin.html': initAdminPage,
  'deposit.html': initDepositPage,
  'account.html': initAccountPage,
  'category.html': initCategoryPage,
  'reports.html': initReportsPage,
  'debug-test.html': initDebugPage
});

export const getCurrentPage = (pathname = globalThis.location?.pathname || '') => pathname.split('/').filter(Boolean).pop() || 'index.html';

export const bootstrap = async () => {
  loadSiteSettings();
  const page = getCurrentPage();
  const initialize = routeInitializers[page] || initHomePage;
  try {
    await initialize({ rootStore });
    document.documentElement.dataset.appReady = 'true';
  } catch (error) {
    console.error(`[main] Failed to initialize ${page}`, error);
    document.documentElement.dataset.appError = 'true';
    const target = document.getElementById('toastText');
    if (target) { target.textContent = error.message || 'تعذر تشغيل الصفحة'; target.parentElement?.classList.add('show', 'error'); }
  }
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
else queueMicrotask(bootstrap);

export default Object.freeze({ bootstrap, getCurrentPage, rootStore });
