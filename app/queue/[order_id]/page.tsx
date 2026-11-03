"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/app/components/ToastProvider";
import { ProgressHero, EggSection } from "./ProgressView";
import CountdownHero from "./CountdownView";
import { QueueHero, StatusSteps, WaitingHero, type StepStatus } from "./WaitingView";
import { estimateQueueStarts, type QueueEstimateOrder } from "@/lib/queueUtils";

type EternalEggLog = {
  egg_name: string;
  area: string | null;
  size: string | null;
  weight: string | null;
  counted: boolean;
  created_at: string;
};

type EternalProgressData = {
  order: {
    order_id: string;
    product: string | null;
    roblox_username: string | null;
    joki_name: string | null;
    queue_status: string;
    progress_keyword: string;
    progress_count: number;
    target_count: number;
    target_unit: string | null;
    is_complete: boolean;
  };
  eggs: {
    total: number;
    counted: number;
    by_rarity: Record<string, EternalEggLog[]>;
  };
};

type QueueOrder = {
  id: number;
  order_id: string;
  roblox_username: string | null;
  product: string | null;
  joki_name: string | null;
  queue_status: string;
  queue_position: number | null;
  processing_started_at: string | null;
  estimated_end_at: string | null;
  schedule_date: string;
  schedule_time: string;
  completed_by_bot: boolean;
  buyer_confirmed: boolean;
  confirm_token: string | null;
  progress_count: number | null;        // ← TAMBAH
  progress_keyword: string | null;      // ← TAMBAH
  target_count: number | null;          // ← TAMBAH
  target_unit: string | null;
};

function formatShortNumber(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`.replace(".0T", "T");
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`.replace(".0B", "B");
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`.replace(".0M", "M");
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`.replace(".0K", "K");
  return `${n}`;
}

export default function QueueDetailPage() {
  // === ROUTING & STATE DULU ===
  const params = useParams();
  const orderId = params?.order_id as string | undefined;
  const searchParams = useSearchParams();
  const toast = useToast();
  const token = searchParams.get("token");
  const [eternalData, setEternalData] = useState<EternalProgressData | null>(null);

  const [order, setOrder] = useState<QueueOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(Date.now());

  // === BUYER CONFIRM STATE ===
  const [buyerConfirmed, setBuyerConfirmed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  // === ADMIN STATE ===
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddTime, setShowAddTime] = useState(false);
  const [addValue, setAddValue] = useState("");
  const [addUnit, setAddUnit] = useState<"minutes" | "hours">("minutes");
  const [saving, setSaving] = useState(false);

  // === ANTRIAN: daftar order aktif + jumlah slot (untuk perkiraan mulai) ===
  const [queueList, setQueueList] = useState<QueueEstimateOrder[] | null>(null);
  const [maxParallel, setMaxParallel] = useState<number | null>(null);

  

  // === SYNC buyer_confirmed DARI ORDER ===
  useEffect(() => {
    if (order?.buyer_confirmed) setBuyerConfirmed(true);
  }, [order?.buyer_confirmed]);

  // === HANDLE CONFIRM BUYER ===
  const handleConfirm = async () => {
    if (!order || !token) return;
    setConfirming(true);
    setConfirmMessage("");
    try {
      const res = await fetch("/api/queue/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.order_id, token }),
      });
      const data = await res.json();

      if (data.success) {
        setBuyerConfirmed(true);
        setConfirmMessage(data.message || "Konfirmasi berhasil!");
        if (data.auto_closed) {
          setTimeout(() => (window.location.href = "/queue"), 3000);
        }
      } else {
        setConfirmMessage(data.message || "Gagal konfirmasi");
      }
    } catch (err) {
      setConfirmMessage("Terjadi kesalahan");
    } finally {
      setConfirming(false);
    }
  };

  // Fetch eternal progress (kalau order-nya progress type)
