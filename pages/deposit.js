import { initCommonPage, renderAuthChrome } from './common.js';
import authStore from '../stores/auth-store.js';
import balanceStore, { loadBalance, loadServices, addTransaction, startBalanceRealtime } from '../stores/balance-store.js';
import { getTopupServices, getTopupTransactions, getUserBalance, debitUserBalance } from '../services/balance-service.js';
import { escapeHTML, safeURL } from '../utils/sanitizers.js';
import { formatDate, formatPrice } from '../utils/formatters.js';
import { injectIcons, showToast } from '../utils/dom-utils.js';

let currentService = null;
let stopRealtime = null;
let lastServiceRevision = '';

const syncRealtimeServices = (state) => {
  const revision = state.services.map((service) => `${service.id}:${service.updatedAt || ''}:${service.enabled}`).join('|');
  if (revision && revision !== lastServiceRevision) {
    const hadServices = Boolean(lastServiceRevision);
    lastServiceRevision = revision;
    renderServices();
    if (hadServices) showToast('تم تحديث خدمات التغذية والاسترداد تلقائياً ✅', 'info');
  }
};

const switchDoor = (type) => {
  document.getElementById('doorBtnDeposit')?.classList.toggle('active', type === 'deposit');
  document.getElementById('doorBtnWithdraw')?.classList.toggle('active', type === 'withdraw');
  const deposit = document.getElementById('doorContentDeposit'); const withdraw = document.getElementById('doorContentWithdraw');
  if (deposit) deposit.style.display = type === 'deposit' ? '' : 'none'; if (withdraw) withdraw.style.display = type === 'withdraw' ? '' : 'none';
};

const renderServices = () => {
  for (const type of ['deposit', 'withdraw']) {
    const target = document.getElementById(type === 'deposit' ? 'depositServicesGrid' : 'withdrawServicesGrid'); if (!target) continue;
    const entries = getTopupServices(type).filter((service) => service.enabled !== false);
    target.innerHTML = entries.length ? entries.map((service) => `<button class="service-card" type="button" data-action="open-service" data-service-id="${escapeHTML(service.id)}"><span class="service-image">${service.image ? `<img src="${escapeHTML(safeURL(/(?:^|\/)logo\.svg(?:[?#]|$)/iu.test(String(service.image || '')) ? '' : service.image, 'content-placeholder.svg'))}" alt="">` : '💳'}</span><strong>${escapeHTML(service.name || service.title)}</strong><small>${escapeHTML(service.description || '')}</small></button>`).join('') : '<div class="empty-state">لا توجد خدمات متاحة</div>';
  }
};

const renderHistory = () => {
  const user = authStore.getState().user; const entries = getTopupTransactions().filter((transaction) => String(transaction.userId) === String(user?.uid));
  for (const type of ['deposit', 'withdraw']) {
    const target = document.getElementById(type === 'deposit' ? 'depositHistoryListContainer' : 'withdrawHistoryListContainer'); if (!target) continue;
    const filtered = entries.filter((transaction) => transaction.type === type);
    target.innerHTML = filtered.length ? filtered.map((transaction) => `<article class="transaction-card status-${escapeHTML(transaction.status)}"><header><strong>${escapeHTML(transaction.serviceName || transaction.walletName || type)}</strong><span>${formatPrice(transaction.amount)}</span></header><p>${escapeHTML(transaction.status)}</p><time>${escapeHTML(formatDate(transaction.createdAt))}</time></article>`).join('') : '<div class="empty-state">لا توجد عمليات سابقة</div>';
  }
};

const openService = (serviceId) => {
  currentService = getTopupServices().find((service) => service.id === String(serviceId)); if (!currentService) return;
  const title = document.getElementById('dynModalTitle'); if (title) title.textContent = currentService.name || currentService.title;
  const description = document.getElementById('dynModalDesc'); if (description) description.textContent = currentService.description || '';
  const hero = document.getElementById('dynModalHero'); if (hero) hero.innerHTML = currentService.image ? `<img src="${escapeHTML(safeURL(/(?:^|\/)logo\.svg(?:[?#]|$)/iu.test(String(currentService.image || '')) ? '' : currentService.image, 'content-placeholder.svg'))}" alt="">` : '';
  const fields = document.getElementById('dynFieldsContainer');
  if (fields) fields.innerHTML = (currentService.customFields || []).map((field) => `<div class="form-group"><label class="form-label" for="service-${escapeHTML(field.id)}">${escapeHTML(field.label)}${field.required ? ' *' : ''}</label>${field.type === 'textarea' ? `<textarea class="form-input" id="service-${escapeHTML(field.id)}" data-service-field="${escapeHTML(field.id)}" ${field.required ? 'required' : ''} placeholder="${escapeHTML(field.placeholder || '')}"></textarea>` : `<input class="form-input" id="service-${escapeHTML(field.id)}" data-service-field="${escapeHTML(field.id)}" type="${escapeHTML(['number', 'tel', 'email'].includes(field.type) ? field.type : 'text')}" ${field.required ? 'required' : ''} placeholder="${escapeHTML(field.placeholder || '')}">`}</div>`).join('');
  const label = document.getElementById('dynSubmitLabel'); if (label) label.textContent = currentService.type === 'withdraw' ? 'تقديم طلب الاسترداد' : 'تقديم طلب التغذية';
  document.getElementById('dynModalOverlay')?.classList.add('show'); injectIcons();
};

