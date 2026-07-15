# هود كوم — نسخة Supabase Admin

## النشر
ارفع كامل المشروع إلى GitHub واربطه بـNetlify. يقرأ Netlify الإعدادات من `netlify.toml`، ويبني الملفات العامة في `_site` وينشر Functions من `netlify/functions`.

## متغيرات Netlify
- `SUPABASE_URL` عام.
- `SUPABASE_SERVICE_ROLE_KEY` سري ومخصص لـProduction/Functions.

## المدير
اتبع `NETLIFY_ADMIN_SETUP_AR.md` ثم `CREATE_SUPABASE_ADMIN.sql`. لا يوجد باب خلفي أو كلمة مرور إدارة ثابتة في الملفات.

## قاعدة البيانات
بعد اختبار دخول المدير، شغّل `SUPABASE_RLS_SECURE.sql` مرة واحدة.

## الفحص
```bash
npm run check
npm run build
```
