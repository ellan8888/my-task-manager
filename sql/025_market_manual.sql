-- 025_market_manual.sql — pesaing yang ditambah manual (tempel link) karena tidak ada di daftar kandidat.
-- Tidak dinonaktifkan oleh scan kategori; worker Harga Pasar membaca halaman produknya langsung.
alter table public.market_listings add column if not exists manual boolean not null default false;
