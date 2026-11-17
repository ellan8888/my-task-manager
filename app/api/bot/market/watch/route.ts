// app/api/bot/market/watch/route.ts — pantauan pesaing untuk bot Discord (📈┃harga-pasar), header x-bot-api-key
//   GET → { items: [{ our_product_id, name, kategori, game_slug, competitors: [...] }], at }
//   Harga pesaing = hasil baca worker Harga Pasar (last_seen = kapan terakhir terbaca di halaman kategori).
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";
import { loadOurProducts, loadWatches } from "@/lib/marketData";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const watches = await loadWatches();
    const compIds = [...new Set(watches.map((w) => w.competitor_id))];
    const [products, { data: comps }] = await Promise.all([
      loadOurProducts(),
      compIds.length
        ? supabaseAdmin
            .from("market_listings")
            .select("product_id, name, seller, url, price, sold, stock, active, last_seen")
            .in("product_id", compIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);
    const compMap = new Map((comps || []).map((c) => [Number(c.product_id), c]));
    const prodMap = new Map(products.map((p) => [p.product_id, p]));

    const items: Record<number, { our_product_id: number; name: string | null; kategori: string | null; game_slug: string | null; competitors: unknown[] }> = {};
    for (const w of watches) {
      const c = compMap.get(w.competitor_id);
      if (!c) continue;
      const p = prodMap.get(w.our_product_id);
      const it = (items[w.our_product_id] ||= {
        our_product_id: w.our_product_id,
        name: p?.name ?? null,
        kategori: p?.kategori ?? null,
        game_slug: p?.game_slug ?? null,
        competitors: [],
      });
      it.competitors.push(c);
    }
    return NextResponse.json({ success: true, items: Object.values(items), at: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
