/* ============================================
HUD COM - النسخة المطورة v11.0 - DATA LAYER
شراء مباشر بدون سلة
جميع بيانات العميل اختيارية
إدارة كاملة للمحافظ
الحقول الديناميكية للمنتجات
إعدادات الموقع
دعم تعدد العملات
كشف الزبون المتكرر
نظام ترجمة احترافي متكامل
============================================ */
// ===== Security & Sanitization Utilities =====
(function attachSecurityHelpers() {
function toStringSafe(value) {
return value === null || value === undefined ? '' : String(value);
}
window.escapeHTML = function(value) {
return toStringSafe(value)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/\"/g, '&quot;')
.replace(/'/g, '&#39;');
};
window.escapeAttr = window.escapeHTML;
window.escapeJSString = function(value) {
return toStringSafe(value)
.replace(/\\/g, '\\\\')
.replace(/'/g, "\\'")
.replace(/"/g, '\\"')
.replace(/\r/g, '\\r')
.replace(/\n/g, '\\n')
.replace(/</g, '\\x3C')
.replace(/>/g, '\\x3E');
};
window.safeId = function(value) {
return toStringSafe(value).replace(/[^a-zA-Z0-9_:.\-]/g, '');
};
window.safeIconName = function(value, fallback) {
var raw = safeId(value || fallback || 'info');
return raw || (fallback || 'info');
};
window.safeURL = function(value, fallback) {
var raw = toStringSafe(value).trim();
if (!raw) return fallback || '';
if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=\r\n]+$/i.test(raw)) return raw;
try {
if (!raw.match(/^[a-z]+:/i) && !raw.startsWith('/')) raw = 'https://' + raw;
var url = new URL(raw, window.location.href);
var allowed = ['http:', 'https:', 'tel:', 'mailto:', 'tg:'];
if (allowed.indexOf(url.protocol) !== -1) return url.href;
} catch (e) {}
return fallback || '';
};
window.safePhoneHref = function(value) {
var digits = toStringSafe(value).replace(/\D/g, '');
return digits ? 'tel:+' + digits : '#';
};
// ===== بناء رابط زر التواصل حسب النوع =====
window.buildContactHref = function(type, value) {
var raw = toStringSafe(value).trim();
switch (type) {
case 'phone':
return window.safePhoneHref(raw);
case 'whatsapp': {
var d = raw.replace(/\D/g, '');
return d ? 'https://wa.me/' + d : '#';
}
case 'telegram': {
if (raw.match(/^https?:\/\//i) || raw.match(/^tg:\/\//i)) return raw;
var tg = raw.replace(/^@/, '');
return tg ? 'https://t.me/' + tg : '#';
}
case 'email': {
var em = raw.replace(/^mailto:/i, '');
return em ? 'mailto:' + em : '#';
}
case 'link':
default:
if (!raw.match(/^https?:\/\//i) && !raw.match(/^tg:\/\//i) && raw.match(/^\d{7,}$/)) {
return 'https://wa.me/' + raw;
}
return window.safeURL(raw, '#');
}
};
// هل يفتح الزر في نافذة جديدة؟
window.contactOpensNewTab = function(type) {
return type === 'link' || type === 'whatsapp' || type === 'telegram';
};
window.textWithBreaks = function(value) {
return escapeHTML(value).replace(/\n/g, '<br>');
};
if (!window.CSS) window.CSS = {};
if (typeof window.CSS.escape !== 'function') {
window.CSS.escape = function(value) {
return toStringSafe(value).replace(/[^a-zA-Z0-9_-]/g, function(ch) {
return '\\' + ch;
});
};
}
})();

// ===== Input Validation Utilities =====
window.validateEmail = function(email) {
const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
return re.test(String(email).toLowerCase());
};
window.validatePhone = function(phone) {
const cleaned = String(phone).replace(/\D/g, '');
return cleaned.length >= 8 && cleaned.length <= 15;
};
window.validateRequired = function(value) {
return value !== null && value !== undefined && String(value).trim() !== '';
};

// ===== Supabase Configuration =====
// يتم تحميل إعدادات Supabase من supabase-config.js عبر supabase-adapter.js

// ===== أرقام التواصل الرسمية =====
const DEFAULT_WHATSAPP_NUMBER = "967783708724";
const DEFAULT_SUPPORT_NUMBER = "967712423773";
const DEFAULT_WHATSAPP_CHANNEL = "https://whatsapp.com/channel/0029Vb8al5Y0LKZA4hbrLE19";

let WHATSAPP_NUMBER = DEFAULT_WHATSAPP_NUMBER;
let SUPPORT_NUMBER = DEFAULT_SUPPORT_NUMBER;
let WHATSAPP_CHANNEL = DEFAULT_WHATSAPP_CHANNEL;

// ===== العملات =====
const CURRENCIES = {
YER: { name: "ريال يمني", short: "ر.ي", flag: "🇾🇪" },
SAR: { name: "ريال سعودي", short: "ر.س", flag: "🇸🇦" },
USD: { name: "دولار", short: "$", flag: "🇺🇸" },
AED: { name: "درهم إماراتي", short: "د.إ", flag: "🇦🇪" }
};
const DEFAULT_CURRENCY = "YER";

let CURRENCY_DISPLAY_MODE = "single";
let ACTIVE_CURRENCIES = ["YER", "SAR", "USD", "AED"];

// أسعار الصرف الداخلية مقابل 1 ريال يمني (تُعرض في الإدارة مقابل 100 ريال)
// مثال: 100 ر.ي = 0.71 SAR ⇒ 0.0071 لكل 1 ر.ي
let EXCHANGE_RATES = {
YER: 1,
SAR: 0.0071,
USD: 0.0018,
AED: 0.0066
};

// ===== المحافظ الإلكترونية الافتراضية =====
const DEFAULT_WALLETS = [
{ id: 'krimi_jawali', name: 'كريمي جوالي', number: '', image: '', enabled: true, order: 1 },
{ id: 'mahfadti', name: 'محفظتي', number: '', image: '', enabled: true, order: 2 },
{ id: 'floosak', name: 'فلوسك', number: '', image: '', enabled: true, order: 3 },
{ id: 'jeeb', name: 'جيب', number: '', image: '', enabled: true, order: 4 },
{ id: 'mobile_money', name: 'موبايل موني', number: '', image: '', enabled: true, order: 5 },
{ id: 'cash', name: 'كاش', number: '', image: '', enabled: true, order: 6 },
{ id: 'one_cash', name: 'ون كاش', number: '', image: '', enabled: true, order: 7 }
];
let WALLETS = JSON.parse(JSON.stringify(DEFAULT_WALLETS));

// ===== إعدادات الموقع =====
const SITE_SETTINGS_KEY = 'hud_site_settings';
const WALLETS_SETTINGS_KEY = 'hud_wallets_settings';

const DEFAULT_SITE_SETTINGS = {
whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
supportNumber: DEFAULT_SUPPORT_NUMBER,
whatsappChannel: DEFAULT_WHATSAPP_CHANNEL,
adminPhone: DEFAULT_WHATSAPP_NUMBER,
contacts: [],
customFields: [],
featuredOffers: [],
offersPerPage: 10,
hideUnavailable: false,
storeName: "هود كوم",
storeSlogan: "كل ما تحتاجه في مكان واحد",
aboutEnabled: true,
aboutTitle: "هود كوم",
aboutText: "تتجه التكنولوجيا المالية نحو آفاق جديدة، وموقع هود كوم يقف في المقدمة كمزوّد رائد لخدمات شحن الألعاب والبرامج والبطاقات الإلكترونية بكفاءة وسرعة عالية، وربط لجميع الأنظمة والتطبيقات. دعم فني متاح على مدار الساعة. كل ما تحتاجه في تطبيق واحد صُمّم خصيصاً لتلبية جميع احتياجاتك بسرعة وأمان وراحة، فإن موقع هود كوم اختيارك الأفضل.",
aboutPosition: "middle",
aboutLines: [
{ icon: "👔", label: "الإدارة العامة", value: "783708724" },
{ icon: "📱", label: "خدمة العملاء", value: "712423773" }
],
contactPlatformsEnabled: true,
contactPlatformsTitle: "تواصل معنا",
contactPlatforms: [
{ id: "cp_wa", icon: "whatsapp", label: "واتساب", type: "whatsapp", value: "967783708724", enabled: true },
{ id: "cp_call", icon: "phone", label: "اتصال", type: "phone", value: "967712423773", enabled: true },
{ id: "cp_channel", icon: "broadcast", label: "قناة واتساب", type: "link", value: "https://whatsapp.com/channel/0029Vb8al5Y0LKZA4hbrLE19", enabled: true },
{ id: "cp_email", icon: "send", label: "بريد إلكتروني", type: "email", value: "support@hudcom.app", enabled: true },
{ id: "cp_telegram", icon: "telegram", label: "تلجرام", type: "telegram", value: "https://t.me/", enabled: true }
],
currencyMode: "single",
activeCurrencies: ["YER", "SAR", "USD", "AED"],
defaultCurrency: "YER",
showWatermark: true,
watermarkOpacity: 0.15,
enableReturningCustomer: true,
exchangeRates: {
YER: 1,
SAR: 0.0071,
USD: 0.0018,
AED: 0.0066
},
adminAvailability: false
};
let siteSettings = { ...DEFAULT_SITE_SETTINGS };

// ===== الحقول الديناميكية للمنتجات =====
const PRODUCT_FIELD_TYPES = {
TEXT: 'text',
NUMBER: 'number',
ID: 'id',
LINK: 'link',
NOTE: 'note',
EMAIL: 'email',
PASSWORD: 'password'
};

const DEFAULT_PRODUCT_FIELDS = [
{ id: 'id', label: 'ID الخاص بك', type: 'id', required: true, placeholder: 'أدخل الـ ID' },
{ id: 'note', label: 'ملاحظات إضافية', type: 'note', required: false, placeholder: 'أي تفاصيل تريد إضافتها...' }
];

// ===== النوافذ المنبثقة =====
window.DEFAULT_POPUPS = [
{
id: 'popup-1',
title: '⚠️ تنبيه مهم قبل الشراء',
content: 'يرجى قراءة التعليمات التالية بعناية قبل إتمام عملية الشراء. هذا يضمن لك تجربة سلسة وسريعة.',
image: '',
buttonText: 'التالي',
type: 'warning'
},
{
id: 'popup-2',
title: '🎮 كيفية إدخال البيانات',
content: '1️⃣ افتح اللعبة على جهازك\n2️⃣ انسخ الـ ID الخاص بحسابك\n3️⃣ الصقه في خانة الـ ID في نموذج الشراء\n4️⃣ أكمل عملية الدفع وانتظر التوصيل الفوري',
image: '',
buttonText: 'متابعة الشراء',
type: 'info'
}
];

// ===== أيقونات SVG =====
const ICONS = {
cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.76 1-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297 A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 1 11.821 0 00-3.48-8.413z"/></svg>',
phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
broadcast: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1v-7h3zM3 19a2 2 0 0 0 2 2h1v-7H3z"/></svg>',
check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>',
arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>',
plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
package: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
star: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20l-2-10 6 4 3-8 3 8 6-4-2 10"/></svg>',
percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>',
cart2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
creditCard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
user2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
drag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="6" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="18" r="1"/></svg>',
sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
};


// أيقونات إضافية ومصححة مطلوبة في V1
Object.assign(ICONS, {
whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
whatsapp2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>',
telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
cart3: ICONS.cart,
cart4: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
menu2: ICONS.menu,
close2: ICONS.close,
check2: ICONS.check,
loading: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
send2: ICONS.send,
globe2: ICONS.globe,
moon2: ICONS.moon,
sun2: ICONS.sun
});

// ===== دالة الأيقونة =====
window.icon = function(name, size) {
size = size || 20;
const svg = ICONS[name] || ICONS.package || ICONS.info;
if (!svg) return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
return svg.replace('<svg', '<svg width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false"');
};

// ===== المتغيرات الأساسية =====
let categories = [];
let db = null;
let firebaseReady = false;
let firebaseLoading = true;
let currentOrder = null;
let currentPopups = [];
let currentPopupIndex = 0;

// ===== إدارة إعدادات الموقع =====
async function loadSiteSettingsFromFirebase() {
if (!window.firebaseDB || !db) return;
try {
const { doc, getDoc } = window.firebaseDB;
const docSnap = await getDoc(doc(db, 'settings', 'site'));
if (docSnap.exists()) {
const loadedData = docSnap.data();
siteSettings = { ...DEFAULT_SITE_SETTINGS, ...loadedData };
applyGlobalSettings();
localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(siteSettings));
try { window.dispatchEvent(new Event('hud:site-settings-loaded')); } catch(e) {}
}
} catch (e) {
console.warn('Failed to load settings from Supabase', e);
}
}

async function saveSiteSettingsToFirebase() {
  try {
    var ready = await waitForFirebaseReady(15000);
    if (!ready || !window.firebaseDB) {
      console.warn('[data.js] saveSiteSettingsToFirebase: Supabase غير جاهز');
      return;
    }
    var activeDb = window.db || (window.firebaseDB && window.firebaseDB.db) || db;
    var fdb = window.firebaseDB;
    await fdb.setDoc(fdb.doc(activeDb, 'settings', 'site'), window.siteSettings || siteSettings, { merge: true });
    console.log('[data.js] ✅ تم حفظ إعدادات الموقع في Supabase');
  } catch (e) {
    console.warn('[data.js] Failed to save settings to Supabase:', e);
  }
}

function applyGlobalSettings() {
WHATSAPP_NUMBER = siteSettings.whatsappNumber || DEFAULT_WHATSAPP_NUMBER;
SUPPORT_NUMBER = siteSettings.supportNumber || DEFAULT_SUPPORT_NUMBER;
WHATSAPP_CHANNEL = siteSettings.whatsappChannel || DEFAULT_WHATSAPP_CHANNEL;
CURRENCY_DISPLAY_MODE = siteSettings.currencyMode || 'single';
ACTIVE_CURRENCIES = siteSettings.activeCurrencies || ['YER', 'SAR', 'USD', 'AED'];
if (siteSettings.exchangeRates) {
EXCHANGE_RATES = { ...EXCHANGE_RATES, ...siteSettings.exchangeRates };
}
}

function loadSiteSettings() {
try {
const stored = localStorage.getItem(SITE_SETTINGS_KEY);
if (stored) {
const parsed = JSON.parse(stored);
siteSettings = { ...DEFAULT_SITE_SETTINGS, ...parsed };
applyGlobalSettings();
}
} catch (e) {
siteSettings = { ...DEFAULT_SITE_SETTINGS };
}
}

function saveSiteSettings(newSettings) {
try {
siteSettings = { ...siteSettings, ...newSettings };
window.siteSettings = siteSettings;
applyGlobalSettings();
localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(siteSettings));
saveSiteSettingsToFirebase();
return true;
} catch (e) {
return false;
}
}

// ===== إدارة المحافظ =====
function loadWalletSettings() {
try {
const stored = localStorage.getItem(WALLETS_SETTINGS_KEY);
if (stored) {
const parsed = JSON.parse(stored);
const savedWallets = parsed.wallets || [];
const customWallets = parsed.customWallets || [];
WALLETS = DEFAULT_WALLETS.map(function(defaultWallet) {
const saved = savedWallets.find(function(w) { return w.id === defaultWallet.id; });
if (saved) {
return { ...defaultWallet, ...saved };
}
return defaultWallet;
});
customWallets.forEach(function(cw) {
const exists = WALLETS.find(function(w) { return w.id === cw.id; });
if (!exists) {
WALLETS.push(cw);
}
});
}
} catch (e) {
console.warn('تعذر تحميل إعدادات المحافظ:', e);
WALLETS = JSON.parse(JSON.stringify(DEFAULT_WALLETS));
}
}

function saveWalletSettings() {
try {
const defaultIds = DEFAULT_WALLETS.map(function(w) { return w.id; });
const customWallets = WALLETS.filter(function(w) {
return defaultIds.indexOf(w.id) === -1;
});
const data = {
wallets: WALLETS.filter(function(w) { return defaultIds.indexOf(w.id) !== -1; }),
customWallets: customWallets
};
localStorage.setItem(WALLETS_SETTINGS_KEY, JSON.stringify(data));
saveWalletsToFirebase();
return true;
} catch (e) {
console.error('خطأ في حفظ إعدادات المحافظ:', e);
return false;
}
}

async function saveWalletsToFirebase() {
  try {
    var ready = await waitForFirebaseReady(15000);
    if (!ready || !window.firebaseDB) return false;
    var activeDb = window.db || (window.firebaseDB && window.firebaseDB.db) || db;
    var fdb = window.firebaseDB;
    var walletData = {
      wallets: WALLETS,
      updatedAt: new Date().toISOString()
    };
    await fdb.setDoc(fdb.doc(activeDb, 'wallets', 'all'), walletData);
    console.log('[data.js] ✅ تم حفظ المحافظ في Supabase');
    return true;
  } catch (e) {
    console.error('[data.js] خطأ في حفظ المحافظ:', e);
    return false;
  }
}

async function loadWalletsFromFirebase() {
if (!window.firebaseDB || !db) return false;
try {
const { doc, getDoc } = window.firebaseDB;
const docSnap = await getDoc(doc(db, 'wallets', 'all'));
if (docSnap.exists()) {
const data = docSnap.data();
if (data && data.wallets && Array.isArray(data.wallets)) {
WALLETS = data.wallets;
localStorage.setItem(WALLETS_SETTINGS_KEY, JSON.stringify({
wallets: WALLETS.filter(function(w) { return DEFAULT_WALLETS.some(function(dw) { return dw.id === w.id; }); }),
customWallets: WALLETS.filter(function(w) { return !DEFAULT_WALLETS.some(function(dw) { return dw.id === w.id; }); })
}));
console.log('تم تحميل المحافظ من Supabase (' + WALLETS.length + ')');
return true;
}
}
return false;
} catch (e) {
console.error('خطأ في تحميل المحافظ:', e);
return false;
}
}

function addWallet(wallet) {
try {
if (!wallet.id) {
wallet.id = 'wallet_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}
wallet.order = WALLETS.length + 1;
if (typeof wallet.enabled === 'undefined') wallet.enabled = true;
WALLETS.push(wallet);
saveWalletSettings();
return wallet;
} catch (e) {
console.error('خطأ في إضافة محفظة:', e);
return null;
}
}

function deleteWallet(walletId) {
try {
const defaultIds = DEFAULT_WALLETS.map(function(w) { return w.id; });
if (defaultIds.indexOf(walletId) !== -1) {
const wallet = WALLETS.find(function(w) { return w.id === walletId; });
if (wallet) {
wallet.enabled = false;
saveWalletSettings();
return true;
}
return false;
}
WALLETS = WALLETS.filter(function(w) { return w.id !== walletId; });
saveWalletSettings();
return true;
} catch (e) {
console.error('خطأ في حذف محفظة:', e);
return false;
}
}

function updateWallet(walletId, updates) {
try {
const wallet = WALLETS.find(function(w) { return w.id === walletId; });
if (!wallet) return false;
Object.assign(wallet, updates);
saveWalletSettings();
return true;
} catch (e) {
console.error('خطأ في تحديث محفظة:', e);
return false;
}
}

function getActiveWallets() {
return WALLETS.filter(function(w) { return w.enabled !== false; })
.sort(function(a, b) { return (a.order || 0) - (b.order || 0); });
}

function loadWalletImages() {
try {
WALLETS.forEach(function(w) {
const img = localStorage.getItem('hud_wallet_img_' + w.id);
if (img) w.image = img;
});
} catch (e) {
console.warn('تعذر تحميل صور المحافظ:', e);
}
}

function saveWalletImage(id, imageData) {
try {
localStorage.setItem('hud_wallet_img_' + id, imageData);
const wallet = WALLETS.find(function(w) { return w.id === id; });
if (wallet) wallet.image = imageData;
saveWalletsToFirebase();
return true;
} catch (e) {
console.error('خطأ في حفظ صورة المحفظة:', e);
return false;
}
}

function getWalletImage(id) {
const wallet = WALLETS.find(function(w) { return w.id === id; });
return wallet ? wallet.image : '';
}

// ===== إدارة بيانات الزبون المتكرر =====
const LAST_ORDER_KEY = 'hud_last_order';
const CUSTOMER_DATA_KEY = 'hud_customer_data';

function hasPreviousOrder() {
try {
return localStorage.getItem(LAST_ORDER_KEY) !== null;
} catch (e) {
return false;
}
}

function getPreviousCustomerData() {
try {
const data = localStorage.getItem(CUSTOMER_DATA_KEY);
return data ? JSON.parse(data) : null;
} catch (e) {
return null;
}
}

function saveCustomerData(data) {
try {
localStorage.setItem(CUSTOMER_DATA_KEY, JSON.stringify(data));
localStorage.setItem(LAST_ORDER_KEY, new Date().toISOString());
} catch (e) {
console.warn('تعذر حفظ بيانات العميل:', e);
}
}

// ===== الحقول الديناميكية للمنتجات =====
function getProductFields(item) {
  if (item && item.customFields && Array.isArray(item.customFields) && item.customFields.length > 0) {
    return item.customFields;
  }
  try {
    const s = window.siteSettings || siteSettings || {};
    if (s.customFields && Array.isArray(s.customFields) && s.customFields.length > 0) {
      return s.customFields.filter(f => f.enabled !== false).map((f, i) => ({
        id: 'cf_' + i + '_' + (f.name || '').replace(/\s+/g,'_'),
        label: f.name || 'حقل مخصص',
        type: 'text',
        required: f.required !== false,
        placeholder: f.defaultVal || 'أدخل القيمة المطلوبة...'
      }));
    }
  } catch(e) {}
  return DEFAULT_PRODUCT_FIELDS;
}

// ===== النوافذ المنبثقة المتعددة =====
function getOfferPopups(item, offer) {
  if (offer && offer.popups && Array.isArray(offer.popups) && offer.popups.length > 0) {
    return offer.popups;
  }
  if (item && item.popups && Array.isArray(item.popups) && item.popups.length > 0) {
    return item.popups;
  }
  // NEW: allow admin-controlled default popups
  try {
    const s = window.siteSettings || {};
    if (s.defaultPopups && Array.isArray(s.defaultPopups) && s.defaultPopups.length > 0) {
      return s.defaultPopups;
    }
  } catch(e) {}
  return window.DEFAULT_POPUPS || [];
}

// ===== العملة =====
function getCurrencyName(code) {
const cur = CURRENCIES[code];
return cur ? cur.name : CURRENCIES[DEFAULT_CURRENCY].name;
}

function getCurrencyShort(code) {
const cur = CURRENCIES[code];
return cur ? cur.short : CURRENCIES[DEFAULT_CURRENCY].short;
}

function getCurrencyFlag(code) {
const cur = CURRENCIES[code];
return cur ? cur.flag : '';
}

function convertPrice(amountInYER, targetCurrency) {
if (targetCurrency === 'YER') return amountInYER;
const rate = EXCHANGE_RATES[targetCurrency] || 1;
return Math.round(amountInYER * rate);
}

function formatPrice(amount, currencyCode) {
const cur = CURRENCIES[currencyCode];
const formatted = amount.toLocaleString();
return cur ? formatted + ' ' + cur.short : formatted + ' ' + currencyCode;
}

function formatPriceMultiCurrency(amountInYER) {
if (typeof ACTIVE_CURRENCIES === 'undefined' || !Array.isArray(ACTIVE_CURRENCIES)) {
ACTIVE_CURRENCIES = ['YER', 'SAR', 'USD', 'AED'];
}
const prices = ACTIVE_CURRENCIES.map(function(code) {
const converted = convertPrice(amountInYER, code);
return formatPrice(converted, code);
});
return prices;
}

// ===== الحصول على قسم =====
function getCategory(id) {
if (!id || !categories || !Array.isArray(categories)) return null;
return categories.find(function(c) { return c && c.id === id; });
}

// ===== تهيئة Supabase =====
async function initFirebase() {
try {
console.log('بدء تحميل Supabase...');
if (typeof window.initSupabaseAdapter !== 'function') {
throw new Error('supabase-adapter.js غير محمل');
}
await window.initSupabaseAdapter();
db = window.db;
console.log('Supabase متصل بنجاح');

await loadSiteSettingsFromFirebase();
await loadCategoriesFromFirebase();

var walletsLoaded = await loadWalletsFromFirebase();
if (!walletsLoaded) {
await saveWalletsToFirebase();
}

firebaseReady = true;
firebaseLoading = false;

if (typeof window.onFirebaseReady === 'function') {
window.onFirebaseReady();
}

setupRealtimeSync();
return true;
} catch (e) {
console.error('خطأ Supabase:', e);
firebaseReady = false;
firebaseLoading = false;
return false;
}
}

// ===== المزامنة اللحظية (Realtime) - النسخة المُصلحة v12.0 =====
// تجعل أي تغيير في لوحة التحكم يظهر مباشرة لجميع الزوار على كل الأجهزة
// الإصلاح: لا نستخدم الكاش المحلي كمصدر بديل — البيانات تأتي دائماً من السحابة فقط
var __realtimeSyncStarted = false;
function setupRealtimeSync() {
if (__realtimeSyncStarted) return;
if (!window.firebaseDB || !db || !window.firebaseDB.onSnapshot) return;
// لا نفعّل المزامنة اللحظية في لوحة التحكم حتى لا تتعارض مع التحرير
var isAdminPage = /admin\.html$/i.test(window.location.pathname);
if (isAdminPage) return;
__realtimeSyncStarted = true;
try {
var onSnapshot = window.firebaseDB.onSnapshot;
var docRef = window.firebaseDB.doc;
var collectionRef = window.firebaseDB.collection;

// 1) إعدادات الموقع (النبذة، أزرار التواصل، الأرقام...)
onSnapshot(docRef(db, 'settings', 'site'), function(snap) {
if (snap.exists()) {
siteSettings = Object.assign({}, DEFAULT_SITE_SETTINGS, snap.data());
applyGlobalSettings();
try { localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(siteSettings)); } catch (e) {}
if (typeof window.applySiteSettingsToUI === 'function') window.applySiteSettingsToUI();
try { window.dispatchEvent(new Event('hud:site-settings-loaded')); } catch(e) {}
}
}, function(err) { console.warn('settings sync error', err); });

// 2) الأقسام والمنتجات والعروض
// الإصلاح الرئيسي: لا نعود للكاش المحلي أبداً — إذا كانت السحابة فارغة نعرض فارغاً
onSnapshot(collectionRef(db, 'categories'), function(snapshot) {
var temp = [];
snapshot.forEach(function(d) {
var data = d.data();
if (!data) return;
if (!data.items || !Array.isArray(data.items)) data.items = [];
data.items.forEach(function(item) {
if (!item.offers || !Array.isArray(item.offers)) item.offers = [];
if (!item.status) item.status = 'available';
item.offers.forEach(function(o) { if (!o.status) o.status = 'available'; });
});
temp.push(Object.assign({ id: d.id }, data));
});
// دائماً نستخدم ما جاء من السحابة — سواء كان فارغاً أو لا
categories = temp;
// نحفظ الكاش فقط إذا كانت البيانات موجودة (لتسريع العرض الأول فقط)
if (temp.length > 0) {
try { localStorage.setItem('hud_categories_cache', JSON.stringify(categories)); } catch (e) {}
} else {
// السحابة فارغة — نحذف الكاش القديم لتجنب عرض بيانات وهمية
try { localStorage.removeItem('hud_categories_cache'); } catch (e) {}
}
if (typeof window.renderHomeCategories === 'function' && document.getElementById('homeCategoriesGrid')) window.renderHomeCategories();
if (typeof window.renderCategoryPage === 'function' && document.getElementById('pageContent')) window.renderCategoryPage();
if (typeof window.renderMenuCategories === 'function') window.renderMenuCategories();
if (typeof window.renderFeaturedOffers === 'function') window.renderFeaturedOffers();
if (typeof window.populateCategoryFilter === 'function') window.populateCategoryFilter();
}, function(err) { console.warn('categories sync error', err); });

// 3) المحافظ
onSnapshot(docRef(db, 'wallets', 'all'), function(snap) {
if (snap.exists()) {
var data = snap.data();
if (data && Array.isArray(data.wallets)) {
WALLETS = data.wallets;
if (typeof window.renderWalletGrid === 'function') window.renderWalletGrid();
}
}
}, function(err) { console.warn('wallets sync error', err); });

console.log('تم تفعيل المزامنة اللحظية v12');
} catch (e) {
console.warn('تعذر تفعيل المزامنة اللحظية:', e);
}
}

// ===== تحميل الأقسام من Supabase - مُصلح v12.0 =====
// الإصلاح: البيانات دائماً من السحابة، الكاش للتسريع فقط في العرض الأولي
async function loadCategoriesFromFirebase() {
if (!db || !window.firebaseDB) {
console.warn('قاعدة البيانات غير متصلة');
return;
}
// نُحمّل الكاش مؤقتاً لعرض شيء للمستخدم بينما يتم تحميل السحابة
// لكننا لن نرجع للكاش إذا كانت السحابة فارغة
try {
const cached = localStorage.getItem('hud_categories_cache');
if (cached && categories.length === 0) {
try {
const parsedCache = JSON.parse(cached);
if (Array.isArray(parsedCache) && parsedCache.length > 0) {
categories = parsedCache; // عرض مؤقت فقط حتى تأتي السحابة
}
} catch (e) { categories = []; }
}
} catch (e) {}
try {
const { collection, getDocs } = window.firebaseDB;
const snapshot = await getDocs(collection(db, 'categories'));
let tempCategories = [];
snapshot.forEach(function(docSnap) {
try {
const data = docSnap.data();
if (data) {
if (!data.items || !Array.isArray(data.items)) data.items = [];
data.items.forEach(function(item) {
if (!item.offers || !Array.isArray(item.offers)) item.offers = [];
if (!item.status) item.status = 'available';
item.offers.forEach(function(o) {
if (!o.status) o.status = 'available';
});
});
tempCategories.push(Object.assign({ id: docSnap.id }, data));
}
} catch (itemErr) {
console.error('خطأ في معالجة قسم:', itemErr);
}
});

// دائماً نضع ما جاء من السحابة (سواء فارغاً أو لا)
categories = tempCategories;
if (tempCategories.length > 0) {
// نحدّث الكاش بالبيانات الجديدة
try { localStorage.setItem('hud_categories_cache', JSON.stringify(categories)); } catch (e) {}
} else {
// السحابة فارغة → نحذف الكاش القديم
try { localStorage.removeItem('hud_categories_cache'); } catch (e) {}
}

console.log('تم تحميل ' + categories.length + ' قسم من السحابة');
return categories;
} catch (e) {
console.error('خطأ في تحميل البيانات:', e);
// في حال الخطأ الشبكي فقط نستخدم الكاش مؤقتاً
return categories;
}
}

// ===== انتظار جاهزية Supabase (v13 FIX) =====
async function waitForFirebaseReady(timeoutMs) {
  timeoutMs = timeoutMs || 15000;
  var start = Date.now();
  // انتظر وعد التهيئة الرئيسي أولاً
  if (window.__hudFirebaseReadyPromise && typeof window.__hudFirebaseReadyPromise.then === 'function') {
    try {
      await Promise.race([
        window.__hudFirebaseReadyPromise,
        new Promise(function(resolve) { setTimeout(resolve, timeoutMs); })
      ]);
    } catch (e) {}
  }
  // ثم انتظر حتى تصبح المتغيرات جاهزة
  while (Date.now() - start < timeoutMs) {
    if (firebaseReady && window.firebaseDB && (db || window.db)) return true;
    await new Promise(function(resolve) { setTimeout(resolve, 100); });
  }
  // آخر محاولة: استخدام adapter مباشرة حتى لو firebaseReady=false
  if (window.firebaseDB && (db || window.db)) {
    console.warn('[data.js] firebaseReady=false لكن window.firebaseDB متاح — سنتابع.');
    return true;
  }
  return false;
}

// ===== حفظ قسم =====
async function saveCategoryToFirebase(category) {
  var ready = await waitForFirebaseReady(15000);
  if (!ready || !window.firebaseDB) {
    console.error('[data.js] saveCategoryToFirebase: Supabase غير جاهز بعد الانتظار');
    return false;
  }
  try {
    var activeDb = window.db || (window.firebaseDB && window.firebaseDB.db) || db;
    var fdb = window.firebaseDB;
    var categoryToSave = Object.assign({}, category);
    if (!categoryToSave.items) categoryToSave.items = [];
    await fdb.setDoc(fdb.doc(activeDb, 'categories', category.id), categoryToSave);
    // تحديث الكاش المحلي
    try {
      var idx = categories.findIndex(function(c) { return c.id === category.id; });
      if (idx >= 0) categories[idx] = categoryToSave;
      else categories.push(categoryToSave);
      localStorage.setItem('hud_categories_cache', JSON.stringify(categories));
    } catch (cacheErr) {}
    console.log('[data.js] ✅ تم حفظ القسم:', category.name || category.id);
    return true;
  } catch (e) {
    console.error('[data.js] خطأ في الحفظ:', e);
    return false;
  }
}

// ===== حذف قسم =====
async function deleteCategoryFromFirebase(catId) {
  var ready = await waitForFirebaseReady(15000);
  if (!ready || !window.firebaseDB) {
    console.error('[data.js] deleteCategoryFromFirebase: Supabase غير جاهز');
    return false;
  }
  try {
    var activeDb = window.db || (window.firebaseDB && window.firebaseDB.db) || db;
    var fdb = window.firebaseDB;
    await fdb.deleteDoc(fdb.doc(activeDb, 'categories', catId));
    // تحديث الكاش المحلي
    try {
      categories = categories.filter(function(c) { return c.id !== catId; });
      if (categories.length > 0) localStorage.setItem('hud_categories_cache', JSON.stringify(categories));
      else localStorage.removeItem('hud_categories_cache');
    } catch (cacheErr) {}
    console.log('[data.js] ✅ تم حذف القسم:', catId);
    return true;
  } catch (e) {
    console.error('[data.js] خطأ في الحذف:', e);
    return false;
  }
}

// ============================================
//   نظام الترجمة الاحترافي المتكامل v2.0
// ============================================
const LANGUAGES = {
ar: {
code: 'ar',
name: 'العربية',
flag: '🇸🇦',
dir: 'rtl',
nativeName: 'العربية',
translations: {
'store_name': 'هود كوم',
'store_slogan': 'كل ما تحتاجه في مكان واحد',
'store_description': 'شحن ألعاب واشتراكات وبرامج بأسعار منافسة مع توصيل فوري وضمان كامل',
'search': 'بحث',
'search_placeholder': 'ابحث عن منتج...',
'no_results': 'لا توجد نتائج',
'results_found': 'نتيجة',
'results_found_plural': 'نتائج',
'all_categories': 'جميع الأقسام',
'sort_by': 'ترتيب حسب',
'sort_price_asc': 'السعر: من الأقل للأعلى',
'sort_price_desc': 'السعر: من الأعلى للأقل',
'sort_name_asc': 'الاسم: أ-ي',
'sort_name_desc': 'الاسم: ي-أ',
'filter': 'تصفية',
'clear_filters': 'إلغاء التصفية',
'available': 'متوفر',
'unavailable': 'غير متوفر',
'coming_soon': 'قريباً',
'categories': 'الأقسام',
'browse_categories': 'تصفح أقسامنا',
'choose_category': 'اختر القسم وادخل لشراء منتجاتك',
'menu_home': 'الرئيسية',
'menu_categories': 'الأقسام',
'menu_contact': 'تواصل معنا',
'menu_support': 'خدمة العملاء',
'menu_admin': 'الإدارة العامة',
'menu_channel': 'قناة الواتساب',
'menu_language': 'اللغة',
'btn_shop': 'تسوق الآن',
'btn_buy': 'شراء',
'btn_save': 'حفظ',
'btn_cancel': 'إلغاء',
'btn_add': 'إضافة',
'btn_edit': 'تعديل',
'btn_delete': 'حذف',
'btn_load_more': 'تحميل المزيد',
'btn_close': 'إغلاق',
'btn_confirm': 'تأكيد',
'btn_submit': 'إرسال',
'btn_back': 'عودة',
'btn_next': 'التالي',
'btn_previous': 'السابق',
'btn_clear': 'مسح',
'btn_reset': 'إعادة تعيين',
'btn_apply': 'تطبيق',
'btn_continue': 'متابعة',
'form_name': 'الاسم',
'form_phone': 'رقم الهاتف',
'form_governorate': 'المحافظة',
'form_city': 'المدينة / المنطقة',
'form_address': 'العنوان',
'form_wallet': 'اختر المحفظة',
'form_optional': 'اختياري',
'form_required': 'مطلوب',
'form_enter_name': 'أدخل اسمك',
'form_enter_phone': 'أدخل رقم الهاتف',
'form_enter_governorate': 'أدخل المحافظة',
'form_enter_city': 'أدخل المدينة',
'form_enter_address': 'أدخل العنوان',
'form_select_wallet': 'اختر المحفظة المناسبة',
'toast_saved': 'تم الحفظ بنجاح',
'toast_deleted': 'تم الحذف بنجاح',
'toast_error': 'حدث خطأ',
'toast_loading': 'جاري التحميل...',
'toast_success': 'تمت العملية بنجاح',
'toast_warning': 'تنبيه',
'toast_info': 'معلومة',
'toast_copied': 'تم النسخ',
'toast_uploaded': 'تم الرفع',
'toast_updated': 'تم التحديث',
'home_title': 'لسنا الوحيدين ولكننا',
'home_title_highlight': 'الأفضل',
'home_subtitle': 'شحن ألعاب واشتراكات وبرامج بأسعار منافسة مع توصيل فوري وضمان كامل',
'featured_badge': 'عروض حصرية',
'home_featured': 'العروض المميزة',
'home_trust_delivery': 'توصيل فوري',
'home_trust_secure': 'دفع آمن',
'home_trust_support': 'دعم 24/7',
'home_trust_guarantee': 'ضمان كامل',
'home_trust_original': 'أصلية 100%',
'home_contact_title': 'قنوات الدعم الرسمية',
'home_contact_subtitle': 'نحن في خدمتك على مدار الساعة',
'footer_about': 'كل ما تحتاجه في مكان واحد',
'footer_rights': 'جميع الحقوق محفوظة',
'footer_contact': 'تواصل معنا',
'admin_title': 'لوحة التحكم السحابية',
'admin_subtitle': 'متصلة بقاعدة بيانات Supabase',
'admin_categories': 'الأقسام',
'admin_items': 'المنتجات',
'admin_offers': 'العروض',
'admin_wallets': 'المحافظ',
'admin_contacts': 'جهات التواصل',
'admin_custom_fields': 'حقول مخصصة',
'admin_featured': 'العروض المميزة',
'admin_settings': 'الإعدادات',
'admin_backup': 'حفظ',
'admin_add_category': 'إضافة قسم جديد',
'admin_add_item': 'إضافة منتج جديد',
'admin_add_offer': 'إضافة عرض جديد',
'admin_manage_wallets': 'إدارة المحافظ الإلكترونية',
'admin_alert': 'جميع التغييرات تُحفظ تلقائياً. الصور تُضغط تلقائياً لتوفير المساحة.',
'error_required_fields': 'يرجى تعبئة جميع الحقول المطلوبة',
'error_invalid_data': 'بيانات غير صالحة',
'error_connection': 'فشل الاتصال، تحقق من الإنترنت',
'error_not_found': 'العنصر غير موجود',
'error_permission': 'ليس لديك صلاحية',
'error_timeout': 'انتهت المهلة، حاول مرة أخرى',
'buy_title': 'إتمام الشراء',
'buy_subtitle': 'أدخل بيانات الطلب واختر المحفظة لتسجيل الطلب داخل الموقع',
'buy_notice': 'سيتم تسجيل طلبك داخل الموقع فقط ولن يتم تحويلك إلى واتساب. يمكنك متابعة الطلب من حسابك وسيتم التواصل معك عند الحاجة.',
'buy_notice_title': '🔒 ملاحظة هامة:',
'buy_wallet_desc': 'سيتم حفظ تفاصيل الطلب في لوحة الإدارة',
'login_required_purchase': 'يجب تسجيل الدخول أولاً من صفحة تسجيل الدخول لإتمام الشراء',
'order_saving': 'جاري تسجيل الطلب...',
'order_saved_success': 'تم تسجيل طلبك بنجاح، سيتم مراجعته من الإدارة',
'order_save_failed': 'تعذر تسجيل الطلب حالياً، يرجى المحاولة لاحقاً',
'buy_total': 'إجمالي الطلب',
'buy_send_whatsapp': 'تأكيد الطلب',
'buy_returning_customer': 'عميل سابق - بياناتك محفوظة لدينا',
'buy_returning_desc': 'آخر عملية شراء لك كانت',
'buy_returning_use': 'استخدام نفس البيانات من آخر طلب',
'buy_returning_confirmed': 'سيتم إخطار الإدارة تلقائياً بأنك تواصلت معنا مسبقاً',
'buy_wallet_account': 'رقم الحساب للتحويل',
'buy_wallet_choose': 'اختر المحفظة التي تريد الدفع منها',
'popup_warning_title': '⚠️ تنبيه مهم قبل الشراء',
'popup_warning_content': 'يرجى قراءة التعليمات التالية بعناية قبل إتمام عملية الشراء. هذا يضمن لك تجربة سلسة وسريعة.',
'popup_howto_title': '🎮 كيفية إدخال البيانات',
'popup_howto_content': '1️⃣ افتح اللعبة على جهازك\n2️⃣ انسخ الـ ID الخاص بحسابك\n3️⃣ الصقه في خانة الـ ID في نموذج الشراء\n4️⃣ أكمل عملية الدفع وانتظر التوصيل الفوري',
'dynamic_fields_title': 'بيانات مطلوبة لـ {item}',
'field_id': 'ID الخاص بك',
'field_id_placeholder': 'أدخل الـ ID',
'field_note': 'ملاحظات إضافية',
'field_note_placeholder': 'أي تفاصيل تريد إضافتها...',
'status_available': 'متوفر',
'status_unavailable': 'غير متوفر',
'status_coming_soon': 'قريباً',
'select_category': 'اختر المنتج',
'select_category_first': '-- اختر المنتج --',
'select_category_empty': '-- أضف منتجات أولاً --',
'select_wallet': 'اختر المحفظة',
'select_language': 'اختر اللغة',
'select_theme': 'اختر المظهر',
'back_to_site': 'العودة للموقع',
'add_category': 'إضافة قسم جديد',
'category_name': 'اسم القسم',
'category_desc': 'الوصف',
'category_image': 'صورة القسم',
'click_upload': 'اضغط لاختيار صورة (سيتم ضغطها تلقائياً)',
'current_categories': 'الأقسام الحالية',
'add_item': 'إضافة منتج جديد',
'item_name': 'اسم المنتج',
'item_desc': 'الوصف',
'item_image': 'صورة المنتج',
'manage_items': 'إدارة المنتجات',
'add_offer': 'إضافة عرض جديد',
'offer_name': 'اسم العرض',
'offer_price': 'السعر الحالي (ريال يمني)',
'offer_old_price': 'السعر القديم',
'offer_desc': 'الوصف (اختياري)',
'offer_currency': 'العملة الأساسية',
'offer_image': 'صورة العرض',
'manage_offers': 'إدارة العروض',
'wallet_name': 'اسم المحفظة',
'wallet_number': 'رقم الحساب',
'wallet_image': 'صورة المحفظة',
'add_wallet': 'إضافة محفظة جديدة',
'manage_wallets': 'إدارة المحافظ الإلكترونية',
'contacts': 'جهات التواصل',
'add_contact': '+ إضافة جهة اتصال',
'custom_fields': 'حقول الصفحة الرئيسية',
'add_custom_field': '+ إضافة حقل',
'featured_offers': 'العروض المميزة',
'add_featured': '+ اختيار عرض/منتج مميز',
'settings_contact': 'أرقام التواصل الرسمية',
'whatsapp_main': 'رقم الواتساب الرئيسي (للدعم)',
'support_number': 'رقم خدمة العملاء',
'admin_number': 'رقم الإدارة',
'whatsapp_channel': 'رابط قناة الواتساب الرسمية',
'save_contacts': 'حفظ أرقام التواصل',
'currency_settings': 'إعدادات العملة',
'currency_mode': 'وضع عرض الأسعار',
'currency_mode_single': 'عملة واحدة فقط',
'currency_mode_multi': 'جميع العملات معاً',
'default_currency': 'العملة الأساسية',
'active_currencies': 'العملات النشطة',
'exchange_rates': 'أسعار الصرف التقريبية (مقابل 100 ريال يمني)',
'save_currency': 'حفظ إعدادات العملة',
'display_settings': 'إعدادات العرض',
'offers_per_page': 'عدد المنتجات في الصفحة',
'hide_unavailable': 'إخفاء المنتجات غير المتوفرة',
'save_display': 'حفظ إعدادات العرض',
'about_us': 'نبذة "من نحن"',
'enable_about': 'تفعيل عرض نبذة "من نحن" في الموقع',
'about_text': 'نص نبذة "من نحن"',
'about_position': 'مكان ظهور نبذة "من نحن"',
'about_position_top': 'أعلى الصفحة (بعد الهيرو)',
'about_position_middle': 'وسط الصفحة (بين المنتجات والأقسام الأخرى)',
'about_position_bottom': 'أسفل الصفحة (قبل الفوتر)',
'save_about': 'حفظ نبذة "من نحن"',
'general_settings': 'إعدادات عامة',
'enable_watermark': 'تفعيل العلامة المائية على صور المنتجات والعروض',
'watermark_opacity': 'شفافية العلامة المائية',
'enable_returning': 'تفعيل ميزة "العميل السابق"',
'save_general': 'حفظ الإعدادات العامة',
'backup_export': 'تصدير نسخة احتياطية',
'backup_export_desc': 'احفظ نسخة من بياناتك لاسترجاعها لاحقاً',
'copy_data': 'نسخ البيانات للحافظة',
'backup_import': 'استرجاع نسخة احتياطية',
'backup_import_desc': 'ألصق هنا البيانات المحفوظة سابقاً',
'paste_data': 'ألصق البيانات هنا...',
'import_data': 'استرجاع البيانات',
'danger_zone': 'منطقة الخطر',
'delete_all': 'حذف جميع البيانات نهائياً',
'delete_all_confirm': 'حذف جميع البيانات',
'confirm_delete': 'تأكيد الحذف',
'are_you_sure': 'هل أنت متأكد؟',
'category_delete_warning': 'سيتم حذف القسم وجميع منتجاته. هل أنت متأكد؟',
'item_delete_warning': 'سيتم حذف المنتج. هل أنت متأكد؟',
'offer_delete_warning': 'هل أنت متأكد من حذف هذا العرض؟',
'wallet_delete_warning': 'سيتم حذف المحفظة نهائياً. هل أنت متأكد؟',
'wallet_disable_warning': 'سيتم تعطيل المحفظة فقط. هل تريد المتابعة؟',
'data_delete_warning': 'سيتم حذف جميع البيانات نهائياً! هل أنت متأكد؟',
'data_delete_final': 'تأكيد أخير: حذف نهائي!',
'select_wallet_placeholder': 'اختر المحفظة المطلوبة',
'edit_category': 'تعديل القسم',
'edit_item': 'تعديل المنتج',
'edit_offer': 'تعديل العرض',
'edit_wallet': 'تعديل المحفظة',
'move_item': 'نقل المنتج',
'move_to': 'اختر القسم المراد النقل إليه:',
'fields_management': 'الحقول الديناميكية للمنتج',
'fields_desc': 'الحقول الديناميكية هي الحقول التي يطلبها العميل عند الشراء (مثل ID اللعبة، الرابط، ملاحظات إضافية). إذا تركت فارغاً، سيتم استخدام الحقول الافتراضية (ID + ملاحظات).',
'add_field': 'إضافة حقل جديد',
'field_types': 'أنواع الحقول:',
'field_type_text': 'نص: حقل نصي عام',
'field_type_number': 'رقم: حقل رقمي',
'field_type_id': 'ID: حقل مخصص لـ ID اللعبة',
'field_type_link': 'رابط: حقل لإدخال رابط',
'field_type_note': 'ملاحظة: ملاحظات إضافية',
'field_label': 'اسم الحقل',
'field_type': 'نوع الحقل',
'field_placeholder': 'تلميح (Placeholder)',
'field_required': 'حقل مطلوب',
'field_saved': 'تم حفظ الحقول المخصصة ({count} حقل)',
'search_results': 'نتائج البحث',
'search_for': 'بحث عن',
'search_clear': 'مسح البحث',
'search_filters_title': 'فلاتر البحث',
'loading': 'جاري التحميل...',
'please_wait': 'يرجى الانتظار',
'no_categories': 'لا توجد أقسام',
'no_items': 'لا توجد منتجات',
'no_offers': 'لا توجد عروض',
'no_wallets': 'لا توجد محافظ',
'no_contacts': 'لا توجد جهات اتصال',
'no_fields': 'لا توجد حقول مخصصة',
'no_featured': 'لا توجد عروض مميزة',
'starting_from': 'تبدأ من',
'order_now': 'اطلب الآن',
'select_offer': 'اختر العرض المناسب لك',
'item_details': 'تفاصيل المنتج',
'out_of_stock': 'غير متوفر',
'nav_home': 'الرئيسية',
'nav_categories': 'الأقسام',
'nav_contact': 'تواصل معنا',
'nav_support': 'خدمة العملاء',
'nav_channel': 'قناة الواتساب',
'nav_admin': 'الإدارة',
'footer_copyright': 'جميع الحقوق محفوظة',
'whatsapp_confirm': 'سيتم تسجيل الطلب داخل الموقع. هل تريد المتابعة؟'
}
},
en: {
code: 'en',
name: 'English',
flag: '🇺🇸',
dir: 'ltr',
nativeName: 'English',
translations: {
'store_name': 'Hood Com',
'store_slogan': 'Everything you need in one place',
'store_description': 'Game top-up, subscriptions, and software with competitive prices, instant delivery, and full guarantee',
'search': 'Search',
'search_placeholder': 'Search for a product...',
'no_results': 'No results found',
'results_found': 'result',
'results_found_plural': 'results',
'all_categories': 'All Categories',
'sort_by': 'Sort by',
'sort_price_asc': 'Price: Low to High',
'sort_price_desc': 'Price: High to Low',
'sort_name_asc': 'Name: A-Z',
'sort_name_desc': 'Name: Z-A',
'filter': 'Filter',
'clear_filters': 'Clear Filters',
'available': 'Available',
'unavailable': 'Unavailable',
'coming_soon': 'Coming Soon',
'categories': 'Categories',
'browse_categories': 'Browse Our Categories',
'choose_category': 'Choose a category to start shopping',
'menu_home': 'Home',
'menu_categories': 'Categories',
'menu_contact': 'Contact Us',
'menu_support': 'Support',
'menu_admin': 'Management',
'menu_channel': 'WhatsApp Channel',
'menu_language': 'Language',
'btn_shop': 'Shop Now',
'btn_buy': 'Buy',
'btn_save': 'Save',
'btn_cancel': 'Cancel',
'btn_add': 'Add',
'btn_edit': 'Edit',
'btn_delete': 'Delete',
'btn_load_more': 'Load More',
'btn_close': 'Close',
'btn_confirm': 'Confirm',
'btn_submit': 'Submit',
'btn_back': 'Back',
'btn_next': 'Next',
'btn_previous': 'Previous',
'btn_clear': 'Clear',
'btn_reset': 'Reset',
'btn_apply': 'Apply',
'btn_continue': 'Continue',
'form_name': 'Name',
'form_phone': 'Phone Number',
'form_governorate': 'Governorate',
'form_city': 'City / Area',
'form_address': 'Address',
'form_wallet': 'Choose Wallet',
'form_optional': 'Optional',
'form_required': 'Required',
'form_enter_name': 'Enter your name',
'form_enter_phone': 'Enter phone number',
'form_enter_governorate': 'Enter governorate',
'form_enter_city': 'Enter city',
'form_enter_address': 'Enter address',
'form_select_wallet': 'Choose the appropriate wallet',
'toast_saved': 'Saved successfully',
'toast_deleted': 'Deleted successfully',
'toast_error': 'An error occurred',
'toast_loading': 'Loading...',
'toast_success': 'Operation successful',
'toast_warning': 'Warning',
'toast_info': 'Info',
'toast_copied': 'Copied',
'toast_uploaded': 'Uploaded',
'toast_updated': 'Updated',
'home_title': 'We are not the only ones, but we are',
'home_title_highlight': 'the best',
'home_subtitle': 'Game top-up, subscriptions, and software with competitive prices, instant delivery, and full guarantee',
'featured_badge': 'Exclusive Offers',
'home_featured': 'Featured Offers',
'home_trust_delivery': 'Instant Delivery',
'home_trust_secure': 'Secure Payment',
'home_trust_support': '24/7 Support',
'home_trust_guarantee': 'Full Guarantee',
'home_trust_original': '100% Original',
'home_contact_title': 'Official Support Channels',
'home_contact_subtitle': 'We are at your service 24/7',
'footer_about': 'Everything you need in one place',
'footer_rights': 'All rights reserved',
'footer_contact': 'Contact Us',
'admin_title': 'Cloud Control Panel',
'admin_subtitle': 'Connected to Supabase Database',
'admin_categories': 'Categories',
'admin_items': 'Products',
'admin_offers': 'Offers',
'admin_wallets': 'Wallets',
'admin_contacts': 'Contacts',
'admin_custom_fields': 'Custom Fields',
'admin_featured': 'Featured Offers',
'admin_settings': 'Settings',
'admin_backup': 'Backup',
'admin_add_category': 'Add New Category',
'admin_add_item': 'Add New Product',
'admin_add_offer': 'Add New Offer',
'admin_manage_wallets': 'Manage Digital Wallets',
'admin_alert': 'All changes are saved automatically. Images are compressed automatically to save space.',
'error_required_fields': 'Please fill in all required fields',
'error_invalid_data': 'Invalid data',
'error_connection': 'Connection failed, check your internet',
'error_not_found': 'Item not found',
'error_permission': 'You do not have permission',
'error_timeout': 'Timeout, please try again',
'buy_title': 'Complete Purchase',
'buy_subtitle': 'Enter the order details and choose a wallet to save the order on the site',
'buy_notice': 'Your order will be saved on the site only and you will not be redirected to WhatsApp. You can follow the order from your account and we will contact you if needed.',
'buy_notice_title': '🔒 Important Notice:',
'buy_wallet_desc': 'Order details will be saved in the admin dashboard',
'login_required_purchase': 'Please log in first from the login page to complete the purchase',
'order_saving': 'Saving order...',
'order_saved_success': 'Your order has been saved successfully and will be reviewed by the administration',
'order_save_failed': 'Unable to save the order right now. Please try again later',
'buy_total': 'Order Total',
'buy_send_whatsapp': 'Confirm Order',
'buy_returning_customer': 'Returning Customer - Your data is saved with us',
'buy_returning_desc': 'Your last purchase was',
'buy_returning_use': 'Use the same data from your last order',
'buy_returning_confirmed': 'Management will be automatically notified that you have contacted us before',
'buy_wallet_account': 'Account Number for Transfer',
'buy_wallet_choose': 'Choose the wallet you want to pay from',
'popup_warning_title': '⚠️ Important Notice Before Purchase',
'popup_warning_content': 'Please read the following instructions carefully before completing your purchase. This ensures a smooth and fast experience.',
'popup_howto_title': '🎮 How to Enter Data',
'popup_howto_content': '1️⃣ Open the game on your device\n2️⃣ Copy your account ID\n3️⃣ Paste it in the ID field in the purchase form\n4️⃣ Complete the payment and wait for instant delivery',
'dynamic_fields_title': 'Required data for {item}',
'field_id': 'Your ID',
'field_id_placeholder': 'Enter your ID',
'field_note': 'Additional Notes',
'field_note_placeholder': 'Any additional details...',
'status_available': 'Available',
'status_unavailable': 'Unavailable',
'status_coming_soon': 'Coming Soon',
'select_category': 'Select Product',
'select_category_first': '-- Select Product --',
'select_category_empty': '-- Add products first --',
'select_wallet': 'Choose Wallet',
'select_language': 'Choose Language',
'select_theme': 'Choose Theme',
'back_to_site': 'Back to Site',
'add_category': 'Add New Category',
'category_name': 'Category Name',
'category_desc': 'Description',
'category_image': 'Category Image',
'click_upload': 'Click to choose image (will be compressed automatically)',
'current_categories': 'Current Categories',
'add_item': 'Add New Product',
'item_name': 'Product Name',
'item_desc': 'Description',
'item_image': 'Product Image',
'manage_items': 'Manage Products',
'add_offer': 'Add New Offer',
'offer_name': 'Offer Name',
'offer_price': 'Current Price (YER)',
'offer_old_price': 'Old Price',
'offer_desc': 'Description (Optional)',
'offer_currency': 'Base Currency',
'offer_image': 'Offer Image',
'manage_offers': 'Manage Offers',
'wallet_name': 'Wallet Name',
'wallet_number': 'Account Number',
'wallet_image': 'Wallet Image',
'add_wallet': 'Add New Wallet',
'manage_wallets': 'Manage Digital Wallets',
'contacts': 'Contacts',
'add_contact': '+ Add Contact',
'custom_fields': 'Home Custom Fields',
'add_custom_field': '+ Add Field',
'featured_offers': 'Featured Offers',
'add_featured': '+ Select Featured Item',
'settings_contact': 'Official Contact Numbers',
'whatsapp_main': 'Main WhatsApp Number (Support)',
'support_number': 'Support Number',
'admin_number': 'Admin Number',
'whatsapp_channel': 'Official WhatsApp Channel Link',
'save_contacts': 'Save Contact Numbers',
'currency_settings': 'Currency Settings',
'currency_mode': 'Price Display Mode',
'currency_mode_single': 'Single Currency Only',
'currency_mode_multi': 'All Currencies Together',
'default_currency': 'Default Currency',
'active_currencies': 'Active Currencies',
'exchange_rates': 'Exchange Rates (per 100 YER)',
'save_currency': 'Save Currency Settings',
'display_settings': 'Display Settings',
'offers_per_page': 'Products per Page',
'hide_unavailable': 'Hide Unavailable Products',
'save_display': 'Save Display Settings',
'about_us': 'About Us',
'enable_about': 'Enable "About Us" Section',
'about_text': 'About Us Text',
'about_position': 'About Us Position',
'about_position_top': 'Top (After Hero)',
'about_position_middle': 'Middle (Between Products)',
'about_position_bottom': 'Bottom (Before Footer)',
'save_about': 'Save About Us',
'general_settings': 'General Settings',
'enable_watermark': 'Enable Watermark on Images',
'watermark_opacity': 'Watermark Opacity',
'enable_returning': 'Enable Returning Customer Feature',
'save_general': 'Save General Settings',
'backup_export': 'Export Backup',
'backup_export_desc': 'Save a copy of your data for later recovery',
'copy_data': 'Copy Data to Clipboard',
'backup_import': 'Import Backup',
'backup_import_desc': 'Paste previously saved data here',
'paste_data': 'Paste data here...',
'import_data': 'Import Data',
'danger_zone': 'Danger Zone',
'delete_all': 'Delete All Data Permanently',
'delete_all_confirm': 'Delete All Data',
'confirm_delete': 'Confirm Delete',
'are_you_sure': 'Are you sure?',
'category_delete_warning': 'This will delete the category and all its products. Are you sure?',
'item_delete_warning': 'This will delete the item. Are you sure?',
'offer_delete_warning': 'Are you sure you want to delete this offer?',
'wallet_delete_warning': 'This will permanently delete the wallet. Are you sure?',
'wallet_disable_warning': 'This will only disable the wallet. Do you want to continue?',
'data_delete_warning': 'This will delete all data permanently! Are you sure?',
'data_delete_final': 'Final confirmation: Permanent deletion!',
'select_wallet_placeholder': 'Select the required wallet',
'edit_category': 'Edit Category',
'edit_item': 'Edit Product',
'edit_offer': 'Edit Offer',
'edit_wallet': 'Edit Wallet',
'move_item': 'Move Product',
'move_to': 'Select the category to move to:',
'fields_management': 'Dynamic Product Fields',
'fields_desc': 'Dynamic fields are fields requested from the customer at purchase (e.g., Game ID, Link, Additional Notes). If left empty, default fields will be used (ID + Notes).',
'add_field': 'Add New Field',
'field_types': 'Field Types:',
'field_type_text': 'Text: General text field',
'field_type_number': 'Number: Numeric field',
'field_type_id': 'ID: Game ID field',
'field_type_link': 'Link: URL field',
'field_type_note': 'Note: Additional notes',
'field_label': 'Field Label',
'field_type': 'Field Type',
'field_placeholder': 'Placeholder',
'field_required': 'Required Field',
'field_saved': 'Custom fields saved ({count} fields)',
'search_results': 'Search Results',
'search_for': 'Search for',
'search_clear': 'Clear Search',
'search_filters_title': 'Search Filters',
'loading': 'Loading...',
'please_wait': 'Please wait',
'no_categories': 'No categories',
'no_items': 'No products',
'no_offers': 'No offers',
'no_wallets': 'No wallets',
'no_contacts': 'No contacts',
'no_fields': 'No custom fields',
'no_featured': 'No featured offers',
'starting_from': 'Starting from',
'order_now': 'Order Now',
'select_offer': 'Choose the right offer for you',
'item_details': 'Product Details',
'out_of_stock': 'Out of Stock',
'nav_home': 'Home',
'nav_categories': 'Categories',
'nav_contact': 'Contact',
'nav_support': 'Support',
'nav_channel': 'Channel',
'nav_admin': 'Admin',
'footer_copyright': 'All rights reserved',
'whatsapp_confirm': 'The order will be saved on the site. Do you want to continue?'
}
}
};

let currentLanguage = 'ar';
const LANGUAGE_KEY = 'hud_language';

function loadLanguage() {
try {
const stored = localStorage.getItem(LANGUAGE_KEY);
if (stored && LANGUAGES[stored]) {
currentLanguage = stored;
}
} catch (e) {}
return currentLanguage;
}

function saveLanguage(lang) {
try {
localStorage.setItem(LANGUAGE_KEY, lang);
currentLanguage = lang;
document.documentElement.lang = lang;
document.documentElement.dir = LANGUAGES[lang] ? LANGUAGES[lang].dir : 'rtl';
} catch (e) {}
}

function t(key, replacements) {
const lang = LANGUAGES[currentLanguage];
if (!lang) return key;
let translation = lang.translations[key];
if (!translation) return key;
if (replacements) {
Object.keys(replacements).forEach(function(varName) {
translation = translation.replace(new RegExp('\\{' + varName + '\\}', 'g'), replacements[varName]);
});
}
return translation;
}

function getCurrentLanguage() {
return currentLanguage;
}

function getLanguageInfo(code) {
return LANGUAGES[code] || null;
}

function getAvailableLanguages() {
return Object.keys(LANGUAGES).map(function(code) {
return {
code: code,
name: LANGUAGES[code].name,
flag: LANGUAGES[code].flag,
nativeName: LANGUAGES[code].nativeName,
dir: LANGUAGES[code].dir
};
});
}

function applyLanguage() {
const lang = LANGUAGES[currentLanguage];
if (!lang) return;
document.documentElement.lang = currentLanguage;
document.documentElement.dir = lang.dir;
document.documentElement.setAttribute('dir', lang.dir);
document.documentElement.setAttribute('data-lang', currentLanguage);

document.querySelectorAll('[data-i18n]').forEach(function(el) {
const key = el.getAttribute('data-i18n');
const translation = t(key);
if (translation && translation !== key) {
el.textContent = translation;
}
});

document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
const key = el.getAttribute('data-i18n-html');
const translation = t(key);
if (translation && translation !== key) {
el.innerHTML = translation;
}
});

document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
const key = el.getAttribute('data-i18n-placeholder');
const translation = t(key);
if (translation && translation !== key) {
el.placeholder = translation;
}
});

