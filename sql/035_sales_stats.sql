-- 035_sales_stats.sql — Produk Terlaris (jumlah terjual saja, tanpa rupiah).
-- Sumber: income_log (satu baris = satu penjualan). Waktu dihitung dalam WIB (Asia/Jakarta).
-- Nama produk dinormalisasi (huruf kecil, spasi rapi) supaya "Break and" & "Break And" jadi satu produk.
create or replace function public.sales_norm(t text) returns text
language sql immutable as $$ select regexp_replace(regexp_replace(lower(trim(coalesce(t, ''))), '\s*\|\s*', ' | ', 'g'), '\s+', ' ', 'g') $$;

-- per produk per hari: key, judul (yang paling sering dipakai), hari WIB, jumlah, penjualan terakhir
create or replace function public.sales_product_daily(p_from timestamptz, p_to timestamptz)
returns table (key text, title text, day date, n int, last_at timestamptz)
language sql stable
set search_path = public
as $$
  with s as (
    select sales_norm(product_title) as k, product_title, (created_at at time zone 'Asia/Jakarta')::date as d, created_at
      from income_log
     where created_at >= p_from and created_at < p_to and coalesce(product_title, '') <> ''
  ), t as (
    select k, mode() within group (order by product_title) as title from s group by k
  )
  select s.k, t.title, s.d, count(*)::int, max(s.created_at)
    from s join t using (k)
   group by s.k, t.title, s.d
$$;

-- kapan paling ramai: hari dalam minggu (0 = Minggu) × jam WIB
create or replace function public.sales_heatmap(p_from timestamptz, p_to timestamptz)
returns table (dow int, hour int, n int)
language sql stable
set search_path = public
as $$
  select extract(dow from created_at at time zone 'Asia/Jakarta')::int,
         extract(hour from created_at at time zone 'Asia/Jakarta')::int,
         count(*)::int
    from income_log
   where created_at >= p_from and created_at < p_to
   group by 1, 2
$$;

-- penjualan terakhir per produk (untuk "tidak laku sejak …")
create or replace function public.sales_last_sold()
returns table (key text, title text, last_at timestamptz, total int)
language sql stable
set search_path = public
as $$
  select sales_norm(product_title), mode() within group (order by product_title), max(created_at), count(*)::int
    from income_log where coalesce(product_title, '') <> ''
   group by 1
$$;

revoke all on function public.sales_product_daily(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.sales_heatmap(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.sales_last_sold() from public, anon, authenticated;
grant execute on function public.sales_product_daily(timestamptz, timestamptz) to service_role;
grant execute on function public.sales_heatmap(timestamptz, timestamptz) to service_role;
grant execute on function public.sales_last_sold() to service_role;
