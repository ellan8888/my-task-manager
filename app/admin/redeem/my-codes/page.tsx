"use client";

import { useEffect, useState } from "react";
import AdminHeader from "@/app/components/AdminHeader";
import { useToast } from "@/app/components/ToastProvider";

export default function MyCodesPage() {
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.success && d.user && setUser(d.user));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/redeem/my-codes?username=${user.username}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCodes(d.data);
        setLoading(false);
      });
  }, [user]);

  return (
    <>
      <AdminHeader
        icon="fa-ticket"
        iconClassName="from-violet-600 via-indigo-600 to-purple-500 shadow-violet-600/30"
        title="Kode Saya"
        subtitle="Kode Redfinger yang sudah kamu beli"
      />

      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <i className="fa-solid fa-spinner fa-spin text-3xl text-violet-600"></i>
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-20">
            <i className="fa-solid fa-ticket text-4xl text-slate-300 mb-3"></i>
            <p className="text-slate-500">Belum ada kode. Beli dulu di halaman Redeem Code.</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-3xl mx-auto">
            {codes.map((c) => (
              <div
                key={c.id}
                className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <p className="font-mono font-black text-lg text-slate-900 dark:text-white">
                    {c.code}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {c.payment_method === "balance" ? "Beli pake saldo" : "Transfer manual"} •{" "}
                    {new Date(c.purchased_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(c.code);
                    toast.success("Code dicopy!");
                  }}
                  className="w-9 h-9 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 flex items-center justify-center"
                >
                  <i className="fa-regular fa-copy"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}