document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
const key = el.getAttribute('data-i18n-title');
const translation = t(key);
if (translation && translation !== key) {
el.title = translation;
}
});

document.querySelectorAll('[data-i18n-alt]').forEach(function(el) {
const key = el.getAttribute('data-i18n-alt');
const translation = t(key);
if (translation && translation !== key) {
el.alt = translation;
}
});

document.querySelectorAll('.lang-btn').forEach(function(btn) {
const langCode = btn.getAttribute('data-lang');
btn.classList.toggle('active', langCode === currentLanguage);
});

const mainLangBtn = document.getElementById('mainLanguageBtn');
if (mainLangBtn) {
const currentLangInfo = LANGUAGES[currentLanguage];
if (currentLangInfo) {
mainLangBtn.innerHTML = currentLangInfo.flag + ' ' + currentLangInfo.name;
}
}

if (typeof injectIcons === 'function') {
injectIcons();
}
}

function createLanguageDropdown() {
const container = document.getElementById('languageDropdownContainer');
if (!container) return;
const languages = getAvailableLanguages();
const currentLangInfo = getLanguageInfo(currentLanguage);

let html = '<div class="lang-dropdown-wrapper">';
html += '<button class="lang-main-btn" id="mainLanguageBtn" onclick="toggleLanguageDropdown()" aria-label="' + t('menu_language') + '">';
html += currentLangInfo ? currentLangInfo.flag + ' ' + currentLangInfo.name : '🌐 ' + t('menu_language');
html += ' <span class="lang-arrow">▼</span>';
html += '</button>';
html += '<div class="lang-dropdown" id="languageDropdown">';
languages.forEach(function(lang) {
const isActive = lang.code === currentLanguage;
html += '<button class="lang-option' + (isActive ? ' active' : '') + '" data-lang="' + lang.code + '" onclick="switchLanguage(\'' + lang.code + '\')">';
html += '<span class="lang-flag">' + lang.flag + '</span>';
html += '<span class="lang-name">' + lang.name + '</span>';
html += '<span class="lang-native">' + lang.nativeName + '</span>';
if (isActive) {
html += '<span class="lang-check">✓</span>';
}
html += '</button>';
});
html += '</div>';
html += '</div>';
container.innerHTML = html;

document.addEventListener('click', function(e) {
const dropdown = document.getElementById('languageDropdown');
const wrapper = container.querySelector('.lang-dropdown-wrapper');
if (dropdown && wrapper) {
if (!wrapper.contains(e.target)) {
dropdown.classList.remove('open');
}
}
});
}

