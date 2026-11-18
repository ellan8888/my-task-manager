-- 029_chat_outbox.sql — balasan chat pembeli dari My Task, dikirim bot (login_once) ke Itemku.
-- Alur status: pending → sending (diambil bot) → sent / failed.
--   method   : fast (langsung dari halaman Tokoku) | ui (cadangan: klik Hubungi Pembeli di rincian order)
--   timetoken: nomor pesan PubNub setelah terkirim (sama dengan chat_messages.tt)
-- Balasan pending > 30 menit TIDAK dikirim (ditandai kedaluwarsa) supaya pembeli tidak menerima jawaban basi.
create table if not exists public.chat_outbox (
  id              bigint generated always as identity primary key,
  conversation_id text not null,
  text            text not null check (char_length(text) between 1 and 2000),
  status          text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  method          text,
  error           text,
  timetoken       text,
  created_by      text not null,
  created_at      timestamptz not null default now(),
  claimed_at      timestamptz,
  done_at         timestamptz
);
create index if not exists chat_outbox_conv_idx on public.chat_outbox (conversation_id, created_at desc);
create index if not exists chat_outbox_pending_idx on public.chat_outbox (status, created_at) where status in ('pending', 'sending');

alter table public.chat_outbox enable row level security;
revoke all on public.chat_outbox from anon, authenticated;

-- 030: bot mengambil antrean secara atomik (satu balasan tidak mungkin diambil dua kali)
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
     where o.status = 'pending'
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
