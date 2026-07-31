begin;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-receipts','payment-receipts',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

insert into public.hud_docs(collection,id,data,updated_at)
values('settings','deposit_page','{"title":"تغذية حسابي","description":"اختر طريقة الإيداع المناسبة وأرسل بيانات التحويل","notice":"تأكد من صحة البيانات قبل الإرسال","submitText":"تقديم الطلب","historyTitle":"عمليات الإيداع","reviewEstimate":"تتم مراجعة الطلب في أقرب وقت","enabled":true}'::jsonb,now())
on conflict(collection,id) do nothing;

insert into public.hud_docs(collection,id,data,updated_at)
values
('notification_templates','account_verified','{"title":"تم توثيق حسابك","message":"تم توثيق حسابك من قبل الإدارة","type":"success","enabled":true}'::jsonb,now()),
('notification_templates','deposit_received','{"title":"تم استلام طلب التغذية","message":"طلبك قيد المراجعة","type":"pending","enabled":true}'::jsonb,now()),
('notification_templates','deposit_approved','{"title":"تم قبول طلب التغذية","message":"تم تحديث رصيد حسابك","type":"success","enabled":true}'::jsonb,now()),
('notification_templates','deposit_rejected','{"title":"تم رفض طلب التغذية","message":"راجع سبب الرفض في صفحة عملياتي","type":"error","enabled":true}'::jsonb,now()),
('notification_templates','catalog_refresh','{"title":"تحديثات جديدة","message":"اضغط زر التحديث لمواكبة آخر العروض والأسعار","type":"info","enabled":true}'::jsonb,now())
on conflict(collection,id) do nothing;

commit;