function toggleLanguageDropdown() {
const dropdown = document.getElementById('languageDropdown');
if (dropdown) {
dropdown.classList.toggle('open');
}
}

function closeLanguageDropdown() {
const dropdown = document.getElementById('languageDropdown');
if (dropdown) {
dropdown.classList.remove('open');
}
}

function switchLanguage(langCode) {
if (!LANGUAGES[langCode]) return;
saveLanguage(langCode);
applyLanguage();

const mainBtn = document.getElementById('mainLanguageBtn');
if (mainBtn) {
const langInfo = LANGUAGES[langCode];
mainBtn.innerHTML = langInfo.flag + ' ' + langInfo.name;
}

document.querySelectorAll('.lang-btn').forEach(function(btn) {
const lang = btn.getAttribute('data-lang');
btn.classList.toggle('active', lang === langCode);
});

closeLanguageDropdown();

if (typeof showToast === 'function') {
showToast(t('toast_success') + ' - ' + LANGUAGES[langCode].name);
}

if (typeof refreshDynamicContent === 'function') {
refreshDynamicContent();
}
}

function refreshDynamicContent() {
if (typeof renderHomeCategories === 'function') {
renderHomeCategories();
}
if (typeof renderMenuCategories === 'function') {
renderMenuCategories();
}
if (typeof renderDynamicContacts === 'function') {
renderDynamicContacts();
}
if (typeof renderFeaturedOffers === 'function') {
renderFeaturedOffers();
}
if (typeof renderHomeCustomFields === 'function') {
renderHomeCustomFields();
}
if (document.getElementById('categoriesList')) {
if (typeof renderCategoriesList === 'function') {
renderCategoriesList();
}
if (typeof renderItemsList === 'function') {
renderItemsList();
}
if (typeof renderOffersList === 'function') {
renderOffersList();
}
if (typeof renderWalletsList === 'function') {
renderWalletsList();
}
if (typeof renderContactsList === 'function') {
renderContactsList();
}
if (typeof renderCustomFieldsList === 'function') {
renderCustomFieldsList();
}
if (typeof renderFeaturedList === 'function') {
renderFeaturedList();
}
}
}

