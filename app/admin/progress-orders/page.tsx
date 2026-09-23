// app/admin/progress-orders/page.tsx
"use client";

import { useEffect, useState } from "react";

type ProgressOrder = {
  id: number;
  order_id: string;
  product: string;
  joki_name: string;
  target_count: number;
  progress_count: number;
  confirmed_by: string | null;
  webhook_url: string | null;
  created_at: string;
};

export default function ProgressOrdersPage() {
  const [orders, setOrders] = useState<ProgressOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [webhookInput, setWebhookInput] = useState<Record<string, string>>({});
  
  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/eternal/orders");
      const data = await res.json();
      if (data.success) setOrders(data.data || []);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadOrders();
  }, []);
  
  const handleConfirm = async (order_id: string) => {
    const webhook = webhookInput[order_id];
    if (!webhook) {
      alert("Webhook wajib diisi");
      return;
    }
    
    const res = await fetch("/api/eternal/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id, webhook_url: webhook }),
    });
    
    const data = await res.json();
    if (data.success) {
      alert("Order confirmed!");
      loadOrders();
    } else {
      alert(`Gagal: ${data.message}`);
    }
  };
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">
        🌀 Progress Orders (Eternal)
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orders.map((order) => {
          const percent = (order.progress_count / order.target_count) * 100;
          const isComplete = order.progress_count >= order.target_count;
          
          return (
            <div
              key={order.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800"
            >
              <h3 className="font-bold text-lg mb-2">{order.product}</h3>
              <p className="text-sm text-slate-500 mb-4">
                🆔 {order.order_id}
              </p>
              
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span className="font-bold">
                    {order.progress_count}/{order.target_count}
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isComplete ? "bg-emerald-500" : "bg-violet-500"
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
              
              {/* Webhook input */}
              {!order.confirmed_by && (
                <div className="mt-4 space-y-2">
                  <label className="text-xs font-bold uppercase">
                    Webhook URL (Discord)
                  </label>
                  <input
                    type="text"
                    value={webhookInput[order.order_id] || ""}
                    onChange={(e) =>
                      setWebhookInput({
                        ...webhookInput,
                        [order.order_id]: e.target.value,
                      })
                    }
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl px-4 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleConfirm(order.order_id)}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-2 rounded-xl"
                  >
                    ✅ Konfirmasi Order
                  </button>
                </div>
              )}
              
              {order.confirmed_by && (
                <p className="text-xs text-emerald-500 mt-2">
                  ✅ Confirmed by {order.confirmed_by}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}