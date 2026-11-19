-- 032_chat_outbox_until_sent.sql — balasan chat dari My Task dicoba terus sampai benar-benar terkirim.
--   • Tidak ada lagi kedaluwarsa 30 menit / status "Gagal" permanen: yang gagal kembali ke antrean dengan jeda
--     (diatur /api/bot/chat/outbox: 15 dtk × percobaan, maks. 60 dtk).
--   • Anti-dobel: sebelum mengambil antrean, balasan yang ternyata SUDAH muncul di chat Itemku (pesan toko dengan
--     teks sama setelah balasan dibuat) langsung ditandai Terkirim — tidak dikirim lagi.
--   • Bot berhenti di tengah pengiriman (status "sending" > 3 menit): dicek dulu seperti di atas; kalau belum
--     muncul di chat, dikembalikan ke antrean.
create or replace function public.chat_outbox_norm(t text) returns text
language sql immutable as $$ select regexp_replace(lower(coalesce(t, '')), '\s+', ' ', 'g') $$;

create or replace function public.chat_outbox_claim(p_limit int default 5)
returns table (id bigint, conversation_id text, text text, created_by text, order_id text)
language plpgsql
set search_path = public
as $$
begin
  -- sudah muncul di chat Itemku → Terkirim (tanpa kirim ulang)
  with hit as (
    select o.id, (
      select cm.tt from chat_messages cm
       where cm.conversation_id = o.conversation_id and cm.sender = 'seller'
         and cm.sent_at >= o.created_at - interval '1 minute'
         and chat_outbox_norm(cm.text) = chat_outbox_norm(o.text)
         and not exists (select 1 from chat_outbox x where x.timetoken = cm.tt)
       order by cm.sent_at limit 1) as tt
      from chat_outbox o
     where o.status in ('pending', 'sending', 'failed') and o.created_at > now() - interval '2 days'
       and (o.status <> 'sending' or o.claimed_at < now() - interval '20 seconds')
  )
  update chat_outbox o
     set status = 'sent', done_at = now(), timetoken = hit.tt, error = null
    from hit
   where o.id = hit.id and hit.tt is not null;
  -- bot berhenti di tengah kirim → kembali ke antrean
  update chat_outbox o set status = 'pending', claimed_at = null, attempts = o.attempts + 1, next_try_at = now(),
         error = 'Bot berhenti saat mengirim — dicoba lagi'
   where o.status = 'sending' and o.claimed_at < now() - interval '3 minutes';
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