function initTranslationSystem() {
loadLanguage();
createLanguageDropdown();
applyLanguage();

document.addEventListener('keydown', function(e) {
if (e.key === 'Escape') {
closeLanguageDropdown();
}
});
}

// ===== تهيئة الإعدادات عند البدء =====
loadSiteSettings();
loadWalletSettings();
loadWalletImages();
loadLanguage();

// ===== تصدير الدوال للاستخدام الخارجي =====
window.t = t;
window.applyLanguage = applyLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.getAvailableLanguages = getAvailableLanguages;
window.getLanguageInfo = getLanguageInfo;
window.LANGUAGES = LANGUAGES;
window.saveLanguage = saveLanguage;
window.loadLanguage = loadLanguage;
window.switchLanguage = switchLanguage;
window.toggleLanguageDropdown = toggleLanguageDropdown;
window.closeLanguageDropdown = closeLanguageDropdown;
window.refreshDynamicContent = refreshDynamicContent;
window.createLanguageDropdown = createLanguageDropdown;
window.initTranslationSystem = initTranslationSystem;


Object.defineProperty(window, 'categories', { configurable: true, get: function(){ return categories; }, set: function(v){ categories = Array.isArray(v) ? v : []; } });
Object.defineProperty(window, 'db', { configurable: true, get: function(){ return db; }, set: function(v){ db = v; } });
Object.defineProperty(window, 'siteSettings', { configurable: true, get: function(){ return siteSettings; }, set: function(v){ siteSettings = v || {}; } });
Object.defineProperty(window, 'WALLETS', { configurable: true, get: function(){ return WALLETS; }, set: function(v){ WALLETS = Array.isArray(v) ? v : []; } });
window.CURRENCIES = CURRENCIES;
window.DEFAULT_CURRENCY = DEFAULT_CURRENCY;
window.DEFAULT_WHATSAPP_NUMBER = DEFAULT_WHATSAPP_NUMBER;
window.DEFAULT_SUPPORT_NUMBER = DEFAULT_SUPPORT_NUMBER;
window.DEFAULT_WHATSAPP_CHANNEL = DEFAULT_WHATSAPP_CHANNEL;

