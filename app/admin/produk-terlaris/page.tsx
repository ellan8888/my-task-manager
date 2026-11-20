"use client";

// Produk Terlaris — apa yang paling banyak laku per hari / minggu / bulan. Hanya JUMLAH terjual (tanpa rupiah),
// boleh dilihat semua staff. Data: /api/stats/top-products (income_log, stok dari Live Stock).

import { useEffect, useMemo, useState } from "react";
import AdminHeader from "@/app/components/AdminHeader";

type Range = "today" | "7d" | "30d" | "month" | "custom";
type Product = {
  rank: number;
  key: string;
  title: string;
  category: "Akun" | "Joki" | "Lainnya";
  game: string;
  n: number;
  prev_n: number;
  daily: number[];
  last_at: string;
  stock: number | null;
  per_day_7d: number;
  days_left: number | null;
};
type Restock = { key: string; title: string; stock: number; per_day_7d: number; days_left: number | null };
type Slow = { key: string; title: string; last_at: string | null; stock: number };
type Data = {
  period: { range: Range; from: string; to: string; days: string[] };
  totals: { n: number; prev_n: number; products: number };
  products: Product[];
  heatmap: number[][];
  heatmap_from: string;
  restock: Restock[];
  slow: Slow[];
};

const RANGES: [Range, string][] = [
  ["today", "Hari ini"],
  ["7d", "7 hari"],
  ["30d", "30 hari"],
  ["month", "Bulan ini"],
  ["custom", "Pilih tanggal"],
];
const PREV_LABEL: Record<Range, string> = {
  today: "kemarin",
  "7d": "7 hari sebelumnya",
  "30d": "30 hari sebelumnya",
  month: "periode yang sama sebelumnya",
  custom: "periode sebelumnya",
};
const DOW = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DOW_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const HEAT_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Senin di atas

const wibYmd = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
const shortTitle = (t: string) => t.split("|")[0].trim();
const fmtDay = (ymd: string) =>
  new Date(ymd + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

function ago(iso: string | null) {
  if (!iso) return "belum pernah";
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 60) return `${Math.max(1, Math.round(m))} menit lalu`;
  if (m < 1440) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
}

/** perubahan vs periode sebelumnya */
function Delta({ n, prev }: { n: number; prev: number }) {
  if (!prev && !n) return null;
  if (!prev) return <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">baru</span>;
  const d = n - prev;
  if (d === 0) return <span className="text-[11px] font-semibold text-slate-400">sama</span>;
  const pct = Math.round((Math.abs(d) / prev) * 100);
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${
        d > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
      title={`Sebelumnya ${prev} terjual`}
    >
      <i className={`fa-solid ${d > 0 ? "fa-arrow-up" : "fa-arrow-down"} text-[9px]`}></i>
      {pct}%
    </span>
  );
}

/** tren harian kecil — satu warna, titik terakhir ditandai */
function Spark({ values, days }: { values: number[]; days: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (values.length < 2) return null;
  const W = 120;
  const H = 32;
  const max = Math.max(1, ...values);
  const step = W / (values.length - 1);
  const pts = values.map((v, i) => [i * step, H - 3 - (v / max) * (H - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <div className="relative">
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible text-violet-500 dark:text-violet-400"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setHover(Math.max(0, Math.min(values.length - 1, Math.round(((e.clientX - r.left) / r.width) * (values.length - 1)))));
        }}
        role="img"
        aria-label={`Tren harian: ${values.join(", ")}`}
      >
        <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={H} className="stroke-slate-300 dark:stroke-slate-600" strokeWidth={1} />}
        <circle cx={(hover !== null ? pts[hover] : last)[0]} cy={(hover !== null ? pts[hover] : last)[1]} r={3} fill="currentColor" className="stroke-white dark:stroke-slate-900" strokeWidth={2} />
      </svg>
      {hover !== null && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-[11px] font-semibold pointer-events-none z-10">
          {fmtDay(days[hover])}: {values[hover]} terjual
        </div>
      )}
    </div>
  );
}

