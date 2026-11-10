-- 019 — Catat login gagal untuk membatasi tebak password (dipakai /api/auth/signin).
create table if not exists public.login_attempts (
  id bigserial primary key,
  username text not null,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists login_attempts_user_time on public.login_attempts (username, created_at desc);
create index if not exists login_attempts_ip_time on public.login_attempts (ip, created_at desc);
alter table public.login_attempts enable row level security;  -- hanya server (service role)
