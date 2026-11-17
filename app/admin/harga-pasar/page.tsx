"use client";

// Harga Pasar — produk akun di kategori Itemku yang dibaca worker (judul, deskripsi, banner OCR).
//   Produk Saya  : produk Live Stock kita vs pesaing yang dipilih (tangga harga + saran harga)
//   Semua Produk : seluruh produk pesaing per game, untuk mengecek hasil bacaan bot

import { useEffect, useMemo, useState } from "react";
import AdminHeader from "@/app/components/AdminHeader";
import { SkeletonTable } from "@/app/components/Skeleton";
import MyProducts, { Segmented, SpecChips, Thumb } from "./MyProducts";
import type { Specs } from "@/lib/marketMatch";

type Listing = {
  product_id: number;
  game_slug: string;
  name: string | null;
  url: string | null;
  seller: string | null;
  is_own: boolean;
  price: number | null;
  sold: number | null;
  stock: number | null;
  thumb_url: string | null;
  description: string | null;
  ocr_text: string | null;
  specs: Specs | null;
  spec_source: string | null;
  active: boolean;
  first_seen: string;
  analyzed_at: string | null;
};

const GAMES: [string, string][] = [
  ["break-and-steal-an-egg", "Break and Steal an Egg"],
  ["steal-an-egg", "Steal An Egg"],
  ["throw-food-for-animals", "Throw Food For Animals"],
];
const SOURCE: Record<string, string> = { description: "deskripsi", banner: "banner", name: "judul" };
const rp = (n: number | null) => (n == null ? "-" : "Rp " + n.toLocaleString("id-ID"));
const hasSpecs = (s: Specs | null) => !!s && !!(s.income || s.speed || s.max);

export default function HargaPasarPage() {
  const [tab, setTab] = useState<"mine" | "all">("mine");
  return (
    <>
      <AdminHeader
        icon="fa-chart-column"
        iconClassName="from-cyan-600 to-sky-500 shadow-cyan-600/30"
        title="Harga Pasar"
        subtitle="Harga produkmu dibanding pesaing di Itemku"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-5">
          <nav className="flex gap-6 border-b border-slate-200 dark:border-slate-800" aria-label="Tampilan harga pasar">
            {([["mine", "Produk Saya"], ["all", "Semua Produk"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                aria-current={tab === k ? "page" : undefined}
                className={`pb-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors ${
                  tab === k ? "border-cyan-600 text-slate-900 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "mine" ? <MyProducts /> : <AllListings />}
        </div>
      </div>
    </>
  );
}

function AllListings() {
  const [game, setGame] = useState(GAMES[0][0]);
  const [rows, setRows] = useState<Listing[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");
  const [sort, setSort] = useState<"price" | "sold" | "new">("price");
  const [open, setOpen] = useState<number | null>(null);

  // Data dimuat ulang tiap ganti game (loading diset di pickGame, bukan di effect)
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/market?game=${encodeURIComponent(game)}`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled || !res.success) return;
        setRows(res.data || []);
        setCounts(res.games || {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [game]);

  const pickGame = (slug: string) => {
    if (slug === game) return;
    setLoading(true);
    setRows([]);
    setOpen(null);
    setGame(slug);
  };

  const readCount = rows.filter((r) => hasSpecs(r.specs)).length;
  const pending = rows.filter((r) => !r.analyzed_at).length;

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows
      .filter((r) => (filter === "read" ? hasSpecs(r.specs) : filter === "unread" ? !hasSpecs(r.specs) : true))
      .filter((r) => !s || `${r.name} ${r.seller} ${r.ocr_text} ${r.description}`.toLowerCase().includes(s))
      .sort((a, b) =>
        sort === "sold" ? (b.sold ?? 0) - (a.sold ?? 0) : sort === "new" ? b.first_seen.localeCompare(a.first_seen) : (a.price ?? 9e15) - (b.price ?? 9e15),
      );
  }, [rows, q, filter, sort]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={game} onChange={pickGame} options={GAMES.map(([g, l]) => [g, `${l} (${counts[g] ?? 0})`] as [string, string])} />
        <p className="text-sm text-slate-500">
          <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{readCount}</span> dari{" "}
          <span className="tabular-nums">{rows.length}</span> produk terbaca spesifikasinya
          {pending > 0 && <>, {pending} masih antre dibaca</>}
        </p>
      </div>

      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="p-3 md:p-4 flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul, penjual, atau teks di banner"
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <Segmented value={filter} onChange={setFilter} options={[["all", "Semua"], ["read", "Terbaca"], ["unread", "Tidak terbaca"]]} />
          <Segmented value={sort} onChange={setSort} options={[["price", "Termurah"], ["sold", "Terlaris"], ["new", "Terbaru"]]} />
        </div>

        {loading && rows.length === 0 ? (
          <div className="p-4">
            <SkeletonTable rows={6} />
          </div>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">
            {rows.length === 0 ? "Belum ada data. Worker Harga Pasar mengisinya saat login_once berjalan." : "Tidak ada produk yang cocok."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((r) => {
              const isOpen = open === r.product_id;
              return (
                <li key={r.product_id} className={r.is_own ? "bg-cyan-50/60 dark:bg-cyan-500/5" : ""}>
                  <div className="px-3 md:px-4 py-3 flex gap-3 items-start">
                    <Thumb src={r.thumb_url} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3">
                        <a href={r.url || "#"} target="_blank" rel="noreferrer" className="text-sm font-semibold text-slate-900 dark:text-white hover:text-cyan-700 dark:hover:text-cyan-400 line-clamp-2 leading-snug">
                          {r.name || `Produk ${r.product_id}`}
                        </a>
                        <div className="flex items-baseline gap-2 sm:block sm:text-right shrink-0">
                          <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">{rp(r.price)}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums">{(r.sold ?? 0).toLocaleString("id-ID")} terjual</div>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-600 dark:text-slate-400">{r.seller || "Penjual belum terbaca"}</span>
                        {r.is_own && <span className="px-1.5 rounded-md bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300 font-semibold">toko kita</span>}
                        {r.stock === 0 && <span className="text-amber-600">stok habis</span>}
                        <SpecChips specs={r.specs} />
                        {!r.analyzed_at ? (
                          <span className="text-slate-400">antre dibaca</span>
                        ) : !hasSpecs(r.specs) ? (
                          <span className="text-amber-600 dark:text-amber-400">income/speed tidak terbaca</span>
                        ) : r.spec_source && SOURCE[r.spec_source] ? (
                          <span className="text-slate-400">dari {SOURCE[r.spec_source]}</span>
                        ) : null}
                        <button
                          onClick={() => setOpen(isOpen ? null : r.product_id)}
                          aria-expanded={isOpen}
                          className="ml-auto text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline"
                        >
                          {isOpen ? "Tutup" : "Lihat bacaan bot"}
                        </button>
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-3 md:px-4 pb-4 grid md:grid-cols-2 gap-3 text-xs md:pl-[5.75rem]">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Teks di banner</div>
                        <div className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">{r.ocr_text || "Tidak ada teks terbaca"}</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-950 p-3">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Deskripsi</div>
                        <div className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{r.description || "Tidak ada deskripsi"}</div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
