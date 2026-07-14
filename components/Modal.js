import { escapeHTML, safeId } from '../utils/sanitizers.js';
import { icon } from '../utils/icons.js';
import { t } from '../utils/i18n.js';

const classes = (...values) => values.flatMap((value) => String(value || '').split(/\s+/u))
  .map((value) => safeId(value)).filter(Boolean).join(' ');

/** Generic presentation-only modal. body/footer are trusted component output. */
export const Modal = ({
  id = 'modal',
  title = '',
  subtitle = '',
  body = '',
  footer = '',
  open = false,
  labelledBy,
  className = '',
  overlayClassName = '',
  closeLabel = '',
  variant = 'default'
} = {}) => {
  const modalId = safeId(id) || 'modal';
  const resolvedCloseLabel = closeLabel || t('btn_close');
  const titleId = safeId(labelledBy || `${modalId}-title`) || `${modalId}-title`;
  const stateClass = open ? 'show active' : '';
  return `<div class="${classes('modal-overlay', overlayClassName, stateClass)}" data-modal-overlay="${escapeHTML(modalId)}" aria-hidden="${!open}"></div>
<section class="${classes('modal', className, `modal-${variant}`, stateClass)}" id="${escapeHTML(modalId)}" role="dialog" aria-modal="true" aria-labelledby="${escapeHTML(titleId)}" aria-hidden="${!open}" tabindex="-1">
  <header class="modal-header">
    <div class="modal-heading"><h2 id="${escapeHTML(titleId)}">${escapeHTML(title)}</h2>${subtitle ? `<p class="modal-subtitle">${escapeHTML(subtitle)}</p>` : ''}</div>
    <button type="button" class="modal-close" data-action="close-modal" data-modal-close="${escapeHTML(modalId)}" aria-label="${escapeHTML(resolvedCloseLabel)}">${icon('close', 18)}</button>
  </header>
  <div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}
</section>`;
};

export default Modal;
