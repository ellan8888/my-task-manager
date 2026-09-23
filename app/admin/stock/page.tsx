"use client";

import { useEffect, useState } from "react";
import KategoriDropdown from "./KategoriDropdown";
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
  logged_out_at: string | null;
  created_at: string;
  used_at: string | null;
  listed_at: string | null;
};

type KategoriLink = {
  id: number;
  kategori: string;
  link: string;
  active: boolean;
};

export default function StockPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<StockAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [kategoriList, setKategoriList] = useState<KategoriLink[]>([]);
  const [loadingKategori, setLoadingKategori] = useState(true);
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cookie, setCookie] = useState("");
  const [kategori, setKategori] = useState("");
  const [addedBy, setAddedBy] = useState("lan4337");
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "ready" | "progress" | "logged_out">("all");

  // Mode tambah kategori baru
  const [isNewKategori, setIsNewKategori] = useState(false);
  const [newKategoriName, setNewKategoriName] = useState("");
  const [newKategoriLink, setNewKategoriLink] = useState("");

  const [currentUser, setCurrentUser] = useState<{
    username: string;
    display_name: string;
    role: string;
  } | null>(null);

  const [currentUserLoading, setCurrentUserLoading] = useState(true);

  // ══════════════════════════════════════════════════════
  // LOAD DATA
  // ══════════════════════════════════════════════════════
  const loadKategori = async () => {
    setLoadingKategori(true);
    try {
      const res = await fetch("/api/kategori/links");
      const data = await res.json();
      if (data.success) {
        setKategoriList(data.list || []);
        if (!kategori && data.list?.length > 0 && !isNewKategori) {
          setKategori(data.list[0].kategori);
        }
      }
    } finally {
      setLoadingKategori(false);
    }
  };

  const loadAccounts = async () => {
    setLoading(true);
    try {
      let url = "/api/accounts/stock?logged_out=false";

      if (filter === "ready") {
        url = "/api/accounts/stock?used=true&logged_out=false";
      } else if (filter === "progress") {
        url = "/api/accounts/stock?used=false&logged_out=false";
      } else if (filter === "all") {
        url = "/api/accounts/stock?logged_out=false";
      }

      const res = await fetch(url);
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
          setAddedBy(data.user.username);
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
  }, [filter]);

  // ══════════════════════════════════════════════════════
  // SUBMIT
  // ══════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username) {
      toast.warning("Username wajib diisi");
      return;
    }

    setSaving(true);

    try {
      let finalKategori = kategori;

      if (isNewKategori) {
        if (!newKategoriName || !newKategoriLink) {
          toast.warning("Nama kategori & link wajib diisi");
          setSaving(false);
          return;
        }

        const katRes = await fetch("/api/kategori/links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kategori: newKategoriName,
            link: newKategoriLink,
          }),
        });

        const katData = await katRes.json();

        if (!katData.success) {
          toast.error(`Gagal simpan kategori: ${katData.message}`);
          setSaving(false);
          return;
        }

        finalKategori = newKategoriName.toLowerCase().trim();
        await loadKategori();
        toast.success(`Kategori "${newKategoriName}" disimpan`);
      }

      const butuhPassword = ["1b-5b/s", "akun"].includes(finalKategori.toLowerCase());
      if (butuhPassword && !password) {
        toast.warning(`Password wajib untuk kategori "${finalKategori}"`);
        setSaving(false);
        return;
      }

      const res = await fetch("/api/accounts/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          roblox_cookie: cookie,
          kategori: finalKategori,
          added_by: addedBy,
          status: "queued_for_sale",
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message);
        setUsername("");
        setPassword("");
        setCookie("");
        setIsNewKategori(false);
        setNewKategoriName("");
        setNewKategoriLink("");
        loadAccounts();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (uname: string) => {
    if (!window.confirm(`Hapus ${uname}?`)) return;
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
  };

  const currentKategori = isNewKategori ? newKategoriName : kategori;
  const butuhPassword = ["1b-5b/s", "akun"].includes(currentKategori.toLowerCase());

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
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
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

          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
            <i className="fa-solid fa-boxes-stacked text-base"></i>
          </div>

          <div>
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Stock Akun Roblox
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Kelola stok akun yang dijual
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* FORM INPUT */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-6 shadow-sm"
          >
            <h2 className="font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-plus text-violet-600 dark:text-violet-400"></i>
              <span>Tambah Stock Baru</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="TestAkun0029"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Password {butuhPassword && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={butuhPassword ? "Wajib untuk auto-login" : "opsional"}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                />
                {butuhPassword && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                    Password dipake buat auto-login Roblox
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                Cookie (.ROBLOSECURITY) — Opsional
              </label>
              <textarea
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="_|WARNING:-DO-NOT-SHARE-THIS...|_ (boleh dikosongin)"
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-violet-500 resize-none"
              />
            </div>

            {/* ══════════════════════════════════════════════════
                SECTION KATEGORI + ADDED BY
                ★ Pakai CSS Grid dengan fixed height biar sejajar
               ══════════════════════════════════════════════════ */}
            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
{/* Header: Tombol Tambah Kategori Baru */}
<div className="flex items-center justify-end mb-3">
  <button
    type="button"
    onClick={() => {
      setIsNewKategori(!isNewKategori);
      setNewKategoriName("");
      setNewKategoriLink("");
    }}
    className={`text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5 ${
      isNewKategori
        ? "bg-red-500/20 text-red-600 dark:text-red-300 hover:bg-red-500/40"
        : "bg-violet-500/20 text-violet-600 dark:text-violet-300 hover:bg-violet-500/40"
    }`}
  >
    <i
      className={`fa-solid ${
        isNewKategori ? "fa-xmark" : "fa-plus"
      } text-[10px]`}
    ></i>
    <span>{isNewKategori ? "Batal" : "Tambah Kategori Baru"}</span>
  </button>
</div>

              {/* Grid 2 kolom — pakai items-stretch biar tinggi sama */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* ══════════ KATEGORI ══════════ */}
                <div className="flex flex-col">
                  {/* Wrapper label tinggi fixed 20px */}
                  <div className="h-5 flex items-center mb-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      <i className="fa-solid fa-tag text-[10px]"></i>
                      <span>Pilih Kategori *</span>
                    </label>
                  </div>

                  {/* Konten: dropdown atau input baru */}
                  {!isNewKategori ? (
                    <div className="kategori-dropdown-wrapper">
                      <KategoriDropdown
                        value={kategori}
                        onChange={setKategori}
                        options={kategoriList.map((k) => ({
                          id: k.id,
                          kategori: k.kategori,
                        }))}
                        loading={loadingKategori}
                        placeholder="Pilih kategori..."
                        hideLabel={true}
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={newKategoriName}
                      onChange={(e) => setNewKategoriName(e.target.value)}
                      placeholder="3000 diamond"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                      style={{ height: "46px" }}
                    />
                  )}

                  {/* Spacer biar tinggi sama kayak Added By */}
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 invisible">
                    <i className="fa-solid fa-circle-info text-[10px]"></i>
                    &nbsp;
                  </p>
                </div>

                {/* ══════════ ADDED BY ══════════ */}
                <div className="flex flex-col">
                  {/* Wrapper label tinggi fixed 20px — SAMA kayak Kategori */}
                  <div className="h-5 flex items-center mb-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                      <i className="fa-solid fa-user text-[10px]"></i>
                      <span>Added By</span>
                    </label>
                  </div>

                  {/* Display box tinggi fixed 46px */}
                  <div
                    className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 flex items-center justify-between"
                    style={{ height: "46px" }}
                  >
                    <span className="font-mono font-bold text-sm text-slate-700 dark:text-slate-300">
                      {currentUserLoading ? "Loading..." : currentUser?.username || "-"}
                    </span>
                    <i className="fa-solid fa-lock text-slate-400 text-xs"></i>
                  </div>

                  {/* Help text */}
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <i className="fa-solid fa-circle-info text-[9px]"></i>
                    Otomatis dari akun yang login
                  </p>
                </div>
              </div>

              {/* Link Itemku (muncul kalau mode tambah kategori baru) */}
              {isNewKategori && (
                <div className="mt-3">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                    <i className="fa-solid fa-link text-[10px]"></i>
                    <span>Link Itemku *</span>
                  </label>
                  <input
                    type="text"
                    value={newKategoriLink}
                    onChange={(e) => setNewKategoriLink(e.target.value)}
                    placeholder="https://tokoku.itemku.com/pengiriman-otomatis/baru/XXXXXXX"
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                    <i className="fa-solid fa-circle-info text-[10px]"></i>
                    Copy URL dari itemku → produk → "Pengiriman Otomatis"
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || loadingKategori}
              className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
            >
              <i
                className={`fa-solid ${
                  saving ? "fa-spinner fa-spin" : "fa-plus"
                }`}
              ></i>
              <span>{saving ? "Menyimpan..." : "Tambah Stock"}</span>
            </button>
          </form>

          {/* ══════════════════════════════════════════════════
              LIST STOCK — GROUPED PER KATEGORI
             ══════════════════════════════════════════════════ */}
          <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            {/* Header + Search */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-table text-violet-600 dark:text-violet-400"></i>
                <span>Daftar Stock ({accounts.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari username..."
                    className="w-full md:w-56 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                {/* Filter */}
                <div className="w-44">
                  <KategoriDropdown
                    value={
                      filter === "all"
                        ? "Semua"
                        : filter === "ready"
                        ? "Ready"
                        : "Progress"
                    }
                    onChange={(val) => {
                      const map: Record<string, any> = {
                        Semua: "all",
                        Ready: "ready",
                        Progress: "progress",
                      };
                      setFilter(map[val] || "all");
                    }}
                    options={[
                      { id: 1, kategori: "Semua" },
                      { id: 2, kategori: "Ready" },
                      { id: 3, kategori: "Progress" },
                    ]}
                    hideLabel={true}
                  />
                </div>
              </div>
            </div>

            {loading ? (
              <SkeletonList count={5} />
            ) : accounts.length === 0 ? (
              <div className="text-center py-12">
                <i className="fa-solid fa-inbox text-4xl text-slate-300 dark:text-slate-700 mb-3"></i>
                <p className="text-slate-400 text-sm">Belum ada stock.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedAccounts.map((group) => (
                  <div key={group.kategori}>
                    {/* Group Header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
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
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg">
                          {group.accounts.filter((a) => a.used).length} Ready
                        </span>
                        <span className="px-2 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-lg">
                          {group.accounts.filter((a) => !a.used).length} Progress
                        </span>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-sm table-fixed">
                        <thead className="bg-slate-50 dark:bg-slate-950/50">
                          <tr className="text-left text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
                            <th className="px-3 py-2.5 w-[5%] text-center">#</th>
                            <th className="px-3 py-2.5 w-[20%]">Username</th>
                            <th className="px-3 py-2.5 w-[13%] hidden md:table-cell">Password</th>
                            <th className="px-3 py-2.5 w-[13%]">Added By</th>
                            <th className="px-3 py-2.5 w-[17%]">Status</th>
                            <th className="px-3 py-2.5 w-[17%] hidden lg:table-cell">Created</th>
                            <th className="px-3 py-2.5 w-[10%] text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.accounts.map((acc, idx) => (
                            <tr
                              key={acc.id}
                              className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
                            >
                              <td className="px-3 py-2.5 w-[5%] text-xs text-slate-400 font-mono text-center">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2.5 w-[20%]">
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
                              <td className="px-3 py-2.5 w-[17%]">
                                <div className="flex items-center gap-1.5">
                                  {acc.used ? (
                                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md inline-flex items-center gap-1 whitespace-nowrap">
                                      <i className="fa-solid fa-rocket text-[9px]"></i>
                                      READY
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-md inline-flex items-center gap-1 whitespace-nowrap">
                                      <i className="fa-solid fa-clock text-[9px]"></i>
                                      PROGRESS
                                    </span>
                                  )}
                                </div>
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
                              <td className="px-3 py-2.5 w-[10%] text-right">
                                <button
                                  onClick={() => handleDelete(acc.username)}
                                  className="w-7 h-7 inline-flex items-center justify-center bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-500/40 transition"
                                  title="Hapus"
                                >
                                  <i className="fa-solid fa-trash-can text-xs"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
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
    </>
  );
}