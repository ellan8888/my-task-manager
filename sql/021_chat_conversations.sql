-- 021_chat_conversations.sql — notif chat pembeli Itemku.
-- Percakapan chat Itemku ↔ order (dan pemilik akun), supaya notif pesan pembeli hanya dikirim ke
-- pemilik akun order itu. Diisi bot (login_once) saat nomor order terlihat di percakapan.
create table if not exists public.chat_conversations (
  conversation_id text primary key,              -- mis. non_order_14306066_5217734
  buyer_id        bigint,
  order_id        text,                          -- OD000000168321882
  owner           text,                          -- ellan / ridho / rizki
  last_notified_at timestamptz,
  updated_at      timestamptz not null default now()
);
create index if not exists chat_conversations_buyer_idx on public.chat_conversations (buyer_id);

alter table public.chat_conversations enable row level security;   -- hanya service role (API web)
revoke all on public.chat_conversations from anon, authenticated;
