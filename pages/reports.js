import { initCommonPage } from './common.js';
import authStore from '../stores/auth-store.js';
import { fetchOrders } from '../stores/order-store.js';
import { getDB } from '../services/supabase-client.js';
import { escapeHTML } from '../utils/sanitizers.js';
import { formatDate, formatPrice } from '../utils/formatters.js';
import { injectIcons } from '../utils/dom-utils.js';

const renderReports = (user, profile, orders) => {
  const target = document.getElementById('reportsContent'); if (!target) return;
  const verified = (profile.accountStatus || user.accountStatus) === 'active' || profile.whatsappCodeStatus === 'verified';
  // Security: verification is admin-only, no client-side code comparison, no self-activation via updateDocument
  target.innerHTML = `<section class="report-card verification-card ${verified ? 'verified' : 'pending'}"><h2>توثيق الحساب</h2><p>الحالة: <strong>${verified ? 'موثّق ونشط' : 'بانتظار تأكيد الإدارة'}</strong></p>
    ${verified ? '<div class="success-message">✓ تم توثيق حسابك بنجاح</div>' : `<div class="pending-message" style="background:rgba(255,215,0,0.08);border:1px dashed var(--gold);border-radius:12px;padding:14px;font-size:13px;line-height:1.7;"><p>⏳ حسابك قيد المراجعة من قبل الإدارة.</p><p>سيتم توثيق حسابك بعد تأكيد بياناتك من لوحة التحكم.</p><p style="margin-top:8px;color:var(--text-secondary);font-size:12px;">للاستفسار تواصل مع الدعم عبر واتساب.</p></div>`}</section>
    <section class="report-card"><h2>سجل الطلبات</h2><div class="orders-list">${orders.length ? orders.map((order) => `<article class="order-card"><header><strong>${escapeHTML(order.itemName || order.id)}</strong><span>${escapeHTML(order.status || 'pending')}</span></header><p>${escapeHTML(order.offerName || '')}</p><footer><b>${formatPrice(order.total || order.price || 0, order.currency || 'YER')}</b><time>${escapeHTML(formatDate(order.createdAt))}</time></footer></article>`).join('') : '<div class="empty-state">لا توجد طلبات</div>'}</div></section>`;
  injectIcons(target);
};

export const initReportsPage = async () => {
  await initCommonPage(); const user = authStore.getState().user;
  if (!user) { globalThis.location.href = 'login.html?redirect=reports.html'; return; }
  try {
    const db = await getDB(); const [profile, orders] = await Promise.all([db.getDocument('users', user.uid), fetchOrders(user.uid)]);
    renderReports(user, profile || user, orders);
  } catch (error) {
    const target = document.getElementById('reportsContent'); if (target) target.innerHTML = `<div class="error-message">${escapeHTML(error.message || 'تعذر تحميل العمليات')}</div>`;
  }
};

export default initReportsPage;
