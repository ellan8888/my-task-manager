"use client";

import type { ReactNode } from "react";
import type { JokiOrder, RamAccount } from "@/lib/types";

// ══════════════════════════════════════════════════════════════
// HELPERS (di-export, dipakai juga di app/joki/page.tsx)
// ══════════════════════════════════════════════════════════════

export function formatShortNumber(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`.replace(".0T", "T");
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`.replace(".0B", "B");
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`.replace(".0M", "M");
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`.replace(".0K", "K");
  return `${n}`;
}

export function isProgressOrder(o: JokiOrder) {
  return o.order_type === "progress" || (o.progress_keyword != null && (o.target_count ?? 0) > 0);
}

export function isDoneByBot(o: JokiOrder) {
  return o.completed_by_bot === true || o.queue_status === "completed";
}

const formatRupiah = (n: number) => `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

const hasText = (v?: string | null) => !!v && v.trim() !== "" && v.trim() !== "-";

/** "Joki AFK Treadmill 12 Jam | Joki AFK | Steal An Egg" → "Steal An Egg" */
const gameFromTitle = (title?: string | null) => {
  if (!title) return null;
  const parts = title.split("|").map((p) => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : null;
};

// ══════════════════════════════════════════════════════════════
// STATUS BADGE
// ══════════════════════════════════════════════════════════════

type StatusInfo = { label: string; icon: string; className: string };

const STATUS = {
  failed: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30",
  waiting: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  bot: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  violet: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30",
  neutral: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
} as const;

function getStatus(
  order: JokiOrder,
  opts: { isChecked: boolean; isProgress: boolean; daysLeft: number | null }
): StatusInfo {
  const { isChecked, isProgress, daysLeft } = opts;

  if (order.bot_process_failed && !isDoneByBot(order))
    return { label: "Bot gagal", icon: "fa-triangle-exclamation", className: STATUS.failed };
  if (isDoneByBot(order) && order.buyer_confirmed)
    return { label: "Buyer konfirmasi", icon: "fa-circle-check", className: STATUS.success };
  if (isDoneByBot(order))
    return { label: "Menunggu buyer", icon: "fa-hourglass-half", className: STATUS.waiting };
  if (isChecked) return { label: "Diproses bot", icon: "fa-robot", className: STATUS.bot };
  if (isProgress && order.queue_status === "waiting_confirm")
    return { label: "Menunggu mulai", icon: "fa-pause", className: STATUS.violet };
  if (isProgress) return { label: "Sedang dikerjakan", icon: "fa-egg", className: STATUS.violet };
  if (daysLeft === null) return { label: "Belum dijadwalkan", icon: "fa-clock", className: STATUS.neutral };
  if (daysLeft < 0) return { label: "Overdue", icon: "fa-triangle-exclamation", className: STATUS.failed };
  if (daysLeft === 0) return { label: "Hari ini", icon: "fa-fire", className: STATUS.waiting };
  if (daysLeft === 1) return { label: "Besok", icon: "fa-calendar-day", className: STATUS.success };
  return { label: `${daysLeft} hari lagi`, icon: "fa-calendar-check", className: STATUS.success };
}

// ══════════════════════════════════════════════════════════════
// SMALL PARTS
// ══════════════════════════════════════════════════════════════

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">{children}</p>;
}

function CopyLink({ value, label = "Salin" }: { value: string; label?: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(value)}
      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
    >
      <i className="fa-regular fa-copy text-[11px]"></i>
      {label}
    </button>
  );
}

function Chip({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700/50">
      {icon && <i className={`${icon} text-[11px]`}></i>}
      {children}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// CARD
// ══════════════════════════════════════════════════════════════

type Props = {
  order: JokiOrder;
  now: number;
  isProcessing: boolean;
  isStarting: boolean;
  isChecked: boolean;
  isDeleting: boolean;
  editingUsername: { orderId: number; value: string } | null;
  ramAccounts: RamAccount[];
  loadingAccounts: boolean;
  setEditingUsername: (val: { orderId: number; value: string } | null) => void;
  fetchRamAccounts: () => void;
  updateOrderUsername: (orderId: number, username: string) => void;
  handleCompleteOrder: (order: JokiOrder) => void;
  handleStartProgressOrder: (order: JokiOrder) => void;
  handleForceDelete: (order: JokiOrder) => void;
  isUsernameUsedInOtherCards: (username: string, currentOrderId: number) => boolean;
};

export default function JokiOrderCard({
  order,
  now,
  isProcessing,
  isStarting,
  isChecked,
  isDeleting,
  editingUsername,
  ramAccounts,
  loadingAccounts,
  setEditingUsername,
  fetchRamAccounts,
  updateOrderUsername,
  handleCompleteOrder,
  handleStartProgressOrder,
  handleForceDelete,
  isUsernameUsedInOtherCards,
}: Props) {
  const isCompletedByBot = isDoneByBot(order);
  const isProgress = isProgressOrder(order);
  const isFailed = order.bot_process_failed === true && !isCompletedByBot;
  const isEditing = editingUsername?.orderId === order.id;

  // ── Jadwal ──────────────────────────────────────────────────
  let daysLeft: number | null = null;
  if (order.estimated_end_at) {
    const end = new Date(order.estimated_end_at);
    end.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);
  }
  const isToday = daysLeft === 0;
  const status = getStatus(order, { isChecked, isProgress, daysLeft });

  // ── Progress egg ────────────────────────────────────────────
  const displayTarget =
    order.target_unit && order.target_unit !== "Joki" ? order.target_unit : order.target_count?.toString() ?? "0";

  const progressPct = (() => {
    let realTarget = order.target_count || 1;
    if (order.target_unit && order.target_unit !== "Joki") {
      const match = order.target_unit.match(/^(\d+(?:\.\d+)?)([TBMK]?)$/i);
      if (match) {
        const suffix = match[2].toUpperCase();
        const mult = suffix === "T" ? 1e12 : suffix === "B" ? 1e9 : suffix === "M" ? 1e6 : suffix === "K" ? 1e3 : 1;
        realTarget = parseFloat(match[1]) * mult;
      }
    }
    return Math.min(100, ((order.progress_count ?? 0) / realTarget) * 100);
  })();

  // ── Countdown ───────────────────────────────────────────────
  const remaining = order.estimated_end_at ? Math.max(0, new Date(order.estimated_end_at).getTime() - now) : 0;
  const countdownText = (() => {
    if (!order.estimated_end_at) return "";
    if (remaining === 0) return "Segera selesai";
    const h = Math.floor(remaining / 3600000);
    const m = Math.floor((remaining % 3600000) / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  })();
  const countdownPct = (() => {
    if (!order.estimated_end_at || !order.created_at) return 0;
    const start = new Date(order.created_at).getTime();
    const end = new Date(order.estimated_end_at).getTime();
    if (end <= start) return 100;
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  })();

  const game = gameFromTitle(order.product);

  const submitUsername = () => {
    if (!editingUsername) return;
    const trimmed = editingUsername.value.trim();
    if (isUsernameUsedInOtherCards(trimmed, order.id)) {
      alert(`Username "${trimmed}" sudah dipakai di card lain!`);
      return;
    }
    updateOrderUsername(order.id, trimmed);
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900/60 border rounded-2xl overflow-hidden transition-all duration-300 ease-out ${
        isDeleting
          ? "opacity-0 scale-90 -translate-x-8 blur-sm"
          : isProcessing
          ? "opacity-0 scale-95 blur-sm pointer-events-none"
          : isCompletedByBot
          ? "border-emerald-300 dark:border-emerald-500/40 opacity-70"
          : isFailed
          ? "border-rose-300 dark:border-rose-500/40"
          : isToday
          ? "border-amber-300 dark:border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          : "border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/40"
      }`}
    >
      {/* ═══ HEADER: status · nomor · masuk ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 px-4 md:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <Label>Status</Label>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${status.className}`}>
            <i className={`fa-solid ${status.icon} text-[10px]`}></i>
            {status.label}
          </span>
        </div>

        <div className="min-w-0">
          <Label>Nomor pesanan</Label>
          <button
            onClick={() => navigator.clipboard.writeText(order.order_id)}
            className="max-w-full inline-flex items-center gap-1.5 font-mono text-[13px] font-bold text-violet-600 dark:text-violet-400 hover:underline"
            title="Salin nomor pesanan"
          >
            <span className="truncate">{order.order_id}</span>
            <i className="fa-regular fa-copy text-[11px] shrink-0"></i>
          </button>
        </div>

        <div>
          <Label>Masuk</Label>
          <p className="text-sm text-slate-700 dark:text-slate-300">{formatDateTime(order.created_at)}</p>
        </div>
      </div>

      {/* ═══ BODY: produk | pembeli & akun ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        {/* Produk */}
        <div className="px-4 md:px-5 py-4 md:border-r border-b md:border-b-0 border-slate-200 dark:border-slate-800/80">
          <h4
            className={`font-extrabold text-base leading-snug ${
              isCompletedByBot ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-white"
            }`}
          >
            {order.product || "Produk tidak diketahui"}
          </h4>
          {game && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{game}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <Chip icon={isProgress ? "fa-solid fa-egg" : "fa-solid fa-hourglass-half"}>
              {isProgress ? "Progress" : "Countdown"}
            </Chip>
            {hasText(order.quantity) && <Chip>{order.quantity}</Chip>}
          </div>
        </div>

        {/* Pembeli & akun */}
        <div className="px-4 md:px-5 py-4 grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <Label>Pembeli</Label>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {hasText(order.buyer_name) ? order.buyer_name : "-"}
            </p>
            {order.detail_url && (
              <a
                href={order.detail_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:underline"
              >
                <i className="fa-regular fa-comment text-[11px]"></i>
                Hubungi pembeli
              </a>
            )}
          </div>

          <div className="min-w-0">
            <Label>Username Roblox</Label>
            <div className="flex items-center gap-1.5">
              <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white truncate">
                {order.roblox_username || "-"}
              </p>
              <button
                onClick={() => {
                  setEditingUsername({ orderId: order.id, value: order.roblox_username || "" });
                  fetchRamAccounts();
                }}
                className="w-6 h-6 shrink-0 rounded-md text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition"
                title="Edit username"
              >
                <i className="fa-solid fa-pen text-[10px]"></i>
              </button>
            </div>
            {order.roblox_username && <CopyLink value={order.roblox_username} />}
          </div>
        </div>
      </div>

      {/* ═══ EDIT USERNAME (dropdown akun RAM) ═══ */}
      {isEditing && editingUsername && (
        <div className="px-4 md:px-5 pb-4 space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editingUsername.value}
              onChange={(e) => setEditingUsername({ orderId: order.id, value: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitUsername();
                else if (e.key === "Escape") setEditingUsername(null);
              }}
              autoFocus
              placeholder="Ketik atau pilih dari daftar akun..."
              className="bg-slate-50 dark:bg-slate-950 border border-violet-500 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-w-0 flex-1"
            />
            <button
              onClick={submitUsername}
              className="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition shrink-0"
              title="Simpan"
            >
              <i className="fa-solid fa-check text-xs"></i>
            </button>
            <button
              onClick={() => setEditingUsername(null)}
              className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center transition shrink-0"
              title="Batal"
            >
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>

          {loadingAccounts ? (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 px-2">
              <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>
              Memuat akun dari RAM...
            </div>
          ) : ramAccounts.length > 0 ? (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto custom-scrollbar">
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-1 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
                Akun di RAM ({ramAccounts.length})
              </div>
              {ramAccounts.map((acc) => {
                const isUsed = isUsernameUsedInOtherCards(acc.Username, order.id);
                const isCurrent = acc.Username.toLowerCase() === editingUsername.value.toLowerCase();
                return (
                  <button
                    key={acc.UserID}
                    onClick={() => {
                      if (isUsed) return;
                      setEditingUsername({ orderId: order.id, value: acc.Username });
                    }}
                    disabled={isUsed}
                    className={`w-full text-left px-2 py-1.5 text-xs flex items-center justify-between gap-2 transition border-b border-slate-100 dark:border-slate-800/50 last:border-0 ${
                      isUsed
                        ? "text-slate-400 dark:text-slate-600 cursor-not-allowed bg-slate-100/50 dark:bg-slate-900/30"
                        : isCurrent
                        ? "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 cursor-pointer"
                    }`}
                  >
                    <span className="truncate font-mono">{acc.Username}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {isUsed && (
                        <span className="text-[9px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">
                          DIPAKAI
                        </span>
                      )}
                      {acc.Alias && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-20">{acc.Alias}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic px-2">
              Tidak ada akun di RAM atau gagal load.
            </div>
          )}
        </div>
      )}

      {/* ═══ PROGRESS / COUNTDOWN ═══ */}
      {(isProgress || order.estimated_end_at) && !isCompletedByBot && (
        <div className="px-4 md:px-5 py-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
          {isProgress ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-egg text-violet-500 dark:text-violet-400"></i>
                  Progress {(order.progress_keyword || "Egg").toUpperCase()}
                </span>
                <span className="font-mono font-black text-sm text-violet-600 dark:text-violet-400">
                  {formatShortNumber(order.progress_count ?? 0)} / {displayTarget}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="h-full bg-linear-to-r from-violet-500 to-indigo-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-mono font-bold flex items-center gap-1.5 ${
                    remaining === 0 ? "text-rose-500 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <i className="fa-regular fa-clock"></i>
                  Sisa {countdownText}
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <i className="fa-solid fa-flag-checkered"></i>
                  Selesai{" "}
                  {new Date(order.estimated_end_at!).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                <div className="h-full bg-linear-to-r from-amber-400 to-amber-500 transition-all duration-1000" style={{ width: `${countdownPct}%` }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ BAR JADWAL ═══ */}
      {(order.schedule_time || order.schedule_date) && (
        <div className="mx-4 md:mx-5 mb-3 mt-1 px-3.5 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300">
          <i className="fa-regular fa-calendar text-xs"></i>
          <span className="font-semibold">{order.schedule_time ? order.schedule_time.slice(0, 5) : "--:--"}</span>
          <span className="text-violet-400 dark:text-violet-500">·</span>
          <span>{order.joki_name || "ellan"}</span>
          {order.schedule_date && (
            <span className="ml-auto text-xs text-violet-500 dark:text-violet-400">
              {new Date(`${order.schedule_date}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      )}

      {/* ═══ BOT SEDANG PROSES ═══ */}
      {isChecked && (
        <div className="px-4 md:px-5 py-3 border-t border-violet-200 dark:border-violet-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
              <i className="fa-solid fa-robot text-[10px]"></i>
              Bot sedang memproses order...
            </span>
            <i className="fa-solid fa-circle-notch fa-spin text-[10px] text-violet-600 dark:text-violet-400"></i>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 relative">
            <div
              className="absolute inset-y-0 bg-linear-to-r from-violet-500 to-indigo-500 rounded-full"
              style={{ animation: "indeterminate 1.5s ease-in-out infinite" }}
            />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
            Card akan hilang otomatis setelah selesai. Kalau bot gagal, tombol &quot;Hapus paksa&quot; muncul.
          </p>
        </div>
      )}

      {/* ═══ BOT GAGAL ═══ */}
      {isFailed && (
        <div className="mx-4 md:mx-5 mb-3 flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
          <i className="fa-solid fa-triangle-exclamation text-rose-600 dark:text-rose-400 text-xs mt-0.5 shrink-0"></i>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Bot gagal proses order ini</p>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
              {order.bot_failed_reason || "Order nggak ketemu di Itemku"}
            </p>
          </div>
        </div>
      )}

      {/* ═══ FOOTER: pendapatan + aksi ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 md:px-5 py-3.5 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/30">
        <div>
          <Label>Total pendapatan</Label>
          <p className="text-base font-black text-amber-600 dark:text-amber-400">
            {order.total_income ? formatRupiah(order.total_income) : "-"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {order.detail_url && (
            <a
              href={order.detail_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-arrow-up-right-from-square text-[11px]"></i>
              Buka di Itemku
            </a>
          )}

          {order.queue_status === "waiting_confirm" && order.order_type === "progress" && !isCompletedByBot && (
            <button
              onClick={() => handleStartProgressOrder(order)}
              disabled={isStarting}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-500/40 hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-50 transition flex items-center gap-1.5"
            >
              <i className={`fa-solid ${isStarting ? "fa-spinner fa-spin" : "fa-play"} text-[11px]`}></i>
              {isStarting ? "Memulai..." : "Mulai orderan"}
            </button>
          )}

          {isFailed ? (
            <button
              onClick={() => handleForceDelete(order)}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 shadow-lg shadow-rose-600/30 transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-trash-can text-[11px]"></i>
              Hapus paksa
            </button>
          ) : isChecked ? (
            <span className="px-4 py-2 rounded-xl text-xs font-extrabold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-500/15 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-notch fa-spin text-[11px]"></i>
              Bot memproses
            </span>
          ) : isCompletedByBot ? (
            <button
              onClick={() => handleCompleteOrder(order)}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 shadow-lg shadow-emerald-600/30 transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-broom text-[11px]"></i>
              Hapus dari daftar
            </button>
          ) : (
            <button
              onClick={() => handleCompleteOrder(order)}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 shadow-lg shadow-violet-600/30 transition flex items-center gap-1.5"
            >
              <i className="fa-solid fa-check text-[11px]"></i>
              Joki selesai
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
