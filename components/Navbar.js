import { escapeHTML } from '../utils/sanitizers.js';
import { icon } from '../utils/icons.js';

/** Presentational navbar. Pass authState and uiState; no store access occurs here. */
export const Navbar = ({ authState = {}, uiState = {}, logo = 'logo.svg' } = {}) => {
  const user = authState.user;
  const name = escapeHTML(user?.displayName || user?.name || 'المستخدم');
  return `<nav class="navbar" id="navbar" aria-label="القائمة الرئيسية">
    <a href="index.html" class="logo-link"><img src="${escapeHTML(logo)}" alt="هود كوم" class="logo-img"></a>
    <div class="nav-actions">
      <button type="button" class="theme-toggle" data-action="toggle-theme" aria-label="تبديل المظهر">${icon(uiState.theme === 'light' ? 'moon' : 'sun', 20)}</button>
      <div class="language-dropdown-container" id="languageDropdownContainer"></div>
      ${user ? `<a class="nav-btn" href="account.html">${icon('user', 16)}<span>${name}</span></a><button type="button" class="nav-btn" data-action="logout">${icon('close', 16)}</button>` : `<a class="nav-btn" href="login.html">${icon('user', 16)}<span>تسجيل الدخول</span></a>`}
      <button type="button" class="nav-btn" data-action="toggle-menu" aria-expanded="${Boolean(uiState.isMenuOpen)}">${icon('menu', 22)}</button>
    </div>
  </nav>`;
};

export default Navbar;
