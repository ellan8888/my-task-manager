-- 015_discord_buyers.sql — kaitan akun Discord ↔ pesanan Itemku
--
-- discord_buyer_links : satu Order ID hanya milik SATU akun Discord (verifikasi / ticket)
-- discord_buyers      : nama pembeli Itemku milik akun Discord itu → pesanan berikutnya
--                       dengan nama yang sama otomatis dikenali sebagai miliknya.
-- Hanya diakses server (service role) lewat /api/bot/buyer.

create table if not exists public.discord_buyer_links (
  order_id     text primary key,
  discord_id   text not null,
  discord_name text,
  buyer_name   text,
  source       text not null default 'verify',   -- verify | gate | ticket | import
  linked_at    timestamptz not null default now()
);
create index if not exists discord_buyer_links_discord_idx on public.discord_buyer_links (discord_id);

create table if not exists public.discord_buyers (
  discord_id   text primary key,
  discord_name text,
  itemku_names text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.discord_buyer_links enable row level security;
alter table public.discord_buyers enable row level security;
-- Tanpa policy: anon / publishable key tidak bisa membaca. Service role tetap bisa.

-- Pencarian order berdasarkan nama pembeli
create index if not exists income_log_buyer_name_idx on public.income_log (buyer_name);
create index if not exists joki_orders_buyer_name_idx on public.joki_orders (buyer_name);
