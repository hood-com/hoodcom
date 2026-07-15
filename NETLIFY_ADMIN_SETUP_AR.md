# إعداد مدير Supabase الآمن

## متغيرات Netlify المطلوبة فقط
أضف في Netlify → Project configuration → Environment variables:

- `SUPABASE_URL`: رابط مشروع Supabase (ليس سرًا).
- `SUPABASE_SERVICE_ROLE_KEY`: مفتاح service_role/Secret الخادمي، واجعله Secret وProduction.

احذف نهائيًا إن كانت موجودة:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`

## إنشاء المدير
1. Supabase → Authentication → Users → Add user.
2. أدخل بريد المدير وكلمة مرور قوية، وفعّل Auto Confirm للمدير.
3. افتح `CREATE_SUPABASE_ADMIN.sql` واستبدل البريد التجريبي ببريد المدير في الموضعين.
4. شغّل SQL وتأكد أن النتيجة `role = admin`.
5. سجّل الدخول من `login.html` باستخدام بريد المدير وكلمة مروره؛ العملاء يستمرون بالدخول برقم الهاتف.

## الحماية
- دور المدير موجود في `app_metadata` التي لا يستطيع العميل تعديلها.
- `admin-api` تتحقق من JWT مع Supabase في كل عملية.
- مفتاح service_role لا يصل إلى المتصفح.
- الشراء يمر عبر `customer-api` التي تتحقق من المستخدم والسعر والرصيد خادميًا.

## ترتيب النشر
1. ارفع هذه الحزمة إلى GitHub.
2. تأكد من نشر Netlify Functions: `admin-api` و`customer-api`.
3. احتفظ بمتغيري Netlify المطلوبين فقط.
4. أنشئ المدير وشغّل `CREATE_SUPABASE_ADMIN.sql`.
5. اختبر دخول المدير.
6. شغّل `SUPABASE_RLS_SECURE.sql`.
7. اختبر الزائر والعميل والمدير.