// ===== تصدير الدوال للاستخدام الخارجي =====
window.saveSiteSettingsToFirebase = saveSiteSettingsToFirebase;


// =========================================================
// نظام إدارة تغذية الرصيد والاسترداد (V1)
// =========================================================
const TOPUP_SETTINGS_KEY = 'hud_topup_settings';
const TOPUP_TXS_KEY = 'hud_topup_transactions';

let TOPUP_SETTINGS = {
  accountName: 'هود فيصل مصلح العماري',
  phone1: '00967783708724',
  phone2: '00967717510727',
  depositInstructions: 'قم بتحويل المبلغ المطلوب إيداعه إلى أحد الحسابات أو الأرقام أدناه، ثم اختر المحفظة واملأ النموذج ليتم تغذية حسابك في أقرب وقت.',
  withdrawInstructions: 'اختر طريقة السحب المناسبة واضغط عليها لتقديم طلب استرداد رصيدك إلى محفظتك أو حسابك الخارجي.',
  withdrawMethods: [
    { id: 'wm_jeeb', title: 'استرداد إلى حسابي محفظة جيب', image: '', enabled: true, minAmount: 1000, order: 1 },
    { id: 'wm_krimi', title: 'استرداد إلى حسابي كريمي جوالي', image: '', enabled: true, minAmount: 1000, order: 2 },
    { id: 'wm_onecash', title: 'استرداد إلى حسابي ون كاش', image: '', enabled: true, minAmount: 1000, order: 3 },
    { id: 'wm_floosak', title: 'استرداد إلى حسابي فلوسك', image: '', enabled: true, minAmount: 1000, order: 4 },
    { id: 'wm_mahfadti', title: 'استرداد إلى حسابي محفظتي', image: '', enabled: true, minAmount: 1000, order: 5 },
    { id: 'wm_mobilemoney', title: 'استرداد إلى حسابي موبايل موني', image: '', enabled: true, minAmount: 1000, order: 6 },
    { id: 'wm_cash', title: 'استرداد إلى حسابي كاش', image: '', enabled: true, minAmount: 1000, order: 7 }
  ]
};

