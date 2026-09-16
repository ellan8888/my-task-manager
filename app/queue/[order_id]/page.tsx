"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams } from "next/navigation";
import Link from "next/link";

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
};

export default function QueueDetailPage() {
  const params = useParams();
  const orderId = params.order_id as string;
  const [order, setOrder] = useState<QueueOrder | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Update time setiap detik
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadOrder = async () => {
    if (!orderId) return;

    // Clean order ID dari suffix (untuk jaga-jaga)
    const cleanId = orderId.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim();

    const { data, error } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("order_id", cleanId)
      .single();

    if (error || !data) {
      console.error("Order not found:", error);
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

  // === NOT FOUND STATE ===
  if (notFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold mb-2">Order Tidak Ditemukan</h1>
          <p className="text-slate-400 mb-6">
            Order dengan ID{" "}
            <code className="text-violet-400 break-all">{orderId}</code> tidak
            ditemukan atau sudah selesai.
          </p>
          <Link
            href="/queue"
            className="inline-block px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl font-bold transition"
          >
            ← Lihat Semua Antrian
          </Link>
        </div>
      </div>
    );
  }

  // === LOADING STATE ===
  if (!order) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Memuat status order...</p>
        </div>
      </div>
    );
  }

  const isProcessing = order.queue_status === "processing";
  const isWaiting = order.queue_status === "waiting_confirm";
  const isQueued = order.queue_status === "queued";

  const endTime = order.estimated_end_at
    ? new Date(order.estimated_end_at).getTime()
    : 0;
  const remaining = Math.max(0, endTime - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* HEADER */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/queue"
            className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 flex items-center justify-center transition font-bold"
          >
            ←
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Status Order</h1>
            <p className="text-xs text-slate-400 font-mono truncate">
              ID: {order.order_id}
            </p>
          </div>
        </div>

        {/* STATUS CARD */}
        <div
          className={`rounded-3xl p-6 mb-6 border-2 ${
            isProcessing
              ? "bg-amber-500/10 border-amber-500/40"
              : isWaiting
              ? "bg-violet-500/10 border-violet-500/40"
              : "bg-indigo-500/10 border-indigo-500/40"
          }`}
        >
          <div className="text-center">
            <div className="text-5xl mb-4">
              {isProcessing ? "🔥" : isWaiting ? "⏳" : "📋"}
            </div>
            <h2 className="text-2xl font-black mb-2">
              {isProcessing
                ? "SEDANG DIPROSES"
                : isWaiting
                ? "MENUNGGU KONFIRMASI"
                : `ANTRIAN #${order.queue_position ?? "-"}`}
            </h2>
            <p className="text-sm text-slate-400">
              {isProcessing
                ? "Jokian kamu sedang dikerjakan"
                : isWaiting
                ? "Menunggu penjoki mulai"
                : "Order kamu sedang dalam antrian"}
            </p>
          </div>

          {isProcessing && (
            <div className="mt-6 pt-6 border-t border-amber-500/20">
              <p className="text-xs text-slate-400 mb-2 text-center">
                Estimasi Selesai:
              </p>
              <p className="text-3xl font-black text-center font-mono text-amber-400">
                {remaining === 0
                  ? "SEGERA SELESAI"
                  : `${hours > 0 ? hours + ":" : ""}${minutes
                      .toString()
                      .padStart(2, "0")}:${seconds
                      .toString()
                      .padStart(2, "0")}`}
              </p>
              {order.estimated_end_at && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  Jam{" "}
                  {new Date(order.estimated_end_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* DETAIL ORDER */}
        <div className="bg-slate-900 rounded-2xl p-5 space-y-1">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            📦 Detail Order
          </h3>
          <DetailRow label="Username" value={order.roblox_username || "-"} />
          <DetailRow label="Produk" value={order.product || "-"} />
          <DetailRow label="Joki" value={order.joki_name || "Ellan"} />
          <DetailRow
            label="Jadwal"
            value={`${new Date(order.schedule_date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })} • ${order.schedule_time.slice(0, 5)}`}
          />
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p>Status di-update otomatis setiap detik</p>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-right break-all max-w-[60%]">
        {value}
      </span>
    </div>
  );
}