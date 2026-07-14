import { createStore } from './index.js';
import * as balanceService from '../services/balance-service.js';

export const initialBalanceState = Object.freeze({
  balance: 0,
  transactions: [],
  withdrawMethods: [],
  services: [],
  loading: false,
  error: null
});
export const balanceStore = createStore(initialBalanceState);
let unsubscribeServices = null;
let unsubscribeTransactions = null;

export const loadBalance = async (userId) => {
  balanceStore.setState({ loading: true, error: null });
  try {
    const balance = balanceService.getUserBalance(userId || 'guest');
    const transactions = balanceService.getTopupTransactions();
    const withdrawMethods = balanceService.getWithdrawMethods();
    balanceStore.setState({ balance, transactions, withdrawMethods, loading: false });
    return balance;
  } catch (error) {
    balanceStore.setState({ loading: false, error: error.message || String(error) });
    throw error;
  }
};
export const credit = async (userId, amount) => {
  const balance = await balanceService.creditUserBalance(userId, amount);
  balanceStore.setState({ balance });
  return balance;
};
export const debit = async (userId, amount) => {
  const balance = await balanceService.debitUserBalance(userId, amount);
  balanceStore.setState({ balance });
  return balance;
};
export const addTransaction = async (transaction) => {
  const saved = await balanceService.saveTopupTransaction(transaction);
  balanceStore.setState({ transactions: [saved, ...balanceStore.getState().transactions.filter((entry) => entry.id !== saved.id)] });
  return saved;
};
export const updateTransaction = async (id, status, notes) => {
  const saved = await balanceService.updateTopupTransactionStatus(id, status, notes);
  balanceStore.setState({ transactions: balanceStore.getState().transactions.map((entry) => entry.id === saved.id ? saved : entry) });
  return saved;
};
export const loadServices = async (type) => {
  const all = await balanceService.loadTopupServicesFromCloud();
  const services = type ? all.filter((service) => service.type === type) : all;
  balanceStore.setState({ services });
  return services;
};
export const loadTransactions = async () => {
  const transactions = await balanceService.loadTopupTransactionsFromCloud();
  balanceStore.setState({ transactions });
  return transactions;
};
export const startBalanceRealtime = async (options = {}) => {
  const { type, onError = console.warn } = options;
  if (!unsubscribeServices) {
    unsubscribeServices = await balanceService.subscribeTopupServices((all) => {
      balanceStore.setState({ services: type ? all.filter((service) => service.type === type) : all });
    }, onError);
  }
  if (!unsubscribeTransactions) {
    unsubscribeTransactions = await balanceService.subscribeTopupTransactions((transactions) => {
      balanceStore.setState({ transactions });
    }, onError);
  }
  return () => stopBalanceRealtime();
};
export const stopBalanceRealtime = () => {
  unsubscribeServices?.();
  unsubscribeTransactions?.();
  unsubscribeServices = null;
  unsubscribeTransactions = null;
};

export default Object.freeze({
  ...balanceStore, loadBalance, credit, debit, addTransaction, updateTransaction,
  loadServices, loadTransactions, startBalanceRealtime, stopBalanceRealtime
});
