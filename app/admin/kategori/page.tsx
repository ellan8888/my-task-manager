// app/admin/kategori/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/app/components/ToastProvider";
import { useSidebar } from "../SidebarContext";
import { SkeletonList } from "@/app/components/Skeleton";

type KategoriLink = {
  id: number;
  kategori: string;
  link: string;
  active: boolean;
};

export default function KategoriPage() {
  const toast = useToast();
  const [list, setList] = useState<KategoriLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { sidebarOpen, toggleSidebar } = useSidebar();

  // Form state
  const [kategori, setKategori] = useState("");
  const [link, setLink] = useState("");
  const [editingKategori, setEditingKategori] = useState<string | null>(null);

  // ══════════════════════════════════════════════════════
  // LOAD DATA — pakai ?active=false biar semua muncul
  // ══════════════════════════════════════════════════════
  const loadKategori = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/kategori/links?active=false");
      const data = await res.json();
      if (data.success) setList(data.list || []);
    } catch {
      toast.error("Gagal load kategori");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKategori();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ══════════════════════════════════════════════════════
  // SUBMIT — Tambah / Update (upsert di API)
  // ══════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!kategori || !link) {
      toast.warning("Kategori & link wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/kategori/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kategori, link }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "Kategori disimpan");
        setKategori("");
        setLink("");
        setEditingKategori(null);
        loadKategori();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // HAPUS — pakai ?kategori= (sesuai API kamu)
  // ══════════════════════════════════════════════════════
  const handleDelete = async (nama: string) => {
    if (!confirm(`Hapus kategori "${nama}"?`)) return;
    try {
      const res = await fetch(
        `/api/kategori/links?kategori=${encodeURIComponent(nama)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Kategori dihapus");
        loadKategori();
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Gagal hapus");
    }
  };

  // ══════════════════════════════════════════════════════
  // EDIT — isi form dengan data existing
  // ══════════════════════════════════════════════════════
  const handleEdit = (item: KategoriLink) => {
    setKategori(item.kategori);
    setLink(item.link);
    setEditingKategori(item.kategori);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setKategori("");
    setLink("");
    setEditingKategori(null);
  };

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

          <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
            <i className="fa-solid fa-folder-tree text-base"></i>
          </div>

          <div>
            <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Kategori Link
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Kelola kategori & link itemku
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* FORM */}
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-6 shadow-sm"
          >
            <h2 className="font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <i
                className={`fa-solid ${
                  editingKategori ? "fa-pen-to-square" : "fa-plus"
                } text-emerald-600 dark:text-emerald-400`}
              ></i>
              <span>
                {editingKategori ? "Edit Kategori" : "Tambah Kategori Baru"}
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  placeholder="3000 diamond"
                  disabled={!!editingKategori}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <i className="fa-solid fa-circle-info text-[10px]"></i>
                  {editingKategori
                    ? "Nama kategori nggak bisa diubah saat edit"
                    : "Gunakan huruf kecil (contoh: 3000 diamond)"}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                  Link Itemku *
                </label>
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://tokoku.itemku.com/pengiriman-otomatis/baru/XXXXXXX"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <i className="fa-solid fa-circle-info text-[10px]"></i>
                  Copy URL dari itemku → produk → "Pengiriman Otomatis"
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                <i
                  className={`fa-solid ${
                    saving
                      ? "fa-spinner fa-spin"
                      : editingKategori
                      ? "fa-check"
                      : "fa-plus"
                  }`}
                ></i>
                <span>
                  {saving
                    ? "Menyimpan..."
                    : editingKategori
                    ? "Update Kategori"
                    : "Tambah Kategori"}
                </span>
              </button>

              {editingKategori && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition flex items-center gap-2"
                >
                  <i className="fa-solid fa-xmark"></i>
                  <span>Batal</span>
                </button>
              )}
            </div>
          </form>

          {/* LIST */}
          <div className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <i className="fa-solid fa-list text-emerald-600 dark:text-emerald-400"></i>
              <span>Daftar Kategori ({list.length})</span>
            </h2>

            {loading ? (
              <SkeletonList count={5} />
            ) : list.length === 0 ? (
              <div className="text-center py-8">
                <i className="fa-solid fa-folder-open text-4xl text-slate-300 dark:text-slate-700 mb-3"></i>
                <p className="text-slate-500 text-sm">Belum ada kategori</p>
                <p className="text-slate-400 text-xs mt-1">
                  Tambah kategori di form atas
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((item) => (
                  <div
                    key={item.id || item.kategori}
                    className="bg-slate-50 dark:bg-slate-950 rounded-xl p-4 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <i className="fa-solid fa-tag text-emerald-600 dark:text-emerald-400 text-xs"></i>
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.kategori}
                        </p>
                        {item.active ? (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded">
                            INACTIVE
                          </span>
                        )}
                      </div>
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
                      >
                        <i className="fa-solid fa-link text-[10px]"></i>
                        <span className="truncate">{item.link}</span>
                      </a>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Edit */}
                      <button
                        onClick={() => handleEdit(item)}
                        className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-500/40 transition"
                        title="Edit"
                      >
                        <i className="fa-solid fa-pen text-xs"></i>
                      </button>

                      {/* Hapus */}
                      <button
                        onClick={() => handleDelete(item.kategori)}
                        className="w-8 h-8 flex items-center justify-center bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-500/40 transition"
                        title="Hapus"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
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