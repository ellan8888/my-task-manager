// app/api/bot/stock/catalog-prices/route.ts — harga produk kita dari daftar produk Itemku (bot, x-bot-api-key)
//   POST { prices: { "<id produk Itemku>": harga } }
//   Sumber sama dengan channel Live Stock (itemku_catalog.json). Dicocokkan lewat id di ujung link kategori,
//   bukan lewat nama, supaya tidak salah produk.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";
import { productIdFromLink } from "@/lib/marketMatch";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const prices = body?.prices;
  if (!prices || typeof prices !== "object") {
    return NextResponse.json({ success: false, message: "prices wajib berupa object { id: harga }" }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin.from("kategori_links").select("id, link, price, price_synced_at");
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  const now = new Date().toISOString();
  let updated = 0;
  let matched = 0;
  for (const r of rows || []) {
    const pid = productIdFromLink(r.link);
    if (!pid) continue;
    const raw = prices[String(pid)];
    const price = Math.round(Number(raw));
    if (!Number.isFinite(price) || price <= 0) continue;
    matched++;
    if (Number(r.price) === price && r.price_synced_at) continue;     // tidak berubah → tidak ditulis
    const { error: e } = await supabaseAdmin.from("kategori_links").update({ price, price_synced_at: now }).eq("id", r.id);
    if (!e) updated++;
  }
  return NextResponse.json({ success: true, matched, updated, total: Object.keys(prices).length });
}