function loadTopupSettings() {
  try {
    const stored = localStorage.getItem(TOPUP_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.assign(TOPUP_SETTINGS, parsed);
    }
  } catch (e) { console.warn('error loading topup settings:', e); }

  try {
    const nameEl = document.getElementById('beneficiaryNameDisplay');
    const p1El = document.getElementById('phoneNum1Display');
    const p2El = document.getElementById('phoneNum2Display');
    const depInst = document.getElementById('depositInstructionsText');
    const wthInst = document.getElementById('withdrawInstructionsText');
    if (nameEl && TOPUP_SETTINGS.accountName) nameEl.textContent = TOPUP_SETTINGS.accountName;
    if (p1El && TOPUP_SETTINGS.phone1) p1El.textContent = TOPUP_SETTINGS.phone1;
    if (p2El && TOPUP_SETTINGS.phone2) p2El.textContent = TOPUP_SETTINGS.phone2;
    if (depInst && TOPUP_SETTINGS.depositInstructions) depInst.textContent = TOPUP_SETTINGS.depositInstructions;
    if (wthInst && TOPUP_SETTINGS.withdrawInstructions) wthInst.textContent = TOPUP_SETTINGS.withdrawInstructions;
  } catch(e) {}
}

function saveTopupSettings(newSettings) {
  try {
    if (newSettings) Object.assign(TOPUP_SETTINGS, newSettings);
    localStorage.setItem(TOPUP_SETTINGS_KEY, JSON.stringify(TOPUP_SETTINGS));
    if (window.firebaseDB && window.firebaseDB.db) {
      window.firebaseDB.setDoc(window.firebaseDB.doc(window.firebaseDB.db, 'settings', 'topup'), TOPUP_SETTINGS).catch(function(){});
    }
    loadTopupSettings();
    return true;
  } catch (e) {
    console.error('saveTopupSettings err:', e);
    return false;
  }
}

