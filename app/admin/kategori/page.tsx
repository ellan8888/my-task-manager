// app/admin/kategori/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/app/components/ToastProvider";
import { useSidebar } from "../SidebarContext";
import { SkeletonList } from "@/app/components/Skeleton";

type KategoriLink = {
  id: number;
  kategori: string;
  link: string;
  active: boolean;
  nama_produk?: string | null;
  image_url?: string | null;
};

type EditMode = "add" | "edit_link" | "edit_product";

export default function KategoriPage() {
  const toast = useToast();
  const [list, setList] = useState<KategoriLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { sidebarOpen, toggleSidebar } = useSidebar();

  // Form state
  const [kategori, setKategori] = useState("");
  const [link, setLink] = useState("");
  const [namaProduk, setNamaProduk] = useState("");
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const productInputRef = useRef<HTMLInputElement>(null);

  // Mode & editing
  const [editMode, setEditMode] = useState<EditMode>("add");
  const [editingKategori, setEditingKategori] = useState<string | null>(null);

  // ══════════════════════════════════════════════════════
  // LOAD DATA
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
  // HANDLE FILE UPLOAD
  // ══════════════════════════════════════════════════════
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File harus gambar (JPG/PNG)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maksimal 5 MB");
      return;
    }

    setProductFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setProductPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ══════════════════════════════════════════════════════
  // RESET FORM
  // ══════════════════════════════════════════════════════
  const resetForm = () => {
    setKategori("");
    setLink("");
    setNamaProduk("");
    setProductFile(null);
    setProductPreview(null);
    if (productInputRef.current) productInputRef.current.value = "";
    setEditMode("add");
    setEditingKategori(null);
  };

  // ══════════════════════════════════════════════════════
  // SUBMIT
  // ══════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!kategori || !link) {
      toast.warning("Kategori & link wajib diisi");
      return;
    }

    // ⭐ Validasi per mode
    if (editMode === "add" || editMode === "edit_product") {
      if (!namaProduk.trim()) {
        toast.warning("Nama produk wajib diisi");
        return;
      }
      if (!productFile) {
        toast.warning("Foto produk wajib diupload");
        return;
      }
    }

    setSaving(true);
    try {
      let imageUrl = "";

      // ⭐ Upload foto (kalo ada)
      if (productFile) {
        const formData = new FormData();
        formData.append("file", productFile);

        const uploadRes = await fetch("/api/upload/product-image", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (!uploadData.success) {
          toast.error("Gagal upload foto: " + uploadData.message);
          setSaving(false);
          return;
        }
        imageUrl = uploadData.url;
      }

      // ⭐ Build payload
      const payload: any = {
        kategori,
        link,
        mode: editMode,
      };

      if (imageUrl) {
        payload.nama_produk = namaProduk.trim();
        payload.image_url = imageUrl;
      }

      // ⭐ Submit
      const res = await fetch("/api/kategori/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        toast.error(data.message);
        setSaving(false);
        return;
      }

      // ⭐ Success toast
      if (editMode === "add") {
        toast.success(
          data.bot_sent
            ? "Kategori + produk terkirim ke Discord!"
            : "Kategori ditambahkan (bot offline — notif disimpan)"
        );
      } else if (editMode === "edit_link") {
        toast.success("Link kategori di-update");
      } else if (editMode === "edit_product") {
        toast.success(
          data.bot_sent
            ? "Produk di-update + terkirim ke Discord!"
            : "Produk di-update (bot offline — notif disimpan)"
        );
      }

      resetForm();
      loadKategori();
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════
  // HAPUS
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
  // EDIT LINK
  // ══════════════════════════════════════════════════════
  const handleEditLink = (item: KategoriLink) => {
    setKategori(item.kategori);
    setLink(item.link);
    setNamaProduk("");
    setProductFile(null);
    setProductPreview(null);
    if (productInputRef.current) productInputRef.current.value = "";
    setEditMode("edit_link");
    setEditingKategori(item.kategori);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ══════════════════════════════════════════════════════
  // EDIT PRODUK
  // ══════════════════════════════════════════════════════
  const handleEditProduct = (item: KategoriLink) => {
    setKategori(item.kategori);
    setLink(item.link);
    // ⭐ Kosong — user isi manual
    setNamaProduk("");
    setProductFile(null);
    setProductPreview(null);
    if (productInputRef.current) productInputRef.current.value = "";
    setEditMode("edit_product");
    setEditingKategori(item.kategori);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => resetForm();

  const isAddNew = editMode === "add";
  const isEdit = editMode !== "add";

  // ══════════════════════════════════════════════════════
  // UI HELPERS
  // ══════════════════════════════════════════════════════
  const formTitle = (() => {
    if (editMode === "add") return "Tambah Kategori Baru";
    if (editMode === "edit_link") return "Edit Link Kategori";
    if (editMode === "edit_product") return "Edit Produk (kirim ke Discord)";
    return "";
  })();

  const formIcon = (() => {
    if (editMode === "add") return "fa-plus";
    if (editMode === "edit_link") return "fa-link";
    return "fa-bullhorn";
  })();

  const submitIcon = saving
    ? "fa-spinner fa-spin"
    : editMode === "edit_product"
    ? "fa-paper-plane"
    : editMode === "edit_link"
    ? "fa-check"
    : "fa-plus";

  const submitLabel = saving
    ? "Menyimpan..."
    : editMode === "add"
    ? "Tambah Kategori & Kirim ke Webhook"
    : editMode === "edit_link"
    ? "Update Link"
    : "Update Produk & Kirim ke Discord";

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
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition"
          >
            <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
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
          {/* ══════════════════════════════════════════════ */}
          {/* FORM                                            */}
          {/* ══════════════════════════════════════════════ */}
          <form
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 mb-6 shadow-sm"
          >
            <h2 className="font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <i className={`fa-solid ${formIcon} text-emerald-600 dark:text-emerald-400`}></i>
              <span>{formTitle}</span>
            </h2>

            {/* Info banner kalo mode edit_product */}
            {editMode === "edit_product" && (
              <div className="mb-4 p-3 rounded-xl bg-violet-50 dark:bg-violet-500/5 border border-violet-200 dark:border-violet-500/20 flex items-start gap-2">
                <i className="fa-solid fa-bullhorn text-violet-600 dark:text-violet-400 text-xs mt-0.5"></i>
                <p className="text-xs text-violet-700 dark:text-violet-300">
                  Isi nama produk + upload foto baru. Setelah submit, <strong>otomatis terkirim ke Discord channel produk</strong>.
                </p>
              </div>
            )}

            {/* Row 1: Kategori + Link */}
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
                  disabled={isEdit}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                  <i className="fa-solid fa-circle-info text-[10px]"></i>
                  {isEdit ? "Nama kategori nggak bisa diubah" : "Gunakan huruf kecil"}
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
              </div>
            </div>

            {/* Row 2: Info Produk — muncul di ADD & EDIT_PRODUCT */}
            {(isAddNew || editMode === "edit_product") && (
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <i className="fa-solid fa-bullhorn text-xs"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Info Produk (buat Webhook)
                    </h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Data ini bakal dikirim ke Discord channel produk
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                      Nama Produk *
                    </label>
                    <input
                      type="text"
                      value={namaProduk}
                      onChange={(e) => setNamaProduk(e.target.value)}
                      placeholder="mis. Diamond 3000 - Fast Process"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                      Foto Produk *
                    </label>

                    {!productPreview ? (
                      <button
                        type="button"
                        onClick={() => productInputRef.current?.click()}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-violet-500 bg-slate-50 dark:bg-slate-950/30 transition flex items-center justify-center gap-2"
                      >
                        <i className="fa-solid fa-cloud-arrow-up text-violet-600 dark:text-violet-400"></i>
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          Pilih Foto
                        </span>
                      </button>
                    ) : (
                      <div className="relative">
                        <img
                          src={productPreview}
                          alt="Preview"
                          className="w-full h-24 object-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setProductFile(null);
                            setProductPreview(null);
                            if (productInputRef.current)
                              productInputRef.current.value = "";
                          }}
                          className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center"
                        >
                          <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                      </div>
                    )}

                    <input
                      ref={productInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                <i className={`fa-solid ${submitIcon}`}></i>
                <span>{submitLabel}</span>
              </button>

              {isEdit && (
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

          {/* ══════════════════════════════════════════════ */}
          {/* LIST                                            */}
          {/* ══════════════════════════════════════════════ */}
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
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                        {item.nama_produk && (
                          <span className="px-2 py-0.5 bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold rounded flex items-center gap-1">
                            <i className="fa-solid fa-image text-[8px]"></i>
                            PRODUK
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

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Edit Link */}
                      <button
                        onClick={() => handleEditLink(item)}
                        className="w-8 h-8 flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-500/40 transition"
                        title="Edit Link"
                      >
                        <i className="fa-solid fa-link text-xs"></i>
                      </button>

                      {/* Edit Produk */}
                      <button
                        onClick={() => handleEditProduct(item)}
                        className="w-8 h-8 flex items-center justify-center bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-300 rounded-lg hover:bg-violet-500/40 transition"
                        title="Edit Produk (kirim ke Discord)"
                      >
                        <i className="fa-solid fa-bullhorn text-xs"></i>
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