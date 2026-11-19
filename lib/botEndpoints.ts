// lib/botEndpoints.ts — alamat layanan di PC (tunnel cloudflared) yang dikirim otomatis oleh PC. Server only.
//   getEndpoint("ram") → alamat terbaru dari tabel bot_endpoints; kalau belum ada → env cadangan.
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const FALLBACK_ENV: Record<string, string> = { ram: "RAM_TUNNEL_URL" };
const cache = new Map<string, { url: string | null; at: number }>();
const TTL_MS = 20_000;

export async function getEndpoint(name: string): Promise<string | null> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.url;
  let url: string | null = null;
  const { data } = await supabaseAdmin.from("bot_endpoints").select("url").eq("name", name).maybeSingle();
  if (data?.url) url = data.url;
  if (!url) url = process.env[FALLBACK_ENV[name] || ""] || null;
  url = url ? url.replace(/\/+$/, "") : null;
  cache.set(name, { url, at: Date.now() });
  return url;
}

export function forgetEndpoint(name: string) {
  cache.delete(name);
}