function getWithdrawMethods() {
  loadTopupSettings();
  return (TOPUP_SETTINGS.withdrawMethods || []).sort(function(a,b) { return (a.order || 0) - (b.order || 0); });
}

function saveWithdrawMethod(method) {
  try {
    loadTopupSettings();
    if (!TOPUP_SETTINGS.withdrawMethods) TOPUP_SETTINGS.withdrawMethods = [];
    if (!method.id) method.id = 'wm_' + Date.now();
    const idx = TOPUP_SETTINGS.withdrawMethods.findIndex(function(m) { return m.id === method.id; });
    if (idx !== -1) {
      Object.assign(TOPUP_SETTINGS.withdrawMethods[idx], method);
    } else {
      method.order = TOPUP_SETTINGS.withdrawMethods.length + 1;
      TOPUP_SETTINGS.withdrawMethods.push(method);
    }
    saveTopupSettings();
    return method;
  } catch(e) { return null; }
}

function deleteWithdrawMethod(id) {
  try {
    loadTopupSettings();
    TOPUP_SETTINGS.withdrawMethods = TOPUP_SETTINGS.withdrawMethods.filter(function(m) { return m.id !== id; });
    saveTopupSettings();
    return true;
  } catch(e) { return false; }
}

function getUserBalance(userId) {
  if (!userId) {
    const authUser = window.getCachedAuthUser ? window.getCachedAuthUser() : null;
    userId = authUser ? (authUser.uid || authUser.id || authUser.email) : 'guest';
  }
  try {
    const stored = localStorage.getItem('hud_balance_' + userId);
    return stored ? parseFloat(stored) || 0 : 0;
  } catch(e) { return 0; }
}

function updateUserBalance(userId, newBal) {
  if (!userId) {
    const authUser = window.getCachedAuthUser ? window.getCachedAuthUser() : null;
    userId = authUser ? (authUser.uid || authUser.id || authUser.email) : 'guest';
  }
  try {
    const formatted = Math.max(0, parseFloat(newBal || 0)).toFixed(2);
    localStorage.setItem('hud_balance_' + userId, formatted);
    if (window.firebaseDB && window.firebaseDB.db && userId && userId !== 'guest') {
      window.firebaseDB.updateDoc(window.firebaseDB.doc(window.firebaseDB.db, 'users', userId), { balance: parseFloat(formatted) }).catch(function(){});
    }
    if (typeof window.updateBalanceDisplayInPage === 'function') window.updateBalanceDisplayInPage();
    if (typeof window.updateBuyModalBalance === 'function') window.updateBuyModalBalance();
    return parseFloat(formatted);
  } catch(e) { return 0; }
}

function creditUserBalance(userId, amount) {
  const cur = getUserBalance(userId);
  return updateUserBalance(userId, cur + parseFloat(amount || 0));
}

function debitUserBalance(userId, amount) {
  const cur = getUserBalance(userId);
  return updateUserBalance(userId, Math.max(0, cur - parseFloat(amount || 0)));
}

