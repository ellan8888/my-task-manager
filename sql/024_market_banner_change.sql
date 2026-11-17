-- 024_market_banner_change.sql
-- 1. Banner pesaing berganti → simpan banner & spesifikasi sebelumnya + waktunya (untuk notif ke staff).
-- 2. Satu pesaing hanya dipantau untuk SATU produk kita.
alter table public.market_listings
  add column if not exists prev_image_url    text,
  add column if not exists prev_specs        jsonb,
  add column if not exists banner_changed_at timestamptz;

create unique index if not exists market_watch_competitor_unique on public.market_watch (competitor_id);
drop index if exists public.market_watch_competitor_idx;
