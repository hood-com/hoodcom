-- 1) أنشئ المستخدم أولاً من Supabase Dashboard > Authentication > Users > Add user.
-- 2) استبدل البريد أدناه ببريد المدير الحقيقي ثم شغّل هذا الاستعلام مرة واحدة.
-- لا تضع كلمة المرور داخل SQL.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = lower('REPLACE_WITH_ADMIN_EMAIL@example.com');

-- تحقق: يجب أن يعيد صفًا واحدًا ودور admin.
select id, email, raw_app_meta_data->>'role' as role
from auth.users
where lower(email) = lower('REPLACE_WITH_ADMIN_EMAIL@example.com');
