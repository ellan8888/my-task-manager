-- 018 — Tutup akses langsung ke database dari browser (kunci publishable / anon).
-- Semua data sekarang lewat API web (service role), yang sudah mengecek login / kunci bot.
-- Jalankan SETELAH versi web yang memakai /api/tasks, /api/queue, /api/me/summary sudah live.

-- 1) Hapus aturan "boleh semua" (RLS tetap aktif → anon & authenticated tidak bisa apa-apa)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('accounts_stock', 'income_log', 'joki_orders', 'kategori_links', 'queue_settings', 'tasks')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

alter table public.accounts_stock enable row level security;
alter table public.income_log     enable row level security;
alter table public.joki_orders    enable row level security;
alter table public.kategori_links enable row level security;
alter table public.queue_settings enable row level security;
alter table public.tasks          enable row level security;

-- 2) Fungsi saldo & trigger buku kas tidak boleh dipanggil dari luar
revoke execute on function public.ledger_balance(text) from public, anon, authenticated;
revoke execute on function public.ledger_on_income_log() from public, anon, authenticated;
revoke execute on function public.ledger_on_withdrawals() from public, anon, authenticated;

-- 3) search_path tetap (saran keamanan Supabase)
alter function public.set_progress_updated_at() set search_path = public;
alter function public.ledger_income_title(boolean, text) set search_path = public;
alter function public.ledger_withdraw_title(text, text) set search_path = public;
alter function public.sync_bot_process_failed() set search_path = public;
