import { initCommonPage } from './common.js';
import authStore, { logout } from '../stores/auth-store.js';
import { fetchOrders } from '../stores/order-store.js';
import { getUserBalance } from '../services/balance-service.js';
import { escapeHTML } from '../utils/sanitizers.js';
import { formatDate, formatPrice } from '../utils/formatters.js';
import { injectIcons, showToast } from '../utils/dom-utils.js';
import { getPhoneVerification } from '../services/phone-verification-service.js';
import { getPurchaseChannels } from '../services/workflow-service.js';

const statusLabel = (status) => ({ under_confirmation: 'بانتظار تأكيد الإدارة', active: 'نشط', suspended: 'موقوف', pending: 'قيد الانتظار', processing: 'قيد التنفيذ', completed: 'مكتمل', cancelled: 'ملغي' }[status] || status || 'غير محدد');

const contactHref=(channel,message)=>{const value=String(channel.value||''),encoded=encodeURIComponent(message),digits=value.replace(/\D/gu,'');if(channel.type==='whatsapp')return`https://wa.me/${digits}?text=${encoded}`;if(channel.type==='sms')return`sms:${digits}?body=${encoded}`;if(channel.type==='email')return`mailto:${value}?subject=${encodeURIComponent('توثيق حساب هود كوم')}&body=${encoded}`;if(channel.type==='telegram')return value.startsWith('http')?value:`https://t.me/${value.replace(/^@/u,'')}`;return value;};
const renderPhoneVerification=async()=>{const target=document.getElementById('accountPhoneVerification');if(!target)return;try{const result=await getPhoneVerification();if(result.verified){target.innerHTML='<article class="account-card verified-phone-card"><h2>رقم الهاتف موثق ✅</h2></article>';return;}const request=result.request;if(!request){target.innerHTML='';return;}const channels=await getPurchaseChannels('verification').catch(()=>[]),message=`طلب توثيق هود كوم: ${request.code}`;target.innerHTML=`<article class="account-card phone-verification-card"><h2>توثيق رقم الهاتف</h2><p>أرسل الرمز من نفس رقم الهاتف المسجل إلى الإدارة.</p><button type="button" class="phone-code-copy" data-copy-phone-code>${escapeHTML(request.code)}</button><small>اضغط الرمز لنسخه</small><div class="verification-channel-list">${channels.map((channel)=>`<a class="btn btn-outline" href="${escapeHTML(contactHref(channel,message))}">${escapeHTML(channel.name)}</a>`).join('')}</div></article>`;target.querySelector('[data-copy-phone-code]')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(request.code);showToast('تم نسخ رمز التوثيق ✅','success');});}catch(error){target.innerHTML=`<div class="error-message">${escapeHTML(error.message)}</div>`;}};

const renderAccount = (user, orders) => {
  const target = document.getElementById('accountContent'); if (!target) return;
  const balance = getUserBalance(user.uid);
  target.innerHTML = `<section class="account-hero"><div class="account-avatar">${escapeHTML((user.displayName || user.name || 'م').charAt(0))}</div><h1>${escapeHTML(user.name || user.displayName || 'المستخدم')}</h1><p dir="ltr">${escapeHTML(user.phone || user.localPhone || '')}</p><span class="account-status status-${escapeHTML(user.accountStatus || '')}">${escapeHTML(statusLabel(user.accountStatus))}</span></section>
    <section class="account-grid">
      <article class="account-card"><h2>الرصيد</h2><strong id="accountPageUserBalance">${formatPrice(balance)}</strong><a class="btn btn-gold" href="deposit.html">تغذية الحساب</a></article>
      <article class="account-card"><h2>بيانات الحساب</h2><dl><dt>الهاتف</dt><dd dir="ltr">${escapeHTML(user.phone || user.localPhone || '')}</dd><dt>البلد/المدينة</dt><dd>${escapeHTML([user.country, user.city].filter(Boolean).join(' — '))}</dd><dt>العنوان</dt><dd>${escapeHTML(user.address || '')}</dd></dl></article>
    </section>
    <section id="accountPhoneVerification"></section>
    <section class="account-orders"><h2>طلباتي</h2><div id="userAccountOrdersContainer">${orders.length ? orders.map((order) => `<article class="order-card order-status-${escapeHTML(order.status || 'pending')}"><header><strong>${escapeHTML(order.itemName || order.offerName || order.id)}</strong><span class="status-${escapeHTML(order.status)}">${escapeHTML(statusLabel(order.status))}</span></header><p>${escapeHTML(order.offerName || '')}</p>${order.status==='rejected'&&order.rejectionReason?`<p class="order-rejection-reason">سبب الرفض: ${escapeHTML(order.rejectionReason)}</p>`:''}<footer><b>${formatPrice(order.total || order.price || 0, order.currency || 'YER')}</b><time>${escapeHTML(formatDate(order.createdAt))}</time></footer></article>`).join('') : '<div class="empty-state">لا توجد طلبات حتى الآن</div>'}</div></section>
    <button type="button" class="btn btn-danger" id="accountLogoutBtn">تسجيل الخروج</button>`;
  document.getElementById('accountLogoutBtn')?.addEventListener('click', async () => { await logout(); globalThis.location.href = 'login.html'; });
  injectIcons(target);
  void renderPhoneVerification();
};

export const initAccountPage = async () => {
  await initCommonPage(); const user = authStore.getState().user;
  if (!user) { globalThis.location.href = 'login.html?redirect=account.html'; return; }
  document.getElementById('logoutBtn')?.addEventListener('click', async () => { await logout(); globalThis.location.href = 'login.html'; });
  try { const orders = await fetchOrders(user.uid); renderAccount(user, orders); }
  catch (error) { showToast('toast_account_load_error', 'error'); renderAccount(user, []); }
};

export default initAccountPage;
