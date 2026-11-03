"use client";

// Riwayat Saldo — buku kas owner & staff (tabel balance_ledger, SQL 009)
//   Staff : melihat riwayat saldonya sendiri
//   Ellan : memilih anggota + membuat penyesuaian manual

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import AdminHeader from "@/app/components/AdminHeader";
import RoleBadge from "@/app/components/RoleBadge";
import { DatePicker, FieldLabel, SegmentedChoice } from "@/app/components/Pickers";
import { useToast } from "@/app/components/ToastProvider";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type Kind =
  | "income_akun"
  | "income_joki"
  | "moved_in"
  | "moved_out"
  | "income_fix"
  | "income_removed"
  | "withdraw"
  | "code_purchase"
  | "refund"
  | "adjustment";

type Item = {
  id: number;
  amount: number;
  kind: Kind;
  title: string;
  detail: string | null;
  order_id: string | null;
  ref_table: string | null;
  created_by: string | null;
  created_at: string;
  balance_before: number;
  balance_after: number;
  fee: { gross: number; fee: number; percent: number } | null;
  withdrawal: {
    status: string;
    bank_name: string | null;
    account_number: string | null;
    reject_reason: string | null;
    payment_proof_url: string | null;
  } | null;
};

type Response = {
  success: boolean;
  ready: boolean;
  message?: string;
  user: string;
  members: string[];
  balance?: number;
  summary?: { opening: number; total_in: number; total_out: number; closing: number; count: number };
  total?: number;
  items?: Item[];
};

type PresetKey = "today" | "7d" | "month" | "lastmonth" | "all" | "custom";
type FlowFilter = "all" | "in" | "out";

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

const PAGE = 50;