useEffect(() => {
  if (!orderId) return;
  
  const fetchEternalData = async () => {
    try {
      const res = await fetch(`/api/eternal/order/${orderId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.success) setEternalData(d.data);
      }
    } catch (err) {
      console.error("Gagal fetch eternal data:", err);
    }
  };
  
  fetchEternalData();
  
  // Re-fetch tiap 10 detik (atau pakai supabase realtime)
  const interval = setInterval(fetchEternalData, 10000);
  return () => clearInterval(interval);
}, [orderId, order?.progress_count]);

  // Update time tiap detik
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Cek status admin
  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  const loadOrder = async () => {
    if (!orderId) return;

    const cleanId = orderId.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();
    console.log("[QueueDetail] Loading:", cleanId);

    const { data, error } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("order_id", cleanId)
      .maybeSingle();

    if (error) {
      console.error("[QueueDetail] error:", error);
      setNotFound(true);
      return;
    }

    if (!data) {
      console.warn("[QueueDetail] Order tidak ditemukan:", cleanId);
      setNotFound(true);
      return;
    }

    setOrder(data);
    if (data.queue_status === "queued") loadQueueList();
  };

  // ⭐ Daftar order aktif — hanya diambil saat order ini masih di antrian
  const loadQueueList = async () => {
    const { data, error } = await supabase
      .from("joki_orders")
      .select(
        "order_id, queue_status, queue_position, processing_started_at, estimated_end_at, order_type, progress_keyword, target_count"
      )
      .eq("completed", false);
    if (error) {
      console.error("[QueueDetail] queue list error:", error);
      return;
    }
    setQueueList((data as QueueEstimateOrder[]) || []);
  };

  useEffect(() => {
    fetch("/api/queue/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMaxParallel(d.max_parallel);
      })
      .catch(() => {});
  }, []);

  // ⭐ Kasih tahu pembeli saat order mulai dikerjakan (toast + judul tab + getar)
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    const status = order?.queue_status ?? null;
    const before = prevStatus.current;
    prevStatus.current = status;
    if (!status || !before || before === status) return;
    if (status !== "processing" || (before !== "queued" && before !== "waiting_confirm")) return;

    toast.success("Jokian kamu mulai dikerjakan!");
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {}

    const original = document.title;
    if (document.visibilityState === "hidden") {
      let flip = false;
      const timer = setInterval(() => {
        flip = !flip;
        document.title = flip ? "(Mulai) Jokian dikerjakan!" : original;
      }, 1200);
      const restore = () => {
        if (document.visibilityState !== "visible") return;
        clearInterval(timer);
        document.title = original;
        document.removeEventListener("visibilitychange", restore);
      };
      document.addEventListener("visibilitychange", restore);
    }
  }, [order?.queue_status, toast]);

  useEffect(() => {
    if (!orderId) return;
    loadOrder();

    const channel = supabase
      .channel(`order_${orderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "joki_orders" },
        () => loadOrder()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // === HANDLE ADD TIME ===
  const handleAddTime = async (addMinutes: number) => {
    if (!order || addMinutes <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/queue/add-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: order.order_id,
          add_minutes: addMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Gagal menambah waktu");
        return;
      }

      // ⭐ Langsung perbarui jam selesai di layar (tidak menunggu realtime),
      //    lalu ambil ulang data dari server supaya pasti sama.
      if (data.new_estimated_end_at) {
        setOrder((prev) =>
          prev
            ? {
                ...prev,
                estimated_end_at: data.new_estimated_end_at,
                schedule_date: data.new_schedule_date ?? prev.schedule_date,
                schedule_time: data.new_schedule_time ?? prev.schedule_time,
                queue_status: "processing",
              }
            : prev
        );
        toast.success(`Waktu ditambah — selesai jadi ${formatEndWIB(data.new_estimated_end_at)} WIB`);
      }
      loadOrder();

      setShowAddTime(false);
      setAddValue("");
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat menambah waktu");
    } finally {
      setSaving(false);
    }
  };

  // ⭐ Perkiraan jam selesai baru (sama dengan perhitungan server):
  //    dari jam selesai sekarang, atau dari SEKARANG kalau sudah lewat.
  const previewEnd = (addMinutes: number) => {
    const current = order?.estimated_end_at ? new Date(order.estimated_end_at).getTime() : now;
    return Math.max(current, now) + addMinutes * 60_000;
  };
  const customMinutes = (() => {
    const val = parseFloat(addValue);
    if (isNaN(val) || val <= 0) return null;
    return Math.round(addUnit === "hours" ? val * 60 : val);
  })();

  const handleCustomAdd = () => {
    const val = parseFloat(addValue);
    if (isNaN(val) || val <= 0) {
      toast.warning("Masukkan angka yang valid (lebih dari 0)");
      return;
    }
    const minutes = addUnit === "hours" ? val * 60 : val;
    handleAddTime(Math.round(minutes));
  };

  // === NOT FOUND ===
  if (notFound) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-950 to-slate-900 text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-3xl bg-violet-500/10 text-violet-400 flex items-center justify-center mx-auto mb-5 border border-violet-500/30">
            <i className="fa-solid fa-magnifying-glass text-3xl"></i>
          </div>
          <h1 className="text-2xl font-extrabold mb-2 text-white">
            Order Tidak Ditemukan
          </h1>
          <p className="text-slate-400 mb-6 text-sm">
            Order dengan ID{" "}
            <code className="text-violet-400 break-all font-mono bg-violet-500/10 px-2 py-0.5 rounded">
              {orderId}
            </code>{" "}
            tidak ditemukan atau sudah selesai.
          </p>
          <Link
            href="/queue"
            className="inline-flex items-center gap-2 px-6 py-3 bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl font-bold text-white transition shadow-lg shadow-violet-600/30"
          >
            <i className="fa-solid fa-arrow-left text-sm"></i>
            Lihat Semua Antrian
          </Link>
        </div>
      </div>
    );
  }

  // === LOADING ===
  if (!order) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-950 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Memuat status order...</p>
        </div>
      </div>
    );
  }

  const isProcessing = order.queue_status === "processing";
  const isWaiting = order.queue_status === "waiting_confirm";
  const isQueued = order.queue_status === "queued";
    // ⭐ Detect progress order — bedain dari countdown
  const isProgressOrder = 
    (order as any).order_type === "progress" ||
    (order.progress_keyword != null && (order.target_count ?? 0) > 0);
  
  // ⭐ HELPER BARU: Nentuin display target (1T atau angka)
  const displayTarget = 
    order.target_unit && order.target_unit !== "Joki" 
      ? order.target_unit 
      : (order.target_count?.toString() ?? "0");
  
  // Progress order: nggak ada countdown, jadi force remaining = 0 tapi jangan trigger overdue
  const effectiveEstimatedEnd = isProgressOrder ? null : order.estimated_end_at;

  // ✅ Order dianggap "selesai" kalau:
  // 1. queue_status = "completed" (dari API check-completed)
  // 2. ATAU completed_by_bot = true (dari API jokian/complete via bot)
  const isCompleted =
    order.queue_status === "completed" || order.completed_by_bot === true;

    const endTime = effectiveEstimatedEnd
    ? new Date(effectiveEstimatedEnd).getTime()
    : 0;
  const remaining = Math.max(0, endTime - now);

  // ⭐ Tahapan untuk garis langkah
  const stepStatus: StepStatus = isCompleted
    ? "completed"
    : isProcessing
      ? "processing"
      : isWaiting
        ? "waiting_confirm"
        : "queued";
  const stepHint = isWaiting
    ? "menunggu tim"
    : isQueued
      ? `antrian #${order.queue_position ?? "-"}`
      : null;

  // ⭐ Perkiraan mulai (rumus sama dengan halaman /queue)
  const queuedTotal = queueList ? queueList.filter((o) => o.queue_status === "queued").length : 0;
  const queueEta: number | null | undefined =
    isQueued && queueList && maxParallel != null
      ? (estimateQueueStarts(queueList, maxParallel, now).get(order.order_id) ?? null)
      : undefined;

  // ✅ Overdue cuma berlaku buat countdown order
  const isOverdue = !isProgressOrder && isProcessing && remaining === 0;

    const statusConfig = isCompleted
    ? {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/40",
        text: "text-emerald-300",
        iconBg: "bg-emerald-500/20",
        iconColor: "text-emerald-400",
        icon: "fa-solid fa-circle-check",
        title: "SELESAI",
        subtitle: "Jokian sudah selesai, terimakasih!",
      }
    : isProgressOrder && isProcessing
    ? {
        bg: "bg-violet-500/10",
        border: "border-violet-500/40",
        text: "text-violet-300",
        iconBg: "bg-violet-500/20",
        iconColor: "text-violet-400",
        icon: "fa-solid fa-egg",
        title: "SEDANG DIPROSES",
        subtitle: `Progress: ${formatShortNumber(order.progress_count ?? 0)}/${displayTarget} ${(order.progress_keyword || "egg").toUpperCase()}`,
      }
    : isProcessing && isOverdue
    ? {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/40",
        text: "text-emerald-300",
        iconBg: "bg-emerald-500/20",
        iconColor: "text-emerald-400",
        icon: "fa-solid fa-circle-check",
        title: "PROSES AKHIR",
        subtitle: "Jokian kamu hampir selesai, mohon tunggu ya",
      }
    : isProcessing
    ? {
        bg: "bg-amber-500/10",
        border: "border-amber-500/40",
        text: "text-amber-300",
        iconBg: "bg-amber-500/20",
        iconColor: "text-amber-400",
        icon: "fa-solid fa-fire",
        title: "SEDANG DIPROSES",
        subtitle: "Jokian kamu sedang dikerjakan",
      }
    : isWaiting
    ? {
        bg: "bg-violet-500/10",
        border: "border-violet-500/40",
        text: "text-violet-300",
        iconBg: "bg-violet-500/20",
        iconColor: "text-violet-400",
        icon: "fa-solid fa-hourglass-half",
        title: "MENUNGGU KONFIRMASI",
        subtitle: "Menunggu tim kami mulai",
      }
    : {
        bg: "bg-indigo-500/10",
        border: "border-indigo-500/40",
        text: "text-indigo-300",
        iconBg: "bg-indigo-500/20",
        iconColor: "text-indigo-400",
        icon: "fa-solid fa-list-ol",
        title: `ANTRIAN #${order.queue_position ?? "-"}`,
        subtitle: "Order kamu sedang dalam antrian",
      };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-950 to-slate-900 text-white font-sans antialiased selection:bg-violet-500 selection:text-white">
      {/* HEADER */}
      <header className="border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/queue"
              className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center transition text-slate-300 shrink-0"
              title="Kembali ke Queue"
            >
              <i className="fa-solid fa-arrow-left text-sm"></i>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg md:text-xl font-extrabold tracking-tight">
                Status Order
              </h1>
              <p className="text-xs text-slate-400 font-mono truncate">
                ID: {order.order_id}
              </p>
            </div>
            {isAdmin && (
              <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/20 text-violet-300 border border-violet-500/30 rounded-lg text-[10px] font-bold">
                <i className="fa-solid fa-shield-halved text-[9px]"></i>
                ADMIN
              </span>
            )}
          </div>
        </div>
      </header>

      {/* KONTEN */}
      <div className="max-w-2xl mx-auto p-4 md:p-8">
        {/* STATUS CARD */}
        <div
          className={`rounded-3xl p-6 md:p-8 mb-6 border-2 ${statusConfig.bg} ${statusConfig.border}`}
        >
          <StatusSteps status={stepStatus} hint={stepHint} />

          {isProgressOrder && eternalData && eternalData.order.target_count > 0 ? (
            // ⭐ Order progress: cincin progress + kecepatan & perkiraan selesai
            <ProgressHero
              data={eternalData}
              fallbackTargetCount={order.target_count}
              fallbackTargetUnit={order.target_unit}
              now={now}
              isCompleted={isCompleted}
            />
          ) : !isProgressOrder && isProcessing && !isCompleted ? (
            // ⭐ Order countdown: cincin sisa waktu + garis waktu + tombol cepat admin
            <CountdownHero
              startIso={order.processing_started_at}
              endIso={order.estimated_end_at}
              now={now}
              isAdmin={isAdmin}
              saving={saving}
              onQuickAdd={handleAddTime}
              onOpenAddTime={() => setShowAddTime(true)}
            />
          ) : isWaiting && !isCompleted ? (
            // ⭐ Menunggu konfirmasi
            <WaitingHero />
          ) : isQueued && !isCompleted ? (
            // ⭐ Antrian: nomor besar + deretan posisi + perkiraan mulai
            <QueueHero position={order.queue_position} totalQueued={queuedTotal} eta={queueEta} now={now} />
          ) : (
          <div className="text-center">
            <div
              className={`w-20 h-20 rounded-3xl ${statusConfig.iconBg} ${statusConfig.iconColor} flex items-center justify-center mx-auto mb-5 shadow-sm border ${statusConfig.border}`}
            >
              <i className={`${statusConfig.icon} text-3xl`}></i>
            </div>
            <h2
              className={`text-xl md:text-2xl font-black mb-2 ${statusConfig.text}`}
            >
              {statusConfig.title}
            </h2>
            <p className="text-sm text-slate-400">{statusConfig.subtitle}</p>
          </div>
          )}

          {/* ✅ Kalau completed → pesan selesai + tombol konfirmasi */}
          {isCompleted && (
            <div className="mt-6 pt-6 border-t border-emerald-500/20">
              <div className="text-center"></div>

              {/* 🔘 TOMBOL KONFIRMASI — hanya kalau ada token & belum dikonfirmasi */}
{token && !buyerConfirmed && (
  <div className="mt-5">
    {/* 1️⃣ TOMBOL DULUAN */}
    <button
      onClick={handleConfirm}
      disabled={confirming}
      className="w-full bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
    >
      {confirming ? (
        <>
          <i className="fa-solid fa-spinner fa-spin"></i>
          Memproses...
        </>
      ) : (
        <>
          <i className="fa-solid fa-circle-check"></i>
          Konfirmasi Selesai
        </>
      )}
    </button>

    {/* 2️⃣ TEKS JUDUL DI BAWAH TOMBOL */}
    <p className="text-[11px] text-slate-400 text-center mt-4 mb-1 uppercase tracking-wider font-bold">
      Konfirmasi Jokian Selesai
    </p>

    {/* 3️⃣ TEKS KETERANGAN DI BAWAH JUDUL */}
    <p className="text-xs text-slate-400 text-center mb-2">
      Klik tombol di atas untuk konfirmasi. Akun roblox akan otomatis di-logout.
    </p>

    {/* 4️⃣ PESAN HASIL KONFIRMASI */}
    {confirmMessage && (
      <p className="text-center text-xs mt-3 text-emerald-400">
        {confirmMessage}
      </p>
    )}
  </div>
)}

              {/* ✅ Kalau sudah dikonfirmasi */}
              {buyerConfirmed && (
                <div className="mt-5 bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/40 text-center">
                  <i className="fa-solid fa-circle-check text-emerald-400 text-2xl mb-2"></i>
                  <p className="text-sm font-extrabold text-emerald-300 mb-1">
                    Sudah Dikonfirmasi
                  </p>
                  <p className="text-xs text-slate-400">
                    Terimakasih! Jokian sudah dikonfirmasi selesai.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════ */}
        {/* ETERNAL PROGRESS SECTION — cuma kalau order progress */}
        {/* ═══════════════════════════════════════════════ */}
        {eternalData &&
          eternalData.order.target_count > 0 &&
          !eternalData.order.progress_keyword.toLowerCase().includes("income") && (
            <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl p-5 md:p-6 border border-violet-500/30 mb-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <i className="fa-solid fa-egg text-violet-400 text-sm"></i>
                </div>
                <h3 className="font-extrabold text-white">Egg yang didapat</h3>
                <span className="ml-auto text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live
                </span>
              </div>
              <EggSection data={eternalData} now={now} />
            </div>
          )}

        {/* DETAIL ORDER */}
        <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl p-5 md:p-6 border border-slate-800/80">
          <h3 className="font-extrabold mb-4 flex items-center gap-2 text-white">
            <i className="fa-solid fa-box text-violet-400"></i>
            Detail Order
          </h3>
          <div className="space-y-1">
            <DetailRow
              icon="fa-regular fa-user"
              label="Username"
              value={order.roblox_username || "-"}
            />
            <DetailRow
              icon="fa-solid fa-gamepad"
              label="Produk"
              value={order.product || "-"}
            />
            <DetailRow
              icon="fa-solid fa-user-tie"
              label="Ditangani oleh"
              value={order.joki_name || "Ellan"}
            />
            {isProgressOrder ? (
              <DetailRow
                icon="fa-solid fa-egg"
                label="Progress"
                value={`${order.progress_count ?? 0} / ${displayTarget} ${
                  (order.progress_keyword || "egg").toUpperCase()
                }`}
              />
            ) : (
  <DetailRow
    icon="fa-regular fa-calendar"
    label="Jadwal"
    value={
      order.schedule_date && order.schedule_time
        ? `${new Date(order.schedule_date).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })} • ${order.schedule_time.slice(0, 5)} WIB`
        : "Belum dijadwalkan"
    }
  />
)}
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p className="flex items-center justify-center gap-1.5">
            <i className="fa-solid fa-rotate text-[10px]"></i>
            Status di-update otomatis setiap detik
          </p>
        </div>
      </div>

      {/* MODAL TAMBAH WAKTU */}
      {isAdmin && showAddTime && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                <i className="fa-solid fa-clock-rotate-left"></i>
              </div>
              <div>
                <h3 className="font-extrabold text-white">Tambah Waktu</h3>
                <p className="text-xs text-slate-400">
                  Nambah estimasi selesai jokian
                </p>
              </div>
            </div>

            {order.estimated_end_at && (
              <div className="mb-4 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-2.5">
                <i className="fa-regular fa-clock text-amber-400 text-sm"></i>
                <div className="text-xs">
                  <p className="text-slate-500">Selesai saat ini:</p>
                  <p className="text-slate-200 font-mono font-bold">
                    {new Date(order.estimated_end_at).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    WIB
                  </p>
                </div>
              </div>
            )}

            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Pilih Cepat
            </label>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                { label: "+30m", mins: 30 },
                { label: "+1 Jam", mins: 60 },
                { label: "+2 Jam", mins: 120 },
                { label: "+3 Jam", mins: 180 },
                { label: "+6 Jam", mins: 360 },
                { label: "+12 Jam", mins: 720 },
              ].map((preset) => (
                <button
                  key={preset.mins}
                  onClick={() => handleAddTime(preset.mins)}
                  disabled={saving}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-amber-300 border border-slate-700 hover:border-amber-500/50 transition disabled:opacity-50"
                >
                  {preset.label}
                  <span className="block mt-0.5 text-[10px] font-semibold text-slate-500 font-mono">
                    → {formatEndWIB(previewEnd(preset.mins))}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-slate-800"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                atau custom
              </span>
              <div className="flex-1 h-px bg-slate-800"></div>
            </div>

            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Tambah Custom
            </label>
            <div className="flex gap-2 mb-5">
              <input
                type="number"
                min="1"
                value={addValue}
                onChange={(e) => setAddValue(e.target.value)}
                placeholder="1"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition"
              />
              <div role="radiogroup" aria-label="Satuan waktu" className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1 shrink-0">
                {(
                  [
                    ["minutes", "Menit"],
                    ["hours", "Jam"],
                  ] as const
                ).map(([unit, label]) => (
                  <button
                    key={unit}
                    type="button"
                    role="radio"
                    aria-checked={addUnit === unit}
                    onClick={() => setAddUnit(unit)}
                    className={`px-3 rounded-lg text-xs font-bold transition active:scale-95 ${
                      addUnit === unit
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCustomAdd}
                disabled={saving || !addValue}
                className="px-4 py-3 rounded-xl text-xs font-bold text-white bg-linear-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-plus"></i>
                )}
              </button>
            </div>
            {customMinutes != null && (
              <p className="-mt-3 mb-5 text-xs text-slate-400 flex items-center gap-1.5">
                <i className="fa-regular fa-clock text-amber-400 text-[11px]"></i>
                Selesai jadi{" "}
                <span className="font-mono font-bold text-amber-300">{formatEndWIB(previewEnd(customMinutes))} WIB</span>
              </p>
            )}

            <button
              onClick={() => {
                setShowAddTime(false);
                setAddValue("");
              }}
              disabled={saving}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Jam selesai dalam WIB, contoh "31 Okt, 13.00" */
function formatEndWIB(value: string | number): string {
  return new Date(value).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between items-start py-3 border-b border-slate-800 last:border-0 gap-3">
      <span className="text-sm text-slate-400 flex items-center gap-2 shrink-0">
        <i className={`${icon} text-xs text-slate-500`}></i>
        {label}
      </span>
      <span className="text-sm font-semibold text-right break-all text-slate-200">
        {value}
      </span>
    </div>
  );
}