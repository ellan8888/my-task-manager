"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import type { JokiOrder, RamAccount } from "@/lib/types";
import AppShell from "@/app/components/AppShell";
import { ConfirmDialog, useConfirm } from "@/app/components/ConfirmDialog";
import JokiOrderCard, { isProgressOrder, isDoneByBot } from "@/app/components/JokiOrderCard";
import { useToast } from "@/app/components/ToastProvider";
import {
  StatCard,
  FilterPill,
  SearchInput,
  ViewToggle,
  SectionHeader,
  EmptyState,
  KanbanColumn,
} from "@/app/components/ui";

type JokiFilter = "All" | "Today" | "NotScheduled" | "Overdue";

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

const withId = (s: Set<number>, id: number, on: boolean) => {
  const next = new Set(s);
  if (on) next.add(id);
  else next.delete(id);
  return next;
};

const todayTime = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const endDayOf = (o: JokiOrder) => {
  if (!o.estimated_end_at) return null;
  const d = new Date(o.estimated_end_at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

async function fetchJokiOrders(username: string): Promise<JokiOrder[] | null> {
  const { data, error } = await supabase
    .from("joki_orders")
    .select("*")
    .eq("completed", false)
    .eq("joki_name", username)
    .order("schedule_date", { ascending: true })
    .order("schedule_time", { ascending: true });

  if (error) {
    console.error("Gagal mengambil data Jokian:", error);
    return null;
  }
  return data || [];
}

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

export default function JokiPage() {
  const { user: currentUser } = useCurrentUser();
  const { dialog, showConfirm, closeConfirm } = useConfirm();

  const [jokiOrders, setJokiOrders] = useState<JokiOrder[]>([]);
  const [processingOrders, setProcessingOrders] = useState<Set<number>>(new Set());
  const [startingOrders, setStartingOrders] = useState<Set<number>>(new Set());
  const [checkedOrders, setCheckedOrders] = useState<Set<number>>(new Set());
  const [deletingOrders, setDeletingOrders] = useState<Set<number>>(new Set());
  const [refetchingOrders, setRefetchingOrders] = useState<Set<number>>(new Set());
  const toast = useToast();

  const [editingUsername, setEditingUsername] = useState<{ orderId: number; value: string } | null>(null);
  const [ramAccounts, setRamAccounts] = useState<RamAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<JokiFilter>("All");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [now, setNow] = useState(() => Date.now());

  // ── Load + realtime ──────────────────────────────────────────
  const loadJokiOrders = (username: string) =>
    fetchJokiOrders(username).then((data) => {
      if (data) setJokiOrders(data);
    });

  const reload = () => {
    if (currentUser) return loadJokiOrders(currentUser.username);
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadJokiOrders(currentUser.username);

    const channel = supabase
      .channel("joki_orders_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "joki_orders" }, (payload) => {
        loadJokiOrders(currentUser.username);

        // Bersihin centang untuk order yang udah berubah (bot sukses/gagal)
        const changedId = (payload.new as { id?: number })?.id;
        if (changedId) setCheckedOrders((prev) => withId(prev, changedId, false));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleStartProgressOrder = (order: JokiOrder) => {
    showConfirm(
      "Mulai Orderan?",
      `Mulai proses order "${order.roblox_username || "Pembeli"}"? Bot akan kirim chat ke buyer kalau order sudah mulai diproses.`,
      "info",
      "Ya, Mulai",
      async () => {
        closeConfirm();
        setStartingOrders((prev) => withId(prev, order.id, true));

        try {
          const res = await fetch("/api/queue/start-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: order.order_id }),
          });
          const data = await res.json();

          if (!data.success) {
            alert(data.message || "Gagal memulai order");
            setStartingOrders((prev) => withId(prev, order.id, false));
            return;
          }

          setJokiOrders((cur) => cur.map((o) => (o.id === order.id ? { ...o, queue_status: "processing" } : o)));
          setTimeout(() => setStartingOrders((prev) => withId(prev, order.id, false)), 1000);
        } catch (err) {
          console.error(err);
          alert("Terjadi kesalahan");
          setStartingOrders((prev) => withId(prev, order.id, false));
        }
      }
    );
  };

  // ⭐ Minta bot ambil ulang data order dari link Itemku.
  //    Hasilnya masuk lewat realtime → card ter-update sendiri.
  const handleRefetchOrder = async (order: JokiOrder) => {
    setRefetchingOrders((prev) => withId(prev, order.id, true));
    try {
      const res = await fetch("/api/queue/refetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.order_id }),
      });
      const data = await res.json().catch(() => null);

      if (!data?.success) {
        toast.error(data?.message || "Gagal meminta ambil ulang data");
        return;
      }

      setJokiOrders((cur) =>
        cur.map((o) => (o.id === order.id ? { ...o, bot_refetch_requested: true, bot_refetch_error: null } : o))
      );
      toast.info(data.message || "Bot akan mengambil ulang data sebentar lagi");
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan");
    } finally {
      setRefetchingOrders((prev) => withId(prev, order.id, false));
    }
  };

  const handleForceDelete = (order: JokiOrder) => {
    showConfirm(
      "Hapus Paksa?",
      `Order "${order.roblox_username || "Pembeli"}" bakal dihapus dari card + database.\n\nGunakan ini kalau bot gagal proses dan order udah nggak ada di Itemku.`,
      "danger",
      "Ya, Hapus Paksa",
      async () => {
        closeConfirm();
        setProcessingOrders((prev) => withId(prev, order.id, true));

        try {
          const res = await fetch("/api/queue/complete-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: order.order_id }),
          });
          const data = await res.json().catch(() => null);

          if (!data?.success) {
            alert(data?.message || "Gagal hapus paksa");
            return;
          }
          setJokiOrders((cur) => cur.filter((o) => o.id !== order.id));
        } catch (err) {
          console.error(err);
          alert("Terjadi kesalahan");
        } finally {
          setProcessingOrders((prev) => withId(prev, order.id, false));
        }
      }
    );
  };

  const handleCompleteOrder = (order: JokiOrder) => {
    if (order.bot_process_failed) {
      alert("Bot gagal proses order ini. Gunakan tombol 'Hapus Paksa' di card.");
      return;
    }

    const alreadyDone = isDoneByBot(order);

    showConfirm(
      alreadyDone ? "Hapus dari Daftar?" : "Selesaikan Jokian Manual?",
      alreadyDone
        ? `Order "${order.roblox_username || "Pembeli"}" sudah selesai. Hapus dari daftar?`
        : `Selesaikan jokian "${order.roblox_username || "Pembeli"}" sekarang?\n\nBot akan proses selesai & kirim chat konfirmasi ke buyer.`,
      "success",
      alreadyDone ? "Ya, Hapus" : "Ya, Selesaikan",
      async () => {
        closeConfirm();
        setCheckedOrders((prev) => withId(prev, order.id, true));

        try {
          if (alreadyDone) {
            // Animasi fade out dulu, baru hapus dari UI, lalu hit API
            setDeletingOrders((prev) => withId(prev, order.id, true));
            await new Promise((r) => setTimeout(r, 300));

            setJokiOrders((cur) => cur.filter((o) => o.id !== order.id));
            setCheckedOrders((prev) => withId(prev, order.id, false));
            setDeletingOrders((prev) => withId(prev, order.id, false));

            const res = await fetch("/api/queue/complete-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ order_id: order.order_id }),
            });
            const data = await res.json().catch(() => null);

            if (!data?.success) {
              alert(data?.message || "Gagal hapus order");
              await reload();
            }
            return;
          }

          const res = await fetch("/api/queue/manual-complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: order.order_id }),
          });
          const data = await res.json().catch(() => null);

          if (!data?.success) {
            alert(data?.message || "Gagal trigger bot");
            await reload();
            setCheckedOrders((prev) => withId(prev, order.id, false));
          }
          // Kalau sukses: centang tetap ada, realtime yang bakal update card
        } catch (err) {
          console.error(err);
          alert("Terjadi kesalahan");
          await reload();
          setCheckedOrders((prev) => withId(prev, order.id, false));
        }
      }
    );
  };

  const isUsernameUsedInOtherCards = (username: string, currentOrderId: number) => {
    const current = jokiOrders.find((o) => o.id === currentOrderId);

    return jokiOrders.some((o) => {
      if (o.id === currentOrderId) return false;
      if (o.roblox_username?.toLowerCase() !== username.toLowerCase()) return false;

      // Progress order boleh username sama asal keyword beda
      if (current?.order_type === "progress" && o.order_type === "progress") {
        return o.progress_keyword === current.progress_keyword;
      }
      return true;
    });
  };

  const fetchRamAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/get-accounts");
      const data = await res.json();
      if (data.success && Array.isArray(data.accounts)) setRamAccounts(data.accounts);
      else console.error("Gagal load RAM accounts:", data.message);
    } catch (err) {
      console.error("Error fetch RAM accounts:", err);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const updateOrderUsername = async (orderId: number, newUsername: string) => {
    if (!newUsername.trim()) {
      alert("Username tidak boleh kosong!");
      return;
    }

    const oldOrder = jokiOrders.find((o) => o.id === orderId);
    if (!oldOrder?.order_id) {
      alert("Order ID nggak ketemu!");
      return;
    }

    try {
      const res = await fetch("/api/queue/update-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: oldOrder.order_id,
          old_username: oldOrder.roblox_username || "",
          new_username: newUsername.trim(),
        }),
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Gagal mengupdate username!");
        return;
      }

      setJokiOrders((cur) =>
        cur.map((o) =>
          o.id === orderId
            ? { ...o, roblox_username: newUsername.trim(), progress_count: data.progress_count ?? o.progress_count }
            : o
        )
      );

      if (data.reclaimed_eggs > 0) {
        console.log(`✅ ${data.reclaimed_eggs} egg lama di-reclaim. Progress sekarang: ${data.progress_count}`);
      }
      setEditingUsername(null);
    } catch (err) {
      console.error(err);
      alert("Gagal mengupdate username!");
    }
  };

  // ── Derived data ─────────────────────────────────────────────
  const today = todayTime();

  const searched = jokiOrders.filter((o) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      (o.roblox_username || "").toLowerCase().includes(q) ||
      o.order_id.toLowerCase().includes(q) ||
      (o.product || "").toLowerCase().includes(q) ||
      (o.note || "").toLowerCase().includes(q)
    );
  });

  const filtered = searched.filter((o) => {
    if (filter === "All") return true;
    if (filter === "NotScheduled") return !o.estimated_end_at && !isDoneByBot(o);
    if (isDoneByBot(o)) return false;
    const end = endDayOf(o);
    if (end === null) return false;
    if (filter === "Today") return end === today;
    if (filter === "Overdue") return end < today;
    return true;
  });

  const countdownOrders = filtered
    .filter((o) => !isProgressOrder(o) && (o.estimated_end_at || isDoneByBot(o)))
    .sort((a, b) => {
      const aDone = isDoneByBot(a);
      const bDone = isDoneByBot(b);
      if (aDone !== bDone) return aDone ? -1 : 1; // card buram paling atas
      const aT = a.estimated_end_at ? new Date(a.estimated_end_at).getTime() : Number.MAX_SAFE_INTEGER;
      const bT = b.estimated_end_at ? new Date(b.estimated_end_at).getTime() : Number.MAX_SAFE_INTEGER;
      return aT - bT;
    });

  const progressOrders = filtered
    .filter(isProgressOrder)
    .sort((a, b) => {
      const aW = a.queue_status === "waiting_confirm" ? 1 : 0;
      const bW = b.queue_status === "waiting_confirm" ? 1 : 0;
      if (aW !== bW) return aW - bW;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const unscheduledOrders = filtered.filter(
    (o) => !isProgressOrder(o) && !o.estimated_end_at && !isDoneByBot(o)
  );

  // Stats (dari semua order, bukan yang ke-filter)
  const jokiToday = jokiOrders.filter(
    (o) => !isDoneByBot(o) && !isProgressOrder(o) && endDayOf(o) === today
  ).length;
  const jokiNotScheduled = jokiOrders.filter(
    (o) => !o.estimated_end_at && !isDoneByBot(o) && !isProgressOrder(o)
  ).length;
  const jokiDoneByBot = jokiOrders.filter(isDoneByBot).length;

  // Kanban
  const kanbanToday = searched.filter((o) => !isDoneByBot(o) && endDayOf(o) === today);
  const kanbanUnscheduled = searched.filter((o) => !o.estimated_end_at && !isDoneByBot(o));
  const kanbanDone = searched.filter(isDoneByBot);

  const renderCard = (order: JokiOrder) => (
    <JokiOrderCard
      key={order.id}
      order={order}
      now={now}
      isProcessing={processingOrders.has(order.id)}
      isStarting={startingOrders.has(order.id)}
      isChecked={checkedOrders.has(order.id)}
      isDeleting={deletingOrders.has(order.id)}
      editingUsername={editingUsername}
      ramAccounts={ramAccounts}
      loadingAccounts={loadingAccounts}
      setEditingUsername={setEditingUsername}
      fetchRamAccounts={fetchRamAccounts}
      updateOrderUsername={updateOrderUsername}
      handleCompleteOrder={handleCompleteOrder}
      handleStartProgressOrder={handleStartProgressOrder}
      handleForceDelete={handleForceDelete}
      isUsernameUsedInOtherCards={isUsernameUsedInOtherCards}
      handleRefetchOrder={handleRefetchOrder}
      isRefetching={refetchingOrders.has(order.id)}
    />
  );

  // ══════════════════════════════════════════════════════════════
  // JSX
  // ══════════════════════════════════════════════════════════════

  return (
    <>
      <AppShell
        active="joki"
        title="Daftar Order Jokian"
        subtitle="Kelola dan pantau antrean jokian real-time"
        currentUser={currentUser}
        refreshKey={jokiOrders.length}
      >
        {/* METRICS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Jokian" value={jokiOrders.length} icon="fa-boxes-stacked" color="violet" footerIcon="fa-robot" footerText="Sync Tokoku-bot" />
          <StatCard label="Hari Ini" value={jokiToday} icon="fa-fire" color="amber" footerIcon="fa-clock" footerText="Prioritas Pengerjaan" />
          <StatCard label="Belum Dijadwalkan" value={jokiNotScheduled} icon="fa-clock" color="indigo" footerIcon="fa-hourglass-half" footerText="Nunggu Jadwal" />
          <StatCard label="Selesai Bot" value={jokiDoneByBot} icon="fa-circle-check" color="emerald" footerIcon="fa-user-check" footerText="Nunggu konfirmasi buyer" />
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 lg:pb-0 custom-scrollbar">
            <FilterPill active={filter === "All"} onClick={() => setFilter("All")}>
              Semua ({jokiOrders.length})
            </FilterPill>
            <FilterPill active={filter === "Today"} onClick={() => setFilter("Today")} dot="bg-amber-400">
              Hari Ini
            </FilterPill>
            <FilterPill active={filter === "NotScheduled"} onClick={() => setFilter("NotScheduled")} dot="bg-indigo-400">
              Belum Dijadwalkan
            </FilterPill>
            <FilterPill active={filter === "Overdue"} onClick={() => setFilter("Overdue")} dot="bg-rose-400">
              Overdue
            </FilterPill>
          </div>
          <div className="flex items-center space-x-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari username / order ID..." />
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        {/* LIST VIEW */}
        {view === "list" && (
          <>
            <section>
              <SectionHeader icon="fa-hourglass-half" title="Jadwal Jokian (Countdown)" count={countdownOrders.length} />
              <div className="pt-4 pb-6 space-y-3.5">
                {countdownOrders.length === 0 ? (
                  <EmptyState
                    icon="fa-solid fa-hourglass-half"
                    color="amber"
                    title="Tidak ada jadwal countdown aktif"
                    desc="Order joki dengan countdown akan muncul di sini."
                  />
                ) : (
                  countdownOrders.map(renderCard)
                )}
              </div>
            </section>

            <section>
              <SectionHeader icon="fa-egg" title="Progress Order" count={progressOrders.length} />
              <div className="pt-4 pb-6 space-y-3.5">
                {progressOrders.length === 0 ? (
                  <EmptyState
                    icon="fa-solid fa-egg"
                    title="Tidak ada progress order aktif"
                    desc="Order progress (egg/eternal) akan muncul di sini."
                  />
                ) : (
                  progressOrders.map(renderCard)
                )}
              </div>
            </section>

            {unscheduledOrders.length > 0 && (
              <section>
                <SectionHeader icon="fa-clock" title="Belum Dijadwalkan" count={unscheduledOrders.length} color="indigo" />
                <div className="pt-4 pb-6 space-y-3.5">{unscheduledOrders.map(renderCard)}</div>
              </section>
            )}
          </>
        )}

        {/* KANBAN VIEW */}
        {view === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
            <KanbanColumn title="Hari Ini" icon="fa-fire" color="amber" count={kanbanToday.length}>
              {kanbanToday.map((o) => (
                <JokiMiniCard key={o.id} order={o} right={o.schedule_time ? o.schedule_time.slice(0, 5) : "-"} />
              ))}
            </KanbanColumn>
            <KanbanColumn title="Belum Dijadwalkan" icon="fa-clock" color="indigo" count={kanbanUnscheduled.length}>
              {kanbanUnscheduled.map((o) => (
                <JokiMiniCard key={o.id} order={o} right="Belum dijadwalkan" />
              ))}
            </KanbanColumn>
            <KanbanColumn title="Selesai Bot" icon="fa-circle-check" color="emerald" count={kanbanDone.length}>
              {kanbanDone.map((o) => (
                <JokiMiniCard key={o.id} order={o} right={o.buyer_confirmed ? "Buyer konfirmasi" : "Menunggu buyer"} faded />
              ))}
            </KanbanColumn>
          </div>
        )}
      </AppShell>

      <ConfirmDialog dialog={dialog} onClose={closeConfirm} />
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// KANBAN MINI CARD
// ══════════════════════════════════════════════════════════════

function JokiMiniCard({ order, right, faded }: { order: JokiOrder; right: string; faded?: boolean }) {
  return (
    <div
      className={`bg-slate-50 dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-violet-300 dark:hover:border-violet-500/50 transition shadow-sm ${
        faded ? "opacity-70" : ""
      }`}
    >
      <div>
        <h5 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
          {order.roblox_username || "Pembeli"}
        </h5>
        <p className="text-[11px] text-violet-600 dark:text-violet-400 font-mono mt-0.5">#{order.order_id}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <span className="font-semibold text-violet-600 dark:text-violet-300">
          <i className="fa-regular fa-user mr-1 text-[11px]"></i>
          {order.joki_name || "Ellan"}
        </span>
        <span className="font-mono text-amber-600 dark:text-amber-400">{right}</span>
      </div>
    </div>
  );
}
