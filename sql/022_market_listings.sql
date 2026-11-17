-- 022_market_listings.sql — harga pasar tanpa link.
-- login_once membaca SEMUA produk di halaman kategori akun (per game), membuka detail produk yang
-- baru/berubah (deskripsi + banner), membaca banner dengan OCR, lalu mengirim hasilnya ke sini.
create table if not exists public.market_listings (
  product_id    bigint primary key,            -- id produk Itemku (angka di akhir link)
  game_slug     text not null,                 -- break-and-steal-an-egg / steal-an-egg / ...
  name          text,
  url           text,
  seller        text,
  is_own        boolean not null default false, -- produk toko sendiri
  price         integer,
  sold          integer,
  stock         integer,
  image_url     text,                          -- banner ukuran asli (berganti = banner diganti)
  thumb_url     text,
  description   text,
  ocr_text      text,
  specs         jsonb,                         -- {"income":[lo,hi],"speed":[lo,hi],"max":bool,...}
  spec_source   text,                          -- name / description / banner
  tier          text,                          -- tier produk kita yang cocok (tahap 2)
  tier_manual   boolean not null default false,
  active        boolean not null default true, -- false = sudah tidak tampil di kategori
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  analyzed_at   timestamptz,
  updated_at    timestamptz not null default now()
);
create index if not exists market_listings_game_idx on public.market_listings (game_slug, active, price);

create table if not exists public.market_price_history (   -- dicatat hanya saat harga/terjual berubah
  id          bigserial primary key,
  product_id  bigint not null references public.market_listings(product_id) on delete cascade,
  price       integer,
  sold        integer,
  at          timestamptz not null default now()
);
create index if not exists market_price_history_product_idx on public.market_price_history (product_id, at desc);

alter table public.market_listings enable row level security;
alter table public.market_price_history enable row level security;
revoke all on public.market_listings from anon, authenticated;
revoke all on public.market_price_history from anon, authenticated;
