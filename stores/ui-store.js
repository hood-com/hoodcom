import { createStore } from './index.js';
import { getCurrentLanguage, translateMessage } from '../utils/i18n.js';

const savedTheme = (() => { try { return globalThis.localStorage?.getItem('hud_theme') || 'dark'; } catch { return 'dark'; } })();
export const initialUIState = Object.freeze({ theme: savedTheme, language: getCurrentLanguage(), toast: null, modal: null, isLoading: false, isMenuOpen: false });
export const uiStore = createStore(initialUIState);

export const toggleTheme = () => {
  const theme = uiStore.getState().theme === 'dark' ? 'light' : 'dark';
  uiStore.setState({ theme });
  try { globalThis.localStorage?.setItem('hud_theme', theme); } catch { /* no-op */ }
  return theme;
};
export const setLanguage = (language) => { uiStore.setState({ language }); return language; };
export const showToast = (messageOrKey, type = 'success', options = {}) => {
  const toast = {
    id: Date.now(),
    messageKey: typeof messageOrKey === 'string' ? messageOrKey : (messageOrKey?.key || ''),
    message: translateMessage(messageOrKey, options.replacements || {}),
    replacements: options.replacements || {},
    type,
    ...options
  };
  uiStore.setState({ toast });
  return toast;
};
export const hideToast = () => { uiStore.setState({ toast: null }); return null; };
export const openModal = (modal) => { const value = typeof modal === 'string' ? { id: modal } : modal; uiStore.setState({ modal: value }); return value; };
export const closeModal = () => { uiStore.setState({ modal: null }); return null; };
export const toggleMenu = (force) => { const isMenuOpen = typeof force === 'boolean' ? force : !uiStore.getState().isMenuOpen; uiStore.setState({ isMenuOpen }); return isMenuOpen; };
export const setLoading = (isLoading) => { uiStore.setState({ isLoading: Boolean(isLoading) }); return Boolean(isLoading); };

export default Object.freeze({ ...uiStore, toggleTheme, setLanguage, showToast, hideToast, openModal, closeModal, toggleMenu, setLoading });