const rupiah = (n: number) => "Rp " + Math.abs(Math.round(n)).toLocaleString("id-ID");
const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + rupiah(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const wibToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const addDays = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const wibDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
const fmtDayLong = (d: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const fmtDayShort = (d: string) =>
  new Date(`${d}T00:00:00+07:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });

function presetRange(key: Exclude<PresetKey, "custom">): { from: string; to: string } {
  const today = wibToday();
  if (key === "all") return { from: "", to: "" };
  if (key === "today") return { from: today, to: today };
  if (key === "7d") return { from: addDays(today, -6), to: today };
  const monthStart = today.slice(0, 8) + "01";
  if (key === "month") return { from: monthStart, to: today };
  const lastEnd = addDays(monthStart, -1);
  return { from: lastEnd.slice(0, 8) + "01", to: lastEnd };
}

/** OD000000167663006 → link rincian pesanan Itemku */
const itemkuUrl = (orderId: string | null) => {
  const digits = (orderId || "").replace(/^OD0*/i, "");
  return /^\d+$/.test(digits) ? `https://tokoku.itemku.com/riwayat-pesanan/rincian/${digits}` : null;
};

const TONES = {
  emerald: "bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  sky: "bg-sky-100 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20",
  rose: "bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20",
  amber: "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  violet: "bg-violet-100 text-violet-600 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
  slate: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
} as const;

const KIND: Record<Kind, { icon: string; tone: keyof typeof TONES; label: string }> = {
  income_akun: { icon: "fa-user-tag", tone: "emerald", label: "Penjualan akun" },
  income_joki: { icon: "fa-gamepad", tone: "emerald", label: "Jokian" },
  moved_in: { icon: "fa-right-left", tone: "sky", label: "Pindahan pendapatan" },
  moved_out: { icon: "fa-right-left", tone: "rose", label: "Pendapatan dipindah" },
  income_fix: { icon: "fa-pen-to-square", tone: "amber", label: "Koreksi" },
  income_removed: { icon: "fa-trash-can", tone: "rose", label: "Pendapatan dihapus" },
  withdraw: { icon: "fa-money-bill-transfer", tone: "rose", label: "Tarik saldo" },
  code_purchase: { icon: "fa-ticket", tone: "violet", label: "Beli code" },
  refund: { icon: "fa-rotate-left", tone: "emerald", label: "Pengembalian" },
  adjustment: { icon: "fa-sliders", tone: "amber", label: "Penyesuaian" },
};

const WD_STATUS: Record<string, { label: string; icon: string; cls: string }> = {
  pending: { label: "Menunggu", icon: "fa-hourglass-half", cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  approved: { label: "Berhasil", icon: "fa-circle-check", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  rejected: { label: "Ditolak", icon: "fa-circle-xmark", cls: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

const USER_AVATAR: Record<string, { soft: string; solid: string }> = {
  ellan: { soft: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", solid: "bg-violet-500 border-violet-500 shadow-violet-500/30" },
  rizki: { soft: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400", solid: "bg-sky-500 border-sky-500 shadow-sky-500/30" },
  ridho: { soft: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", solid: "bg-amber-500 border-amber-500 shadow-amber-500/30" },
};

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

export default function RiwayatSaldoPage() {
  const toast = useToast();
  const { user, loading: userLoading } = useCurrentUser();
  const isEllan = user?.username?.toLowerCase() === "ellan";

  const [member, setMember] = useState<string>("");
  const [preset, setPreset] = useState<PresetKey>("month");
  const [range, setRange] = useState(() => presetRange("month"));
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);
  const [flow, setFlow] = useState<FlowFilter>("all");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const [data, setData] = useState<Response | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  const target = member || user?.username?.toLowerCase() || "";

  // Pencarian ditunda sebentar supaya tidak request tiap ketikan
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const buildUrl = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ type: flow, offset: String(offset), limit: String(PAGE) });
      if (isEllan && target) p.set("user", target);
      if (range.from) p.set("from", range.from);
      if (range.to) p.set("to", range.to);
      if (query) p.set("q", query);
      return `/api/saldo/riwayat?${p}`;
    },
    [flow, isEllan, target, range, query]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(buildUrl(0));
      const json: Response = await res.json();
      if (!json.success) {
        toast.error(json.message || "Gagal memuat riwayat saldo");
        return;
      }
      setData(json);
      setItems(json.items || []);
    } catch {
      toast.error("Gagal memuat riwayat saldo");
    } finally {
      setLoading(false);
    }
  }, [buildUrl, toast]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [user, load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(items.length));
      const json: Response = await res.json();
      if (json.success) setItems((prev) => [...prev, ...(json.items || [])]);
    } catch {
      toast.error("Gagal memuat data berikutnya");
    } finally {
      setLoadingMore(false);
    }
  };

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

  // Kelompokkan per hari (WIB)
  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const d = wibDay(it.created_at);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(it);
    }
    return [...map.entries()];
  }, [items]);

  const periodLabel = range.from ? `${fmtDayShort(range.from)} – ${fmtDayShort(range.to)}` : "Semua waktu";
  const s = data?.summary;

  const header = (
    <AdminHeader
      icon="fa-clock-rotate-left"
      iconClassName="from-emerald-600 via-teal-600 to-cyan-500 shadow-emerald-600/30"
      title="Riwayat Saldo"
      subtitle="Semua uang masuk & keluar beserta asalnya"
    >
      {isEllan && data?.ready && (
        <button
          type="button"
          onClick={() => setShowAdjust(true)}
          className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center gap-1.5 transition"
        >
          <i className="fa-solid fa-sliders"></i>
          <span className="hidden sm:inline">Penyesuaian</span>
        </button>
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

  return (
    <>
      {header}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-5">
          {/* ═══ PILIH ANGGOTA (Ellan) ═══ */}
          {isEllan && (
            <SegmentedChoice
              ariaLabel="Pilih anggota"
              value={target}
              onChange={(v) => setMember(v)}
              options={(data?.members || ["ellan", "rizki", "ridho"]).map((m) => ({
                value: m,
                label: cap(m),
                avatar: true,
                avatarClass: USER_AVATAR[m]?.soft,
                activeClass: `${USER_AVATAR[m]?.solid || "bg-slate-600 border-slate-600"} text-white`,
              }))}
            />
          )}

          {data && !data.ready ? (
            <NotReady />
          ) : (
            <>
              {/* ═══ RINGKASAN ═══ */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="col-span-2 lg:col-span-1 rounded-2xl p-4 border bg-linear-to-br from-emerald-500 to-teal-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">Saldo sekarang</span>
                    <i className="fa-solid fa-wallet text-white/70"></i>
                  </div>
                  <p className="mt-2 text-2xl font-black tabular-nums truncate">
                    {data?.balance != null ? (data.balance < 0 ? "−" : "") + rupiah(data.balance) : "—"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/80">
                    <span className="font-semibold">{cap(target)}</span>
                    {target && <RoleBadge username={target} />}
                  </div>
                </div>
                <SummaryTile className="col-span-2 lg:col-span-1" icon="fa-flag" label="Saldo awal periode" value={s ? rupiah(s.opening) : "—"} negative={!!s && s.opening < 0} />
                <SummaryTile icon="fa-arrow-down" label="Masuk" value={s ? "+" + rupiah(s.total_in) : "—"} tone="emerald" />
                <SummaryTile icon="fa-arrow-up" label="Keluar" value={s ? "−" + rupiah(s.total_out) : "—"} tone="rose" />
              </div>

              {s && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <i className="fa-solid fa-calculator text-[10px]"></i>
                  <span>
                    Awal <b className="text-slate-700 dark:text-slate-200">{rupiah(s.opening)}</b>
                  </span>
                  <i className="fa-solid fa-plus text-[8px] text-emerald-500"></i>
                  <span>
                    masuk <b className="text-emerald-600 dark:text-emerald-400">{rupiah(s.total_in)}</b>
                  </span>
                  <i className="fa-solid fa-minus text-[8px] text-rose-500"></i>
                  <span>
                    keluar <b className="text-rose-600 dark:text-rose-400">{rupiah(s.total_out)}</b>
                  </span>
                  <i className="fa-solid fa-equals text-[8px]"></i>
                  <span>
                    akhir periode <b className="text-slate-700 dark:text-slate-200">{(s.closing < 0 ? "−" : "") + rupiah(s.closing)}</b>
                  </span>
                </div>
              )}

              {/* ═══ PERIODE ═══ */}
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    ["today", "Hari ini"],
                    ["7d", "7 hari"],
                    ["month", "Bulan ini"],
                    ["lastmonth", "Bulan lalu"],
                    ["all", "Semua"],
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
                    <DatePicker value={customFrom} max={customTo} onChange={setCustomFrom} accent="emerald" size="sm" className="w-40" ariaLabel="Dari tanggal" />
                    <span className="text-xs text-slate-400">s/d</span>
                    <DatePicker value={customTo} min={customFrom} onChange={setCustomTo} accent="emerald" size="sm" className="w-40" ariaLabel="Sampai tanggal" />
                    <button type="button" onClick={applyCustom} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500">
                      Terapkan
                    </button>
                  </div>
                )}
              </div>

              {/* ═══ FILTER ═══ */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <SegmentedChoice
                  ariaLabel="Jenis transaksi"
                  size="sm"
                  value={flow}
                  onChange={setFlow}
                  options={[
                    { value: "all", label: "Semua", icon: "fa-list", activeClass: "bg-slate-800 dark:bg-slate-200 dark:text-slate-900 text-white border-slate-800 dark:border-slate-200" },
                    { value: "in", label: "Masuk", icon: "fa-arrow-down", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/30" },
                    { value: "out", label: "Keluar", icon: "fa-arrow-up", activeClass: "bg-rose-600 text-white border-rose-600 shadow-rose-600/30" },
                  ]}
                />
                <div className="relative sm:ml-auto sm:w-72">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari order, username akun, bank…"
                    className="w-full pl-8 pr-8 py-2 rounded-xl text-sm bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      aria-label="Hapus pencarian"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* ═══ DAFTAR ═══ */}
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {periodLabel}
                  {data?.total != null && <span className="normal-case font-semibold"> · {data.total} transaksi</span>}
                </p>
                {loading && <i className="fa-solid fa-spinner fa-spin text-emerald-500 text-sm"></i>}
              </div>

              {!loading && items.length === 0 ? (
                <div className="text-center py-14 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <i className="fa-solid fa-receipt text-lg"></i>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">Tidak ada transaksi di periode ini</p>
                </div>
              ) : (
                <div className={`space-y-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
                  {groups.map(([day, list]) => {
                    const net = list.reduce((sum, it) => sum + it.amount, 0);
                    return (
                      <section key={day}>
                        <div className="flex items-center justify-between px-1 mb-2">
                          <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 capitalize">{fmtDayLong(day)}</h3>
                          <span className={`text-[11px] font-bold tabular-nums ${net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {signed(net)}
                          </span>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
                          {list.map((it) => (
                            <LedgerRow key={it.id} item={it} />
                          ))}
                        </div>
                      </section>
                    );
                  })}

                  {data?.total != null && items.length < data.total && (
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="w-full py-3 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 hover:border-emerald-400 transition flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {loadingMore ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-angles-down"></i>}
                      Muat lebih banyak ({data.total - items.length} lagi)
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAdjust && isEllan && (
        <AdjustModal
          defaultMember={target}
          members={data?.members || ["ellan", "rizki", "ridho"]}
          onClose={() => setShowAdjust(false)}
          onSaved={(m) => {
            setShowAdjust(false);
            if (m !== target) setMember(m);
            else load();
          }}
        />
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// KOMPONEN
// ══════════════════════════════════════════════════════════════

function SummaryTile({
  icon,
  label,
  value,
  tone,
  negative,
  className = "",
}: {
  className?: string;
  icon: string;
  label: string;
  value: string;
  tone?: "emerald" | "rose";
  negative?: boolean;
}) {
  const color =
    tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : tone === "rose" ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-white";
  return (
    <div className={`rounded-2xl p-4 border bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
        <i className={`fa-solid ${icon} text-xs ${tone ? color : "text-slate-400"}`}></i>
      </div>
      <p className={`mt-2 text-lg font-black tabular-nums truncate ${color}`}>
        {negative ? "−" : ""}
        {value}
      </p>
    </div>
  );
}

function LedgerRow({ item }: { item: Item }) {
  const k = KIND[item.kind] || { icon: "fa-circle", tone: "slate" as const, label: item.kind };
  const isIn = item.amount > 0;
  const wd = item.kind === "withdraw" || item.kind === "code_purchase" ? item.withdrawal : null;
  const status = wd ? WD_STATUS[wd.status] : null;
  const link = itemkuUrl(item.order_id);

  return (
    <div className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${TONES[k.tone]}`} title={k.label}>
        <i className={`fa-solid ${k.icon} text-xs`}></i>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white wrap-break-word">{item.title}</p>
            {item.detail && <p className="text-xs text-slate-500 dark:text-slate-400 wrap-break-word">{item.detail}</p>}
          </div>
          <p className={`text-sm font-black tabular-nums shrink-0 ${isIn ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {signed(item.amount)}
          </p>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1">
            <i className="fa-regular fa-clock text-[9px]"></i>
            {fmtTime(item.created_at)}
          </span>
          {item.order_id &&
            (link ? (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Buka rincian pesanan di Itemku"
              >
                <i className="fa-solid fa-hashtag text-[9px]"></i>
                {item.order_id}
                <i className="fa-solid fa-arrow-up-right-from-square text-[8px] opacity-60"></i>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono">
                <i className="fa-solid fa-hashtag text-[9px]"></i>
                {item.order_id}
              </span>
            ))}
          {status && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[10px] ${status.cls}`}>
              <i className={`fa-solid ${status.icon} text-[9px]`}></i>
              {status.label}
            </span>
          )}
          {item.fee && (
            <span className="inline-flex items-center gap-1" title="Pendapatan kotor dan potongan fee">
              <i className="fa-solid fa-percent text-[9px]"></i>
              Kotor {rupiah(item.fee.gross)} · fee {item.fee.percent}% {rupiah(item.fee.fee)}
            </span>
          )}
          {item.kind === "adjustment" && item.created_by && (
            <span className="inline-flex items-center gap-1">
              <i className="fa-solid fa-user-pen text-[9px]"></i>
              oleh {cap(item.created_by)}
            </span>
          )}
          {wd?.status === "approved" && wd.payment_proof_url && (
            <a
              href={wd.payment_proof_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"
            >
              <i className="fa-solid fa-receipt text-[9px]"></i>
              Bukti
            </a>
          )}
        </div>

        <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-400 dark:text-slate-500">
          <span>{(item.balance_before < 0 ? "−" : "") + rupiah(item.balance_before)}</span>
          <i className={`fa-solid fa-arrow-right-long text-[9px] ${isIn ? "text-emerald-500" : "text-rose-500"}`}></i>
          <span className="font-bold text-slate-600 dark:text-slate-300">{(item.balance_after < 0 ? "−" : "") + rupiah(item.balance_after)}</span>
        </div>
      </div>
    </div>
  );
}

function NotReady() {
  return (
    <div className="text-center py-14 px-6 rounded-2xl border border-dashed border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
        <i className="fa-solid fa-database text-xl"></i>
      </div>
      <h3 className="font-bold text-slate-900 dark:text-white mb-1">Riwayat saldo belum aktif</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
        Jalankan file <code className="font-mono text-amber-700 dark:text-amber-300">sql/009_balance_ledger.sql</code> di Supabase SQL Editor.
        Semua pendapatan dan penarikan lama akan otomatis dimasukkan ke riwayat.
      </p>
    </div>
  );
}

function AdjustModal({
  defaultMember,
  members,
  onClose,
  onSaved,
}: {
  defaultMember: string;
  members: string[];
  onClose: () => void;
  onSaved: (member: string) => void;
}) {
  const toast = useToast();
  const [member, setMember] = useState(defaultMember || members[0]);
  const [direction, setDirection] = useState<"plus" | "minus">("plus");
  const [amountText, setAmountText] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const amount = parseInt(amountText.replace(/\D/g, ""), 10) || 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return toast.warning("Isi nominal penyesuaian");
    if (reason.trim().length < 3) return toast.warning("Tulis alasan penyesuaian");
    setSaving(true);
    try {
      const res = await fetch("/api/saldo/riwayat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: member, amount: direction === "plus" ? amount : -amount, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || "Gagal menyimpan penyesuaian");
        return;
      }
      toast.success(`Saldo ${cap(member)} ${direction === "plus" ? "ditambah" : "dikurangi"} ${rupiah(amount)}`);
      onSaved(member);
    } catch {
      toast.error("Gagal menyimpan penyesuaian");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <form
        onSubmit={submit}
        className="relative w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <i className="fa-solid fa-sliders"></i>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white">Penyesuaian saldo</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Untuk koreksi di luar sistem, tercatat di riwayat</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div>
          <FieldLabel>Anggota</FieldLabel>
          <SegmentedChoice
            ariaLabel="Anggota"
            size="sm"
            value={member}
            onChange={setMember}
            options={members.map((m) => ({
              value: m,
              label: cap(m),
              avatar: true,
              avatarClass: USER_AVATAR[m]?.soft,
              activeClass: `${USER_AVATAR[m]?.solid || "bg-slate-600 border-slate-600"} text-white`,
            }))}
          />
        </div>

        <div>
          <FieldLabel>Jenis</FieldLabel>
          <SegmentedChoice
            ariaLabel="Jenis penyesuaian"
            size="sm"
            fullWidth
            value={direction}
            onChange={setDirection}
            options={[
              { value: "plus", label: "Tambah saldo", icon: "fa-plus", activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-emerald-600/30" },
              { value: "minus", label: "Kurangi saldo", icon: "fa-minus", activeClass: "bg-rose-600 text-white border-rose-600 shadow-rose-600/30" },
            ]}
          />
        </div>

        <div>
          <FieldLabel>Nominal</FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">Rp</span>
            <input
              inputMode="numeric"
              value={amount ? amount.toLocaleString("id-ID") : ""}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold tabular-nums focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Alasan</FieldLabel>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Contoh: bonus, salah catat, transfer manual…"
            className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving || amount <= 0 || reason.trim().length < 3}
          className={`w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition disabled:opacity-50 ${
            direction === "plus" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"
          }`}
        >
          {saving ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className={`fa-solid ${direction === "plus" ? "fa-plus" : "fa-minus"}`}></i>}
          {direction === "plus" ? "Tambah" : "Kurangi"} {amount ? rupiah(amount) : "saldo"} untuk {cap(member)}
        </button>
      </form>
    </div>
  );
}
