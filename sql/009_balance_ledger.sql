-- ═══════════════════════════════════════════════════════════════════════
-- 009 — Buku kas saldo (Riwayat Saldo)
--
-- Setiap perubahan saldo owner/staff dicatat 1 baris di balance_ledger:
--   + pendapatan masuk (akun / jokian)
--   + / − pendapatan dipindah (mis. Ganti Akun), dikoreksi, atau dihapus
--   − tarik saldo & beli code (saat diajukan saldo langsung ditahan)
--   + pengembalian kalau tarik ditolak / dibatalkan
--   +/− penyesuaian manual oleh Ellan (dicatat lewat web)
--
-- Saldo = jumlah semua amount milik user (sama dengan hitungan lama:
-- pendapatan − penarikan pending/approved − beli code).
--
-- Jalankan SEKALI di Supabase SQL Editor. Aman dijalankan ulang:
-- data lama hanya diisi kalau tabel ledger masih kosong.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.balance_ledger (
  id          bigserial primary key,
  username    text        not null,              -- huruf kecil, mis. "rizki"
  amount      bigint      not null,              -- + masuk, − keluar
  kind        text        not null,              -- lihat daftar di bawah
  title       text        not null,
  detail      text,
  order_id    text,
  ref_table   text,                              -- 'income_log' / 'withdrawals'
  ref_id      text,
  created_by  text,
  created_at  timestamptz not null default now()
);
-- kind: income_akun, income_joki, moved_in, moved_out, income_fix, income_removed,
--       withdraw, code_purchase, refund, adjustment

create index if not exists balance_ledger_user_time_idx on public.balance_ledger (username, created_at, id);
create index if not exists balance_ledger_ref_idx       on public.balance_ledger (ref_table, ref_id);

-- Hanya server (service role) yang boleh baca/tulis
alter table public.balance_ledger enable row level security;

-- ───────────────────────────────────────────────────────────────────────
-- Helper: jenis & judul pendapatan
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.ledger_is_joki(p_order_id text, p_product text)
returns boolean
language sql stable
set search_path = public
as $$
  select coalesce(p_product, '') ilike '%joki%'
      or exists (
        select 1 from public.joki_orders j
        where j.order_id = p_order_id and coalesce(j.order_type, '') <> 'akun'
      );
$$;

create or replace function public.ledger_income_title(p_is_joki boolean, p_username text)
returns text
language sql immutable
as $$
  select case
    when p_is_joki then 'Jokian ' || coalesce(nullif(trim(p_username), ''), '-')
    else 'Penjualan akun ' || coalesce(nullif(trim(p_username), ''), '-')
  end;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- Trigger income_log
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.ledger_on_income_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_user text;
  v_new_user text;
  v_is_joki  boolean;
begin
  if tg_op = 'INSERT' then
    v_new_user := lower(trim(coalesce(new.joki_name, '')));
    if v_new_user <> '' and coalesce(new.amount, 0) <> 0 then
      v_is_joki := ledger_is_joki(new.order_id, new.product_title);
      insert into balance_ledger (username, amount, kind, title, detail, order_id, ref_table, ref_id)
      values (
        v_new_user, round(new.amount),
        case when v_is_joki then 'income_joki' else 'income_akun' end,
        ledger_income_title(v_is_joki, new.roblox_username),
        nullif(new.product_title, ''), new.order_id, 'income_log', new.id::text
      );
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    v_old_user := lower(trim(coalesce(old.joki_name, '')));
    v_new_user := lower(trim(coalesce(new.joki_name, '')));

    if v_old_user <> v_new_user then
      -- Pendapatan pindah pemilik (mis. lewat Ganti Akun)
      if v_old_user <> '' and coalesce(old.amount, 0) <> 0 then
        insert into balance_ledger (username, amount, kind, title, detail, order_id, ref_table, ref_id)
        values (v_old_user, -round(old.amount), 'moved_out',
                'Pendapatan dipindah ke ' || coalesce(nullif(v_new_user, ''), '-'),
                trim(coalesce(old.roblox_username, '') || ' · ' || coalesce(old.product_title, ''), ' ·'),
                old.order_id, 'income_log', old.id::text);
      end if;
      if v_new_user <> '' and coalesce(new.amount, 0) <> 0 then
        insert into balance_ledger (username, amount, kind, title, detail, order_id, ref_table, ref_id)
        values (v_new_user, round(new.amount), 'moved_in',
                'Pendapatan pindahan dari ' || coalesce(nullif(v_old_user, ''), '-'),
                trim(coalesce(new.roblox_username, '') || ' · ' || coalesce(new.product_title, ''), ' ·'),
                new.order_id, 'income_log', new.id::text);
      end if;

    elsif coalesce(old.amount, 0) <> coalesce(new.amount, 0) and v_new_user <> '' then
      insert into balance_ledger (username, amount, kind, title, detail, order_id, ref_table, ref_id)
      values (v_new_user, round(coalesce(new.amount, 0)) - round(coalesce(old.amount, 0)), 'income_fix',
              'Koreksi pendapatan ' || coalesce(new.roblox_username, ''),
              'Dari ' || round(coalesce(old.amount, 0))::text || ' jadi ' || round(coalesce(new.amount, 0))::text,
              new.order_id, 'income_log', new.id::text);
    end if;
    return new;

  else -- DELETE
    v_old_user := lower(trim(coalesce(old.joki_name, '')));
    if v_old_user <> '' and coalesce(old.amount, 0) <> 0 then
      insert into balance_ledger (username, amount, kind, title, detail, order_id, ref_table, ref_id)
      values (v_old_user, -round(old.amount), 'income_removed',
              'Pendapatan dihapus',
              trim(coalesce(old.roblox_username, '') || ' · ' || coalesce(old.product_title, ''), ' ·'),
              old.order_id, 'income_log', old.id::text);
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists trg_ledger_income_log on public.income_log;
create trigger trg_ledger_income_log
after insert or update of joki_name, amount or delete on public.income_log
for each row execute function public.ledger_on_income_log();

