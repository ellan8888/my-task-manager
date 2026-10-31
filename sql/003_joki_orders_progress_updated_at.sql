-- 003: catat kapan progres order terakhir berubah (untuk "Update X menit lalu" di Jokian Queue)
-- Diisi otomatis oleh trigger, jadi bot & API tidak perlu diubah.

alter table public.joki_orders
  add column if not exists progress_updated_at timestamptz;

create or replace function public.set_progress_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.progress_count is distinct from old.progress_count then
    new.progress_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_joki_orders_progress_updated_at on public.joki_orders;
create trigger trg_joki_orders_progress_updated_at
  before update on public.joki_orders
  for each row
  execute function public.set_progress_updated_at();
