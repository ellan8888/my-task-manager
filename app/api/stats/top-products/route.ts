// app/api/stats/top-products/route.ts — data halaman Produk Terlaris (semua staff yang login).
//   GET ?range=today|7d|30d|month|custom[&from=YYYY-MM-DD&to=YYYY-MM-DD]   (tanggal WIB, "to" ikut dihitung)
//   → { period, prev, totals, products[], heatmap[7][24], restock[], slow[] }
// HANYA jumlah terjual — tidak ada rupiah (pendapatan tidak ditampilkan di fitur ini).
// Sumber: income_log lewat fungsi SQL sql/035_sales_stats.sql; stok dari stock_counts() + kategori_links.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const WIB_MS = 7 * 3600e3;
const DAY = 86400e3;
const MAX_DAYS = 366;

type Daily = { key: string; title: string; day: string; n: number; last_at: string };

/** "2026-11-20" (WIB) → awal hari itu sebagai Date (UTC) */
const wibStart = (ymd: string) => new Date(Date.parse(ymd + "T00:00:00Z") - WIB_MS);
const wibYmd = (d: Date) => new Date(d.getTime() + WIB_MS).toISOString().slice(0, 10);

/** sama dengan sales_norm() di SQL: huruf kecil, spasi rapi, " | " seragam */
const norm = (t: string) => t.trim().toLowerCase().replace(/\s*\|\s*/g, " | ").replace(/\s+/g, " ");

function categoryOf(title: string): "Akun" | "Joki" | "Lainnya" {
  if (/^\s*joki\b/i.test(title)) return "Joki";
  if (/\b(akun|account)\b/i.test(title)) return "Akun";
  return "Lainnya";
}
function gameOf(title: string) {
  const parts = title.split("|").map((s) => s.trim()).filter(Boolean);
  const g = parts.length > 1 ? parts[parts.length - 1] : "";
  // "Break and Steal an Egg" / "Break And Steal An Egg" → satu nama
  return g.toLowerCase().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and") || "Lainnya";
}

function periodOf(sp: URLSearchParams) {
  const range = sp.get("range") || "7d";
  const now = new Date();
  const todayStart = wibStart(wibYmd(now));
  let from: Date;
  let to = now;
  if (range === "today") from = todayStart;
  else if (range === "30d") from = new Date(todayStart.getTime() - 29 * DAY);
  else if (range === "month") from = wibStart(wibYmd(now).slice(0, 8) + "01");
  else if (range === "custom") {
    const f = sp.get("from") || "";
    const t = sp.get("to") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error("Tanggal tidak valid");
    from = wibStart(f);
    to = new Date(Math.min(wibStart(t).getTime() + DAY, now.getTime()));
    if (to <= from) throw new Error("Tanggal akhir harus setelah tanggal awal");
    if (to.getTime() - from.getTime() > MAX_DAYS * DAY) throw new Error("Maksimal 1 tahun");
  } else from = new Date(todayStart.getTime() - 6 * DAY); // 7d
  const len = to.getTime() - from.getTime();
  return { range, from, to, prevFrom: new Date(from.getTime() - len), prevTo: from };
}

