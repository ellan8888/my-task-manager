-- 023_market_watch.sql — pesaing yang dipilih staff untuk dipantau, per produk kita.
-- Produk kita = kategori_links (daftar Live Stock); nomor produk Itemku diambil dari ujung link /kode/<id>.
-- Pesaing = market_listings.product_id (hasil baca worker Harga Pasar).
create table if not exists public.market_watch (
  our_product_id  bigint not null,                -- id produk Itemku milik kita
  competitor_id   bigint not null references public.market_listings(product_id) on delete cascade,
  added_by        text,
  created_at      timestamptz not null default now(),
  primary key (our_product_id, competitor_id)
);
create index if not exists market_watch_competitor_idx on public.market_watch (competitor_id);

alter table public.market_watch enable row level security;
revoke all on public.market_watch from anon, authenticated;
