import { escapeHTML } from '../utils/sanitizers.js';
import { icon } from '../utils/icons.js';
import { t, translateMessage } from '../utils/i18n.js';

export const Toast = ({ toast = null } = {}) => toast ? `<div class="toast show ${escapeHTML(toast.type || 'success')}" role="status" aria-live="polite" data-toast-id="${escapeHTML(toast.id || '')}">
  <span class="toast-icon">${icon(toast.type === 'error' ? 'alert' : 'check', 18)}</span>
  <span>${escapeHTML(translateMessage(toast.messageKey || toast.message, toast.replacements || {}))}</span>
  <button type="button" class="toast-close-btn" data-action="hide-toast" aria-label="${escapeHTML(t('toast_close'))}">×</button>
</div>` : '';

export default Toast;
