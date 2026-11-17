// app/api/market/mine/route.ts — tab "Produk Saya" di Harga Pasar (staff yang login)
//   GET → { products, listings, watches, candidates }
//     products   : produk kita dari Live Stock (kategori_links) + harga, stok, spesifikasi
//     listings   : semua produk pesaing aktif di game tersebut (+ yang dipantau walau sudah tidak aktif)
//     watches    : pilihan pesaing yang dipantau per produk kita
//     candidates : { our_id: [[competitor_id, skor, alasan]] } — yang relevan menurut spesifikasi (OCR/deskripsi)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { LISTING_COLS, loadOurProducts, loadWatches, relevantCandidates } from "@/lib/marketData";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!getSession(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const [products, watches] = await Promise.all([loadOurProducts(), loadWatches()]);
    const games = [...new Set(products.map((p) => p.game_slug).filter(Boolean))];
    const ourIds = new Set(products.map((p) => p.product_id));

    const { data: active, error } = await supabaseAdmin
      .from("market_listings")
      .select(LISTING_COLS)
      .in("game_slug", games.length ? games : ["-"])
      .eq("active", true)
      .eq("is_own", false)
      .order("price", { ascending: true })
      .limit(2000);
    if (error) throw error;
    const listings = (active || []).filter((l) => !ourIds.has(Number(l.product_id)));

    // pesaing yang dipantau tapi sudah tidak tampil di kategori tetap dikirim (ditandai tidak aktif)
    const have = new Set(listings.map((l) => Number(l.product_id)));
    const missing = [...new Set(watches.map((w) => w.competitor_id))].filter((id) => !have.has(id));
    if (missing.length) {
      const { data: gone } = await supabaseAdmin.from("market_listings").select(LISTING_COLS).in("product_id", missing);
      listings.push(...(gone || []));
    }

    const candidates = await relevantCandidates(products);
    return NextResponse.json({ success: true, products, listings, watches, candidates });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
