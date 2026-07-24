import { initCommonPage } from './common.js';
import authStore, { login as loginAction } from '../stores/auth-store.js';
import { register, resolveLoginEmail, sendPasswordResetEmail, sendEmailVerificationCode, verifyEmailCode, loginWithGoogle, loginAdmin, getCurrentUser } from '../services/auth-service.js';
import { LOCATION_DATA, COUNTRY_DIAL_CODES } from '../config/locations.js';
import { isValidEmailAddress, isValidName, isValidPassword, isValidPhone, validateRequired } from '../utils/validators.js';
import { escapeHTML } from '../utils/sanitizers.js';
import { showToast } from '../utils/dom-utils.js';

const value = (id) => document.getElementById(id)?.value?.trim() || '';
const element = (id) => document.getElementById(id);
const showError = (inputId, errorId, visible) => { element(inputId)?.classList.toggle('error', visible); element(inputId)?.classList.toggle('success', !visible); element(errorId)?.classList.toggle('show', visible); };

const selectedDialCode = () => COUNTRY_DIAL_CODES[value('regCountry')] || '';
const localPhone = (phone, dialCode = selectedDialCode()) => {
  let digits = String(phone || '').replace(/\D/gu, '').replace(/^00/u, '');
  if (dialCode && digits.startsWith(dialCode)) digits = digits.slice(dialCode.length);
  return digits.replace(/^0+/u, '');
};
const fullPhone = (phone) => `+${selectedDialCode()}${localPhone(phone)}`;

const populateCountries = () => {
  const select = element('regCountry'); if (!select) return;
  select.replaceChildren(new Option('-- اختر البلد --', ''));
  Object.entries(LOCATION_DATA).forEach(([code, data]) => select.add(new Option(data.name, code)));
};
const populateCities = (countryCode) => {
  const select = element('regCity'); const district = element('regDistrict'); if (!select) return;
  select.replaceChildren(new Option('-- اختر المدينة --', '')); select.disabled = !countryCode;
  district?.replaceChildren(new Option('-- اختر المدينة أولاً --', '')); if (district) district.disabled = true;
  Object.entries(LOCATION_DATA[countryCode]?.cities || {}).forEach(([code, data]) => select.add(new Option(data.name, code)));
};
const populateDistricts = (countryCode, cityCode) => {
  const select = element('regDistrict'); if (!select) return;
  select.replaceChildren(new Option('-- اختر المنطقة --', '')); select.disabled = !cityCode;
  (LOCATION_DATA[countryCode]?.cities?.[cityCode]?.districts || []).forEach((district) => select.add(new Option(district, district)));
};

const switchMode = (mode) => {
  element('loginForm')?.classList.toggle('active', mode === 'login');
  element('registerForm')?.classList.toggle('active', mode === 'register');
};
const setStep = (step) => {
  element('step1Content')?.classList.toggle('active', step === 1); element('step2Content')?.classList.toggle('active', step === 2);
  element('step1Tab')?.classList.toggle('active', step === 1); element('step1Tab')?.classList.toggle('completed', step === 2);
  element('step2Tab')?.classList.toggle('active', step === 2);
};

const validateFirstStep = () => {
  const checks = {
    regName: isValidName(value('regName'), 4),
    regPhone: isValidPhone(value('regPhone')) && localPhone(value('regPhone')).length >= 7,
    regCountry: validateRequired(value('regCountry')),
    regCity: validateRequired(value('regCity')),
    regDistrict: validateRequired(value('regDistrict')),
    regAddress: validateRequired(value('regAddress'))
  };
  Object.entries(checks).forEach(([id, valid]) => showError(id, `${id}Error`, !valid));
  const username = element('regUsername'); if (username) username.value = localPhone(value('regPhone'));
  return Object.values(checks).every(Boolean);
};

const buildRegistrationData = (extra = {}) => ({
  name: value('regName'), phone: fullPhone(value('regPhone')), localPhone: localPhone(value('regPhone')),
  email: value('regEmail').toLowerCase(), password: element('regPassword')?.value || '',
  country: value('regCountry'), countryCode: selectedDialCode(), city: value('regCity'),
  district: value('regDistrict'), address: value('regAddress'), ...extra
});

