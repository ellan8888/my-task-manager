"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminHeader from "@/app/components/AdminHeader";
import RoleBadge from "@/app/components/RoleBadge";
import { DatePicker, SegmentedChoice } from "@/app/components/Pickers";
import { useToast } from "@/app/components/ToastProvider";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type UserSummary = {
  name: string;
  net: number;
  gross: number;
  fee: number;
  count: number;
  prev_net: number;
  prev_count: number;
};

type Transaction = {
  id: number;
  order_id: string;
  joki_name: string;
  roblox_username: string | null;
  product_title: string | null;
  buyer_name: string | null;
  completed_at: string | null;
  net: number;
  gross: number;
  fee: number;
  replaced: { from_owner: string | null; from_username: string } | null;
};

type Summary = {
  period: { from: string; to: string };
  users: UserSummary[];
  daily: { dates: string[]; series: Record<string, number[]> };
  transactions: Transaction[];
  total_count: number;
};

type OrderCheck = {
  order_id: string;
  detail_url: string | null;
  kind: "joki" | "akun";
  position: string;
  action: "none" | "catat_joki" | "retry_joki" | "catat_akun";
  income: {
    id: number;
    joki_name: string | null;
    roblox_username: string | null;
    completed_at: string | null;
    product_title: string | null;
    buyer_name: string | null;
    net: number;
    gross: number;
    fee: number;
    fee_percent: number;
  }[];
  joki: {
    product: string | null;
    joki_name: string | null;
    roblox_username: string | null;
    queue_status: string | null;
    total_income: number | null;
    manual_retry_count: number | null;
  } | null;
  replacements: { id: number; old_username: string; new_username: string; old_added_by: string | null; new_added_by: string | null; status: string; created_at: string }[];
  reprocess: { id: number; status: string; error: string | null; result: string | null; created_at: string; updated_at: string } | null;
};

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

const rupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(Math.round(n))}`;
const rupiahShort = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}jt`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}rb`;
  return `${Math.round(n)}`;
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "-";
const fmtDay = (d: string) => new Date(`${d}T00:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });

/** Tanggal WIB "YYYY-MM-DD" */
const wibToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

type PresetKey = "today" | "7d" | "month" | "lastmonth" | "custom";

function presetRange(key: Exclude<PresetKey, "custom">): { from: string; to: string } {
  const today = wibToday();
  if (key === "today") return { from: today, to: today };
  if (key === "7d") return { from: addDays(today, -6), to: today };
  const monthStart = today.slice(0, 8) + "01";
  if (key === "month") return { from: monthStart, to: today };
  const lastEnd = addDays(monthStart, -1);
  return { from: lastEnd.slice(0, 8) + "01", to: lastEnd };
}

const USER_COLORS: Record<string, { solid: string; bar: string; ring: string; text: string; soft: string }> = {
  ellan: { solid: "bg-violet-500 border-violet-500 shadow-violet-500/30", bar: "#8b5cf6", ring: "border-violet-300 dark:border-violet-500/40", text: "text-violet-600 dark:text-violet-400", soft: "bg-violet-100 dark:bg-violet-500/15" },
  rizki: { solid: "bg-sky-500 border-sky-500 shadow-sky-500/30", bar: "#0ea5e9", ring: "border-sky-300 dark:border-sky-500/40", text: "text-sky-600 dark:text-sky-400", soft: "bg-sky-100 dark:bg-sky-500/15" },
  ridho: { solid: "bg-amber-500 border-amber-500 shadow-amber-500/30", bar: "#f59e0b", ring: "border-amber-300 dark:border-amber-500/40", text: "text-amber-600 dark:text-amber-400", soft: "bg-amber-100 dark:bg-amber-500/15" },
};
const OTHER_COLOR = { solid: "bg-slate-500 border-slate-500 shadow-slate-500/30", bar: "#64748b", ring: "border-slate-300 dark:border-slate-700", text: "text-slate-600 dark:text-slate-300", soft: "bg-slate-100 dark:bg-slate-800" };
const colorOf = (name: string) => USER_COLORS[name] || OTHER_COLOR;

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

