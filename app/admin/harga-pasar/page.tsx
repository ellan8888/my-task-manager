"use client";

// Harga Pasar — semua produk akun pesaing di halaman kategori Itemku, lengkap dengan spesifikasi
// yang dibaca bot dari deskripsi / banner (OCR) / judul. Tahap 1: untuk mengecek akurasi bacaan.

import { useEffect, useMemo, useState } from "react";
import AdminHeader from "@/app/components/AdminHeader";
import { SkeletonTable } from "@/app/components/Skeleton";

type Specs = { income?: [number, number | null]; speed?: [number, number | null]; max?: boolean; starter?: boolean };
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

const GAMES: { slug: string; label: string }[] = [
  { slug: "break-and-steal-an-egg", label: "Break and Steal an Egg" },
  { slug: "steal-an-egg", label: "Steal An Egg" },
  { slug: "throw-food-for-animals", label: "Throw Food For Animals" },
];

const UNITS: [string, number][] = [
  ["Dc", 1e33], ["No", 1e30], ["Oc", 1e27], ["Sp", 1e24], ["Sx", 1e21], ["Qi", 1e18],
  ["Qa", 1e15], ["T", 1e12], ["B", 1e9], ["M", 1e6], ["K", 1e3],
];
function fmt(v: number | null | undefined) {
  if (v == null) return "";
  for (const [u, m] of UNITS) {
    if (v >= m) {
      const n = v / m;
      return (n >= 10 || Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)) + u;
    }
  }
  return String(Math.round(v));
}
const range = (r?: [number, number | null]) =>
  !r ? null : r[1] == null ? `${fmt(r[0])}+` : r[0] === r[1] ? fmt(r[0]) : `${fmt(r[0])}–${fmt(r[1])}`;
const rupiah = (n: number | null) => (n == null ? "-" : "Rp " + n.toLocaleString("id-ID"));

const SOURCE: Record<string, { label: string; cls: string }> = {
  description: { label: "Deskripsi", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  banner: { label: "Banner (OCR)", cls: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  name: { label: "Judul", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
};

export default function HargaPasarPage() {
  const [game, setGame] = useState(GAMES[0].slug);
  const [rows, setRows] = useState<Listing[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  // Data dimuat ulang tiap ganti game (loading diset di tombol, bukan di effect)
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
    setGame(slug);
  };

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlyUnread && r.specs && (r.specs.income || r.specs.speed)) return false;
      if (!s) return true;
      return `${r.name} ${r.seller} ${r.ocr_text} ${r.description}`.toLowerCase().includes(s);
    });
  }, [rows, q, onlyUnread]);

  const readCount = rows.filter((r) => r.specs && (r.specs.income || r.specs.speed)).length;
  const pending = rows.filter((r) => !r.analyzed_at).length;

  return (
    <>
      <AdminHeader
        icon="fa-chart-column"
        iconClassName="from-cyan-600 to-sky-500 shadow-cyan-600/30"
        title="Harga Pasar"
        subtitle="Semua produk akun di kategori Itemku, dibaca dari deskripsi & banner"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-5">
        {/* Pilih game */}
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => (
            <button
              key={g.slug}
              onClick={() => pickGame(g.slug)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                game === g.slug
                  ? "bg-cyan-600 border-cyan-600 text-white"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-cyan-500"
              }`}
            >
              {g.label}
              <span className="ml-2 text-xs opacity-80">{counts[g.slug] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* Ringkasan + filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <i className="fa-solid fa-layer-group mr-1.5"></i>
            {rows.length} produk aktif · <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{readCount} terbaca</span>
            {pending > 0 && <> · {pending} masih dibaca bot</>}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
            <input type="checkbox" checked={onlyUnread} onChange={(e) => setOnlyUnread(e.target.checked)} />
            Hanya yang belum terbaca
          </label>
          <div className="relative ml-auto w-full sm:w-72">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul, penjual, teks banner…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
            />
          </div>
        </div>

        {loading && rows.length === 0 ? (
          <SkeletonTable rows={6} />
        ) : visible.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <i className="fa-solid fa-box-open text-3xl mb-3 block"></i>
            {rows.length === 0 ? "Belum ada data — bot mengisi halaman ini setelah login_once berjalan." : "Tidak ada yang cocok."}
          </div>
        ) : (
          <div className="grid gap-3">
            {visible.map((r) => {
              const inc = range(r.specs?.income);
              const spd = range(r.specs?.speed);
              const src = r.spec_source ? SOURCE[r.spec_source] : null;
              return (
                <div
                  key={r.product_id}
                  className={`rounded-2xl border bg-white dark:bg-slate-900 p-3 md:p-4 ${
                    r.is_own ? "border-cyan-400 dark:border-cyan-600" : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex gap-3 md:gap-4">
                    {r.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumb_url} alt="" className="w-28 h-14 md:w-40 md:h-20 object-cover rounded-lg shrink-0 bg-slate-100 dark:bg-slate-800" loading="lazy" />
                    ) : (
                      <div className="w-28 h-14 md:w-40 md:h-20 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={r.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-900 dark:text-white text-sm md:text-base line-clamp-2 hover:text-cyan-600"
                        >
                          {r.name || `Produk ${r.product_id}`}
                        </a>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-slate-900 dark:text-white">{rupiah(r.price)}</div>
                          <div className="text-xs text-slate-500">{(r.sold ?? 0).toLocaleString("id-ID")} terjual</div>
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-x-2">
                        <span>
                          <i className="fa-solid fa-store mr-1"></i>
                          {r.seller || "-"}
                        </span>
                        {r.is_own && <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300 font-semibold">Toko sendiri</span>}
                        {r.stock != null && <span>· stok {r.stock}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {inc && <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">Income {inc}</span>}
                        {spd && <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">Speed {spd}</span>}
                        {r.specs?.max && <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">MAX</span>}
                        {r.specs?.starter && <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Starter</span>}
                        {!r.analyzed_at ? (
                          <span className="text-xs text-slate-400"><i className="fa-solid fa-hourglass-half mr-1"></i>menunggu dibaca bot</span>
                        ) : !inc && !spd ? (
                          <span className="text-xs text-amber-600 dark:text-amber-400"><i className="fa-solid fa-triangle-exclamation mr-1"></i>income/speed tidak terbaca</span>
                        ) : null}
                        {src && <span className={`px-1.5 py-0.5 rounded text-[11px] ${src.cls}`}>dari {src.label}</span>}
                        <button
                          onClick={() => setOpen(open === r.product_id ? null : r.product_id)}
                          className="ml-auto text-xs text-cyan-600 hover:underline"
                        >
                          {open === r.product_id ? "Tutup" : "Lihat bacaan bot"}
                        </button>
                      </div>
                    </div>
                  </div>
                  {open === r.product_id && (
                    <div className="mt-3 grid md:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Teks banner (OCR)</div>
                        <div className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">{r.ocr_text || "-"}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-3">
                        <div className="font-semibold text-slate-700 dark:text-slate-300 mb-1">Deskripsi</div>
                        <div className="text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                          {r.description || "-"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
