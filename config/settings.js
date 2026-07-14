import { DEFAULT_CURRENCY, DEFAULT_SITE_SETTINGS } from '../utils/constants.js';

export const APP_NAME = 'هود كوم';
export const APP_VERSION = '1.0.0';
export const SESSION_VERSION = 2;
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
export const STORAGE_KEYS = Object.freeze({
  auth: 'hud_auth_user', language: 'hud_language', theme: 'hud_theme', categories: 'hud_categories_cache',
  settings: 'hud_site_settings', wallets: 'hud_wallets_settings', topup: 'hud_topup_settings',
  transactions: 'hud_topup_transactions', services: 'hud_topup_services_v2', balances: 'hud_user_balances_index'
});
export const DEFAULT_SETTINGS = Object.freeze({ ...DEFAULT_SITE_SETTINGS, defaultCurrency: DEFAULT_CURRENCY });
export const DEFAULT_TOPUP_SERVICES = Object.freeze([
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
]);
export const DEFAULT_TOPUP_SETTINGS = Object.freeze({
  accountName: 'هود فيصل مصلح العماري', phone1: '00967783708724', phone2: '00967717510727',
  depositInstructions: 'قم بتحويل المبلغ المطلوب ثم اختر الخدمة واملأ النموذج.',
  withdrawInstructions: 'اختر طريقة الاسترداد المناسبة وقدّم الطلب.', withdrawMethods: []
});

export default Object.freeze({ APP_NAME, APP_VERSION, SESSION_VERSION, SESSION_TIMEOUT_MS, STORAGE_KEYS, DEFAULT_SETTINGS, DEFAULT_TOPUP_SERVICES, DEFAULT_TOPUP_SETTINGS });