export default function PendapatanTimPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const isEllan = user?.username?.toLowerCase() === "ellan";
  const [tab, setTab] = useState<"ringkasan" | "cek">("ringkasan");

  const header = (
    <AdminHeader
      icon="fa-people-group"
      iconClassName="from-emerald-600 via-teal-600 to-cyan-500 shadow-emerald-600/30"
      title="Pendapatan Tim"
      subtitle="Pantau pendapatan owner & staff — khusus owner"
    >
      {isEllan && (
        <div className="flex bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 gap-1">
          {(
            [
              ["ringkasan", "fa-chart-simple", "Ringkasan"],
              ["cek", "fa-magnifying-glass-dollar", "Cek Order"],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                tab === key ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <i className={`fa-solid ${icon} text-[11px]`}></i>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}
    </AdminHeader>
  );

  if (userLoading) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center">
          <i className="fa-solid fa-spinner fa-spin text-emerald-500 text-2xl"></i>
        </div>
      </>
    );
  }

  if (!isEllan) {
    return (
      <>
        {header}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-500/20">
              <i className="fa-solid fa-lock text-2xl"></i>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white mb-1">Akses ditolak</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Halaman ini khusus Ellan.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-6xl mx-auto">{tab === "ringkasan" ? <RingkasanTab /> : <CekOrderTab />}</div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 1 — RINGKASAN
// ══════════════════════════════════════════════════════════════

function RingkasanTab() {
  const toast = useToast();
  const [preset, setPreset] = useState<PresetKey>("month");
  const [range, setRange] = useState(() => presetRange("month"));
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState<string>("all");
  const [txSearch, setTxSearch] = useState("");

  const load = useCallback(async (r: { from: string; to: string }) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pendapatan?from=${r.from}&to=${r.to}`);
      const json = await res.json();
      if (json.success) setData(json);
      else toast.error(json.message || "Gagal memuat pendapatan");
    } catch {
      toast.error("Gagal memuat pendapatan");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const t = setTimeout(() => load(range), 0);
    return () => clearTimeout(t);
  }, [range, load]);

  const choosePreset = (key: PresetKey) => {
    setPreset(key);
    if (key !== "custom") setRange(presetRange(key));
  };

  const applyCustom = () => {
    if (!customFrom || !customTo || customFrom > customTo) {
      toast.warning("Tanggal awal harus sebelum tanggal akhir");
      return;
    }
    setRange({ from: customFrom, to: customTo });
  };

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.daily.dates.map((d, i) => {
      const row: Record<string, number | string> = { date: d };
      data.users.forEach((u) => (row[u.name] = data.daily.series[u.name]?.[i] || 0));
      return row;
    });
  }, [data]);

  const totalNet = data?.users.reduce((s, u) => s + u.net, 0) || 0;

  const transactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return (data?.transactions || []).filter(
      (t) =>
        (filterUser === "all" || t.joki_name === filterUser) &&
        (!q ||
          t.order_id.toLowerCase().includes(q) ||
          (t.roblox_username || "").toLowerCase().includes(q) ||
          (t.product_title || "").toLowerCase().includes(q))
    );
  }, [data, filterUser, txSearch]);

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes pc-check { from { transform: scale(0) rotate(-30deg) } to { transform: scale(1) rotate(0) } }
        .pc-check { animation: pc-check .35s cubic-bezier(.34,1.56,.64,1) }
        @media (prefers-reduced-motion: reduce) { .pc-check { animation: none } }
      `}</style>
      {/* ═══ PERIODE ═══ */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["today", "Hari ini"],
            ["7d", "7 hari"],
            ["month", "Bulan ini"],
            ["lastmonth", "Bulan lalu"],
            ["custom", "Pilih tanggal"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => choosePreset(key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
              preset === key
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                : "bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400"
            }`}
          >
            {label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              value={customFrom}
              max={customTo}
              onChange={setCustomFrom}
              accent="emerald"
              size="sm"
              className="w-40"
              ariaLabel="Dari tanggal"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <DatePicker
              value={customTo}
              min={customFrom}
              onChange={setCustomTo}
              accent="emerald"
              size="sm"
              className="w-40"
              ariaLabel="Sampai tanggal"
            />
            <button
              type="button"
              onClick={applyCustom}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500"
            >
              Terapkan
            </button>
          </div>
        )}
        <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-auto">
          {fmtDay(range.from)} – {fmtDay(range.to)}
          {loading && <i className="fa-solid fa-spinner fa-spin ml-2 text-emerald-500"></i>}
        </span>
      </div>

      {/* ═══ KARTU PER USER ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data?.users || []).map((u) => {
          const c = colorOf(u.name);
          const diff = u.net - u.prev_net;
          const pct = u.prev_net > 0 ? (diff / u.prev_net) * 100 : null;
          const share = totalNet > 0 ? (u.net / totalNet) * 100 : 0;
          const selected = filterUser === u.name;
          const dimmed = filterUser !== "all" && !selected;
          return (
            <button
              key={u.name}
              type="button"
              onClick={() => setFilterUser(selected ? "all" : u.name)}
              aria-pressed={selected}
              className={`relative overflow-hidden text-left bg-white dark:bg-slate-900/60 rounded-2xl border p-5 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 active:scale-[0.985] active:duration-150 ${
                selected
                  ? "-translate-y-1"
                  : "border-slate-200 dark:border-slate-800"
              } ${dimmed ? "opacity-55 hover:opacity-90" : ""}`}
              style={
                selected
                  ? {
                      // Pinggiran warna user (2px, tanpa bayangan) + latar sedikit berwarna
                      borderColor: c.bar,
                      boxShadow: `inset 0 0 0 1px ${c.bar}`,
                      backgroundImage: `linear-gradient(160deg, ${c.bar}24, transparent 65%)`,
                    }
                  : undefined
              }
              title={selected ? "Klik lagi untuk lihat semua" : "Klik untuk filter transaksi"}
            >
              <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm transition-colors duration-300 ${
                      selected ? "text-white" : `${c.soft} ${c.text}`
                    }`}
                    style={selected ? { background: c.bar } : undefined}
                  >
                    {selected ? <i className="fa-solid fa-check pc-check"></i> : u.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex flex-col items-start">
                    <span className="font-bold text-slate-900 dark:text-white leading-tight">{cap(u.name)}</span>
                    <RoleBadge username={u.name} className="mt-0.5" />
                  </span>
                </span>
                {pct != null || u.prev_net > 0 || u.net > 0 ? (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                      diff >= 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    }`}
                    title={`Periode sebelumnya: ${rupiah(u.prev_net)}`}
                  >
                    <i className={`fa-solid ${diff >= 0 ? "fa-arrow-trend-up" : "fa-arrow-trend-down"} mr-1`}></i>
                    {pct == null ? "baru" : `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`}
                  </span>
                ) : null}
              </div>

              <p className={`mt-3 text-2xl font-black ${c.text}`}>{rupiah(u.net)}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">pendapatan bersih · {u.count} transaksi</p>

              <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${share}%`, background: c.bar }} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-slate-400">Kotor</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">{rupiah(u.gross)}</p>
                </div>
                <div>
                  <p className="text-slate-400">Fee</p>
                  <p className={`font-semibold ${u.fee > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"}`}>
                    {u.fee > 0 ? `− ${rupiah(u.fee)}` : "Rp 0"}
                  </p>
                </div>
              </div>
              </div>
            </button>
          );
        })}
        {!data && loading &&
          [0, 1, 2].map((i) => <div key={i} className="h-48 rounded-2xl bg-slate-200/60 dark:bg-slate-800/40 animate-pulse" />)}
      </div>

      {/* ═══ GRAFIK ═══ */}
      <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-chart-column text-emerald-500"></i>
            Pendapatan per hari
          </h3>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total {rupiah(totalNet)}</span>
        </div>
        <div className="h-64">
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} stroke="#94a3b8" style={{ fontSize: "11px" }} minTickGap={12} />
                <YAxis tickFormatter={rupiahShort} stroke="#94a3b8" style={{ fontSize: "11px" }} width={44} />
                <Tooltip
                  contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, fontSize: 12, color: "#e2e8f0" }}
                  labelFormatter={(l) => fmtDay(String(l))}
                  formatter={(v, n) => [rupiah(Number(v) || 0), cap(String(n))]}
                  cursor={{ fill: "rgba(148,163,184,0.12)" }}
                />
                <Legend formatter={(v) => cap(String(v))} wrapperStyle={{ fontSize: 12 }} />
                {(data?.users || []).map((u) => (
                  <Bar key={u.name} dataKey={u.name} stackId="a" fill={colorOf(u.name).bar} radius={[2, 2, 0, 0]} maxBarSize={36} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ═══ TRANSAKSI ═══ */}
      <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 md:p-5 flex flex-wrap items-center gap-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mr-auto">
            <i className="fa-solid fa-receipt text-emerald-500"></i>
            Transaksi
            <span className="text-xs font-semibold text-slate-400">
              {transactions.length}
              {data && data.total_count > data.transactions.length ? ` dari ${data.transactions.length} terbaru` : ""}
            </span>
          </h3>
          <SegmentedChoice
            ariaLabel="Filter user"
            size="sm"
            value={filterUser}
            onChange={setFilterUser}
            options={[
              { value: "all", label: "Semua", avatar: true, icon: "fa-users", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/30" },
              ...(data?.users || []).map((u) => ({
                value: u.name,
                label: cap(u.name),
                avatar: true,
                avatarClass: `${colorOf(u.name).soft} ${colorOf(u.name).text}`,
                activeClass: `${colorOf(u.name).solid} text-white shadow-md`,
              })),
            ]}
          />
          <div className="relative w-full sm:w-56">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Cari order / akun / produk"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {transactions.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">{loading ? "Memuat..." : "Belum ada transaksi di periode ini."}</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((t) => {
              const c = colorOf(t.joki_name);
              return (
                <div key={t.id} className="px-4 md:px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${c.soft} ${c.text}`}>{cap(t.joki_name)}</span>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{t.order_id}</span>
                  {t.roblox_username && <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">{t.roblox_username}</span>}
                  {t.replaced && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-fuchsia-100 dark:bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300"
                      title={`Ganti akun: ${t.replaced.from_username} (${t.replaced.from_owner || "-"}) → ${t.roblox_username}`}
                    >
                      <i className="fa-solid fa-right-left mr-1"></i>dari {cap(t.replaced.from_owner || "-")}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs hidden md:inline">{t.product_title || ""}</span>
                  <span className="ml-auto text-right">
                    <span className="block text-sm font-bold text-emerald-600 dark:text-emerald-400">{rupiah(t.net)}</span>
                    <span className="block text-[10px] text-slate-400">
                      {t.fee > 0 ? `${rupiah(t.gross)} − fee ${rupiah(t.fee)} · ` : ""}
                      {fmtDateTime(t.completed_at)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2 — CEK ORDER
// ══════════════════════════════════════════════════════════════

const ACTION_INFO: Record<Exclude<OrderCheck["action"], "none">, { label: string; icon: string; desc: string }> = {
  catat_joki: {
    label: "Catat pendapatan sekarang",
    icon: "fa-file-invoice-dollar",
    desc: "Order joki sudah selesai. Pendapatan dicatat langsung dari data order (tanpa bot, tanpa chat).",
  },
  retry_joki: {
    label: "Coba ulang di bot",
    icon: "fa-rotate-right",
    desc: "Bot mengulang penyelesaian order ini (sama seperti tombol Coba ulang di Order Gagal) — termasuk pesan selesai ke pembeli.",
  },
  catat_akun: {
    label: "Catat ulang pendapatan (bot)",
    icon: "fa-robot",
    desc: "Bot membuka rincian order akun dan mencatat pendapatannya saja — TIDAK mengirim chat ulang ke pembeli.",
  },
};

function CekOrderTab() {
  const toast = useToast();
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<OrderCheck | null>(null);
  const [acting, setActing] = useState(false);

  const check = useCallback(
    async (orderId: string, silent = false) => {
      if (!silent) setChecking(true);
      try {
        const res = await fetch(`/api/admin/pendapatan/order?order_id=${encodeURIComponent(orderId)}`);
        const json = await res.json();
        if (json.success) setResult(json);
        else if (!silent) {
          toast.error(json.message || "Gagal cek order");
          setResult(null);
        }
      } catch {
        if (!silent) toast.error("Gagal cek order");
      } finally {
        if (!silent) setChecking(false);
      }
    },
    [toast]
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) check(input.trim());
  };

  // Pantau otomatis selama catat ulang oleh bot masih berjalan
  const waitingBot = result?.reprocess && ["pending", "processing"].includes(result.reprocess.status);
  useEffect(() => {
    if (!waitingBot || !result) return;
    const t = setInterval(() => check(result.order_id, true), 5000);
    return () => clearInterval(t);
  }, [waitingBot, result, check]);

  const runAction = async () => {
    if (!result || result.action === "none") return;
    setActing(true);
    try {
      const res = await fetch("/api/admin/pendapatan/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: result.order_id, action: result.action }),
      });
      const json = await res.json();
      if (json.success) toast.success(json.message || "Berhasil");
      else toast.error(json.message || "Gagal");
      check(result.order_id, true);
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setActing(false);
    }
  };

  const hasIncome = !!result && result.income.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-2">
        <div className="relative flex-1">
          <i className="fa-solid fa-hashtag absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nomor order, misal OD000000167689540 atau 167689540"
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-3 py-3 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={checking || !input.trim()}
          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2"
        >
          <i className={`fa-solid ${checking ? "fa-spinner fa-spin" : "fa-magnifying-glass"} text-xs`}></i>
          Cek
        </button>
      </form>

      {!result && !checking && (
        <div className="text-center py-10 text-sm text-slate-500 dark:text-slate-400">
          <i className="fa-solid fa-magnifying-glass-dollar text-3xl text-slate-300 dark:text-slate-700 mb-3 block"></i>
          Cek apakah sebuah order sudah masuk ke income. Kalau belum, bisa diproses ulang dari sini.
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* STATUS */}
          <div
            className={`rounded-2xl border p-5 flex items-start gap-4 ${
              hasIncome
                ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
                : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-xl ${
                hasIncome ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
              }`}
            >
              <i className={`fa-solid ${hasIncome ? "fa-circle-check" : "fa-circle-exclamation"}`}></i>
            </div>
            <div className="min-w-0 flex-1">
              <p className={`font-black text-lg ${hasIncome ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}>
                {hasIncome ? "Sudah masuk income" : "Belum masuk income"}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{result.position}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono flex flex-wrap items-center gap-x-3">
                {result.order_id}
                <span className="font-sans">· {result.kind === "joki" ? "Order joki" : "Order akun"}</span>
                {result.detail_url && (
                  <a href={result.detail_url} target="_blank" rel="noreferrer" className="font-sans text-emerald-600 dark:text-emerald-400 hover:underline">
                    Buka di Itemku <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                  </a>
                )}
              </p>
            </div>
          </div>

          {/* PENDAPATAN TERCATAT */}
          {hasIncome && (
            <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {result.income.map((r) => {
                const name = (r.joki_name || "ellan").toLowerCase();
                const c = colorOf(name);
                return (
                  <div key={r.id} className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <Field label="Akun / username">
                      <span className="font-mono font-bold">{r.roblox_username || "-"}</span>
                    </Field>
                    <Field label="Masuk ke">
                      <span className={`font-bold px-2 py-0.5 rounded-md ${c.soft} ${c.text}`}>{cap(name)}</span>
                    </Field>
                    <Field label="Bersih">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{rupiah(r.net)}</span>
                    </Field>
                    <Field label="Kotor · fee">
                      {rupiah(r.gross)}
                      {r.fee > 0 && <span className="text-rose-500"> · −{rupiah(r.fee)} ({r.fee_percent}%)</span>}
                    </Field>
                    <Field label="Waktu">{fmtDateTime(r.completed_at)}</Field>
                    <Field label="Pembeli">{r.buyer_name || "-"}</Field>
                    <div className="col-span-2">
                      <Field label="Produk">{r.product_title || "-"}</Field>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* INFO ORDER JOKI */}
          {result.joki && !hasIncome && (
            <div className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <Field label="Produk">{result.joki.product || "-"}</Field>
              <Field label="Ditangani">{cap(result.joki.joki_name || "-")}</Field>
              <Field label="Status antrian">{result.joki.queue_status || "-"}</Field>
              <Field label="Total pendapatan">{result.joki.total_income ? rupiah(result.joki.total_income) : "-"}</Field>
            </div>
          )}

          {/* CATAT ULANG OLEH BOT */}
          {result.reprocess && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 px-4 py-3 text-xs flex flex-wrap items-center gap-2">
              <i className="fa-solid fa-robot text-violet-500"></i>
              <span className="font-bold text-slate-700 dark:text-slate-200">Catat ulang oleh bot:</span>
              <span
                className={`font-bold ${
                  result.reprocess.status === "done"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : result.reprocess.status === "failed"
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {result.reprocess.status === "pending"
                  ? "menunggu bot"
                  : result.reprocess.status === "processing"
                    ? "sedang diproses"
                    : result.reprocess.status === "done"
                      ? "selesai"
                      : "gagal"}
              </span>
              {waitingBot && <i className="fa-solid fa-spinner fa-spin text-amber-500"></i>}
              {result.reprocess.result && <span className="text-slate-500">· {result.reprocess.result}</span>}
              {result.reprocess.error && <span className="w-full text-rose-600 dark:text-rose-400">{result.reprocess.error}</span>}
            </div>
          )}

          {/* RIWAYAT GANTI AKUN */}
          {result.replacements.length > 0 && (
            <div className="rounded-xl border border-fuchsia-200 dark:border-fuchsia-500/30 bg-fuchsia-50/60 dark:bg-fuchsia-500/5 px-4 py-3 text-xs space-y-1">
              {result.replacements.map((r) => (
                <p key={r.id} className="text-slate-700 dark:text-slate-200">
                  <i className="fa-solid fa-right-left text-fuchsia-500 mr-1.5"></i>
                  Ganti akun <span className="font-mono">{r.old_username}</span> ({cap(r.old_added_by || "-")}) →{" "}
                  <span className="font-mono font-bold">{r.new_username}</span> ({cap(r.new_added_by || "-")}) ·{" "}
                  <span className="font-semibold">{r.status}</span>
                </p>
              ))}
            </div>
          )}

          {/* TINDAKAN */}
          {!hasIncome && result.action !== "none" && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{ACTION_INFO[result.action].desc}</p>
              <button
                type="button"
                onClick={runAction}
                disabled={acting}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <i className={`fa-solid ${acting ? "fa-spinner fa-spin" : ACTION_INFO[result.action].icon}`}></i>
                {ACTION_INFO[result.action].label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">{label}</p>
      <div className="text-slate-700 dark:text-slate-200 wrap-break-word">{children}</div>
    </div>
  );
}
