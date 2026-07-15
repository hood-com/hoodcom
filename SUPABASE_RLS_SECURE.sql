-- HUD COM: سياسات الإنتاج الآمنة
-- شغّل الملف بعد إنشاء المدير ومنحه app_metadata.role=admin وبعد نشر الملفات الجديدة.
begin;

alter table public.hud_docs enable row level security;

drop policy if exists allow_delete_anon on public.hud_docs;
drop policy if exists allow_insert_anon on public.hud_docs;
drop policy if exists allow_read_anon on public.hud_docs;
drop policy if exists allow_update_anon on public.hud_docs;
drop policy if exists hud_public_read on public.hud_docs;
drop policy if exists hud_owner_read on public.hud_docs;
drop policy if exists hud_user_profile_insert on public.hud_docs;
drop policy if exists hud_user_profile_update on public.hud_docs;
drop policy if exists hud_owner_insert on public.hud_docs;
drop policy if exists hud_owner_delete_review on public.hud_docs;

-- البيانات العامة فقط.
create policy hud_public_read on public.hud_docs
for select to anon, authenticated
using (
  collection in ('categories', 'wallets', 'topup_services')
  or (collection = 'reviews' and coalesce(data->>'hidden', 'false') <> 'true')
  or (collection = 'settings' and id in ('site', 'topup'))
);

-- كل مستخدم يرى سجلاته فقط.
create policy hud_owner_read on public.hud_docs
for select to authenticated
using (
  (collection = 'users' and id = auth.uid()::text)
  or (collection in ('orders', 'topup_transactions') and data->>'userId' = auth.uid()::text)
  or (collection = 'user_balances' and id = auth.uid()::text)
);

create policy hud_user_profile_insert on public.hud_docs
for insert to authenticated
with check (collection = 'users' and id = auth.uid()::text);

-- الطلبات المالية تُنشأ من customer-api الخادمية فقط. العميل يستطيع إنشاء تقييم وعملية إيداع باسمه.
create policy hud_owner_insert on public.hud_docs
for insert to authenticated
with check (
  collection in ('reviews', 'topup_transactions')
  and data->>'userId' = auth.uid()::text
);

create policy hud_owner_delete_review on public.hud_docs
for delete to authenticated
using (collection = 'reviews' and data->>'userId' = auth.uid()::text);

-- إزالة وثيقة الباب الخلفي القديمة نهائيًا.
delete from public.hud_docs where collection = 'settings' and id = 'admin_gate';

commit;