const closeModal = () => { document.getElementById('dynModalOverlay')?.classList.remove('show'); currentService = null; };

const submitService = async (event) => {
  event.preventDefault(); if (!currentService || !event.currentTarget.reportValidity()) return;
  const user = authStore.getState().user; const fields = Object.fromEntries([...event.currentTarget.querySelectorAll('[data-service-field]')].map((input) => [input.dataset.serviceField, input.value.trim()]));
  const amountField = (currentService.customFields || []).find((field) => field.type === 'number' || /amount|مبلغ/iu.test(`${field.id} ${field.label}`));
  const amount = Number(fields[amountField?.id] || 0); if (!(amount > 0)) { showToast('toast_amount_invalid', 'error'); return; }
  if (currentService.type === 'withdraw' && amount > getUserBalance(user.uid)) { showToast('toast_error_balance', 'error'); return; }
  const button = document.getElementById('dynSubmitBtn'); if (button) button.disabled = true;
  let debited = false;
  try {
    if (currentService.type === 'withdraw') { await debitUserBalance(user.uid, amount); debited = true; }
    await addTransaction({ userId: user.uid, userName: user.displayName || user.name, userPhone: user.phone || '', type: currentService.type, amount, serviceId: currentService.id, serviceName: currentService.name, fields, status: 'pending' });
    closeModal(); event.currentTarget.reset(); await loadBalance(user.uid); renderHistory(); renderAuthChrome(); showToast('toast_request_submitted');
  } catch (error) {
    if (debited) {
      try {
        const { creditUserBalance } = await import('../services/balance-service.js');
        await creditUserBalance(user.uid, amount);
        await loadBalance(user.uid); renderAuthChrome();
      } catch {}
    }
    showToast('toast_request_failed', 'error');
  }
  finally { if (button) button.disabled = false; }
};

const bindTabs = () => {
  document.getElementById('doorBtnDeposit')?.addEventListener('click', () => switchDoor('deposit'));
  document.getElementById('doorBtnWithdraw')?.addEventListener('click', () => switchDoor('withdraw'));
  document.getElementById('subTabBtnRequest')?.addEventListener('click', () => {
    document.getElementById('subTabContentRequest').style.display = ''; document.getElementById('subTabContentHistory').style.display = 'none';
  });
  document.getElementById('subTabBtnHistory')?.addEventListener('click', () => {
    document.getElementById('subTabContentRequest').style.display = 'none'; document.getElementById('subTabContentHistory').style.display = ''; renderHistory();
  });
  document.addEventListener('click', (event) => { const button = event.target.closest('[data-action="open-service"]'); if (button) openService(button.dataset.serviceId); });
  document.getElementById('dynModalOverlay')?.addEventListener('click', (event) => { if (event.target.id === 'dynModalOverlay') closeModal(); });
  document.getElementById('dynServiceForm')?.addEventListener('submit', submitService);
};

export const initDepositPage = async () => {
  await initCommonPage(); const user = authStore.getState().user;
  if (!user) { globalThis.location.href = 'login.html?redirect=deposit.html'; return; }
  await Promise.all([loadBalance(user.uid), loadServices()]);
  const balance = balanceStore.getState().balance;
  const target = document.getElementById('userCurrentBalanceDisplay'); if (target) target.textContent = formatPrice(balance);
  renderServices(); renderHistory(); bindTabs(); switchDoor('deposit'); injectIcons();
  lastServiceRevision = balanceStore.getState().services.map((service) => `${service.id}:${service.updatedAt || ''}:${service.enabled}`).join('|');
  balanceStore.subscribe(syncRealtimeServices);
  stopRealtime = await startBalanceRealtime({ onError: (error) => console.warn('[deposit] realtime failed', error) });
  globalThis.addEventListener('pagehide', () => stopRealtime?.(), { once: true });
};

export default initDepositPage;
