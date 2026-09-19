"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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
};

export default function QueueDetailPage() {
  // === ROUTING & STATE DULU ===
  const params = useParams();
  const orderId = params?.order_id as string | undefined;
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

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
  };

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
        alert(data.message || "Gagal menambah waktu");
        return;
      }
      setShowAddTime(false);
      setAddValue("");
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleCustomAdd = () => {
    const val = parseFloat(addValue);
    if (isNaN(val) || val <= 0) {
      alert("Masukkan angka yang valid (lebih dari 0)");
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

  // ✅ Order dianggap "selesai" kalau:
  // 1. queue_status = "completed" (dari API check-completed)
  // 2. ATAU completed_by_bot = true (dari API jokian/complete via bot)
  const isCompleted =
    order.queue_status === "completed" || order.completed_by_bot === true;

  const endTime = order.estimated_end_at
    ? new Date(order.estimated_end_at).getTime()
    : 0;
  const remaining = Math.max(0, endTime - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  // ✅ Cek dulu countdown udah lewat atau belum
  const isOverdue = isProcessing && remaining === 0;

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
        subtitle: "Menunggu penjoki mulai",
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

          {isProcessing && !isOverdue && !isCompleted && (
            <div className="mt-6 pt-6 border-t border-amber-500/20">
              <p className="text-[11px] text-slate-400 mb-2 text-center uppercase tracking-wider font-bold flex items-center justify-center gap-1.5">
                <i className="fa-regular fa-clock"></i>
                Estimasi Selesai
              </p>
              <p className="text-3xl md:text-4xl font-black text-center font-mono tracking-tight text-amber-400">
                {`${hours > 0 ? hours + ":" : ""}${minutes
                  .toString()
                  .padStart(2, "0")}:${seconds
                  .toString()
                  .padStart(2, "0")}`}
              </p>
              {order.estimated_end_at && (
                <p className="text-xs text-slate-400 text-center mt-3 flex items-center justify-center gap-1.5">
                  <i className="fa-regular fa-calendar text-[10px]"></i>
                  {new Date(order.estimated_end_at).toLocaleString("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  WIB
                </p>
              )}

              {isAdmin && (
                <button
                  onClick={() => setShowAddTime(true)}
                  className="mt-5 w-full flex items-center justify-center gap-2 bg-slate-950/40 hover:bg-slate-950/60 border border-amber-500/40 hover:border-amber-500/60 text-amber-300 font-bold py-2.5 rounded-xl transition text-sm"
                >
                  <i className="fa-solid fa-plus"></i>
                  Tambah Waktu
                </button>
              )}
            </div>
          )}

          {/* ✅ Countdown lewat tapi status masih processing → pesan kalem */}
          {isProcessing && isOverdue && !isCompleted && (
            <div className="mt-6 pt-6 border-t border-emerald-500/20">
              <div className="text-center">
                <i className="fa-solid fa-circle-check text-emerald-400 text-3xl mb-3"></i>
                <p className="text-sm text-slate-300 font-medium">
                  Jokian kamu sudah dalam proses penyelesaian.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Mohon tunggu sebentar ya kak, penjoki sedang menyelesaikan
                </p>
              </div>

              {isAdmin && (
                <button
                  onClick={() => setShowAddTime(true)}
                  className="mt-5 w-full flex items-center justify-center gap-2 bg-slate-950/40 hover:bg-slate-950/60 border border-emerald-500/40 hover:border-emerald-500/60 text-emerald-300 font-bold py-2.5 rounded-xl transition text-sm"
                >
                  <i className="fa-solid fa-plus"></i>
                  Tambah Waktu
                </button>
              )}
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
              label="Joki"
              value={order.joki_name || "Ellan"}
            />
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
              <select
                value={addUnit}
                onChange={(e) =>
                  setAddUnit(e.target.value as "minutes" | "hours")
                }
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 transition cursor-pointer"
              >
                <option value="minutes">Menit</option>
                <option value="hours">Jam</option>
              </select>
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