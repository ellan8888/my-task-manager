// app/api/bot/market/manual/route.ts — pesaing yang ditambah manual & sedang dipantau (untuk worker Harga Pasar)
//   GET → { items: [{ product_id, url, game_slug }] }  (header x-bot-api-key)
//   Worker membuka halaman produknya langsung (tidak menunggu muncul di halaman kategori).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { data: watched, error } = await supabaseAdmin.from("market_watch").select("competitor_id").limit(5000);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  const ids = [...new Set((watched || []).map((w) => Number(w.competitor_id)))];
  if (!ids.length) return NextResponse.json({ success: true, items: [] });
  const { data, error: e2 } = await supabaseAdmin
    .from("market_listings")
    .select("product_id, url, game_slug")
    .eq("manual", true)
    .in("product_id", ids);
  if (e2) return NextResponse.json({ success: false, message: e2.message }, { status: 500 });
  return NextResponse.json({ success: true, items: data || [] });
}
