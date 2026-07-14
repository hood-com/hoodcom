import { createStore } from './index.js';
import * as authService from '../services/auth-service.js';

export const initialAuthState = Object.freeze({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionVersion: 2,
  accountStatus: null
});

export const authStore = createStore(initialAuthState);
const errorMessage = (error) => error?.message || String(error || 'خطأ غير معروف');

export const login = async (username, password) => {
  authStore.setState({ isLoading: true, error: null });
  try {
    const user = await authService.login(username, password);
    authStore.setState({ user, isAuthenticated: true, isLoading: false, accountStatus: user.accountStatus || null });
    return user;
  } catch (error) {
    authStore.setState({ user: null, isAuthenticated: false, isLoading: false, error: errorMessage(error) });
    throw error;
  }
};

export const logout = async () => {
  authStore.setState({ isLoading: true, error: null });
  try { await authService.logout(); }
  finally { authStore.setState({ ...initialAuthState, isLoading: false }); }
  return true;
};

export const checkSession = async () => {
  authStore.setState({ isLoading: true, error: null });
  try {
    const user = await authService.checkSession();
    authStore.setState({ user, isAuthenticated: Boolean(user), isLoading: false, accountStatus: user?.accountStatus || null });
    return user;
  } catch (error) {
    authStore.setState({ user: null, isAuthenticated: false, isLoading: false, error: errorMessage(error) });
    return null;
  }
};

export const updateUser = (patch) => {
  const user = { ...(authStore.getState().user || {}), ...(patch || {}) };
  authStore.setState({ user, isAuthenticated: Boolean(user.uid || user.id), accountStatus: user.accountStatus || authStore.getState().accountStatus });
  return user;
};

export const setAccountStatus = (accountStatus) => {
  updateUser({ accountStatus });
  authStore.setState({ accountStatus });
  return accountStatus;
};

export default Object.freeze({ ...authStore, login, logout, checkSession, updateUser, setAccountStatus });
