begin;
create table if not exists public.hud_withdrawal_archive_2026 as
select * from public.hud_docs
where collection in ('topup_services','topup_transactions') and data->>'type' = 'withdraw';
delete from public.hud_docs where collection in ('topup_services','topup_transactions') and data->>'type' = 'withdraw';
update public.hud_docs set data=jsonb_set(data,'{withdrawMethods}','[]'::jsonb,true),updated_at=now()
where collection='settings' and id='topup';
commit;
