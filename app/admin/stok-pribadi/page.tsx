// app/admin/stok-pribadi/page.tsx
"use client";

import { useEffect, useState } from "react";
import KategoriDropdown from "../stock/KategoriDropdown";
import { useToast } from "@/app/components/ToastProvider";
import { useSidebar } from "../SidebarContext";
import { SkeletonList } from "@/app/components/Skeleton";

type StockAccount = {
  id: number;
  username: string;
  password: string | null;
  roblox_cookie: string | null;
  kategori: string | null;
  added_by: string | null;
  status: string;
  used: boolean;
  logged_out: boolean;
  created_at: string;
  used_at: string | null;
  listed_at: string | null;
};

export default function StokPribadiPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<StockAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [kategoriList, setKategoriList] = useState<any[]>([]);
  const [selling, setSelling] = useState<Set<number>>(new Set());
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");

// Form tambah
const [username, setUsername] = useState("");
const [password, setPassword] = useState("");
const [cookie, setCookie] = useState("");
const [kategori, setKategori] = useState("");
const [addedBy, setAddedBy] = useState("lan4337");
const [saving, setSaving] = useState(false);

// ⭐ State current user
const [currentUser, setCurrentUser] = useState<{
  username: string;
  display_name: string;
  role: string;
} | null>(null);
const [currentUserLoading, setCurrentUserLoading] = useState(true);



  // ★ State edit
  const [editingAccount, setEditingAccount] = useState<StockAccount | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editCookie, setEditCookie] = useState("");
  const [editKategori, setEditKategori] = useState("");
  const [editAddedBy, setEditAddedBy] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // ★ State confirm modal
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "primary" | "warning";
  } | null>(null);

  // Helper: buka confirm
  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    variant: "danger" | "primary" | "warning" = "primary"
  ) => {
    setConfirmDialog({ open: true, title, message, onConfirm, variant });
  };

  // Helper: tutup confirm
  const closeConfirm = () => setConfirmDialog(null);

  // Load kategori
  const loadKategori = async () => {
    try {
      const res = await fetch("/api/kategori/links");
      const data = await res.json();
      if (data.success) {
        setKategoriList(data.list || []);
        if (!kategori && data.list?.length > 0) setKategori(data.list[0].kategori);
      }
    } catch {}
  };

  // Load akun
  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/accounts/stock?status=personal&logged_out=false");
      const data = await res.json();
      if (data.success) setAccounts(data.data || []);
    } finally {
      setLoading(false);
    }
  };

// ⭐ Fetch current user DULU
useEffect(() => {
  const fetchMe = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setAddedBy(data.user.username);  // ⭐ auto-set added_by
      }
    } catch (err) {
      console.error("Gagal fetch user:", err);
    } finally {
      setCurrentUserLoading(false);
    }
  };
  fetchMe();
}, []);

