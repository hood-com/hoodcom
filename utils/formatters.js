import { CURRENCIES, DEFAULT_CURRENCY } from './constants.js';

const DEFAULT_RATES = Object.freeze({ YER: 1, SAR: 0.0071, USD: 0.0018, AED: 0.0066 });
const asFinite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export const getCurrencyName = (code = DEFAULT_CURRENCY) => CURRENCIES[code]?.name || CURRENCIES[DEFAULT_CURRENCY].name;
export const getCurrencyShort = (code = DEFAULT_CURRENCY) => CURRENCIES[code]?.short || CURRENCIES[DEFAULT_CURRENCY].short;
export const getCurrencyFlag = (code = DEFAULT_CURRENCY) => CURRENCIES[code]?.flag || '';

export const convertPrice = (amountInYER, targetCurrency = DEFAULT_CURRENCY, exchangeRates = DEFAULT_RATES) => {
  const amount = asFinite(amountInYER);
  const rate = asFinite(exchangeRates?.[targetCurrency], targetCurrency === 'YER' ? 1 : 0);
  return targetCurrency === 'YER' ? amount : amount * rate;
};

export const formatPrice = (amount, currencyCode = DEFAULT_CURRENCY, locale = 'ar-YE') => {
  const value = asFinite(amount);
  const maximumFractionDigits = currencyCode === 'YER' ? 0 : 2;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits, minimumFractionDigits: 0 }).format(value)} ${getCurrencyShort(currencyCode)}`;
};

export const formatPriceMultiCurrency = (amountInYER, options = {}) => {
  const { activeCurrencies = Object.keys(CURRENCIES), exchangeRates = DEFAULT_RATES, locale = 'ar-YE' } = options;
  return activeCurrencies.filter((code) => CURRENCIES[code]).map((code) =>
    formatPrice(convertPrice(amountInYER, code, exchangeRates), code, locale));
};

export const formatDate = (value, options = {}) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const { locale = 'ar-YE', dateStyle = 'medium', timeStyle = 'short' } = options;
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle, timeStyle }).format(date);
  } catch {
    return date.toLocaleString(locale);
  }
};

export const fmtDate = (value, options = {}) => formatDate(value, options);

export const formatStatus = (status, locale = 'ar') => {
  const labels = {
    ar: { available: 'متوفر', unavailable: 'غير متوفر', coming_soon: 'قريباً', enabled: 'مفعل', disabled: 'معطل', visible: 'ظاهر', hidden: 'مخفي', pending: 'قيد الانتظار', completed: 'مكتمل' },
    en: { available: 'Available', unavailable: 'Unavailable', coming_soon: 'Coming soon', enabled: 'Enabled', disabled: 'Disabled', visible: 'Visible', hidden: 'Hidden', pending: 'Pending', completed: 'Completed' }
  };
  return labels[locale]?.[status] || labels.ar[status] || String(status || '');
};

export const formatPhone = (phone, defaultCountryCode = '967') => {
  const raw = String(phone ?? '').trim();
  let digits = raw.replace(/\D/gu, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && defaultCountryCode) digits = `${defaultCountryCode}${digits.replace(/^0+/u, '')}`;
  const groups = digits.match(/.{1,3}/gu) || [digits];
  return `+${groups.join(' ')}`;
};

export default Object.freeze({
  formatPrice,
  formatPriceMultiCurrency,
  formatDate,
  formatPhone,
  formatStatus,
  getCurrencyName,
  getCurrencyShort,
  getCurrencyFlag,
  convertPrice,
  fmtDate
});