const showConfirmation = () => {
  const country = LOCATION_DATA[value('regCountry')]; const city = country?.cities?.[value('regCity')];
  const target = element('confirmSummary'); if (!target) return;
  target.innerHTML = `<div><b>الاسم:</b> ${escapeHTML(value('regName'))}</div><div><b>الهاتف:</b> <span dir="ltr">${escapeHTML(fullPhone(value('regPhone')))}</span></div><div><b>البلد:</b> ${escapeHTML(country?.name || '')}</div><div><b>المدينة:</b> ${escapeHTML(city?.name || '')}</div><div><b>المنطقة:</b> ${escapeHTML(value('regDistrict'))}</div><div><b>العنوان:</b> ${escapeHTML(value('regAddress'))}</div>`;
};

const setButtonLoading = (button, loading) => { if (!button) return; button.disabled = loading || button.dataset.cooldown === 'true'; button.classList.toggle('loading', loading); };
const startOtpCooldown=(button,seconds=120)=>{if(!button)return;let remaining=seconds;button.dataset.cooldown='true';button.disabled=true;const original='إرسال رمز التأكيد إلى البريد';const tick=()=>{button.textContent=remaining>0?`إعادة الإرسال بعد ${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`:original;if(remaining--<=0){delete button.dataset.cooldown;button.disabled=false;clearInterval(timer);}};tick();const timer=setInterval(tick,1000);};
const redirectAfterLogin = () => {
  const params = new URLSearchParams(globalThis.location.search); const candidate = params.get('redirect') || globalThis.sessionStorage?.getItem('hud_post_login_redirect') || 'index.html';
  // Security fix: block javascript: data: vbscript: and keep original logic intact
  const isDangerous = /^\s*(?:javascript|data|vbscript):/iu.test(candidate) || /[<>"]/u.test(candidate);
  const safe = !isDangerous && !/^https?:|^\/\//iu.test(candidate) && !candidate.includes('login.html') ? candidate : 'index.html';
  globalThis.sessionStorage?.removeItem('hud_post_login_redirect'); globalThis.location.href = safe;
};

const bindLogin = () => {
  const form = element('loginForm'); if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = value('loginUsername');
    const password = element('loginPassword')?.value || '';
    const button = element('loginBtn');

    // The admin username is intentionally not required to be a phone number.
    // Validate only presence first, then check the gate before normal login.
    showError('loginUsername', 'loginUsernameError', !username);
    showError('loginPassword', 'loginPasswordError', !password);
    if (!username || !password) return;

    setButtonLoading(button, true);
    try {
      if (username.includes('@')) {
        await loginAdmin(username, password);
        showToast('تم تسجيل دخول المدير بنجاح', 'success');
        globalThis.setTimeout(() => { globalThis.location.assign('admin.html'); }, 250);
        return;
      }

      const validPhone = isValidPhone(username);
      showError('loginUsername', 'loginUsernameError', !validPhone);
      if (!validPhone) throw new Error('رقم الهاتف غير صالح أو بيانات الإدارة غير صحيحة');

      await loginAction(username, password);
      void import('../services/workflow-service.js').then((mod)=>mod.logActivity('login',{method:'phone'}));
      showToast('toast_login_success');
      globalThis.setTimeout(redirectAfterLogin, 500);
    } catch (error) {
      showToast(error?.message || 'تعذر تسجيل الدخول', 'error', { sticky: true });
      setButtonLoading(button, false);
    }
  });

  element('forgotPasswordLink')?.addEventListener('click', async (event) => {
    event.preventDefault();
    try { const email = await resolveLoginEmail(value('loginUsername')); await sendPasswordResetEmail(email); showToast('toast_password_reset_sent'); }
    catch (error) { showToast('toast_password_reset_failed', 'error'); }
  });
};

