import { createStore } from './index.js';
import * as walletService from '../services/wallet-service.js';

export const initialWalletState = Object.freeze({ wallets: [], selectedWallet: null, loading: false, error: null });
export const walletStore = createStore(initialWalletState);

export const loadWallets = async () => {
  walletStore.setState({ loading: true, error: null });
  try {
    const wallets = await walletService.loadWalletsFromFirebase();
    walletStore.setState({ wallets, loading: false }); return wallets;
  } catch (error) {
    walletStore.setState({ loading: false, error: error.message || String(error) }); throw error;
  }
};
export const selectWallet = (id) => { const selectedWallet = walletService.selectWallet(id); walletStore.setState({ selectedWallet }); return selectedWallet; };
export const addWallet = async (wallet) => { const saved = await walletService.addWallet(wallet); walletStore.setState({ wallets: [...walletStore.getState().wallets, saved] }); return saved; };
export const updateWallet = async (id, updates) => { const saved = await walletService.updateWallet(id, updates); walletStore.setState({ wallets: walletStore.getState().wallets.map((wallet) => wallet.id === saved.id ? saved : wallet) }); return saved; };
export const deleteWallet = async (id) => { await walletService.deleteWallet(id); walletStore.setState({ wallets: walletStore.getState().wallets.filter((wallet) => wallet.id !== String(id)), selectedWallet: walletStore.getState().selectedWallet?.id === String(id) ? null : walletStore.getState().selectedWallet }); return true; };

export default Object.freeze({ ...walletStore, loadWallets, selectWallet, addWallet, updateWallet, deleteWallet });
