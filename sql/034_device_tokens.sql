-- 034_device_tokens.sql — token khusus perangkat (mis. dashboard HP PhoneBox) dengan izin SEMPIT.
--   Token asli hanya ada di perangkatnya; di sini disimpan hash SHA-256-nya.
--   scopes: 'rf_release' = boleh mengosongkan HP Redfinger dari order (POST /api/bot/phonebox-rf)
create table if not exists public.device_tokens (
  id bigserial primary key,
  name text not null,
  token_hash text not null unique,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.device_tokens enable row level security;   -- hanya service role (server)
