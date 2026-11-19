-- 031_chat_outbox_retry.sql — balasan chat yang gagal dikirim otomatis dicoba ulang oleh bot.
--   attempts    : percobaan ke berapa (1 = kiriman pertama). Maksimal 3 (diatur di /api/bot/chat/outbox).
--   next_try_at : jangan diambil bot sebelum waktu ini (jeda antar percobaan).
-- Kiriman yang statusnya tidak pasti (bot berhenti di tengah) TIDAK diulang otomatis supaya pembeli tidak
-- menerima pesan dobel.
alter table public.chat_outbox add column if not exists attempts int not null default 1;
alter table public.chat_outbox add column if not exists next_try_at timestamptz;

create or replace function public.chat_outbox_claim(p_limit int default 5)
returns table (id bigint, conversation_id text, text text, created_by text, order_id text)
language plpgsql
set search_path = public
as $$
begin
  update chat_outbox o set status = 'failed', error = 'Kedaluwarsa: login_once tidak aktif lebih dari 30 menit', done_at = now()
   where o.status = 'pending' and o.created_at < now() - interval '30 minutes';
  update chat_outbox o set status = 'failed', error = 'Status tidak pasti: bot berhenti saat mengirim — cek chat di Itemku', done_at = now()
   where o.status = 'sending' and o.claimed_at < now() - interval '10 minutes';
  return query
  with picked as (
    select o.id from chat_outbox o
     where o.status = 'pending' and (o.next_try_at is null or o.next_try_at <= now())
     order by o.created_at
     limit greatest(1, least(p_limit, 10))
     for update skip locked
  )
  update chat_outbox o set status = 'sending', claimed_at = now()
    from picked
   where o.id = picked.id
  returning o.id, o.conversation_id, o.text, o.created_by,
            (select c.order_id from chat_conversations c where c.conversation_id = o.conversation_id);
end;
$$;
revoke all on function public.chat_outbox_claim(int) from public, anon, authenticated;
grant execute on function public.chat_outbox_claim(int) to service_role;
