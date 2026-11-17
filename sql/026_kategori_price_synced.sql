-- 026_kategori_price_synced.sql — harga produk kita dari daftar produk Itemku (itemku_catalog.json di bot),
-- sumber yang sama dengan channel Live Stock. Diisi bot lewat /api/bot/stock/catalog-prices.
-- price_synced_at terisi = kategori_links.price berasal dari katalog (bukan isian lama My Task).
alter table public.kategori_links add column if not exists price_synced_at timestamptz;