function getTopupTransactions() {
  try {
    const stored = localStorage.getItem(TOPUP_TXS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch(e) { return []; }
}

async function saveTopupTransaction(tx) {
  try {
    const txs = getTopupTransactions();
    const idx = txs.findIndex(function(t) { return t.id === tx.id; });
    if (idx !== -1) {
      Object.assign(txs[idx], tx);
    } else {
      txs.unshift(tx);
    }
    localStorage.setItem(TOPUP_TXS_KEY, JSON.stringify(txs));
    
    if (window.firebaseDB && window.firebaseDB.db) {
      window.firebaseDB.setDoc(window.firebaseDB.doc(window.firebaseDB.db, 'topup_transactions', tx.id), tx).catch(function(){});
    }
    return true;
  } catch(e) { return false; }
}

async function updateTopupTransactionStatus(txId, newStatus, adminNotes) {
  try {
    const txs = getTopupTransactions();
    const tx = txs.find(function(t) { return t.id === txId; });
    if (!tx) return false;

    const oldStatus = tx.status;
    tx.status = newStatus;
    if (adminNotes !== undefined) tx.adminNotes = adminNotes;
    tx.updatedAt = new Date().toISOString();

    if (newStatus === 'approved' && oldStatus !== 'approved' && tx.type === 'deposit') {
      creditUserBalance(tx.userId, tx.amount);
      const authUser = window.getCachedAuthUser ? window.getCachedAuthUser() : null;
      const curId = authUser ? (authUser.uid || authUser.id || authUser.email) : 'guest';
      if (curId !== tx.userId && (curId === 'guest' || tx.userId === 'guest')) {
        creditUserBalance(curId, tx.amount);
      }
    }
    if (newStatus === 'rejected' && oldStatus !== 'rejected' && tx.type === 'withdraw') {
      creditUserBalance(tx.userId, tx.amount);
    }

    localStorage.setItem(TOPUP_TXS_KEY, JSON.stringify(txs));
    if (window.firebaseDB && window.firebaseDB.db) {
      window.firebaseDB.updateDoc(window.firebaseDB.doc(window.firebaseDB.db, 'topup_transactions', tx.id), { status: newStatus, adminNotes: adminNotes || '', updatedAt: tx.updatedAt }).catch(function(){});
    }
    return true;
  } catch(e) { return false; }
}

loadTopupSettings();

window.TOPUP_SETTINGS = TOPUP_SETTINGS;
window.loadTopupSettings = loadTopupSettings;
window.saveTopupSettings = saveTopupSettings;
window.getWithdrawMethods = getWithdrawMethods;
window.saveWithdrawMethod = saveWithdrawMethod;
window.deleteWithdrawMethod = deleteWithdrawMethod;
window.getUserBalance = getUserBalance;
window.updateUserBalance = updateUserBalance;
window.creditUserBalance = creditUserBalance;
window.debitUserBalance = debitUserBalance;
window.getTopupTransactions = getTopupTransactions;
window.saveTopupTransaction = saveTopupTransaction;
window.updateTopupTransactionStatus = updateTopupTransactionStatus;

// =====================================================================
// ============  V2: نظام الخدمات الديناميكية للتغذية والاسترداد =========
// =====================================================================
// كل خدمة (تغذية أو استرداد) لها:
//   { id, name/title, image, enabled, order, description,
//     type: 'deposit' | 'withdraw',
//     customFields: [ { id, label, type, required, placeholder, options[] } ] }
// يتم تخزينها في localStorage تحت مفتاح TOPUP_SERVICES_KEY
// ومزامنتها مع Supabase في collection = 'topup_services'
// =====================================================================

const TOPUP_SERVICES_KEY = 'hud_topup_services_v2';
const USER_BALANCES_KEY  = 'hud_user_balances_index';

// خدمات افتراضية (تظهر أول مرة فقط، ويستطيع الأدمن حذفها/تعديلها)
const DEFAULT_TOPUP_SERVICES = [
  {
    id: 'ds_jeeb', type: 'deposit', name: 'جيب', image: '', enabled: true, order: 1,
    description: 'قم بتحويل المبلغ إلى محفظة جيب ثم عبّئ البيانات أدناه.',
    customFields: [
      { id: 'f_amount',   label: 'المبلغ المودع (ر.ي)', type: 'number', required: true,  placeholder: 'مثال: 1000' },
      { id: 'f_sender',   label: 'رقم هاتف المرسل',      type: 'tel',    required: true,  placeholder: 'مثال: 77xxxxxxx' },
      { id: 'f_ref',      label: 'رقم الحوالة / السند',   type: 'text',   required: true,  placeholder: 'رقم العملية' },
      { id: 'f_notes',    label: 'ملاحظات',              type: 'textarea',required: false, placeholder: 'أي تفاصيل إضافية' }
    ]
  },
  {
    id: 'ds_jawali', type: 'deposit', name: 'جوالي', image: '', enabled: true, order: 2,
    description: 'قم بتحويل المبلغ إلى محفظة جوالي ثم عبّئ البيانات أدناه.',
    customFields: [
      { id: 'f_amount',   label: 'المبلغ المودع (ر.ي)', type: 'number', required: true,  placeholder: 'مثال: 1000' },
      { id: 'f_sender',   label: 'رقم هاتف المرسل',      type: 'tel',    required: true,  placeholder: 'مثال: 77xxxxxxx' },
      { id: 'f_ref',      label: 'رقم الحوالة / السند',   type: 'text',   required: true,  placeholder: 'رقم العملية' }
    ]
  },
  {
    id: 'ds_cash', type: 'deposit', name: 'كاش', image: '', enabled: true, order: 3,
    description: 'قم بتحويل المبلغ إلى محفظة كاش ثم عبّئ البيانات أدناه.',
    customFields: [
      { id: 'f_amount',   label: 'المبلغ المودع (ر.ي)', type: 'number', required: true,  placeholder: 'مثال: 1000' },
      { id: 'f_sender',   label: 'رقم هاتف المرسل',      type: 'tel',    required: true,  placeholder: 'مثال: 77xxxxxxx' },
      { id: 'f_ref',      label: 'رقم الحوالة / السند',   type: 'text',   required: true,  placeholder: 'رقم العملية' }
    ]
  },
  {
    id: 'ws_jeeb', type: 'withdraw', name: 'استرداد إلى محفظة جيب', image: '', enabled: true, order: 1,
    description: 'استرداد الرصيد إلى محفظة جيب الخاصة بك.',
    customFields: [
      { id: 'f_amount',   label: 'المبلغ المطلوب استرداده (ر.ي)', type: 'number', required: true,  placeholder: 'المبلغ' },
      { id: 'f_account',  label: 'رقم المحفظة/الهاتف',            type: 'tel',    required: true,  placeholder: 'رقم الاستلام' },
      { id: 'f_name',     label: 'اسم صاحب الحساب المستلم',        type: 'text',   required: true,  placeholder: 'الاسم الكامل' },
      { id: 'f_notes',    label: 'ملاحظات',                        type: 'textarea',required: false, placeholder: 'اختياري' }
    ]
  },
  {
    id: 'ws_jawali', type: 'withdraw', name: 'استرداد إلى محفظة جوالي', image: '', enabled: true, order: 2,
    description: 'استرداد الرصيد إلى محفظة جوالي.',
    customFields: [
      { id: 'f_amount',   label: 'المبلغ المطلوب استرداده (ر.ي)', type: 'number', required: true,  placeholder: 'المبلغ' },
      { id: 'f_account',  label: 'رقم المحفظة/الهاتف',            type: 'tel',    required: true,  placeholder: 'رقم الاستلام' },
      { id: 'f_name',     label: 'اسم صاحب الحساب المستلم',        type: 'text',   required: true,  placeholder: 'الاسم الكامل' }
    ]
  }
];

let TOPUP_SERVICES = [];

function loadTopupServicesLocal() {
  try {
    const raw = localStorage.getItem(TOPUP_SERVICES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) { TOPUP_SERVICES = parsed; return; }
    }
  } catch(e){}
  // القيم الافتراضية
  TOPUP_SERVICES = JSON.parse(JSON.stringify(DEFAULT_TOPUP_SERVICES));
  try { localStorage.setItem(TOPUP_SERVICES_KEY, JSON.stringify(TOPUP_SERVICES)); } catch(e){}
}

function persistTopupServicesLocal() {
  try { localStorage.setItem(TOPUP_SERVICES_KEY, JSON.stringify(TOPUP_SERVICES)); } catch(e){}
}

async function saveTopupServiceCloud(service) {
  try {
    if (!window.firebaseDB) return false;
    const fdb = window.firebaseDB;
    const activeDb = window.db || fdb.db;
    await fdb.setDoc(fdb.doc(activeDb, 'topup_services', service.id), service);
    return true;
  } catch(e) { console.warn('cloud save service failed', e); return false; }
}

async function deleteTopupServiceCloud(serviceId) {
  try {
    if (!window.firebaseDB) return false;
    const fdb = window.firebaseDB;
    const activeDb = window.db || fdb.db;
    await fdb.deleteDoc(fdb.doc(activeDb, 'topup_services', serviceId));
    return true;
  } catch(e) { console.warn('cloud delete service failed', e); return false; }
}

async function loadTopupServicesFromCloud() {
  try {
    if (!window.firebaseDB) return false;
    const fdb = window.firebaseDB;
    const activeDb = window.db || fdb.db;
    const snap = await fdb.getDocs(fdb.collection(activeDb, 'topup_services'));
    if (snap && snap.docs && snap.docs.length > 0) {
      TOPUP_SERVICES = snap.docs.map(d => d.data()).filter(x => x && x.id);
      persistTopupServicesLocal();
      return true;
    }
    // إذا لم توجد بيانات في السحابة → ادفع الافتراضية إليها لأول مرة
    if (TOPUP_SERVICES.length === 0) {
      TOPUP_SERVICES = JSON.parse(JSON.stringify(DEFAULT_TOPUP_SERVICES));
    }
    for (const s of TOPUP_SERVICES) { await saveTopupServiceCloud(s); }
    persistTopupServicesLocal();
    return true;
  } catch(e) { console.warn('cloud load services failed', e); return false; }
}

function getTopupServices(typeFilter) {
  const arr = (TOPUP_SERVICES || []).slice();
  arr.sort((a,b) => (a.order || 0) - (b.order || 0));
  if (typeFilter) return arr.filter(s => s.type === typeFilter);
  return arr;
}

function getTopupServiceById(id) {
  return (TOPUP_SERVICES || []).find(s => s.id === id) || null;
}

async function saveTopupService(service) {
  if (!service) return null;
  if (!service.id) service.id = 'svc_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  if (!service.type) service.type = 'deposit';
  if (typeof service.enabled === 'undefined') service.enabled = true;
  if (!Array.isArray(service.customFields)) service.customFields = [];
  const idx = TOPUP_SERVICES.findIndex(s => s.id === service.id);
  if (idx !== -1) {
    TOPUP_SERVICES[idx] = Object.assign({}, TOPUP_SERVICES[idx], service);
  } else {
    if (!service.order) service.order = TOPUP_SERVICES.filter(s => s.type === service.type).length + 1;
    TOPUP_SERVICES.push(service);
  }
  persistTopupServicesLocal();
  await saveTopupServiceCloud(TOPUP_SERVICES.find(s => s.id === service.id));
  return service;
}

async function deleteTopupService(serviceId) {
  TOPUP_SERVICES = TOPUP_SERVICES.filter(s => s.id !== serviceId);
  persistTopupServicesLocal();
  await deleteTopupServiceCloud(serviceId);
  return true;
}

async function addServiceField(serviceId, field) {
  const svc = getTopupServiceById(serviceId);
  if (!svc) return null;
  if (!Array.isArray(svc.customFields)) svc.customFields = [];
  if (!field.id) field.id = 'fld_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  if (!field.type) field.type = 'text';
  if (typeof field.required === 'undefined') field.required = false;
  svc.customFields.push(field);
  return saveTopupService(svc);
}

async function updateServiceField(serviceId, fieldId, updates) {
  const svc = getTopupServiceById(serviceId);
  if (!svc || !Array.isArray(svc.customFields)) return null;
  const f = svc.customFields.find(x => x.id === fieldId);
  if (!f) return null;
  Object.assign(f, updates || {});
  return saveTopupService(svc);
}

async function deleteServiceField(serviceId, fieldId) {
  const svc = getTopupServiceById(serviceId);
  if (!svc || !Array.isArray(svc.customFields)) return false;
  svc.customFields = svc.customFields.filter(x => x.id !== fieldId);
  await saveTopupService(svc);
  return true;
}

// ===================== إدارة أرصدة العملاء المسجلين =====================
// نستخدم collection = 'user_balances' على السحابة، مفتاح id = userId
// كل مستند: { id: userId, email, name, balance, updatedAt }
// كذلك نحتفظ بفهرس محلي USER_BALANCES_KEY

function getBalancesIndex() {
  try {
    const raw = localStorage.getItem(USER_BALANCES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

function saveBalancesIndex(idx) {
  try { localStorage.setItem(USER_BALANCES_KEY, JSON.stringify(idx || {})); } catch(e){}
}

function upsertBalanceIndex(userId, patch) {
  const idx = getBalancesIndex();
  idx[userId] = Object.assign({ id: userId, balance: 0 }, idx[userId] || {}, patch || {});
  saveBalancesIndex(idx);
  return idx[userId];
}

async function loadAllUserBalancesFromCloud() {
  try {
    if (!window.firebaseDB) return [];
    const fdb = window.firebaseDB;
    const activeDb = window.db || fdb.db;
    const snap = await fdb.getDocs(fdb.collection(activeDb, 'user_balances'));
    const arr = (snap && snap.docs) ? snap.docs.map(d => d.data()).filter(x => x && x.id) : [];
    const idx = {};
    arr.forEach(u => { idx[u.id] = u; });
    // دمج مع الفهرس المحلي (المحلي يفوز في القيمة الأحدث زمنياً)
    const local = getBalancesIndex();
    Object.keys(local).forEach(k => {
      const l = local[k]; const c = idx[k];
      if (!c || (l.updatedAt && (!c.updatedAt || l.updatedAt > c.updatedAt))) idx[k] = Object.assign({}, c || {}, l);
    });
    saveBalancesIndex(idx);
    return Object.values(idx);
  } catch(e) { console.warn('loadAllUserBalancesFromCloud', e); return Object.values(getBalancesIndex()); }
}

async function saveUserBalanceCloud(userRec) {
  try {
    if (!window.firebaseDB || !userRec || !userRec.id) return false;
    const fdb = window.firebaseDB;
    const activeDb = window.db || fdb.db;
    await fdb.setDoc(fdb.doc(activeDb, 'user_balances', userRec.id), userRec);
    return true;
  } catch(e) { console.warn('saveUserBalanceCloud', e); return false; }
}

// نُغلّف updateUserBalance الأصلية لتحدّث كذلك الفهرس السحابي
const __originalUpdateUserBalance = updateUserBalance;
updateUserBalance = function(userId, newBal) {
  const val = __originalUpdateUserBalance(userId, newBal);
  try {
    const authUser = window.getCachedAuthUser ? window.getCachedAuthUser() : null;
    const rec = upsertBalanceIndex(userId, {
      balance: val,
      email: (authUser && authUser.email && (authUser.uid === userId || authUser.id === userId)) ? authUser.email : (getBalancesIndex()[userId] || {}).email || '',
      name:  (authUser && (authUser.displayName || authUser.name) && (authUser.uid === userId || authUser.id === userId)) ? (authUser.displayName || authUser.name) : (getBalancesIndex()[userId] || {}).name || '',
      updatedAt: new Date().toISOString()
    });
    saveUserBalanceCloud(rec);
  } catch(e) { console.warn('sync balance idx failed', e); }
  return val;
};
window.updateUserBalance = updateUserBalance;

async function adminSetUserBalance(userId, newBalance, reason) {
  const val = updateUserBalance(userId, newBalance);
  // سجل معاملة كنوع 'admin_adjustment'
  try {
    if (typeof window.saveTopupTransaction === 'function') {
      await window.saveTopupTransaction({
        id: 'adj_' + Date.now(),
        userId: userId,
        userName: 'تعديل يدوي من الإدارة',
        userPhone: '-',
        type: 'admin_adjustment',
        amount: parseFloat(newBalance) || 0,
        walletName: reason || 'تعديل رصيد يدوي',
        status: 'approved',
        createdAt: new Date().toISOString()
      });
    }
  } catch(e) {}
  return val;
}

async function listRegisteredUsers() {
  const users = await loadAllUserBalancesFromCloud();
  // كذلك حاول جلب أي مستندات users (إن وُجدت)
  try {
    if (window.firebaseDB) {
      const fdb = window.firebaseDB;
      const activeDb = window.db || fdb.db;
      const snap = await fdb.getDocs(fdb.collection(activeDb, 'users'));
      if (snap && snap.docs) {
        const byId = {}; users.forEach(u => { byId[u.id] = u; });
        snap.docs.forEach(d => {
          const data = d.data() || {};
          const id = data.uid || data.id || d.id;
          const email = data.email || '';
          const name  = data.displayName || data.name || '';
          if (!byId[id]) {
            byId[id] = { id: id, email: email, name: name, balance: parseFloat(data.balance || 0) || 0, updatedAt: data.updatedAt || '' };
            upsertBalanceIndex(id, byId[id]);
          } else {
            if (email && !byId[id].email) byId[id].email = email;
            if (name  && !byId[id].name)  byId[id].name  = name;
          }
        });
        return Object.values(byId);
      }
    }
  } catch(e) { console.warn('listRegisteredUsers', e); }
  return users;
}

// ==== registration hook: عند تسجيل حساب جديد سجّله في الفهرس تلقائياً ====
function registerCurrentAuthUserInBalanceIndex() {
  try {
    const authUser = window.getCachedAuthUser ? window.getCachedAuthUser() : null;
    if (!authUser) return;
    const uid = authUser.uid || authUser.id || authUser.email;
    if (!uid) return;
    const cur = getBalancesIndex()[uid];
    const bal = getUserBalance(uid);
    const rec = upsertBalanceIndex(uid, {
      email: authUser.email || (cur && cur.email) || '',
      name:  authUser.displayName || authUser.name || (cur && cur.name) || '',
      balance: bal
    });
    saveUserBalanceCloud(rec);
  } catch(e) {}
}
window.registerCurrentAuthUserInBalanceIndex = registerCurrentAuthUserInBalanceIndex;

// حاول تحميل الخدمات من السحابة عند بدء التشغيل
loadTopupServicesLocal();
setTimeout(function(){
  loadTopupServicesFromCloud().then(function(){
    // اطلق حدثاً لأي صفحة تنتظره
    try { window.dispatchEvent(new CustomEvent('hud:topup-services-loaded')); } catch(e){}
  });
  // سجّل المستخدم الحالي في فهرس الأرصدة
  setTimeout(registerCurrentAuthUserInBalanceIndex, 800);
}, 400);

// ===== تصدير =====
window.TOPUP_SERVICES = TOPUP_SERVICES;
window.DEFAULT_TOPUP_SERVICES = DEFAULT_TOPUP_SERVICES;
window.loadTopupServicesFromCloud = loadTopupServicesFromCloud;
window.getTopupServices = getTopupServices;
window.getTopupServiceById = getTopupServiceById;
window.saveTopupService = saveTopupService;
window.deleteTopupService = deleteTopupService;
window.addServiceField = addServiceField;
window.updateServiceField = updateServiceField;
window.deleteServiceField = deleteServiceField;
window.listRegisteredUsers = listRegisteredUsers;
window.adminSetUserBalance = adminSetUserBalance;
window.loadAllUserBalancesFromCloud = loadAllUserBalancesFromCloud;
window.upsertBalanceIndex = upsertBalanceIndex;

// دالة عالمية لتحديث عرض الرصيد في النافبار (تستخدمها كل الصفحات)
window.updateNavBalanceDisplay = function() {
  try {
    const authUser = window.getCachedAuthUser ? window.getCachedAuthUser() : null;
    const userId = authUser ? (authUser.uid || authUser.id || authUser.email) : 'guest';
    let bal = 0;
    if (typeof window.getUserBalance === 'function') bal = window.getUserBalance(userId);
    const targets = document.querySelectorAll('#navUserBalanceDisplay, .nav-user-balance-display');
    targets.forEach(el => { el.textContent = Number(bal).toLocaleString() + ' ر.ي'; });
  } catch(e) {}
};

// ===== بدء التشغيل =====
// حفظ وعد التهيئة حتى تستطيع الصفحات (خصوصاً لوحة الإدارة) الانتظار إلى أن تصبح قاعدة البيانات جاهزة
window.__hudFirebaseReadyPromise = initFirebase();

// بعد تهيئة قاعدة البيانات: أعِد تحميل الخدمات من السحابة
if (window.__hudFirebaseReadyPromise && window.__hudFirebaseReadyPromise.then) {
  window.__hudFirebaseReadyPromise.then(function(){
    setTimeout(function(){
      loadTopupServicesFromCloud().then(function(){
        try { window.dispatchEvent(new CustomEvent('hud:topup-services-loaded')); } catch(e){}
      });
    }, 300);
  }).catch(function(){});
}