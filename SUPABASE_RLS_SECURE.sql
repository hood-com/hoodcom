-- شغّل هذا الملف فقط بعد رفع النسخة الجديدة وضبط متغيرات Netlify واختبار دخول الإدارة.
begin;

alter table public.hud_docs enable row level security;

drop policy if exists allow_delete_anon on public.hud_docs;
drop policy if exists allow_insert_anon on public.hud_docs;
drop policy if exists allow_read_anon on public.hud_docs;
drop policy if exists allow_update_anon on public.hud_docs;

-- بيانات عامة للقراءة فقط. لا تكشف admin_gate أو المستخدمين أو الطلبات أو الأرصدة.
create policy hud_public_read on public.hud_docs
for select to anon, authenticated
using (
  collection in ('categories', 'wallets', 'topup_services')
  or (collection = 'reviews' and coalesce((data->>'hidden')::boolean, false) = false)
  or (collection = 'settings' and id in ('site', 'topup'))
);

-- المستخدم الموثق يقرأ ملفه وطلباته ورصيده وعملياته فقط.
create policy hud_owner_read on public.hud_docs
for select to authenticated
using (
  (collection = 'users' and id = auth.uid()::text)
  or (collection in ('orders', 'topup_transactions') and data->>'userId' = auth.uid()::text)
  or (collection = 'user_balances' and id = auth.uid()::text)
);

-- إنشاء ملف المستخدم نفسه.
create policy hud_user_profile_insert on public.hud_docs
for insert to authenticated
with check (collection = 'users' and id = auth.uid()::text);

-- تحديث البيانات الشخصية فقط؛ الحقول الحساسة تبقى من خلال الإدارة الخادمية.
create policy hud_user_profile_update on public.hud_docs
for update to authenticated
using (collection = 'users' and id = auth.uid()::text)
with check (collection = 'users' and id = auth.uid()::text);

-- إنشاء طلب/تعليق/عملية باسم صاحب الجلسة فقط.
create policy hud_owner_insert on public.hud_docs
for insert to authenticated
with check (
  collection in ('orders', 'reviews', 'topup_transactions')
  and data->>'userId' = auth.uid()::text
);

commit;
