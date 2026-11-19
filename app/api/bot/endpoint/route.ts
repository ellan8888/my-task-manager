// app/api/bot/endpoint/route.ts — PC memberi tahu alamat tunnel terbarunya (header x-bot-api-key)
//   POST { name: "ram", url: "https://xxxx.trycloudflare.com" } → disimpan di bot_endpoints
//   GET  ?name=ram → { url, updated_at }  (untuk cek dari PC)
// Hanya alamat https yang diterima; password RAM tetap di secret Cloudflare (RAM_PASSWORD), tidak lewat sini.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";
import { forgetEndpoint } from "@/lib/botEndpoints";

export const dynamic = "force-dynamic";

const NAMES = new Set(["ram"]);

export async function POST(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "");
  const raw = String(body.url || "").trim().replace(/\/+$/, "");
  if (!NAMES.has(name)) return NextResponse.json({ success: false, message: "name tidak dikenal" }, { status: 400 });
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ success: false, message: "url tidak valid" }, { status: 400 });
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search) {
    return NextResponse.json({ success: false, message: "url harus https tanpa parameter" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("bot_endpoints")
    .upsert({ name, url: url.origin + url.pathname.replace(/\/+$/, ""), updated_at: new Date().toISOString(),
              note: String(body.note || "").slice(0, 120) || null }, { onConflict: "name" });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  forgetEndpoint(name);
  return NextResponse.json({ success: true });
}

export async function GET(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const name = new URL(req.url).searchParams.get("name") || "ram";
  const { data } = await supabaseAdmin.from("bot_endpoints").select("url, updated_at").eq("name", name).maybeSingle();
  return NextResponse.json({ success: true, url: data?.url || null, updated_at: data?.updated_at || null });
}
