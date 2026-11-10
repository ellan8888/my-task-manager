-- 017 — Sinyal "joki_orders berubah" lewat Supabase Realtime Broadcast.
-- Pengganti realtime postgres_changes (yang butuh tabel bisa dibaca publik).
-- Payload kosong: browser hanya diberi tahu "ada perubahan", lalu ambil data lewat API.

create or replace function public.notify_joki_orders_changed()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  begin
    perform realtime.send('{}'::jsonb, 'changed', 'joki_orders_changed', false);
  exception when others then
    -- Jangan pernah menggagalkan perubahan order hanya karena sinyal gagal terkirim
    null;
  end;
  return null;
end;
$$;

revoke execute on function public.notify_joki_orders_changed() from public, anon, authenticated;

drop trigger if exists trg_joki_orders_changed on public.joki_orders;
create trigger trg_joki_orders_changed
  after insert or update or delete on public.joki_orders
  for each statement execute function public.notify_joki_orders_changed();