-- ───────────────────────────────────────────────────────────────────────
-- Trigger withdrawals (tarik saldo & beli code "[BELI CODE] ...")
-- Saldo dianggap terpakai selama status pending / approved.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.ledger_withdraw_title(p_note text, p_bank text)
returns text
language sql immutable
as $$
  select case
    when coalesce(p_note, '') like '[BELI CODE]%' then 'Beli code Redfinger'
    else 'Tarik saldo' || coalesce(' ke ' || nullif(trim(p_bank), ''), '')
  end;
$$;

create or replace function public.ledger_on_withdrawals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     text;
  v_is_code  boolean;
  v_old_held boolean;
  v_new_held boolean;
begin
  if tg_op = 'INSERT' then
    v_user    := lower(trim(coalesce(new.joki_name, '')));
    v_is_code := coalesce(new.note, '') like '[BELI CODE]%';
    if v_user <> '' and coalesce(new.amount, 0) <> 0 and new.status in ('pending', 'approved') then
      insert into balance_ledger (username, amount, kind, title, detail, ref_table, ref_id)
      values (v_user, -round(new.amount),
              case when v_is_code then 'code_purchase' else 'withdraw' end,
              ledger_withdraw_title(new.note, new.bank_name),
              case when v_is_code then nullif(trim(replace(new.note, '[BELI CODE]', '')), '')
                   else nullif(trim(coalesce(new.account_number, '') || ' ' || coalesce(new.account_holder, '')), '') end,
              'withdrawals', new.id::text);
    end if;
    return new;

  elsif tg_op = 'UPDATE' then
    v_user     := lower(trim(coalesce(new.joki_name, '')));
    v_is_code  := coalesce(new.note, '') like '[BELI CODE]%';
    v_old_held := old.status in ('pending', 'approved');
    v_new_held := new.status in ('pending', 'approved');
    if v_user = '' then return new; end if;

    if v_old_held and not v_new_held then
      insert into balance_ledger (username, amount, kind, title, detail, ref_table, ref_id)
      values (v_user, round(coalesce(old.amount, 0)), 'refund',
              case when v_is_code then 'Pengembalian beli code' else 'Pengembalian, tarik ditolak' end,
              nullif(trim(coalesce(new.reject_reason, '')), ''),
              'withdrawals', new.id::text);
    elsif not v_old_held and v_new_held then
      insert into balance_ledger (username, amount, kind, title, detail, ref_table, ref_id)
      values (v_user, -round(coalesce(new.amount, 0)),
              case when v_is_code then 'code_purchase' else 'withdraw' end,
              ledger_withdraw_title(new.note, new.bank_name), 'Diajukan ulang',
              'withdrawals', new.id::text);
    elsif v_new_held and coalesce(old.amount, 0) <> coalesce(new.amount, 0) then
      insert into balance_ledger (username, amount, kind, title, detail, ref_table, ref_id)
      values (v_user, round(coalesce(old.amount, 0)) - round(coalesce(new.amount, 0)), 'adjustment',
              'Koreksi nominal tarik',
              'Dari ' || round(coalesce(old.amount, 0))::text || ' jadi ' || round(coalesce(new.amount, 0))::text,
              'withdrawals', new.id::text);
    end if;
    return new;

  else -- DELETE
    v_user := lower(trim(coalesce(old.joki_name, '')));
    if v_user <> '' and coalesce(old.amount, 0) <> 0 and old.status in ('pending', 'approved') then
      insert into balance_ledger (username, amount, kind, title, detail, ref_table, ref_id)
      values (v_user, round(old.amount), 'refund',
              case when coalesce(old.note, '') like '[BELI CODE]%' then 'Pengembalian beli code' else 'Pengembalian, tarik dibatalkan' end,
              'Pengajuan dihapus', 'withdrawals', old.id::text);
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists trg_ledger_withdrawals on public.withdrawals;
create trigger trg_ledger_withdrawals
after insert or update of status, amount or delete on public.withdrawals
for each row execute function public.ledger_on_withdrawals();

