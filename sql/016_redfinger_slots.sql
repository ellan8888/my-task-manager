-- 016_redfinger_slots.sql — pantau slot HP Redfinger untuk jokian
--
-- rf_devices          : daftar HP Redfinger (nomor). Ditambah/dihapus lewat Discord (📱┃slot-redfinger)
-- joki_orders.rf_slot : HP Redfinger yang dipakai order jokian ini (dipilih di kartu order My Task)
-- Status HP dihitung otomatis: dipakai kalau ada order jokian yang masih berjalan dengan rf_slot itu.

create table if not exists public.rf_devices (
  number     integer primary key check (number > 0 and number < 100000),
  active     boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.rf_devices enable row level security;   -- hanya lewat /api/rf (service role)

alter table public.joki_orders add column if not exists rf_slot integer;
create index if not exists joki_orders_rf_slot_idx on public.joki_orders (rf_slot) where rf_slot is not null;

-- Pindahkan catatan yang isinya hanya nomor HP (mis. "45") ke kolom rf_slot
insert into public.rf_devices (number)
select distinct trim(my_note)::int from public.joki_orders where my_note ~ '^\s*\d{1,4}\s*$'
on conflict do nothing;

update public.joki_orders
set rf_slot = trim(my_note)::int, my_note = null
where my_note ~ '^\s*\d{1,4}\s*$' and rf_slot is null;
