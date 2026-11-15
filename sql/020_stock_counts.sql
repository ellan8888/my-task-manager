-- 020_stock_counts.sql — hitung stok siap jual per kategori di database.
-- /api/bot/stock dulu mengambil SEMUA baris akun siap jual (±180 baris, tiap 15 detik) hanya untuk
-- dihitung di server web. Fungsi ini mengirim hasil hitungnya saja (±25 baris) → hemat egress Supabase.
create or replace function public.stock_counts()
returns table (kategori text, n bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select lower(trim(a.kategori)) as kategori, count(*) as n
  from public.accounts_stock a
  where a.used = true
    and a.logged_out = false
    and a.deleted = false
    and coalesce(trim(a.kategori), '') <> ''
  group by 1;
$$;

revoke all on function public.stock_counts() from public, anon, authenticated;
grant execute on function public.stock_counts() to service_role;
