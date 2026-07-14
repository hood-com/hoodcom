import { escapeHTML, safeURL } from '../utils/sanitizers.js';

export const Footer = ({ settings = {}, contacts = [], year = new Date().getFullYear() } = {}) => {
  const links = contacts.map((contact) => `<a href="${escapeHTML(safeURL(contact.href || contact.value, '#'))}"${contact.newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${escapeHTML(contact.label || contact.name)}${contact.displayValue ? `: ${escapeHTML(contact.displayValue)}` : ''}</a>`).join('');
  return `<footer class="site-footer" role="contentinfo">
    <div class="footer-brand"><img src="logo.svg" alt="هود كوم" class="footer-logo"><p>${escapeHTML(settings.storeSlogan || 'كل ما تحتاجه في مكان واحد')}</p></div>
    <div class="footer-contact">${links}</div>
    <div class="footer-bottom">© ${Number(year)} <span class="gold">${escapeHTML(settings.storeName || 'هود كوم')}</span> — جميع الحقوق محفوظة</div>
  </footer>`;
};

export default Footer;