async function daily(from: Date, to: Date) {
  const { data, error } = await supabaseAdmin.rpc("sales_product_daily", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return (data || []) as Daily[];
}

export async function GET(req: Request) {
  if (!getSession(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  let p: ReturnType<typeof periodOf>;
  try {
    p = periodOf(new URL(req.url).searchParams);
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  try {
    const now = new Date();
    const heatFrom = new Date(Math.min(p.from.getTime(), now.getTime() - 28 * DAY));
    const [cur, prev, last7, heat, last, stockRes, linksRes] = await Promise.all([
      daily(p.from, p.to),
      daily(p.prevFrom, p.prevTo),
      daily(new Date(now.getTime() - 7 * DAY), now),
      // jam ramai butuh data cukup: minimal 4 minggu terakhir walau periode yang dipilih lebih pendek
      supabaseAdmin.rpc("sales_heatmap", { p_from: heatFrom.toISOString(), p_to: p.to.toISOString() }),
      supabaseAdmin.rpc("sales_last_sold"),
      supabaseAdmin.rpc("stock_counts"),
      supabaseAdmin.from("kategori_links").select("kategori, nama_produk, active"),
    ]);

    // ── stok siap jual per produk (kategori → nama produk Itemku) ──
    const stockByKey = new Map<string, number>();
    const linkTitle = new Map<string, string>();
    const katToKey = new Map<string, string>();
    for (const l of linksRes.data || []) {
      if (!l.nama_produk || l.active === false) continue;
      const k = norm(l.nama_produk);
      katToKey.set(norm(l.kategori || ""), k);
      linkTitle.set(k, l.nama_produk);
    }
    for (const r of (stockRes.data || []) as { kategori: string; n: number }[]) {
      const k = katToKey.get(norm(r.kategori || ""));
      if (k) stockByKey.set(k, (stockByKey.get(k) || 0) + Number(r.n || 0));
    }

    // ── rata-rata laku per hari (7 hari terakhir, terlepas dari periode yang dipilih) ──
    const per7 = new Map<string, number>();
    for (const r of last7) per7.set(r.key, (per7.get(r.key) || 0) + r.n);

    // ── susun per produk ──
    const days: string[] = [];
    for (let t = new Date(wibStart(wibYmd(p.from))); t < p.to; t = new Date(t.getTime() + DAY)) days.push(wibYmd(t));
    const prevBy = new Map<string, number>();
    for (const r of prev) prevBy.set(r.key, (prevBy.get(r.key) || 0) + r.n);

    const byKey = new Map<string, { key: string; title: string; n: number; perDay: Map<string, number>; last_at: string }>();
    for (const r of cur) {
      const e = byKey.get(r.key) || { key: r.key, title: linkTitle.get(r.key) || r.title, n: 0, perDay: new Map(), last_at: r.last_at };
      e.n += r.n;
      e.perDay.set(r.day, (e.perDay.get(r.day) || 0) + r.n);
      if (r.last_at > e.last_at) e.last_at = r.last_at;
      byKey.set(r.key, e);
    }
    const lastBy = new Map<string, { last_at: string; total: number; title: string }>();
    for (const r of (last.data || []) as { key: string; title: string; last_at: string; total: number }[]) lastBy.set(r.key, r);

    const daysLeft = (key: string) => {
      const stock = stockByKey.get(key);
      const v = (per7.get(key) || 0) / 7;
      return stock == null ? null : v > 0 ? Math.round((stock / v) * 10) / 10 : null;
    };

    const products = [...byKey.values()]
      .sort((a, b) => b.n - a.n || (a.last_at < b.last_at ? 1 : -1))
      .map((e, i) => ({
        rank: i + 1,
        key: e.key,
        title: e.title,
        category: categoryOf(e.title),
        game: gameOf(e.title),
        n: e.n,
        prev_n: prevBy.get(e.key) || 0,
        daily: days.map((d) => e.perDay.get(d) || 0),
        last_at: e.last_at,
        stock: stockByKey.has(e.key) ? stockByKey.get(e.key)! : null,
        per_day_7d: Math.round(((per7.get(e.key) || 0) / 7) * 10) / 10,
        days_left: daysLeft(e.key),
      }));

    // ── perlu diisi: stok habis duluan menurut kecepatan laku 7 hari ──
    const restock = [...stockByKey.entries()]
      .map(([key, stock]) => ({
        key,
        title: linkTitle.get(key) || lastBy.get(key)?.title || key,
        stock,
        per_day_7d: Math.round(((per7.get(key) || 0) / 7) * 10) / 10,
        days_left: daysLeft(key),
      }))
      .filter((r) => r.per_day_7d > 0 && (r.days_left ?? 99) <= 7)
      .sort((a, b) => (a.days_left ?? 99) - (b.days_left ?? 99));
    // produk aktif yang stoknya 0 tapi laku 7 hari terakhir → habis sekarang
    for (const [key, title] of linkTitle) {
      if (!stockByKey.has(key) && (per7.get(key) || 0) > 0) {
        restock.unshift({ key, title, stock: 0, per_day_7d: Math.round(((per7.get(key) || 0) / 7) * 10) / 10, days_left: 0 });
      }
    }

    // ── tidak laku 7 hari: produk aktif di Kategori Link (punya stok / masih dijual) ──
    const weekAgo = new Date(now.getTime() - 7 * DAY).toISOString();
    const slow = [...linkTitle.entries()]
      .map(([key, title]) => ({ key, title, last_at: lastBy.get(key)?.last_at || null, stock: stockByKey.get(key) ?? 0 }))
      .filter((r) => (!r.last_at || r.last_at < weekAgo) && r.stock > 0)
      .sort((a, b) => (a.last_at || "").localeCompare(b.last_at || ""));

    // ── jam ramai ──
    const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const r of (heat.data || []) as { dow: number; hour: number; n: number }[]) heatmap[r.dow][r.hour] = r.n;

    const total = products.reduce((s, x) => s + x.n, 0);
    const prevTotal = [...prevBy.values()].reduce((s, n) => s + n, 0);
    return NextResponse.json({
      success: true,
      period: { range: p.range, from: p.from.toISOString(), to: p.to.toISOString(), days },
      prev: { from: p.prevFrom.toISOString(), to: p.prevTo.toISOString() },
      totals: { n: total, prev_n: prevTotal, products: products.length },
      products,
      heatmap,
      heatmap_from: heatFrom.toISOString(),
      restock: restock.slice(0, 12),
      slow: slow.slice(0, 20),
    });
  } catch (e) {
    return NextResponse.json({ success: false, message: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
