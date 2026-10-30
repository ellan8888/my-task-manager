"use client";

import type { JokiOrder, RamAccount } from "@/lib/types";

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

  const displayTarget =
    order.target_unit && order.target_unit !== "Joki"
      ? order.target_unit
      : order.target_count?.toString() ?? "0";

  const endDate = order.estimated_end_at ? new Date(order.estimated_end_at) : null;
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  let daysLeft: number | null = null;
  let isToday = false;
  let isOverdue = false;

  if (endDate) {
    const endDateMidnight = new Date(endDate);
    endDateMidnight.setHours(0, 0, 0, 0);
    daysLeft = Math.round((endDateMidnight.getTime() - todayMidnight.getTime()) / 86400000);
    isToday = daysLeft === 0;
    isOverdue = daysLeft < 0;
  }

  const progressPct = (() => {
    let realTarget = order.target_count || 1;
    if (order.target_unit && order.target_unit !== "Joki") {
      const match = order.target_unit.match(/^(\d+(?:\.\d+)?)([TBMK]?)$/i);
      if (match) {
        const suffix = match[2].toUpperCase();
        const multiplier =
          suffix === "T" ? 1e12 : suffix === "B" ? 1e9 : suffix === "M" ? 1e6 : suffix === "K" ? 1e3 : 1;
        realTarget = parseFloat(match[1]) * multiplier;
      }
    }
    return Math.min(100, ((order.progress_count ?? 0) / realTarget) * 100);
  })();

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
      className={`bg-white dark:bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-4 md:p-5 transition-all duration-300 ease-out ${
        isDeleting
          ? "opacity-0 scale-90 -translate-x-8 blur-sm"
          : isProcessing
          ? "opacity-0 scale-95 blur-sm pointer-events-none"
          : isCompletedByBot
          ? "border-emerald-300 dark:border-emerald-500/40 opacity-60"
          : isToday
          ? "border-amber-300 dark:border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          : "border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/40"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5 flex-1 min-w-0">
          {/* CHECKBOX */}
          <button
            onClick={() => handleCompleteOrder(order)}
            disabled={isProcessing || isChecked || order.bot_process_failed === true}
            className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
              isProcessing
                ? "border-emerald-500 bg-emerald-500 text-white cursor-wait"
                : isChecked
                ? "bg-emerald-500 border-emerald-500 text-white"
                : order.bot_process_failed
                ? "border-slate-300 dark:border-slate-700 opacity-40 cursor-not-allowed"
                : isCompletedByBot
                ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                : "border-slate-300 dark:border-slate-600 hover:border-violet-500 text-transparent"
            }`}
            title={
              order.bot_process_failed
                ? "Bot gagal proses — pakai tombol Hapus Paksa di bawah"
                : isChecked
                ? "Menunggu bot proses..."
                : isCompletedByBot
                ? "Konfirmasi Selesai"
                : "Selesaikan"
            }
          >
            {isProcessing ? (
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
            ) : (
              <i className="fa-solid fa-check text-xs"></i>
            )}
          </button>

          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              {editingUsername?.orderId === order.id ? (
                <div className="flex flex-col gap-2 flex-1 min-w-0">
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
                      placeholder="Ketik atau pilih dari dropdown..."
                      className="bg-slate-50 dark:bg-slate-950 border border-violet-500 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-w-0 flex-1"
                    />
                    <button
                      onClick={submitUsername}
                      className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition shrink-0"
                      title="Simpan"
                    >
                      <i className="fa-solid fa-check text-xs"></i>
                    </button>
                    <button
                      onClick={() => setEditingUsername(null)}
                      className="w-7 h-7 rounded-lg bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center transition shrink-0"
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
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-20">
                                  {acc.Alias}
                                </span>
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
              ) : (
                <>
                  <h4
                    className={`font-extrabold text-base md:text-lg truncate ${
                      isCompletedByBot ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {order.roblox_username || "Pembeli"}
                  </h4>
                  <button
                    onClick={() => {
                      setEditingUsername({ orderId: order.id, value: order.roblox_username || "" });
                      fetchRamAccounts();
                    }}
                    className="w-6 h-6 rounded-md text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition shrink-0"
                    title="Edit Username"
                  >
                    <i className="fa-solid fa-pen text-[10px]"></i>
                  </button>
                  {isCompletedByBot && (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/30">
                      <i className="fa-solid fa-robot text-[9px]"></i>
                      Bot Selesai
                    </span>
                  )}
                </>
              )}

              {isProcessing && (
                <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-blue-200 dark:border-blue-500/30 animate-pulse">
                  <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>
                  Memproses...
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>
                Order{" "}
                <strong className="text-violet-600 dark:text-violet-400 font-semibold">#{order.order_id}</strong>
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(order.order_id)}
                className="text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition p-0.5"
                title="Copy Order ID"
              >
                <i className="fa-regular fa-copy text-xs"></i>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center space-x-1.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded-lg font-semibold border border-violet-200 dark:border-violet-500/20">
                <i className="fa-regular fa-user text-[11px]"></i>
                <span>{order.joki_name || "Ellan"}</span>
              </span>
              {order.schedule_time && (
                <span className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 dark:border-slate-700/50">
                  <i className="fa-regular fa-clock text-[11px] text-amber-500 dark:text-amber-400"></i>
                  <span>{order.schedule_time.slice(0, 5)}</span>
                </span>
              )}
              {order.schedule_date && (
                <span className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 dark:border-slate-700/50">
                  <i className="fa-regular fa-calendar-days text-[11px] text-indigo-500 dark:text-indigo-400"></i>
                  <span>
                    {new Date(`${order.schedule_date}T00:00:00`).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </span>
              )}
              {order.note && (
                <span className="inline-flex items-center space-x-1.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded-lg font-mono text-[11px] border border-violet-200 dark:border-violet-500/20">
                  <i className="fa-regular fa-note-sticky text-[11px] text-violet-500 dark:text-violet-400"></i>
                  <span>{order.note}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* STATUS BADGE */}
        <div className="flex items-center justify-between sm:justify-end space-x-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60">
          {isCompletedByBot && order.buyer_confirmed ? (
            <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-xs"></i> Buyer Konfirmasi
            </span>
          ) : isCompletedByBot ? (
            <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-hourglass-half text-xs"></i> Menunggu Buyer
            </span>
          ) : isProgress ? (
            <span className="bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-egg text-xs"></i>
              {(order.progress_keyword || "Egg").toUpperCase()} {formatShortNumber(order.progress_count ?? 0)}/{displayTarget}
            </span>
          ) : isOverdue ? (
            <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-triangle-exclamation text-xs"></i> Overdue
            </span>
          ) : isToday ? (
            <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-fire text-xs text-amber-500 dark:text-amber-400"></i> Hari Ini
            </span>
          ) : daysLeft === 1 ? (
            <span className="bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-calendar-day text-xs"></i> Besok
            </span>
          ) : daysLeft !== null && daysLeft > 1 ? (
            <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-calendar-check text-xs"></i> {daysLeft} hari lagi
            </span>
          ) : (
            <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-clock text-xs"></i> Belum dijadwalkan
            </span>
          )}
        </div>
      </div>

      {/* PROGRESS BAR (egg/eternal) */}
      {isProgress && (
        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <i className="fa-solid fa-egg text-violet-500 dark:text-violet-400"></i>
              Progress {(order.progress_keyword || "Egg").toUpperCase()}
            </span>
            <span className="text-sm font-black text-violet-600 dark:text-violet-400 font-mono">
              {formatShortNumber(order.progress_count ?? 0)} / {displayTarget}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div
              className="h-full bg-linear-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* COUNTDOWN */}
      {!isProgress && order.estimated_end_at && (
        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <i className="fa-regular fa-clock text-amber-500 dark:text-amber-400"></i>
              Sisa Waktu
            </span>
            <span
              className={`text-sm font-black font-mono tracking-tight ${
                new Date(order.estimated_end_at).getTime() - now <= 0
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {(() => {
                const remaining = Math.max(0, new Date(order.estimated_end_at!).getTime() - now);
                if (remaining === 0) return "SEGERA SELESAI";
                const h = Math.floor(remaining / 3600000);
                const m = Math.floor((remaining % 3600000) / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                return `${h > 0 ? h + ":" : ""}${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
              })()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <i className="fa-solid fa-flag-checkered text-emerald-500 dark:text-emerald-400"></i>
              Selesai Jam
            </span>
            <span className="text-sm font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {new Date(order.estimated_end_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB
            </span>
          </div>
        </div>
      )}

      {/* MULAI ORDERAN */}
      {order.queue_status === "waiting_confirm" && order.order_type === "progress" && (
        <button
          onClick={() => handleStartProgressOrder(order)}
          disabled={isStarting}
          className="w-full mt-3 bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 text-sm"
        >
          {isStarting ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i>
              Memulai...
            </>
          ) : (
            <>
              <i className="fa-solid fa-play"></i>
              Mulai Orderan
            </>
          )}
        </button>
      )}

      {/* INDETERMINATE — bot lagi proses */}
      {isChecked && (
        <div className="mt-3 pt-3 border-t border-violet-200 dark:border-violet-500/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider flex items-center gap-1.5">
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
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
            Bot sedang memproses order di background. Card akan otomatis hilang setelah selesai. Kalau bot gagal,
            tombol &quot;Hapus Paksa&quot; bakal muncul.
          </p>
        </div>
      )}

      {/* HAPUS PAKSA */}
      {order.bot_process_failed && !isCompletedByBot && (
        <div className="mt-3 pt-3 border-t border-rose-200 dark:border-rose-500/20">
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
            <i className="fa-solid fa-triangle-exclamation text-rose-600 dark:text-rose-400 text-xs mt-0.5 shrink-0"></i>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Bot gagal proses order ini</p>
              <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 leading-relaxed">
                {order.bot_failed_reason || "Order nggak ketemu di Itemku"}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleForceDelete(order)}
            disabled={isProcessing}
            className="w-full mt-2 bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 text-sm"
          >
            <i className="fa-solid fa-trash-can"></i>
            Hapus Paksa (Card + DB)
          </button>
        </div>
      )}
    </div>
  );
}
