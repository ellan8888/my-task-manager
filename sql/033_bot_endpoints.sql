-- 033_bot_endpoints.sql — alamat layanan di PC yang berganti-ganti (tunnel cloudflared), diisi otomatis oleh PC.
--   name = 'ram'  → Roblox Account Manager (port 7963), dipakai lib/ram.ts & /api/get-accounts
--   Diisi lewat POST /api/bot/endpoint (header x-bot-api-key) oleh ram_tunnel.py di PC.
--   Env RAM_TUNNEL_URL tetap jadi cadangan kalau baris di sini belum ada.
create table if not exists public.bot_endpoints (
  name text primary key,
  url text not null,
  updated_at timestamptz not null default now(),
  note text
);
alter table public.bot_endpoints enable row level security;   -- hanya service role (server)
