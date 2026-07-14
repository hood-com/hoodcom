/**
 * Immutable application defaults shared by all layers.
 * This module has no browser or service dependencies.
 */
export const DEFAULT_WHATSAPP_NUMBER = '967783708724';
export const DEFAULT_SUPPORT_NUMBER = '967712423773';
export const DEFAULT_WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029Vb8al5Y0LKZA4hbrLE19';

export const CURRENCIES = Object.freeze({
YER: { name: "ريال يمني", short: "ر.ي", flag: "🇾🇪" },
SAR: { name: "ريال سعودي", short: "ر.س", flag: "🇸🇦" },
USD: { name: "دولار", short: "$", flag: "🇺🇸" },
AED: { name: "درهم إماراتي", short: "د.إ", flag: "🇦🇪" }
});
export const DEFAULT_CURRENCY = 'YER';
export const DEFAULT_WALLETS = Object.freeze([
{ id: 'krimi_jawali', name: 'كريمي جوالي', number: '', image: '', enabled: true, order: 1 },
{ id: 'mahfadti', name: 'محفظتي', number: '', image: '', enabled: true, order: 2 },
{ id: 'floosak', name: 'فلوسك', number: '', image: '', enabled: true, order: 3 },
{ id: 'jeeb', name: 'جيب', number: '', image: '', enabled: true, order: 4 },
{ id: 'mobile_money', name: 'موبايل موني', number: '', image: '', enabled: true, order: 5 },
{ id: 'cash', name: 'كاش', number: '', image: '', enabled: true, order: 6 },
{ id: 'one_cash', name: 'ون كاش', number: '', image: '', enabled: true, order: 7 }
].map((wallet) => Object.freeze({ ...wallet })));
export const DEFAULT_SITE_SETTINGS = Object.freeze({
whatsappNumber: DEFAULT_WHATSAPP_NUMBER,
supportNumber: DEFAULT_SUPPORT_NUMBER,
whatsappChannel: DEFAULT_WHATSAPP_CHANNEL,
adminPhone: DEFAULT_WHATSAPP_NUMBER,
contacts: [],
customFields: [],
featuredOffers: [],
featuredSectionTitle: "العروض المميزة",
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
adminAvailability: false,
// Image size controls - fully customizable from admin panel
productImageWidth: 140,
productImageHeight: 130,
categoryImageWidth: 110,
categoryImageHeight: 110,
offerImageWidth: 60,
offerImageHeight: 60,
heroLogoWidth: 320,
heroLogoHeight: 320,
footerLogoWidth: 50,
footerLogoHeight: 50,
generalImageMaxWidth: 100,
generalImageQuality: 82,
imageBorderRadius: 16,
imageFitMode: "cover"
});
export const DEFAULT_PRODUCT_FIELDS = Object.freeze([
{ id: 'id', label: 'ID الخاص بك', type: 'id', required: true, placeholder: 'أدخل الـ ID' },
{ id: 'note', label: 'ملاحظات إضافية', type: 'note', required: false, placeholder: 'أي تفاصيل تريد إضافتها...' }
].map((field) => Object.freeze({ ...field })));
export const DEFAULT_POPUPS = Object.freeze([
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
].map((popup) => Object.freeze({ ...popup })));

const constants = Object.freeze({
  DEFAULT_WHATSAPP_NUMBER, DEFAULT_SUPPORT_NUMBER, DEFAULT_WHATSAPP_CHANNEL,
  CURRENCIES, DEFAULT_CURRENCY, DEFAULT_WALLETS, DEFAULT_SITE_SETTINGS,
  DEFAULT_PRODUCT_FIELDS, DEFAULT_POPUPS
});

export default constants;