const bindRegistration = () => {
  element('showRegisterBtn')?.addEventListener('click', (event) => { event.preventDefault(); switchMode('register'); });
  element('showLoginBtn')?.addEventListener('click', (event) => { event.preventDefault(); switchMode('login'); setStep(1); });
  element('nextStepBtn')?.addEventListener('click', () => { if (!validateFirstStep()) { showToast('toast_registration_fields_invalid', 'error'); return; } showConfirmation(); setStep(2); });
  element('backStepBtn')?.addEventListener('click', () => setStep(1));

  element('sendEmailCodeBtn')?.addEventListener('click', async () => {
    const email = value('regEmail').toLowerCase(); const password = element('regPassword')?.value || ''; const button = element('sendEmailCodeBtn');
    showError('regEmail', 'regEmailError', !isValidEmailAddress(email)); showError('regPassword', 'regPasswordError', !isValidPassword(password));
    if (!isValidEmailAddress(email) || !isValidPassword(password)) { showToast('toast_password_requirements', 'error'); return; }
    setButtonLoading(button, true);
    try { const result=await sendEmailVerificationCode(email); startOtpCooldown(button,result.retryAfter||120); element('emailCodeGroup').style.display = 'block'; element('regEmail').dataset.otpSentTo = email; showToast('toast_verification_code_sent'); }
    catch (error) { showToast('toast_verification_code_send_failed', 'error'); }
    finally { setButtonLoading(button, false); }
  });

  element('registerForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!validateFirstStep()) { setStep(1); return; }
    const email = value('regEmail').toLowerCase(); const password = element('regPassword')?.value || ''; const code = value('regEmailCode');
    if (!isValidEmailAddress(email) || !isValidPassword(password) || !code || element('regEmail')?.dataset.otpSentTo !== email) { showToast('toast_verification_code_required', 'error'); return; }
    const button = element('registerBtn'); setButtonLoading(button, true);
    try {
      const verification = await verifyEmailCode(email, code); const verifiedUserId = verification.user?.id || verification.session?.user?.id;
      const user = await register(buildRegistrationData({ verifiedUserId }));
      void import('../services/workflow-service.js').then((mod)=>mod.logActivity('registration',{country:user.country||'',city:user.city||''}));
      authStore.setState({ user, isAuthenticated: true, isLoading: false, accountStatus: user.accountStatus });
      showToast('toast_register_success'); setTimeout(() => { globalThis.location.href = 'reports.html'; }, 700);
    } catch (error) { showToast('toast_error_register', 'error', { sticky: true }); setButtonLoading(button, false); }
  });
};

const bindGoogle = () => {
  element('googleContinueBtn')?.addEventListener('click', async () => {
    if (!validateFirstStep()) { setStep(1); showToast('toast_google_registration_data_required', 'error'); return; }
    const password = element('regPassword')?.value || '';
    if (!isValidPassword(password)) { showToast('toast_google_password_required', 'error'); return; }
    globalThis.sessionStorage?.setItem('hud_google_pending_reg', JSON.stringify({ ...buildRegistrationData(), timestamp: Date.now() }));
    try { await loginWithGoogle(); } catch (error) { showToast('toast_google_open_failed', 'error'); }
  });
};

const finishGoogleRegistration = async () => {
  try {
    const pendingRaw = globalThis.sessionStorage?.getItem('hud_google_pending_reg'); if (!pendingRaw) return;
    const pending = JSON.parse(pendingRaw); if (Date.now() - pending.timestamp > 600000) { globalThis.sessionStorage.removeItem('hud_google_pending_reg'); return; }
    const oauthUser = await getCurrentUser(); if (!oauthUser?.uid) return;
    const user = await register({ ...pending, email: oauthUser.email || pending.email, name: oauthUser.displayName || pending.name, verifiedUserId: oauthUser.uid });
    authStore.setState({ user, isAuthenticated: true, accountStatus: user.accountStatus });
    globalThis.sessionStorage.removeItem('hud_google_pending_reg'); globalThis.location.href = 'reports.html';
  } catch (error) { console.error('[login-page] Google return failed', error); showToast('toast_google_complete_failed', 'error'); }
};

export const initLoginPage = async () => {
  // Bind all controls immediately so slow network/Supabase startup never freezes the page.
  populateCountries();
  bindLogin();
  bindRegistration();
  bindGoogle();

  element('regCountry')?.addEventListener('change', (event) => {
    populateCities(event.target.value);
    const phone = element('regPhone');
    if (phone) phone.value = `+${selectedDialCode()}${localPhone(phone.value)}`;
  });

  element('regCity')?.addEventListener('change', (event) =>
    populateDistricts(value('regCountry'), event.target.value)
  );

  for (const [buttonId, inputId] of [
    ['toggleLoginPass', 'loginPassword'],
    ['toggleRegPass', 'regPassword']
  ]) {
    element(buttonId)?.addEventListener('click', () => {
      const input = element(inputId);
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    });
  }

  // Network-dependent initialization runs in the background without blocking controls.
  void initCommonPage().catch((error) =>
    console.warn('[login-page] common initialization delayed', error)
  );

  void finishGoogleRegistration();
};

export default initLoginPage;
