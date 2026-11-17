// app/api/market/route.ts — daftar listing pasar untuk halaman Harga Pasar (staff yang login)
//   GET ?game=break-and-steal-an-egg&inactive=1
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!getSession(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const game = searchParams.get("game") || "";
  let q = supabaseAdmin
    .from("market_listings")
    .select("product_id, game_slug, name, url, seller, is_own, price, sold, stock, thumb_url, image_url, description, ocr_text, specs, spec_source, tier, active, first_seen, last_seen, analyzed_at")
    .order("price", { ascending: true })
    .limit(500);
  if (game) q = q.eq("game_slug", game);
  if (searchParams.get("inactive") !== "1") q = q.eq("active", true);
  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  const { data: games } = await supabaseAdmin.from("market_listings").select("game_slug").eq("active", true).limit(2000);
  const counts: Record<string, number> = {};
  for (const g of games || []) counts[g.game_slug] = (counts[g.game_slug] || 0) + 1;
  return NextResponse.json({ success: true, data: data || [], games: counts });
}