useEffect(() => {
  loadKategori();
  loadAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // Submit — tambah akun
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username) {
      toast.warning("Username wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/accounts/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          roblox_cookie: cookie,
          kategori,
          added_by: addedBy,
          status: "personal",
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setUsername("");
        setPassword("");
        setCookie("");
        loadAccounts();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  // Jual akun
  const handleSell = (uname: string) => {
    showConfirm(
      "Jual Akun?",
      `Jual akun "${uname}"?\n\nBot akan otomatis input ke itemku.`,
      async () => {
        closeConfirm();

        const acc = accounts.find((a) => a.username === uname);
        if (!acc) return;

        setSelling((prev) => new Set(prev).add(acc.id));

        try {
          const res = await fetch("/api/accounts/stock/sell", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: uname }),
          });

          const data = await res.json();

          if (data.success) {
            toast.success(data.message);
            setAccounts((current) => current.filter((a) => a.username !== uname));
          } else {
            toast.error(data.message);
          }
        } catch {
          toast.error("Gagal jual akun");
        } finally {
          setSelling((prev) => {
            const next = new Set(prev);
            next.delete(acc.id);
            return next;
          });
        }
      },
      "primary"
    );
  };

  // Hapus akun
  const handleDelete = (uname: string) => {
    showConfirm(
      "Hapus Akun?",
      `Akun "${uname}" akan dihapus permanen. Lanjutkan?`,
      async () => {
        closeConfirm();
        try {
          const res = await fetch(
            `/api/accounts/stock?username=${encodeURIComponent(uname)}`,
            { method: "DELETE" }
          );
          const data = await res.json();
          if (data.success) {
            toast.success(data.message);
            loadAccounts();
          } else {
            toast.error(data.message);
          }
        } catch {
          toast.error("Gagal hapus");
        }
      },
      "danger"
    );
  };

  // ★ Buka modal edit
  const handleEditClick = (acc: StockAccount) => {
    setEditingAccount(acc);
    setEditUsername(acc.username);
    setEditPassword(acc.password || "");
    setEditCookie(acc.roblox_cookie || "");
    setEditKategori(acc.kategori || "");
    setEditAddedBy(acc.added_by || "lan4337");
  };

  // ★ Tutup modal edit
  const handleCloseEdit = () => {
    setEditingAccount(null);
    setEditUsername("");
    setEditPassword("");
    setEditCookie("");
    setEditKategori("");
    setEditAddedBy("");
  };

  // ★ Simpan edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingAccount) return;

    if (!editUsername) {
      toast.warning("Username wajib diisi");
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/accounts/stock?username=${encodeURIComponent(editingAccount.username)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: editUsername,
            password: editPassword,
            roblox_cookie: editCookie,
            kategori: editKategori,
            added_by: editAddedBy,
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        handleCloseEdit();
        loadAccounts();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Gagal edit akun");
    } finally {
      setEditSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // GROUP ACCOUNTS BY KATEGORI + FILTER SEARCH
  // ══════════════════════════════════════════════════════
  const groupedAccounts = (() => {
    const filtered = accounts.filter((acc) => {
      if (acc.logged_out) return false;
      return acc.username.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const groups: Record<string, StockAccount[]> = {};
    filtered.forEach((acc) => {
      const kat = acc.kategori || "tanpa-kategori";
      if (!groups[kat]) groups[kat] = [];
      groups[kat].push(acc);
    });

return Object.entries(groups)
  .map(([kategori, accounts]) => ({ kategori, accounts }))
  .sort((a, b) => {
    const numA = parseInt(a.kategori.match(/^\d+/)?.[0] || "999999", 10);
    const numB = parseInt(b.kategori.match(/^\d+/)?.[0] || "999999", 10);
    if (numA !== numB) return numA - numB;
    return a.kategori.localeCompare(b.kategori);
  });
  })();

  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { display: none; }
        .custom-scrollbar { scrollbar-width: none; }
      `}</style>

      {/* Header */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSidebar}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            title={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
          >
            <i
              className={`fa-solid ${
                sidebarOpen ? "fa-bars-staggered" : "fa-bars"
              } text-base`}
            ></i>
          </button>

          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <i className="fa-solid fa-vault text-base"></i>
          </div>

          <div>
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Stok Pribadi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Simpan akun dulu, jual nanti
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Form Tambah */}
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-6 shadow-sm"
          >
            <h2 className="font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
              <i className="fa-solid fa-plus text-blue-600 dark:text-blue-400"></i>
              <span>Tambah Akun ke Stok Pribadi</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Patryarla827"
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Password
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="opsional"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                Cookie (.ROBLOSECURITY) — Opsional
              </label>
              <textarea
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="_|WARNING...|_ (boleh dikosongin)"
                rows={2}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white resize-none focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                
                <KategoriDropdown
                  value={kategori}
                  onChange={setKategori}
                  options={kategoriList.map((k) => ({
                    id: k.id,
                    kategori: k.kategori,
                  }))}
                  placeholder="Pilih kategori..."
                />
              </div>
              <div>
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
    <i className="fa-solid fa-user text-[10px] mr-1"></i>
    Added By
  </label>
  <div className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
    <i className="fa-solid fa-lock text-slate-400 text-xs"></i>
    <span className="font-mono font-bold">
      {currentUserLoading ? "Loading..." : currentUser?.username || "-"}
    </span>
  </div>
  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
    <i className="fa-solid fa-circle-info text-[9px]"></i>
    Otomatis dari akun yang login
  </p>
</div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <i
                className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-plus"}`}
              ></i>
              <span>{saving ? "Menyimpan..." : "Simpan ke Stok Pribadi"}</span>
            </button>
          </form>

          {/* ══════════════════════════════════════════════════════
              LIST AKUN — GROUPED PER KATEGORI (TABEL)
             ══════════════════════════════════════════════════════ */}
          <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Header + Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-table text-blue-600 dark:text-blue-400"></i>
                <span>Akun Tersimpan ({accounts.length})</span>
              </h2>
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari username..."
                  className="w-full md:w-56 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {loading ? (
              <SkeletonList count={3} />
            ) : accounts.length === 0 ? (
              <div className="text-center py-8">
                <i className="fa-solid fa-inbox text-4xl text-slate-300 dark:text-slate-700 mb-3"></i>
                <p className="text-slate-500 text-sm">Belum ada akun tersimpan</p>
                <p className="text-slate-400 text-xs mt-1">
                  Tambah akun di form atas
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedAccounts.map((group) => (
                  <div key={group.kategori}>
                    {/* Group Header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                          <i className="fa-solid fa-tag text-xs"></i>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-sm capitalize">
                            {group.kategori}
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {group.accounts.length} akun
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-lg">
                        {group.accounts.length} Siap Dijual
                      </span>
                    </div>

                    {/* Table */}
                    {/* Table */}
<div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
  <table className="w-full text-sm table-fixed">
    <thead className="bg-slate-50 dark:bg-slate-950/50">
      <tr className="text-left text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
        <th className="px-3 py-2.5 w-[5%] text-center">#</th>
        <th className="px-3 py-2.5 w-[22%]">Username</th>
        <th className="px-3 py-2.5 w-[13%] hidden md:table-cell">Password</th>
        <th className="px-3 py-2.5 w-[13%]">Added By</th>
        <th className="px-3 py-2.5 w-[17%] hidden lg:table-cell">Created</th>
        <th className="px-3 py-2.5 w-[30%] text-right">Aksi</th>
      </tr>
    </thead>
    <tbody>
      {group.accounts.map((acc, idx) => {
        const isSelling = selling.has(acc.id);
        return (
          <tr
            key={acc.id}
            className={`border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition ${
              isSelling ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            <td className="px-3 py-2.5 w-[5%] text-xs text-slate-400 font-mono text-center">
              {idx + 1}
            </td>
            <td className="px-3 py-2.5 w-[22%]">
              <span className="font-mono font-bold text-xs text-slate-900 dark:text-white truncate block">
                {acc.username}
              </span>
            </td>
            <td className="px-3 py-2.5 w-[13%] hidden md:table-cell">
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {acc.password ? "••••••••" : "—"}
              </span>
            </td>
            <td className="px-3 py-2.5 w-[13%]">
              <span className="text-xs text-slate-600 dark:text-slate-300 truncate block">
                {acc.added_by || "—"}
              </span>
            </td>
            <td className="px-3 py-2.5 w-[17%] hidden lg:table-cell">
              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                {new Date(acc.created_at).toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </td>
            <td className="px-3 py-2.5 w-[30%]">
              <div className="flex items-center justify-end gap-1.5">
                {/* Jual */}
                <button
                  onClick={() => handleSell(acc.username)}
                  disabled={isSelling}
                  className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-md flex items-center gap-1 transition disabled:opacity-50 whitespace-nowrap"
                  title="Jual akun ini"
                >
                  {isSelling ? (
                    <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>
                  ) : (
                    <i className="fa-solid fa-rocket text-[9px]"></i>
                  )}
                  <span>{isSelling ? "..." : "Jual"}</span>
                </button>

                {/* Edit */}
                <button
                  onClick={() => handleEditClick(acc)}
                  className="w-7 h-7 inline-flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-500/40 transition"
                  title="Edit"
                >
                  <i className="fa-solid fa-pen text-xs"></i>
                </button>

                {/* Hapus */}
                <button
                  onClick={() => handleDelete(acc.username)}
                  className="w-7 h-7 inline-flex items-center justify-center bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-500/40 transition"
                  title="Hapus"
                >
                  <i className="fa-solid fa-trash-can text-xs"></i>
                </button>
              </div>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL CONFIRM
         ══════════════════════════════════════════════════════ */}
      {confirmDialog?.open && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-60 flex items-center justify-center p-4"
          onClick={closeConfirm}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div
                className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                  confirmDialog.variant === "danger"
                    ? "bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400"
                    : confirmDialog.variant === "warning"
                    ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                }`}
              >
                <i
                  className={`fa-solid text-2xl ${
                    confirmDialog.variant === "danger"
                      ? "fa-triangle-exclamation"
                      : confirmDialog.variant === "warning"
                      ? "fa-circle-exclamation"
                      : "fa-circle-question"
                  }`}
                ></i>
              </div>

              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">
                {confirmDialog.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 whitespace-pre-line">
                {confirmDialog.message}
              </p>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={closeConfirm}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition"
              >
                Batal
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 font-bold py-3 rounded-xl transition text-white ${
                  confirmDialog.variant === "danger"
                    ? "bg-linear-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
                    : confirmDialog.variant === "warning"
                    ? "bg-linear-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400"
                    : "bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500"
                }`}
              >
                {confirmDialog.variant === "danger" ? "Hapus" : "Ya, Lanjutkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL EDIT
         ══════════════════════════════════════════════════════ */}
      {editingAccount && (
        <div
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleCloseEdit}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-blue-600 dark:text-blue-400"></i>
                <span>Edit Akun</span>
              </h2>
              <button
                onClick={handleCloseEdit}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-500/20 hover:text-red-500 transition"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
                {editUsername !== editingAccount.username && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                    Username berubah dari <code>{editingAccount.username}</code>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Password
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="opsional"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Cookie (.ROBLOSECURITY)
                </label>
                <textarea
                  value={editCookie}
                  onChange={(e) => setEditCookie(e.target.value)}
                  placeholder="opsional"
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white resize-none focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Kategori
                </label>
                <KategoriDropdown
                  value={editKategori}
                  onChange={setEditKategori}
                  options={kategoriList.map((k) => ({
                    id: k.id,
                    kategori: k.kategori,
                  }))}
                  placeholder="Pilih kategori..."
                />
              </div>

              <div>
  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
    <i className="fa-solid fa-user text-[10px] mr-1"></i>
    Added By
  </label>
  <div className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
    <i className="fa-solid fa-lock text-slate-400 text-xs"></i>
    <span className="font-mono font-bold">
      {editAddedBy || currentUser?.username || "-"}
    </span>
  </div>
  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
    <i className="fa-solid fa-circle-info text-[9px]"></i>
    Owner akun (nggak bisa diubah)
  </p>
</div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  <i
                    className={`fa-solid ${editSaving ? "fa-spinner fa-spin" : "fa-check"}`}
                  ></i>
                  <span>{editSaving ? "Menyimpan..." : "Simpan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}