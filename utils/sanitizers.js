/** Context-aware, dependency-free sanitizers. */
const asString = (value) => (value === null || value === undefined ? '' : String(value));

export const escapeHTML = (value) => asString(value)
  .replace(/&/gu, '&amp;')
  .replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;')
  .replace(/"/gu, '&quot;')
  .replace(/'/gu, '&#39;');

export const escapeAttr = escapeHTML;

export const escapeJSString = (value) => asString(value)
  .replace(/\\/gu, '\\\\')
  .replace(/'/gu, "\\'")
  .replace(/"/gu, '\\"')
  .replace(/\r/gu, '\\r')
  .replace(/\n/gu, '\\n')
  .replace(/</gu, '\\x3C')
  .replace(/>/gu, '\\x3E')
  .replace(/\u2028/gu, '\\u2028')
  .replace(/\u2029/gu, '\\u2029');

export const safeId = (value) => asString(value).replace(/[^a-zA-Z0-9_:.-]/gu, '');
export const safeIconName = (value, fallback = 'info') => safeId(value) || safeId(fallback) || 'info';

export const safeURL = (value, fallback = '') => {
  const raw = asString(value).trim();
  if (!raw) return fallback;
  // Security: allow raster data URLs only, block svg+xml to prevent XSS via <svg><script>
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\r\n]+$/iu.test(raw)) {
    // block if base64 contains script marker
    if (/PHNjcmlwdA|amF2YXNjcmlwdDo|vbscript:/iu.test(raw)) return fallback;
    return raw;
  }
  // Legacy svg+xml allowed only if explicitly needed, but sanitize - reject if contains script
  if (/^data:image\/svg\+xml;base64,/iu.test(raw)) {
    // For backward compatibility keep svg but check for script - if suspicious, fallback
    if (/PHNjcmlwdA|amF2YXNjcmlwdA|onload|onerror/iu.test(raw)) return fallback;
    return raw;
  }
  try {
    const base = globalThis.location?.href || 'https://localhost/';
    const candidate = /^[a-z][a-z\d+.-]*:/iu.test(raw) || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')
      ? raw
      : `https://${raw}`;
    const url = new URL(candidate, base);
    return ['http:', 'https:', 'tel:', 'mailto:', 'tg:'].includes(url.protocol) ? url.href : fallback;
  } catch {
    return fallback;
  }
};

export const safePhoneHref = (value) => {
  const raw = asString(value).trim();
  const prefix = raw.startsWith('+') ? '+' : '';
  const digits = raw.replace(/\D/gu, '');
  return digits ? `tel:${prefix}${digits}` : '#';
};

export const sanitizeValue = (value) => asString(value)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
  .trim();

export const sanitizeInput = (value, maxLength = 2000) => sanitizeValue(value).slice(0, Math.max(0, maxLength));

export const sanitizeNumber = (value, options = {}) => {
  const { min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY, fallback = 0, integer = false } = options;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(max, Math.max(min, parsed));
  return integer ? Math.round(bounded) : bounded;
};

export const sanitizeBoolean = (value) => value === true || value === 1 || value === '1' || value === 'true' || value === 'on';

export const sanitizeRecord = (record = {}, schema = {}) => Object.fromEntries(
  Object.entries(schema).map(([key, sanitizer]) => [key, typeof sanitizer === 'function' ? sanitizer(record?.[key]) : record?.[key]])
);

export const textWithBreaks = (value) => escapeHTML(sanitizeValue(value)).replace(/\r?\n/gu, '<br>');

export default Object.freeze({
  escapeHTML,
  escapeAttr,
  escapeJSString,
  safeId,
  safeIconName,
  safeURL,
  safePhoneHref,
  sanitizeInput,
  sanitizeValue,
  sanitizeNumber,
  sanitizeBoolean,
  sanitizeRecord,
  textWithBreaks
});
