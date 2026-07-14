/** Pure validation helpers. */
const text = (value) => (value === null || value === undefined ? '' : String(value).trim());

export const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(text(email).toLowerCase());
export const isValidEmailAddress = validateEmail;

export const validatePhone = (phone) => {
  const digits = text(phone).replace(/\D/gu, '');
  return digits.length >= 8 && digits.length <= 15;
};
export const isValidPhone = validatePhone;

export const validateRequired = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return value;
  return text(value).length > 0;
};

export const isValidName = (name, minimumParts = 2) => {
  const parts = text(name).split(/\s+/u).filter(Boolean);
  return parts.length >= minimumParts && parts.every((part) => /^[\p{L}\p{M}'’-]{2,}$/u.test(part));
};

export const isValidPassword = (password, options = {}) => {
  const { minLength = 8, requireLetter = true, requireNumber = true } = options;
  const value = String(password ?? '');
  if (value.length < minLength || value.length > 128) return false;
  if (requireLetter && !/\p{L}/u.test(value)) return false;
  if (requireNumber && !/\p{N}/u.test(value)) return false;
  return true;
};

export const isValidURL = (value, allowedProtocols = ['http:', 'https:']) => {
  try {
    const url = new URL(text(value));
    return allowedProtocols.includes(url.protocol);
  } catch {
    return false;
  }
};

export default Object.freeze({
  validateEmail,
  validatePhone,
  validateRequired,
  isValidEmailAddress,
  isValidPhone,
  isValidName,
  isValidPassword,
  isValidURL
});
