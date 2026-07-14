import { getDB } from './supabase-client.js';
import { DEFAULT_WALLETS } from '../utils/constants.js';
import { STORAGE_KEYS } from '../config/settings.js';
import { sanitizeBoolean, sanitizeInput, sanitizeNumber } from '../utils/sanitizers.js';

let wallets = DEFAULT_WALLETS.map((wallet) => ({ ...wallet }));
let selectedWalletId = null;

const clone = (value) => JSON.parse(JSON.stringify(value));
const persist = () => {
  try { globalThis.localStorage?.setItem(STORAGE_KEYS.wallets, JSON.stringify({ wallets })); } catch { /* no-op */ }
};

export const loadWalletSettings = () => {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEYS.wallets) || '{}');
    if (Array.isArray(parsed.wallets)) wallets = parsed.wallets.map((wallet) => ({ ...wallet }));
  } catch (error) {
    console.warn('[wallet-service] local load failed', error);
    wallets = DEFAULT_WALLETS.map((wallet) => ({ ...wallet }));
  }
  return clone(wallets);
};

export const saveWalletSettings = async () => {
  persist();
  return saveWalletsToFirebase();
};

export const loadWalletsFromFirebase = async () => {
  try {
    const document = await (await getDB()).getDocument('wallets', 'all');
    if (Array.isArray(document?.wallets)) wallets = document.wallets.map((wallet) => ({ ...wallet }));
    else loadWalletSettings();
    loadWalletImages(); persist();
    return clone(wallets);
  } catch (error) {
    console.error('[wallet-service] cloud load failed', error);
    loadWalletSettings();
    return clone(wallets);
  }
};

export const saveWalletsToFirebase = async () => {
  try {
    persist();
    await (await getDB()).setDocument('wallets', 'all', { wallets: clone(wallets), updatedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    console.error('[wallet-service] cloud save failed', error);
    throw error;
  }
};

export const addWallet = async (wallet) => {
  const entry = {
    ...wallet,
    id: String(wallet?.id || `wallet-${Date.now()}`),
    name: sanitizeInput(wallet?.name || 'محفظة', 100),
    number: sanitizeInput(wallet?.number || '', 100),
    image: String(wallet?.image || ''),
    enabled: wallet?.enabled !== false,
    order: sanitizeNumber(wallet?.order, { min: 0, max: 10000, integer: true, fallback: wallets.length + 1 })
  };
  wallets.push(entry);
  await saveWalletSettings();
  return clone(entry);
};

export const deleteWallet = async (id) => {
  const defaultWallet = DEFAULT_WALLETS.some((wallet) => wallet.id === String(id));
  if (defaultWallet) wallets = wallets.map((wallet) => wallet.id === String(id) ? { ...wallet, enabled: false } : wallet);
  else wallets = wallets.filter((wallet) => wallet.id !== String(id));
  if (selectedWalletId === String(id)) selectedWalletId = null;
  await saveWalletSettings();
  return true;
};

export const updateWallet = async (id, updates = {}) => {
  const index = wallets.findIndex((wallet) => wallet.id === String(id));
  if (index < 0) throw new Error('المحفظة غير موجودة');
  const current = wallets[index];
  wallets[index] = {
    ...current,
    ...updates,
    id: current.id,
    name: sanitizeInput(updates.name ?? current.name, 100),
    number: sanitizeInput(updates.number ?? current.number, 100),
    image: String(updates.image ?? current.image ?? ''),
    enabled: Object.hasOwn(updates, 'enabled') ? sanitizeBoolean(updates.enabled) : current.enabled !== false,
    order: sanitizeNumber(updates.order ?? current.order, { min: 0, max: 10000, integer: true, fallback: index + 1 })
  };
  await saveWalletSettings();
  return clone(wallets[index]);
};

export const getAllWallets = () => wallets.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((wallet) => ({ ...wallet }));
export const getWalletById = (id) => {
  const wallet = wallets.find((entry) => entry.id === String(id));
  return wallet ? { ...wallet } : null;
};
export const getActiveWallets = () => wallets.filter((wallet) => wallet.enabled !== false)
  .sort((a, b) => (a.order || 0) - (b.order || 0)).map((wallet) => ({ ...wallet }));

export const loadWalletImages = () => {
  wallets = wallets.map((wallet) => {
    try { return { ...wallet, image: globalThis.localStorage?.getItem(`hud_wallet_img_${wallet.id}`) || wallet.image || '' }; }
    catch { return wallet; }
  });
  return clone(wallets);
};

export const saveWalletImage = async (id, imageData) => {
  try { globalThis.localStorage?.setItem(`hud_wallet_img_${id}`, String(imageData || '')); } catch (error) { console.warn('[wallet-service] image cache failed', error); }
  return updateWallet(id, { image: String(imageData || '') });
};

export const selectWallet = (id) => {
  const wallet = wallets.find((entry) => entry.id === String(id) && entry.enabled !== false);
  selectedWalletId = wallet?.id || null;
  return wallet ? { ...wallet } : null;
};

export const getSelectedWallet = () => wallets.find((wallet) => wallet.id === selectedWalletId) || null;
export const renderWalletGrid = () => getActiveWallets();

// HUD COM refresh
export const refreshWallets = async (options = {}) => {
  try {
    if (options.clearCache) {
      try { globalThis.localStorage?.removeItem(STORAGE_KEYS.wallets); } catch {}
    }
    const fresh = await loadWalletsFromFirebase();
    if (typeof globalThis.CustomEvent === 'function') {
      globalThis.dispatchEvent?.(new CustomEvent('hud:wallets-updated', { detail: { wallets: fresh, source: 'refresh' } }));
    }
    return fresh;
  } catch (error) {
    console.error('[wallet-service] refresh failed', error);
    throw error;
  }
};

if (typeof globalThis.window !== 'undefined') {
  globalThis.window.refreshWallets = refreshWallets;
}

loadWalletSettings();

export default Object.freeze({
  loadWalletSettings, saveWalletSettings, loadWalletsFromFirebase, saveWalletsToFirebase,
  addWallet, deleteWallet, updateWallet, getAllWallets, getWalletById, getActiveWallets, loadWalletImages, saveWalletImage,
  renderWalletGrid, selectWallet, getSelectedWallet,
  refreshWallets
});
