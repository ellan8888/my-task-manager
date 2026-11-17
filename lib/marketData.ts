// lib/marketData.ts — data "Produk Saya" untuk Harga Pasar (dipakai API halaman & API bot).
//   Produk kita   = kategori_links (daftar Live Stock), id produk Itemku dari ujung link.
//   Pesaing       = market_listings (hasil baca worker Harga Pasar).
//   Pilihan staff = market_watch.
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { gameSlugOf, keywordsOf, matchCompetitor, mergeSpecs, parseSpecs, productIdFromLink, type Specs } from "@/lib/marketMatch";

export type OurProduct = {
  product_id: number;
  kategori: string;
  name: string;
  game_slug: string;
  price: number | null;        // harga yang sedang tayang di Itemku (kalau terbaca), lalu harga di Live Stock
  stock: number;               // stok siap jual di My Task
  url: string;
  thumb_url: string | null;
  specs: Specs;
  keywords: string[];
};

export async function loadOurProducts(): Promise<OurProduct[]> {
  const [{ data: links, error }, { data: counts }] = await Promise.all([
    supabaseAdmin.from("kategori_links").select("kategori, nama_produk, price, link, active, default_income, default_speed").order("kategori"),
    supabaseAdmin.rpc("stock_counts"),
  ]);
  if (error) throw error;
  const stock: Record<string, number> = {};
  for (const r of (counts as { kategori: string; n: number }[] | null) || []) {
    const k = String(r.kategori || "").trim().toLowerCase();
    if (k) stock[k] = (stock[k] || 0) + Number(r.n || 0);
  }
  const rows = (links || []).filter((l) => l.active !== false && productIdFromLink(l.link));
  const ids = rows.map((l) => productIdFromLink(l.link)!);
  const { data: own } = ids.length
    ? await supabaseAdmin.from("market_listings").select("product_id, price, url, thumb_url").in("product_id", ids)
    : { data: [] };
  const ownMap = new Map((own || []).map((o) => [Number(o.product_id), o]));

  const seen = new Set<number>();
  const out: OurProduct[] = [];
  for (const l of rows) {
    const id = productIdFromLink(l.link)!;
    if (seen.has(id)) continue;
    seen.add(id);
    const kategori = String(l.kategori || "").trim();
    const name = String(l.nama_produk || kategori);
    const o = ownMap.get(id);
    out.push({
      product_id: id,
      kategori,
      name,
      game_slug: gameSlugOf(kategori) || gameSlugOf(name),
      price: o?.price ?? (l.price ? Number(l.price) : null),
      stock: stock[kategori.toLowerCase()] || 0,
      url: o?.url || l.link,
      thumb_url: o?.thumb_url ?? null,
      // nama kategori → nama produk → income/speed bawaan Live Stock (mis. "Max Account" = 10Qa+)
      specs: mergeSpecs(
        mergeSpecs(parseSpecs(kategori.split("|")[0]), parseSpecs(name.split("|")[0])),
        parseSpecs(
          [l.default_income && `income ${l.default_income}+/s`, l.default_speed && `speed ${l.default_speed}+`].filter(Boolean).join(" "),
        ),
      ),
      keywords: keywordsOf(kategori),
    });
  }
  return out;
}

export const LISTING_COLS =
  "product_id, game_slug, name, url, seller, is_own, price, sold, stock, thumb_url, specs, spec_source, active, first_seen, last_seen, analyzed_at";

/** Kandidat relevan per produk kita → { our_id: [[competitor_id, score, reasons]] } (urut paling mirip). */
export async function relevantCandidates(products: OurProduct[]) {
  const games = [...new Set(products.map((p) => p.game_slug).filter(Boolean))];
  const { data: comps } = await supabaseAdmin
    .from("market_listings")
    .select("product_id, game_slug, name, description, ocr_text, specs, is_own")
    .in("game_slug", games.length ? games : ["-"])
    .eq("active", true)
    .eq("is_own", false)
    .limit(2000);
  const ourIds = new Set(products.map((p) => p.product_id));
  const out: Record<number, [number, number, string[]][]> = {};
  for (const p of products) {
    const list: [number, number, string[]][] = [];
    for (const c of comps || []) {
      if (c.game_slug !== p.game_slug || ourIds.has(Number(c.product_id))) continue;
      // dua bacaan: gabungan (deskripsi → banner → judul) dan judul saja — deskripsi template penjual
      // sering berisi angka lain, jadi yang paling cocok yang dipakai
      const m1 = matchCompetitor(p.specs, p.keywords, c as never);
      const m2 = matchCompetitor(p.specs, p.keywords, { ...c, specs: parseSpecs(c.name) } as never);
      const m = m1.relevant && (!m2.relevant || m1.score <= m2.score) ? m1 : m2;
      if (m.relevant) list.push([Number(c.product_id), Math.round(m.score * 100) / 100, m.reasons]);
    }
    list.sort((a, b) => a[1] - b[1]);
    out[p.product_id] = list;
  }
  return out;
}

export async function loadWatches() {
  const { data, error } = await supabaseAdmin
    .from("market_watch")
    .select("our_product_id, competitor_id, added_by, created_at")
    .limit(5000);
  if (error) throw error;
  return (data || []).map((w) => ({ ...w, our_product_id: Number(w.our_product_id), competitor_id: Number(w.competitor_id) }));
}
