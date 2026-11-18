-- 027_chat_messages.sql — kotak chat pembeli Itemku di My Task (hanya untuk dibaca).
-- Pesan diisi bot (login_once → itemku_chat_watch.py) dari respons PubNub yang memang diminta halaman Tokoku.
-- Pesan lebih dari 30 hari dihapus oleh cron /api/cron/cleanup-chat.

create table if not exists public.chat_messages (
  conversation_id text not null,                 -- non_order_<buyer>_<seller>
  tt              text not null,                 -- timetoken PubNub (unik per pesan)
  sender          text not null check (sender in ('buyer', 'seller')),
  text            text,
  files           jsonb,                         -- ["https://…"] gambar / file yang dikirim
  sent_at         timestamptz not null,
  order_id        text,                          -- OD000000… (dari data pesan, kalau ada)
  product_name    text,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, tt)
);
create index if not exists chat_messages_conv_sent_idx on public.chat_messages (conversation_id, sent_at desc);
create index if not exists chat_messages_sent_idx on public.chat_messages (sent_at);

-- ringkasan per percakapan (untuk daftar chat tanpa membaca semua pesan)
alter table public.chat_conversations
  add column if not exists buyer_name      text,
  add column if not exists product_name    text,
  add column if not exists product_image   text,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_text       text,
  add column if not exists last_sender     text;
create index if not exists chat_conversations_last_idx on public.chat_conversations (last_message_at desc);

-- kapan tiap staff terakhir membuka percakapan (untuk tanda belum dibaca)
create table if not exists public.chat_reads (
  username        text not null,
  conversation_id text not null,
  read_at         timestamptz not null default now(),
  primary key (username, conversation_id)
);

alter table public.chat_messages enable row level security;
alter table public.chat_reads    enable row level security;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.chat_reads    from anon, authenticated;

-- 028: jumlah percakapan belum dibaca untuk satu staff (dipakai tombol "Pesan"; hanya mengirim satu angka)
create or replace function public.chat_unread_count(p_username text, p_see_all boolean)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from chat_conversations c
  left join chat_reads r on r.conversation_id = c.conversation_id and r.username = p_username
  where c.last_sender = 'buyer'
    and c.last_message_at > now() - interval '30 days'
    and c.last_message_at > coalesce(r.read_at, 'epoch'::timestamptz)
    and (p_see_all or c.owner is null or c.owner = p_username);
$$;
revoke all on function public.chat_unread_count(text, boolean) from public, anon, authenticated;
grant execute on function public.chat_unread_count(text, boolean) to service_role;