-- ───────────────────────────────────────────────────────────────────────
-- Saldo satu user (dipakai web untuk cek saldo saat tarik / beli code)
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.ledger_balance(p_username text)
returns bigint
language sql stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::bigint
  from public.balance_ledger
  where username = lower(trim(p_username));
$$;

-- ───────────────────────────────────────────────────────────────────────
-- Isi data lama (hanya kalau ledger masih kosong)
-- ───────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from public.balance_ledger) then
    raise notice 'balance_ledger sudah berisi data — pengisian data lama dilewati';
    return;
  end if;

  insert into public.balance_ledger (username, amount, kind, title, detail, order_id, ref_table, ref_id, created_at, created_by)
  select username, amount, kind, title, detail, order_id, ref_table, ref_id, created_at, 'data lama'
  from (
    -- Pendapatan
    select lower(trim(i.joki_name))                                              as username,
           round(i.amount)::bigint                                               as amount,
           case when public.ledger_is_joki(i.order_id, i.product_title) then 'income_joki' else 'income_akun' end as kind,
           public.ledger_income_title(public.ledger_is_joki(i.order_id, i.product_title), i.roblox_username) as title,
           nullif(i.product_title, '')                                           as detail,
           i.order_id                                                            as order_id,
           'income_log'                                                          as ref_table,
           i.id::text                                                            as ref_id,
           coalesce(i.completed_at, now())                                       as created_at
    from public.income_log i
    where coalesce(trim(i.joki_name), '') <> '' and coalesce(i.amount, 0) <> 0

    union all
    -- Tarik / beli code: saat diajukan saldo ditahan
    select lower(trim(w.joki_name)),
           -round(w.amount)::bigint,
           case when coalesce(w.note, '') like '[BELI CODE]%' then 'code_purchase' else 'withdraw' end,
           public.ledger_withdraw_title(w.note, w.bank_name),
           case when coalesce(w.note, '') like '[BELI CODE]%' then nullif(trim(replace(w.note, '[BELI CODE]', '')), '')
                else nullif(trim(coalesce(w.account_number, '') || ' ' || coalesce(w.account_holder, '')), '') end,
           null, 'withdrawals', w.id::text,
           coalesce(w.requested_at, now())
    from public.withdrawals w
    where coalesce(trim(w.joki_name), '') <> '' and coalesce(w.amount, 0) <> 0

    union all
    -- Yang ditolak: saldo dikembalikan
    select lower(trim(w.joki_name)),
           round(w.amount)::bigint,
           'refund',
           case when coalesce(w.note, '') like '[BELI CODE]%' then 'Pengembalian beli code' else 'Pengembalian, tarik ditolak' end,
           nullif(trim(coalesce(w.reject_reason, '')), ''),
           null, 'withdrawals', w.id::text,
           coalesce(w.approved_at, w.requested_at, now()) + interval '1 second'
    from public.withdrawals w
    where coalesce(trim(w.joki_name), '') <> '' and coalesce(w.amount, 0) <> 0
      and w.status not in ('pending', 'approved')
  ) t
  order by created_at;
end $$;

-- ───────────────────────────────────────────────────────────────────────
-- CEK (opsional): saldo ledger vs hitungan lama — kolom "selisih" harus 0
-- ───────────────────────────────────────────────────────────────────────
-- select u.username,
--        public.ledger_balance(u.username) as saldo_ledger,
--        coalesce((select sum(amount) from income_log where lower(joki_name) = u.username), 0)
--          - coalesce((select sum(amount) from withdrawals where lower(joki_name) = u.username and status in ('pending','approved')), 0) as saldo_lama,
--        public.ledger_balance(u.username)
--          - (coalesce((select sum(amount) from income_log where lower(joki_name) = u.username), 0)
--             - coalesce((select sum(amount) from withdrawals where lower(joki_name) = u.username and status in ('pending','approved')), 0)) as selisih
-- from (select distinct username from public.balance_ledger) u;
