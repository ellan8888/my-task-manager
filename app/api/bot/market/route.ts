// app/api/bot/market/route.ts — data harga pasar dari login_once (header x-bot-api-key)
//
//   POST { game, cards: [...], details: [...], complete?: true, seen_ids?: number[] }
//     cards   : hasil halaman kategori → { product_id, name, url, price, sold, thumb_url }
//               (upsert; riwayat harga dicatat kalau harga / terjual berubah)
//     details : hasil detail + OCR → { product_id, seller, stock, image_url, description, ocr_text,
//               specs, spec_source, is_own }
//     complete: semua halaman kategori game ini sudah dibaca → listing lain jadi active=false
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Card = { product_id: number; name?: string; url?: string; price?: number; sold?: number; thumb_url?: string };
type Detail = {
  product_id: number; seller?: string | null; stock?: number | null; image_url?: string | null;
  description?: string | null; ocr_text?: string | null; specs?: unknown; spec_source?: string | null; is_own?: boolean;
};

const int = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);
const str = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n));

export async function POST(request: Request) {
  if (!isBotRequest(request)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    const game = String(body.game || "").slice(0, 80);
    if (!game) return NextResponse.json({ success: false, message: "game wajib" }, { status: 400 });
    const now = new Date().toISOString();
    const out = { cards: 0, history: 0, details: 0, deactivated: 0 };

    // 1. Kartu kategori
    const cards: Card[] = (Array.isArray(body.cards) ? body.cards : []).filter((c: Card) => int(c?.product_id));
    if (cards.length) {
      const ids = cards.map((c) => int(c.product_id)!);
      const { data: prev } = await supabaseAdmin.from("market_listings").select("product_id, price, sold").in("product_id", ids);
      const prevMap = new Map((prev || []).map((p) => [Number(p.product_id), p]));
      const rows = cards.map((c) => ({
        product_id: int(c.product_id)!, game_slug: game, name: str(c.name, 300), url: str(c.url, 500),
        price: int(c.price), sold: int(c.sold), thumb_url: str(c.thumb_url, 600),
        active: true, last_seen: now, updated_at: now,
      }));
      const { error } = await supabaseAdmin.from("market_listings").upsert(rows, { onConflict: "product_id" });
      if (error) throw error;
      out.cards = rows.length;
      const hist = rows
        .filter((r) => {
          const p = prevMap.get(r.product_id);
          return !p || p.price !== r.price || p.sold !== r.sold;
        })
        .map((r) => ({ product_id: r.product_id, price: r.price, sold: r.sold, at: now }));
      if (hist.length) {
        const { error: hErr } = await supabaseAdmin.from("market_price_history").insert(hist);
        if (!hErr) out.history = hist.length;
      }
    }

    // 2. Detail + OCR (satu per satu: kolomnya bisa berbeda-beda)
    const details: Detail[] = (Array.isArray(body.details) ? body.details : []).filter((d: Detail) => int(d?.product_id));
    for (const d of details) {
      const patch: Record<string, unknown> = { analyzed_at: now, updated_at: now };
      if ("seller" in d) patch.seller = str(d.seller, 120);
      if ("stock" in d) patch.stock = int(d.stock);
      if ("image_url" in d) patch.image_url = str(d.image_url, 600);
      if ("description" in d) patch.description = str(d.description, 3000);
      if ("ocr_text" in d) patch.ocr_text = str(d.ocr_text, 2000);
      if ("specs" in d) patch.specs = d.specs ?? null;
      if ("spec_source" in d) patch.spec_source = str(d.spec_source, 40);
      if ("is_own" in d) patch.is_own = !!d.is_own;
      const { error } = await supabaseAdmin.from("market_listings").update(patch).eq("product_id", int(d.product_id)!);
      if (!error) out.details++;
    }

    // 3. Scan lengkap → yang tidak terlihat lagi = tidak aktif
    if (body.complete && Array.isArray(body.seen_ids) && body.seen_ids.length) {
      const seen = body.seen_ids.map(int).filter(Boolean) as number[];
      const { data: gone } = await supabaseAdmin
        .from("market_listings")
        .update({ active: false, updated_at: now })
        .eq("game_slug", game)
        .eq("active", true)
        .not("product_id", "in", `(${seen.join(",")})`)
        .select("product_id");
      out.deactivated = gone?.length || 0;
    }
    return NextResponse.json({ success: true, ...out });
  } catch (err) {
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