/** grafik batang harian (detail produk) */
function DailyBars({ values, days }: { values: number[]; days: string[] }) {
  const max = Math.max(1, ...values);
  const labelEvery = Math.ceil(values.length / 8);
  return (
    <div>
      <div className="flex items-end gap-[2px] h-24" role="img" aria-label="Terjual per hari">
        {values.map((v, i) => (
          <div key={days[i]} className="group relative flex-1 h-full flex items-end">
            <div
              className="w-full rounded-t-[4px] bg-violet-500/85 dark:bg-violet-400/85 group-hover:bg-violet-600 dark:group-hover:bg-violet-300 min-h-[2px]"
              style={{ height: `${v ? Math.max(4, (v / max) * 100) : 2}%`, opacity: v ? 1 : 0.25 }}
            />
            <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-2 py-1 text-[11px] font-semibold z-10">
              {fmtDay(days[i])}: {v}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-1">
        {days.map((d, i) => (
          <div key={d} className="flex-1 text-[10px] text-slate-400 text-center tabular-nums truncate">
            {i % labelEvery === 0 ? fmtDay(d) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function StockChip({ stock, daysLeft }: { stock: number | null; daysLeft: number | null }) {
  if (stock === null) return null;
  const empty = stock === 0;
  const low = !empty && daysLeft !== null && daysLeft <= 3;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
        empty
          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          : low
            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      }`}
    >
      <i className={`fa-solid ${empty ? "fa-circle-exclamation" : low ? "fa-hourglass-half" : "fa-box"} text-[9px]`}></i>
      {empty ? "Stok habis" : `Stok ${stock}`}
      {!empty && daysLeft !== null && <span className="font-normal opacity-80">· habis ±{daysLeft < 1 ? "<1" : Math.round(daysLeft)} hari</span>}
    </span>
  );
}

function Card({ title, icon, hint, children }: { title: string; icon: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 md:p-5">
      <div className="flex items-baseline gap-2 mb-3">
        <i className={`fa-solid ${icon} text-[13px] text-slate-400`}></i>
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        {hint && <span className="ml-auto text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default function ProdukTerlarisPage() {
  const [range, setRange] = useState<Range>("7d");
  const [from, setFrom] = useState(() => wibYmd(new Date(Date.now() - 13 * 86400e3)));
  const [to, setTo] = useState(() => wibYmd(new Date()));
  const [cat, setCat] = useState<"all" | "Akun" | "Joki">("all");
  const [game, setGame] = useState("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [nonce, setNonce] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const qs = useMemo(() => {
    const p = new URLSearchParams({ range });
    if (range === "custom") {
      p.set("from", from);
      p.set("to", to);
    }
    return p.toString();
  }, [range, from, to]);
  const reqKey = `${qs}#${nonce}`;
  const loading = loadedKey !== reqKey;
  const load = () => setNonce((n) => n + 1);

  useEffect(() => {
    let alive = true;
    fetch(`/api/stats/top-products?${qs}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d.success) throw new Error(d.message || "Gagal memuat");
        setData(d);
        setError("");
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoadedKey(`${qs}#${nonce}`));
    return () => {
      alive = false;
    };
  }, [qs, nonce]);

  const games = useMemo(() => [...new Set((data?.products || []).map((p) => p.game))].sort(), [data]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data?.products || []).filter(
      (p) => (cat === "all" || p.category === cat) && (game === "all" || p.game === game) && (!s || p.title.toLowerCase().includes(s)),
    );
  }, [data, cat, game, q]);
  const shown = showAll ? list : list.slice(0, 15);
  const max = Math.max(1, ...list.map((p) => p.n));
  const filteredTotal = list.reduce((s, p) => s + p.n, 0);
  const filteredPrev = list.reduce((s, p) => s + p.prev_n, 0);

  const busiest = useMemo(() => {
    if (!data) return null;
    let best = { dow: 0, hour: 0, n: 0 };
    data.heatmap.forEach((row, dow) => row.forEach((n, hour) => n > best.n && (best = { dow, hour, n })));
    return best.n ? best : null;
  }, [data]);
  const heatMax = Math.max(1, ...(data?.heatmap.flat() || [0]));
  const days = data?.period.days || [];

  return (
    <>
      <AdminHeader icon="fa-ranking-star" title="Produk Terlaris" subtitle="Yang paling banyak laku — jumlah terjual per produk" />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-5 md:py-7 space-y-5">
          {/* ── filter ── */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex max-w-full overflow-x-auto p-0.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-[13px] font-semibold">
              {RANGES.map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setRange(v)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    range === v ? "bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {range === "custom" && (
              <div className="flex items-center gap-1.5 text-[13px]">
                <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
                <span className="text-slate-400">sampai</span>
                <input type="date" value={to} min={from} max={wibYmd(new Date())} onChange={(e) => setTo(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100" />
              </div>
            )}
            <div className="flex flex-wrap md:flex-nowrap items-center gap-1.5 md:ml-auto w-full md:w-auto">
              <select value={cat} onChange={(e) => setCat(e.target.value as typeof cat)} className="flex-1 md:flex-none px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[13px] text-slate-900 dark:text-slate-100">
                <option value="all">Akun & Joki</option>
                <option value="Akun">Akun saja</option>
                <option value="Joki">Joki saja</option>
              </select>
              <select value={game} onChange={(e) => setGame(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[13px] text-slate-900 dark:text-slate-100 flex-1 md:flex-none md:max-w-[11rem]">
                <option value="all">Semua game</option>
                {games.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <div className="relative w-full md:w-52">
                <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400"></i>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk" className="w-full pl-7 pr-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-base md:text-[13px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400" />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              {error} <button onClick={load} className="underline font-semibold ml-1">Coba lagi</button>
            </div>
          )}

          {/* ── ringkasan ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3.5">
              <div className="text-[12px] text-slate-500">Terjual</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold tabular-nums">{loading && !data ? "–" : filteredTotal}</span>
                {data && <Delta n={filteredTotal} prev={filteredPrev} />}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">vs {PREV_LABEL[range]}: {data ? filteredPrev : "–"}</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3.5">
              <div className="text-[12px] text-slate-500">Produk yang laku</div>
              <div className="text-2xl font-bold tabular-nums mt-0.5">{data ? list.length : "–"}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">dari semua produk di toko</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3.5 col-span-2 lg:col-span-1">
              <div className="text-[12px] text-slate-500">Paling laku</div>
              <div className="text-[15px] font-bold leading-snug mt-1 line-clamp-2">{list[0] ? shortTitle(list[0].title) : "–"}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{list[0] ? `${list[0].n} terjual · ${list[0].game}` : ""}</div>
            </div>
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3.5 col-span-2 lg:col-span-1">
              <div className="text-[12px] text-slate-500">Paling ramai</div>
              <div className="text-[15px] font-bold mt-1">{busiest ? `${DOW[busiest.dow]}, ${String(busiest.hour).padStart(2, "0")}.00–${String((busiest.hour + 1) % 24).padStart(2, "0")}.00` : "–"}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">jam & hari dengan penjualan terbanyak</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem] gap-5 items-start">
            {/* ── peringkat ── */}
            <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="flex items-baseline gap-2 px-4 md:px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-sm font-bold">Peringkat</h2>
                <span className="text-[11px] text-slate-400">
                  {days.length > 1 ? `${fmtDay(days[0])} – ${fmtDay(days[days.length - 1])}` : days[0] ? fmtDay(days[0]) : ""} · ketuk produk untuk grafik harian
                </span>
                {loading && <i className="fa-solid fa-circle-notch fa-spin text-[11px] text-slate-400 ml-auto"></i>}
              </div>
              {!loading && !list.length && (
                <div className="px-5 py-12 text-center text-sm text-slate-500">Belum ada yang laku di periode ini.</div>
              )}
              <ol>
                {shown.map((p) => {
                  const isOpen = open === p.key;
                  return (
                    <li key={p.key} className="border-b border-slate-100 dark:border-slate-800/80 last:border-0">
                      <button
                        onClick={() => setOpen(isOpen ? null : p.key)}
                        aria-expanded={isOpen}
                        className="w-full text-left px-4 md:px-5 py-3 flex items-center gap-3 md:gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800/40"
                      >
                        <span className={`w-7 shrink-0 text-right tabular-nums font-bold ${p.rank <= 3 ? "text-lg text-slate-900 dark:text-white" : "text-sm text-slate-400"}`}>{p.rank}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-[14px] font-semibold leading-snug text-slate-900 dark:text-slate-100">{shortTitle(p.title)}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-slate-500">
                            <span className={`px-1.5 py-px rounded font-semibold ${p.category === "Joki" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"}`}>{p.category}</span>
                            <span>{p.game}</span>
                            <StockChip stock={p.stock} daysLeft={p.days_left} />
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500 dark:bg-violet-400" style={{ width: `${(p.n / max) * 100}%` }} />
                          </div>
                        </div>
                        <div className="hidden sm:block shrink-0">
                          <Spark values={p.daily} days={days} />
                        </div>
                        <div className="w-16 shrink-0 text-right">
                          <div className="text-lg font-bold tabular-nums leading-none">{p.n}</div>
                          <div className="mt-1"><Delta n={p.n} prev={p.prev_n} /></div>
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-4 md:px-5 pb-4 pl-14 md:pl-16">
                          <div className="text-[12px] text-slate-500 mb-2 break-words">{p.title}</div>
                          {days.length > 1 && <DailyBars values={p.daily} days={days} />}
                          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-[12px]">
                            <div><dt className="text-slate-400">Periode ini</dt><dd className="font-semibold tabular-nums">{p.n} terjual</dd></div>
                            <div><dt className="text-slate-400">Sebelumnya</dt><dd className="font-semibold tabular-nums">{p.prev_n} terjual</dd></div>
                            <div><dt className="text-slate-400">Rata-rata 7 hari</dt><dd className="font-semibold tabular-nums">{p.per_day_7d} / hari</dd></div>
                            <div><dt className="text-slate-400">Terakhir laku</dt><dd className="font-semibold">{ago(p.last_at)}</dd></div>
                          </dl>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {list.length > 15 && (
                <button onClick={() => setShowAll((v) => !v)} className="w-full py-3 text-[13px] font-semibold text-violet-600 dark:text-violet-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
                  {showAll ? "Tampilkan 15 teratas" : `Tampilkan semua (${list.length} produk)`}
                </button>
              )}
            </section>

            <div className="space-y-5">
              {/* ── perlu diisi ── */}
              <Card title="Perlu diisi" icon="fa-boxes-stacked" hint="menurut laku 7 hari">
                {!data ? (
                  <div className="text-[13px] text-slate-400">–</div>
                ) : !data.restock.length ? (
                  <div className="text-[13px] text-slate-500">Stok aman — tidak ada yang diperkirakan habis dalam 7 hari.</div>
                ) : (
                  <ul className="space-y-2.5">
                    {data.restock.map((r) => (
                      <li key={r.key} className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold leading-snug">{shortTitle(r.title)}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">laku {r.per_day_7d}/hari · stok {r.stock}</div>
                        </div>
                        <span className={`shrink-0 text-[12px] font-bold tabular-nums ${r.stock === 0 ? "text-rose-600 dark:text-rose-400" : (r.days_left ?? 9) <= 2 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-300"}`}>
                          {r.stock === 0 ? "Habis" : `±${(r.days_left ?? 0) < 1 ? "<1" : Math.round(r.days_left ?? 0)} hari`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* ── jam ramai ── */}
              <Card title="Jam ramai" icon="fa-clock" hint={data ? `sejak ${fmtDay(wibYmd(new Date(data.heatmap_from)))}` : undefined}>
                {data && (
                  <div>
                    <div className="grid grid-cols-[2.2rem_repeat(24,minmax(0,1fr))] gap-[2px]">
                      {HEAT_ORDER.map((dow) => (
                        <div key={dow} className="contents">
                          <div className="text-[10px] text-slate-400 leading-none self-center">{DOW_SHORT[dow]}</div>
                          {data.heatmap[dow].map((n, h) => (
                            <div
                              key={h}
                              title={`${DOW[dow]} ${String(h).padStart(2, "0")}.00: ${n} terjual`}
                              className="aspect-square rounded-[3px] bg-violet-600 dark:bg-violet-400"
                              style={{ opacity: n ? 0.15 + 0.85 * (n / heatMax) : 0.06 }}
                            />
                          ))}
                        </div>
                      ))}
                      <div />
                      {Array.from({ length: 24 }, (_, h) => (
                        <div key={h} className="text-[9px] text-slate-400 text-center tabular-nums">{h % 6 === 0 ? h : ""}</div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
                      sepi
                      {[0.06, 0.3, 0.55, 0.8, 1].map((o) => (
                        <span key={o} className="w-3 h-3 rounded-[3px] bg-violet-600 dark:bg-violet-400" style={{ opacity: o }} />
                      ))}
                      ramai
                    </div>
                  </div>
                )}
              </Card>

              {/* ── tidak laku ── */}
              <Card title="Tidak laku 7 hari" icon="fa-moon" hint="masih ada stok">
                {!data ? (
                  <div className="text-[13px] text-slate-400">–</div>
                ) : !data.slow.length ? (
                  <div className="text-[13px] text-slate-500">Semua produk yang punya stok laku dalam 7 hari terakhir.</div>
                ) : (
                  <ul className="space-y-2">
                    {data.slow.map((s) => (
                      <li key={s.key} className="flex items-start gap-3">
                        <div className="min-w-0 flex-1 text-[13px] leading-snug">{shortTitle(s.title)}</div>
                        <div className="shrink-0 text-right text-[11px] text-slate-400 tabular-nums">
                          <div>stok {s.stock}</div>
                          <div>{s.last_at ? ago(s.last_at) : "belum pernah laku"}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
