"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type QueueOrder = {
  id: number;
  order_id: string;
  roblox_username: string | null;
  product: string | null;
  queue_status: string;
  queue_position: number | null;
  processing_started_at: string | null;
  estimated_end_at: string | null;
};
// ... (import dll)

export default function QueuePage() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [now, setNow] = useState(Date.now());

  // Update time setiap detik untuk countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    const { data, error } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("completed", false);
    
    if (!error) setOrders(data || []);
  };

  useEffect(() => {
    loadQueue();
    
    // Realtime subscription
    const channel = supabase
      .channel("queue_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "joki_orders" }, () => loadQueue())
      .subscribe();
    
    return () => { supabase.removeChannel(channel); };
  }, []);

  const processing = orders.filter(o => o.queue_status === "processing");
  const waiting = orders.filter(o => o.queue_status === "waiting_confirm");
  const queued = orders.filter(o => o.queue_status === "queued");

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🎮 Jokian Queue</h1>
        <p className="text-slate-400 mb-8">
          Total slot aktif: {processing.length + waiting.length}/11
        </p>

        {/* PROCESSING */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
            Sedang Diproses ({processing.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processing.map(order => <ProcessingCard key={order.id} order={order} now={now} />)}
          </div>
        </div>

        {/* WAITING CONFIRM */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-violet-500"></span>
            Menunggu Konfirmasi Penjoki ({waiting.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waiting.map(order => <WaitingCard key={order.id} order={order} />)}
          </div>
        </div>

        {/* QUEUED */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
            Antrian ({queued.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {queued.map(order => <QueueCard key={order.id} order={order} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// Countdown component
function ProcessingCard({ order, now }: { order: QueueOrder; now: number }) {
  const endTime = order.estimated_end_at ? new Date(order.estimated_end_at).getTime() : 0;
  const remaining = Math.max(0, endTime - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  return (
    <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-lg truncate">{order.roblox_username || "Pembeli"}</h3>
          <p className="text-xs text-slate-400 font-mono">#{order.order_id}</p>
        </div>
        <span className="px-2 py-1 bg-amber-500/20 text-amber-300 rounded-lg text-xs font-bold shrink-0 ml-2">
          🔥 LIVE
        </span>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-800">
        <p className="text-xs text-slate-400 mb-1">Sisa Waktu:</p>
        <p className={`text-2xl font-black font-mono ${remaining === 0 ? "text-rose-500" : "text-amber-400"}`}>
          {remaining === 0 
            ? "SEGERA SELESAI" 
            : `${hours > 0 ? hours + ":" : ""}${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`}
        </p>
      </div>
    </div>
  );
}

function WaitingCard({ order }: { order: QueueOrder }) {
  return (
    <div className="bg-slate-900 border border-violet-500/30 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-lg truncate">{order.roblox_username || "Pembeli"}</h3>
          <p className="text-xs text-slate-400 font-mono">#{order.order_id}</p>
        </div>
        <span className="px-2 py-1 bg-violet-500/20 text-violet-300 rounded-lg text-xs font-bold shrink-0 ml-2">
          ⏳ MENUNGGU
        </span>
      </div>
      <p className="text-xs text-slate-400 mt-2">Menunggu penjoki konfirmasi</p>
    </div>
  );
}

function QueueCard({ order }: { order: QueueOrder }) {
  return (
    <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-lg truncate">{order.roblox_username || "Pembeli"}</h3>
          <p className="text-xs text-slate-400 font-mono">#{order.order_id}</p>
        </div>
        <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg text-xs font-bold shrink-0 ml-2">
          #{order.queue_position} ANTRIAN
        </span>
      </div>
    </div>
  );
}