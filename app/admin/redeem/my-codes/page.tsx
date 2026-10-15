"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "../../SidebarContext";

export default function MyCodesPage() {
  const { sidebarOpen, toggleSidebar } = useSidebar();
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
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center z-20 shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 mr-3"
        >
          <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"}`}></i>
        </button>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
          Kode Saya
        </h2>
      </header>

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
                    alert("Code dicopy!");
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