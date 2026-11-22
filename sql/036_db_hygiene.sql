-- 036_db_hygiene.sql — rapikan temuan Supabase advisor (aman, tidak menyentuh data)
-- 1) Indeks kembar: setiap INSERT/UPDATE menulis dua kali tanpa manfaat
drop index if exists public.idx_income_log_completed_at;
drop index if exists public.idx_income_log_joki;
-- order_id punya dua UNIQUE constraint identik; sisakan yang bawaan (joki_orders_order_id_key).
-- Tanpa CASCADE: kalau ada foreign key yang bergantung, perintah ini gagal dan tidak ada yang berubah.
alter table public.joki_orders drop constraint if exists joki_orders_order_id_unique;

-- 2) Fungsi tanpa search_path tetap (advisor: function_search_path_mutable)
alter function public.sales_norm(text) set search_path = '';
alter function public.chat_outbox_norm(text) set search_path = '';

-- 3) Foreign key tanpa indeks → join/hapus redeem_codes jadi scan penuh
create index if not exists redeem_purchases_code_id_idx on public.redeem_purchases (code_id);
