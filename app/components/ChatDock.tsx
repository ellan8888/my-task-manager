"use client";

// ChatDock — tombol "Pesan" melayang di semua halaman My Task + panel chat pembeli Itemku (hanya untuk dibaca).
// Pesan dikumpulkan bot dari chat Tokoku. Balasan ditulis di sini → antrean → bot (login_once) mengirim ke Itemku
// (cara cepat langsung dari halaman Tokoku, cadangan: klik Hubungi Pembeli). Status tiap balasan terlihat di panel.
// Warna biru mengikuti tombol "Pesan" Itemku supaya langsung terbaca sebagai chat Itemku.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatText, { chatPreview } from "./ChatText";
import { OPEN_CHAT_EVENT, chatIdFromUrl } from "@/lib/openChat";
import {
  MAX_ATTACH,
  compressImage,
  imagesFrom,
  mediaKind,
  mediaSrc,
  uploadAttachment,
  type Attachment,
  type ChatFile,
} from "./chatAttach";

type Conversation = {
  conversation_id: string;
  buyer_id: number | null;
  buyer_name: string | null;
  order_id: string | null;
  owner: string | null;
  product_name: string | null;
  product_image: string | null;
  last_message_at: string;
  last_text: string | null;
  last_sender: "buyer" | "seller" | null;
  unread: boolean;
};
type Message = {
  tt: string;
  sender: "buyer" | "seller";
  text: string | null;
  files: (ChatFile | string)[] | null;
  sent_at: string;
  order_id: string | null;
  product_name: string | null;
};
type Outbox = {
  id: number;
  text: string;
  files?: ChatFile[] | null;
  status: "pending" | "sending" | "sent" | "failed";
  method: "fast" | "ui" | null;
  error: string | null;
  timetoken: string | null;
  created_by: string;
  created_at: string;
  done_at: string | null;
  attempts?: number;
};
type Thread = { conversation: Conversation & { tokoku_url: string }; messages: Message[]; outbox?: Outbox[] };

const POLL_CLOSED = 30_000;
const POLL_INBOX = 15_000;
const POLL_THREAD = 10_000;
const POLL_SENDING = 3_000;     // ada balasan yang sedang dikirim → cek lebih sering
const ITEMKU_BLUE = "#2F80ED";
const NEAR_BOTTOM = 120;          // px — di dekat bawah, pesan baru otomatis digulir

const OUT_STATUS: Record<Outbox["status"], { label: string; cls: string }> = {
  pending: { label: "Menunggu bot", cls: "text-slate-400" },
  sending: { label: "Mengirim", cls: "text-blue-500" },
  sent: { label: "Terkirim", cls: "text-emerald-600 dark:text-emerald-400" },
  failed: { label: "Gagal", cls: "text-rose-600 dark:text-rose-400 font-semibold" },
};

const buyerLabel = (c: Pick<Conversation, "buyer_name" | "buyer_id">) => c.buyer_name || `Pembeli #${c.buyer_id ?? "?"}`;
const orderShort = (o: string | null) => (o ? o.replace(/^OD0*/, "#") : null);

function timeLabel(iso: string, now: number) {
  const d = new Date(iso);
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt`;
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now - 86400e3);
  if (d.toDateString() === y.toDateString()) return "kemarin";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function dayLabel(iso: string, now: number) {
  const d = new Date(iso);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return "Hari ini";
  if (d.toDateString() === new Date(now - 86400e3).toDateString()) return "Kemarin";
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
}

/** warna avatar tetap per pembeli */
const AVATAR = ["bg-sky-600", "bg-violet-600", "bg-emerald-600", "bg-amber-600", "bg-rose-600", "bg-teal-600", "bg-indigo-600", "bg-orange-600"];
function Avatar({ c, size = "md" }: { c: Pick<Conversation, "buyer_name" | "buyer_id">; size?: "md" | "lg" }) {
  const name = buyerLabel(c);
  const idx = Math.abs([...String(c.buyer_id ?? name)].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)) % AVATAR.length;
  const letter = c.buyer_name ? c.buyer_name.trim()[0]?.toUpperCase() : "#";
  return (
    <span
      className={`${AVATAR[idx]} ${size === "lg" ? "w-10 h-10 text-base" : "w-9 h-9 text-sm"} shrink-0 rounded-full text-white font-bold flex items-center justify-center`}
      aria-hidden
    >
      {letter}
    </span>
  );
}

/** Foto / video / file di gelembung chat. Link lama yang sudah kedaluwarsa → kotak "tidak tersedia". */
function MediaTile({ f, onZoom, dim = false }: { f: ChatFile | string; onZoom: (src: string) => void; dim?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = mediaSrc(f);
  const kind = mediaKind(f);
  const name = typeof f === "string" ? "" : f.name;
  if (!src || broken) {
    return (
      <span className="w-40 h-28 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/50 flex flex-col items-center justify-center gap-1 text-center px-2 text-[11px] text-slate-500">
        <i className="fa-regular fa-image text-lg text-slate-400"></i>
        {kind === "video" ? "Video" : "Foto"} sudah tidak tersedia
      </span>
    );
  }
  if (kind === "video") {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        onError={() => setBroken(true)}
        className={`w-56 max-h-72 rounded-xl bg-black border border-slate-200 dark:border-slate-800 ${dim ? "opacity-70" : ""}`}
      />
    );
  }
  if (kind === "file") {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-blue-700 dark:text-blue-300">
        <i className="fa-solid fa-paperclip"></i>
        <span className="truncate max-w-[10rem]">{name || "Lampiran"}</span>
      </a>
    );
  }
  return (
    <button
      onClick={() => onZoom(src)}
      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      aria-label="Perbesar foto"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Foto dari chat"
        loading="lazy"
        onError={() => setBroken(true)}
        className={`w-40 h-40 sm:w-48 sm:h-48 object-cover bg-slate-200 dark:bg-slate-800 ${dim ? "opacity-70" : ""}`}
      />
    </button>
  );
}

export default function ChatDock() {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [seeAll, setSeeAll] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [q, setQ] = useState("");
  const [now, setNow] = useState(0);
  const [zoom, setZoom] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dragDepth = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const lastCount = useRef(0);

  // ── angka belum dibaca (ringan) ──
  const pollCount = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/inbox?count=1", { cache: "no-store" });
      if (r.status === 401) return setEnabled(false);
      const d = await r.json();
      if (d.success) {
        setEnabled(true);
        setUnread(d.unread || 0);
      }
    } catch {
      /* jaringan putus sebentar — coba lagi di putaran berikutnya */
    }
  }, []);

  const loadInbox = useCallback(async () => {
    try {
      const d = await fetch("/api/chat/inbox", { cache: "no-store" }).then((r) => r.json());
      if (d.success) {
        setEnabled(true);                                   // dibuka langsung dari notif sebelum angka dimuat
        setConvs(d.conversations || []);
        setUnread(d.unread || 0);
        setSeeAll(!!d.see_all);
        setNow(Date.now());
      }
    } catch {
      /* diam: daftar lama tetap tampil */
    }
  }, []);

  const loadThread = useCallback(async (id: string, quiet = false) => {
    if (!quiet) setThreadLoading(true);
    try {
      const d = await fetch(`/api/chat/messages?c=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json());
      if (d.success) {
        setThread(d);
        setNow(Date.now());
        setConvs((cs) => cs && cs.map((c) => (c.conversation_id === id ? { ...c, unread: false } : c)));
      }
    } catch {
      /* diam */
    } finally {
      if (!quiet) setThreadLoading(false);
    }
  }, []);

  // tombol tertutup: cek angka tiap 30 detik saat tab terlihat
  useEffect(() => {
    if (open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    pollCount();
    const t = setInterval(() => document.visibilityState === "visible" && pollCount(), POLL_CLOSED);
    const vis = () => document.visibilityState === "visible" && pollCount();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [open, pollCount]);

  // panel terbuka: daftar tiap 15 detik
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInbox();
    const t = setInterval(() => document.visibilityState === "visible" && loadInbox(), POLL_INBOX);
    return () => clearInterval(t);
  }, [open, loadInbox]);

  // percakapan terbuka: isi tiap 10 detik
  const waiting = (thread?.outbox || []).some((o) => o.status === "pending" || o.status === "sending");
  useEffect(() => {
    if (!open || !active) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadThread(active, waiting);
    const t = setInterval(() => document.visibilityState === "visible" && loadThread(active, true), waiting ? POLL_SENDING : POLL_THREAD);
    return () => clearInterval(t);
  }, [open, active, loadThread, waiting]);

  // gulir: buka chat → langsung ke pesan terbaru; pesan baru masuk → ikut turun HANYA kalau sedang di bawah,
  // kalau sedang membaca pesan lama muncul tombol "pesan baru" (tidak ditarik paksa ke bawah)
  const msgCount = (thread?.messages.length ?? 0) + (thread?.outbox?.length ?? 0);
  const threadReady = !!thread && thread.conversation.conversation_id === active;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !threadReady) return;
    const prev = lastCount.current;
    lastCount.current = msgCount;
    if (prev === 0) {
      el.scrollTop = el.scrollHeight;                       // baru dibuka
      return;
    }
    if (msgCount <= prev) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM + 200;
    if (near) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else setNewBelow((n) => n + (msgCount - prev));
  }, [msgCount, threadReady]);

  const onThreadScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM;
    setAtBottom(bottom);
    if (bottom) setNewBelow(0);
  };
  const toBottom = (smooth = true) => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewBelow(0);
  };

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoom) setZoom(null);
      else {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, zoom]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (convs || [])
      .filter((c) => filter === "all" || c.unread)
      .filter((c) => !s || `${c.buyer_name} ${c.buyer_id} ${c.order_id} ${c.product_name} ${c.last_text} ${c.owner}`.toLowerCase().includes(s));
  }, [convs, filter, q]);

  // ── lampiran foto: kecilkan → unggah langsung di latar (saat staff masih mengetik keterangan) ──
  const patchAtt = (id: string, p: Partial<Attachment>) => setAtts((as) => as.map((a) => (a.id === id ? { ...a, ...p } : a)));

  const startUpload = async (conv: string, a: Attachment, file?: File) => {
    try {
      let blob = a.blob;
      if (!blob) {
        patchAtt(a.id, { status: "compressing", error: undefined });
        blob = await compressImage(file!);
      }
      patchAtt(a.id, { status: "uploading", progress: 0, blob, error: undefined });
      const up = await uploadAttachment(conv, blob, (pr) => patchAtt(a.id, { progress: pr }));
      patchAtt(a.id, { status: "ready", progress: 1, uploaded: up });
    } catch (e) {
      patchAtt(a.id, { status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  };

  const addFiles = (files: File[]) => {
    if (!active || !files.length) return;
    const room = MAX_ATTACH - atts.length;
    if (room <= 0) {
      setSendError(`Maksimal ${MAX_ATTACH} foto sekali kirim`);
      return;
    }
    if (files.length > room) setSendError(`Hanya ${room} foto lagi yang bisa ditambahkan (maks. ${MAX_ATTACH})`);
    else setSendError("");
    const conv = active;
    for (const file of files.slice(0, room)) {
      const a: Attachment = {
        id: crypto.randomUUID(),
        name: file.name || "foto",
        preview: URL.createObjectURL(file),
        status: "compressing",
        progress: 0,
      };
      setAtts((as) => [...as, a]);
      startUpload(conv, a, file);
    }
  };

  const removeAtt = (id: string) =>
    setAtts((as) => {
      const a = as.find((x) => x.id === id);
      if (a) URL.revokeObjectURL(a.preview);
      return as.filter((x) => x.id !== id);
    });

  const clearAtts = () =>
    setAtts((as) => {
      as.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });

  const uploadingCount = atts.filter((a) => a.status === "compressing" || a.status === "uploading").length;
  const failedCount = atts.filter((a) => a.status === "error").length;
  const canSend = !sending && uploadingCount === 0 && failedCount === 0 && (!!draft.trim() || atts.length > 0);

  const send = async () => {
    const text = draft.trim();
    if (!active || !canSend) return;
    setSending(true);
    setSendError("");
    try {
      const files = atts.map((a) => a.uploaded).filter((f): f is ChatFile => !!f);
      const d = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: active, text, files }),
      }).then((r) => r.json());
      if (!d.success) throw new Error(d.message || "Balasan belum masuk antrean, coba lagi");
      setDraft("");
      clearAtts();
      const added: Outbox[] = d.items || (d.item ? [d.item] : []);
      setThread((t) => (t && t.conversation.conversation_id === active ? { ...t, outbox: [...(t.outbox || []), ...added] } : t));
      setTimeout(() => toBottom(), 50);                     // pesan sendiri selalu terlihat
      textRef.current?.focus();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const openConv = (id: string) => {
    setDraft("");
    clearAtts();
    setSendError("");
    setNewBelow(0);
    setAtBottom(true);
    lastCount.current = 0;
    setThread((t) => (t?.conversation.conversation_id === id ? t : null));
    setActive(id);
  };

  // buka ruang chat dari notif: lewat lonceng (event) atau dari push notif (?chat=… di alamat halaman)
  useEffect(() => {
    const go = (id: string) => {
      setOpen(true);
      openConv(id);
    };
    const fromUrl = chatIdFromUrl(window.location.href);
    if (fromUrl) {
      go(fromUrl);
      const u = new URL(window.location.href);
      u.searchParams.delete("chat");
      window.history.replaceState(window.history.state, "", u.pathname + u.search + u.hash);
    }
    const onEvt = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) go(id);
    };
    window.addEventListener(OPEN_CHAT_EVENT, onEvt);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onEvt);
  }, []);

  if (!enabled) return null;

  const current = thread && thread.conversation.conversation_id === active ? thread : null;
  // balasan My Task yang sudah muncul sebagai pesan asli (timetoken sama) tidak ditampilkan dobel
  const msgTts = new Set((current?.messages || []).map((m) => m.tt));
  const repliedBy = new Map((current?.outbox || []).filter((o) => o.timetoken).map((o) => [o.timetoken as string, o.created_by]));
  const pendingOut = (current?.outbox || []).filter((o) => !(o.status === "sent" && o.timetoken && msgTts.has(o.timetoken)));
  const activeConv = convs?.find((c) => c.conversation_id === active) || current?.conversation || null;

  return (
    <>
      {/* ── Tombol melayang ── */}
      {!open && (
        <button
          ref={buttonRef}
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[900] flex items-center gap-2.5 pl-4 pr-3 py-3 rounded-xl text-white font-bold shadow-lg shadow-blue-900/25 hover:brightness-110 active:scale-[0.98] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          style={{ backgroundColor: ITEMKU_BLUE }}
          aria-label={unread ? `Pesan pembeli, ${unread} belum dibaca` : "Pesan pembeli"}
        >
          <i className="fa-solid fa-comment-dots text-lg"></i>
          <span className="text-sm">Pesan</span>
          {unread > 0 && (
            <span className="min-w-[1.5rem] h-6 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      )}

      {/* ── Panel ── */}
      {open && (
        <div
          role="dialog"
          aria-label="Pesan pembeli Itemku"
          className="fixed z-[900] inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[min(820px,calc(100vw-2.5rem))] sm:h-[min(640px,calc(100vh-2.5rem))] bg-white dark:bg-slate-900 sm:rounded-2xl sm:border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/30 flex flex-col overflow-hidden"
        >
          {/* kepala */}
          <div className="flex items-center gap-3 px-4 py-3 text-white shrink-0" style={{ backgroundColor: ITEMKU_BLUE }}>
            <i className="fa-solid fa-comment-dots text-lg"></i>
            <div className="min-w-0 mr-auto">
              <div className="font-bold leading-tight">Pesan pembeli</div>
              <div className="text-[11px] text-blue-100 leading-tight">
                {seeAll ? "Semua chat Itemku" : "Chat dari order milikmu & yang belum jelas ordernya"} · balasan dikirim bot ke Itemku
              </div>
            </div>
            {unread > 0 && <span className="hidden sm:inline text-xs font-semibold bg-white/20 rounded-full px-2 py-0.5 tabular-nums">{unread} belum dibaca</span>}
            <button
              onClick={() => {
                setOpen(false);
                setTimeout(() => buttonRef.current?.focus(), 0);
              }}
              className="w-8 h-8 rounded-lg hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Tutup pesan"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="flex-1 min-h-0 flex">
            {/* daftar percakapan */}
            <aside className={`${active ? "hidden sm:flex" : "flex"} w-full sm:w-[290px] shrink-0 flex-col border-r border-slate-200 dark:border-slate-800`}>
              <div className="p-3 space-y-2 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari pembeli, order, produk"
                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-base sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 caret-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-1 text-xs font-semibold">
                  {([["all", "Semua"], ["unread", "Belum dibaca"]] as const).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setFilter(k)}
                      className={`px-2.5 py-1 rounded-full transition-colors ${
                        filter === k ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {l}
                      {k === "unread" && unread > 0 ? ` ${unread}` : ""}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="chat-scroll flex-1 overflow-y-auto overscroll-contain">
                {convs === null ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <li key={i} className="px-3 py-3 flex gap-3 animate-pulse">
                      <span className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800" />
                      <span className="flex-1 space-y-2 pt-1">
                        <span className="block h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-800" />
                        <span className="block h-3 w-full rounded bg-slate-100 dark:bg-slate-800/60" />
                      </span>
                    </li>
                  ))
                ) : shown.length === 0 ? (
                  <li className="p-6 text-center text-sm text-slate-500">
                    {convs.length === 0
                      ? "Belum ada chat tersimpan. Chat masuk otomatis selama login_once berjalan."
                      : filter === "unread"
                        ? "Semua chat sudah dibaca."
                        : "Tidak ada chat yang cocok."}
                  </li>
                ) : (
                  shown.map((c) => (
                    <li key={c.conversation_id}>
                      <button
                        onClick={() => openConv(c.conversation_id)}
                        className={`w-full text-left px-3 py-3 flex gap-3 border-b border-slate-100 dark:border-slate-800/70 focus:outline-none focus-visible:bg-blue-50 dark:focus-visible:bg-blue-500/10 ${
                          active === c.conversation_id ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <Avatar c={c} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={`truncate text-sm ${c.unread ? "font-extrabold text-slate-900 dark:text-white" : "font-semibold text-slate-800 dark:text-slate-200"}`}>
                              {buyerLabel(c)}
                            </span>
                            <span className={`ml-auto shrink-0 text-[11px] tabular-nums ${c.unread ? "text-blue-600 dark:text-blue-400 font-semibold" : "text-slate-400"}`}>
                              {timeLabel(c.last_message_at, now)}
                            </span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`truncate text-xs ${c.unread ? "text-slate-800 dark:text-slate-200" : "text-slate-500"}`}>
                              {c.last_sender === "seller" && <span className="text-slate-400">Toko: </span>}
                              {c.last_text ? chatPreview(c.last_text) : "Mengirim gambar"}
                            </span>
                            {c.unread && <span className="ml-auto w-2.5 h-2.5 shrink-0 rounded-full bg-red-600" aria-label="belum dibaca" />}
                          </span>
                          {(c.order_id || c.product_name || (seeAll && c.owner)) && (
                            <span className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400 min-w-0">
                              {c.order_id && <span className="shrink-0 tabular-nums">{orderShort(c.order_id)}</span>}
                              {c.product_name && <span className="truncate">{c.product_name}</span>}
                              {seeAll && c.owner && (
                                <span className="ml-auto shrink-0 px-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 capitalize">{c.owner}</span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </aside>

            {/* isi percakapan */}
            <section
              className={`${active ? "flex" : "hidden sm:flex"} relative flex-1 min-w-0 flex-col bg-slate-50 dark:bg-slate-950`}
              onDragEnter={(e) => {
                if (!active || !e.dataTransfer.types.includes("Files")) return;
                e.preventDefault();
                dragDepth.current += 1;
                setDragging(true);
              }}
              onDragOver={(e) => {
                if (active && e.dataTransfer.types.includes("Files")) e.preventDefault();
              }}
              onDragLeave={() => {
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (!dragDepth.current) setDragging(false);
              }}
              onDrop={(e) => {
                if (!active) return;
                e.preventDefault();
                dragDepth.current = 0;
                setDragging(false);
                addFiles(imagesFrom(e.dataTransfer.files));
              }}
            >
              {dragging && (
                <div className="absolute inset-2 z-30 rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50/90 dark:bg-blue-500/15 backdrop-blur-sm grid place-items-center pointer-events-none motion-safe:animate-[pop_.16s_ease-out]">
                  <div className="text-center text-blue-700 dark:text-blue-300">
                    <i className="fa-solid fa-images text-3xl mb-2"></i>
                    <p className="text-sm font-semibold">Lepas foto di sini</p>
                    <p className="text-xs opacity-80">maks. {MAX_ATTACH} foto sekali kirim</p>
                  </div>
                </div>
              )}
              {!active || !activeConv ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
                  <i className="fa-regular fa-comments text-3xl mb-3 text-slate-300 dark:text-slate-700"></i>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Pilih chat di kiri</p>
                  <p className="text-xs mt-1 max-w-xs">Isi chat pembeli dari Itemku tampil di sini, dikelompokkan per pembeli.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <button
                      onClick={() => setActive(null)}
                      className="sm:hidden w-8 h-8 -ml-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      aria-label="Kembali ke daftar chat"
                    >
                      <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <Avatar c={activeConv} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{buyerLabel(activeConv)}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 min-w-0">
                        {activeConv.order_id && <span className="tabular-nums shrink-0">{activeConv.order_id}</span>}
                        {activeConv.product_name && <span className="truncate">{activeConv.product_name}</span>}
                        {!activeConv.order_id && !activeConv.product_name && <span>Order belum dikenali</span>}
                      </div>
                    </div>
                    <a
                      href={current?.conversation.tokoku_url || "https://tokoku.itemku.com/riwayat-pesanan"}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                    >
                      Buka di Itemku
                    </a>
                  </div>

                  <div className="relative flex-1 min-h-0">
                  <div ref={scrollRef} onScroll={onThreadScroll} className="chat-scroll h-full overflow-y-auto overscroll-contain px-4 sm:px-6 py-4" aria-live="polite">
                    {threadLoading && !current ? (
                      <div className="space-y-3 animate-pulse">
                        {[60, 40, 70, 30].map((w, i) => (
                          <div key={i} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                            <span className="h-10 rounded-2xl bg-slate-200 dark:bg-slate-800" style={{ width: `${w}%` }} />
                          </div>
                        ))}
                      </div>
                    ) : current && current.messages.length === 0 ? (
                      <p className="text-center text-sm text-slate-500 mt-10">Isi chat ini belum tersimpan.</p>
                    ) : (
                      current?.messages.map((m, i) => {
                        const prev = current.messages[i - 1];
                        const newDay = !prev || new Date(prev.sent_at).toDateString() !== new Date(m.sent_at).toDateString();
                        const orderChange = m.order_id && m.order_id !== prev?.order_id;
                        const mine = m.sender === "seller";
                        const grouped = prev && prev.sender === m.sender && !newDay && new Date(m.sent_at).getTime() - new Date(prev.sent_at).getTime() < 5 * 60e3;
                        return (
                          <div key={m.tt}>
                            {newDay && (
                              <div className="sticky top-0 z-10 text-center py-2 pointer-events-none">
                                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-full px-3 py-1 shadow-sm">
                                  {dayLabel(m.sent_at, now)}
                                </span>
                              </div>
                            )}
                            {orderChange && (
                              <div className="text-center my-2 text-[11px] text-slate-500">
                                Order <span className="font-semibold tabular-nums">{m.order_id}</span>
                                {m.product_name ? ` · ${m.product_name}` : ""}
                              </div>
                            )}
                            <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-1" : "mt-3"}`}>
                              <div className={`max-w-[85%] sm:max-w-[75%] min-w-0 ${mine ? "items-end" : "items-start"} flex flex-col`}>
                                {m.files && m.files.length > 0 && (
                                  <div className={`flex flex-wrap gap-1.5 mb-1 ${mine ? "justify-end" : ""}`}>
                                    {m.files.map((f, fi) => (
                                      <MediaTile key={typeof f === "string" ? f : f.path || `${f.name}${fi}`} f={f} onZoom={setZoom} />
                                    ))}
                                  </div>
                                )}
                                {m.text && (
                                  <div
                                    className={`max-w-full min-w-0 px-3.5 py-2 text-sm leading-relaxed shadow-sm ${
                                      mine
                                        ? "text-white rounded-2xl rounded-br-md"
                                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-md border border-slate-200 dark:border-slate-700"
                                    }`}
                                    style={mine ? { backgroundColor: ITEMKU_BLUE } : undefined}
                                  >
                                    <ChatText text={m.text} mine={mine} />
                                  </div>
                                )}
                                <span className="mt-0.5 px-1 text-[10px] text-slate-400 tabular-nums">
                                  {mine ? (repliedBy.get(m.tt) ? `${repliedBy.get(m.tt)} dari My Task · ` : "Toko · ") : ""}
                                  {new Date(m.sent_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {current &&
                      pendingOut.map((o) => {
                        const st = OUT_STATUS[o.status];
                        const tries = o.attempts ?? 1;
                        const retryingAuto = o.status === "pending" && tries > 1;
                        return (
                          <div key={`o${o.id}`} className="flex justify-end mt-3">
                            <div className="max-w-[80%] flex flex-col items-end">
                              {o.files && o.files.length > 0 && (
                                <div className="relative mb-1">
                                  {o.files.map((f) => (
                                    <MediaTile key={f.path} f={f} onZoom={setZoom} dim={o.status !== "failed"} />
                                  ))}
                                  {(o.status === "pending" || o.status === "sending") && (
                                    <span className="absolute inset-0 grid place-items-center pointer-events-none">
                                      <span className="w-9 h-9 rounded-full bg-slate-900/55 text-white grid place-items-center">
                                        <i className="fa-solid fa-arrow-up text-sm motion-safe:animate-bounce"></i>
                                      </span>
                                    </span>
                                  )}
                                </div>
                              )}
                              {o.text && (
                              <div
                                className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-2xl rounded-br-md ${
                                  o.status === "failed"
                                    ? "bg-rose-50 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-500/30"
                                    : "text-white opacity-70"
                                }`}
                                style={o.status === "failed" ? undefined : { backgroundColor: ITEMKU_BLUE }}
                              >
                                {o.text}
                              </div>
                              )}
                              <span className={`mt-0.5 px-1 text-[10px] ${st.cls}`}>
                                {o.status === "sending" || o.status === "pending" ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : null}
                                {retryingAuto
                                  ? `Belum terkirim, dicoba lagi otomatis (percobaan ke-${tries})`
                                  : o.status === "sending" && tries > 1
                                    ? `Mengirim ulang (percobaan ke-${tries})`
                                    : st.label}
                                {o.status === "sent" && o.method === "ui" ? " (lewat rincian order)" : ""}
                                {" · "}
                                {o.created_by}
                              </span>
                              {o.status === "failed" && (
                                <span className="mt-0.5 px-1 text-[11px] text-rose-700 dark:text-rose-300 text-right max-w-sm">
                                  {o.error || "Gagal dikirim"}
                                </span>
                              )}
                              {retryingAuto && o.error && (
                                <span className="mt-0.5 px-1 text-[10px] text-slate-400 text-right max-w-xs truncate" title={o.error}>
                                  Sebelumnya: {o.error}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    <div ref={endRef} />
                  </div>
                  {(!atBottom || newBelow > 0) && current && (
                    <button
                      onClick={() => toBottom()}
                      className={`absolute bottom-3 right-4 z-20 flex items-center gap-1.5 rounded-full shadow-lg shadow-slate-900/20 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 transition ${
                        newBelow > 0 ? "px-3.5 h-9 text-white text-xs font-semibold" : "w-9 h-9 justify-center bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                      }`}
                      style={newBelow > 0 ? { backgroundColor: ITEMKU_BLUE } : undefined}
                      aria-label={newBelow > 0 ? `${newBelow} pesan baru, gulir ke bawah` : "Gulir ke pesan terbaru"}
                    >
                      <i className="fa-solid fa-arrow-down"></i>
                      {newBelow > 0 && <span>{newBelow} pesan baru</span>}
                    </button>
                  )}
                  </div>

                  <div className="shrink-0 px-3 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                    {atts.length > 0 && (
                      <ul className="flex gap-2 overflow-x-auto pt-2 pr-2 pb-2 mb-1 chat-scroll" aria-label="Foto yang akan dikirim">
                        {atts.map((a) => {
                          const busy = a.status === "compressing" || a.status === "uploading";
                          return (
                            <li key={a.id} className="relative shrink-0 motion-safe:animate-[pop_.18s_ease-out]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={a.preview}
                                alt={a.name}
                                className={`w-16 h-16 rounded-xl object-cover border ${
                                  a.status === "error" ? "border-rose-400 opacity-60" : "border-slate-200 dark:border-slate-700"
                                } ${busy ? "opacity-60" : ""}`}
                              />
                              {busy && (
                                <span className="absolute inset-x-1.5 bottom-1.5 h-1.5 rounded-full bg-white/70 overflow-hidden" aria-hidden>
                                  <span
                                    className={`block h-full rounded-full bg-blue-600 transition-[width] duration-200 ${a.status === "compressing" ? "w-1/4 animate-pulse" : ""}`}
                                    style={a.status === "uploading" ? { width: `${Math.max(8, a.progress * 100)}%` } : undefined}
                                  />
                                </span>
                              )}
                              {a.status === "ready" && (
                                <span className="absolute left-1 bottom-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] grid place-items-center shadow" aria-label="siap dikirim">
                                  <i className="fa-solid fa-check"></i>
                                </span>
                              )}
                              {a.status === "error" && (
                                <button
                                  onClick={() => active && startUpload(active, a)}
                                  disabled={!a.blob}
                                  title={a.error}
                                  className="absolute inset-0 rounded-xl grid place-items-center text-rose-600 bg-white/40 dark:bg-slate-900/40 disabled:cursor-not-allowed"
                                  aria-label={`Gagal: ${a.error}. Coba unggah lagi`}
                                >
                                  <i className={`fa-solid ${a.blob ? "fa-rotate-right" : "fa-triangle-exclamation"}`}></i>
                                </button>
                              )}
                              <button
                                onClick={() => removeAtt(a.id)}
                                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-800 text-white text-[11px] grid place-items-center shadow ring-2 ring-white dark:ring-slate-900 hover:bg-rose-600"
                                aria-label={`Hapus ${a.name}`}
                              >
                                <i className="fa-solid fa-xmark"></i>
                              </button>
                            </li>
                          );
                        })}
                        {atts.length < MAX_ATTACH && (
                          <li className="shrink-0">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 hover:text-blue-600 hover:border-blue-400 grid place-items-center"
                              aria-label="Tambah foto"
                            >
                              <i className="fa-solid fa-plus"></i>
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                    <div className="flex items-end gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                        multiple
                        hidden
                        onChange={(e) => {
                          addFiles(imagesFrom(e.target.files));
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={atts.length >= MAX_ATTACH}
                        aria-label="Lampirkan foto"
                        title="Lampirkan foto (bisa juga tempel Ctrl+V atau seret ke sini)"
                        className="press w-10 h-10 shrink-0 rounded-full text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                      >
                        <i className="fa-solid fa-image text-lg"></i>
                      </button>
                      <textarea
                        ref={textRef}
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          if (sendError) setSendError("");
                        }}
                        onPaste={(e) => {
                          const imgs = imagesFrom(e.clipboardData?.items);
                          if (imgs.length) {
                            e.preventDefault();
                            addFiles(imgs);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        rows={Math.min(5, Math.max(1, draft.split("\n").length))}
                        maxLength={2000}
                        placeholder={atts.length ? "Tambahkan keterangan (opsional)…" : `Balas ${buyerLabel(activeConv)}…`}
                        aria-label="Tulis balasan"
                        className="chat-scroll flex-1 resize-none px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-base sm:text-sm leading-relaxed text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 caret-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={send}
                        disabled={!canSend}
                        aria-label={atts.length ? `Kirim ${atts.length} foto` : "Kirim balasan"}
                        className="press w-10 h-10 shrink-0 rounded-full text-white disabled:opacity-40 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                        style={{ backgroundColor: ITEMKU_BLUE }}
                      >
                        <i className={`fa-solid ${sending ? "fa-spinner fa-spin" : "fa-paper-plane"}`}></i>
                      </button>
                    </div>
                    <p className={`mt-1.5 px-1 text-[11px] ${sendError || failedCount ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                      {sendError ||
                        (failedCount
                          ? `${failedCount} foto gagal diunggah — ketuk fotonya untuk coba lagi, atau hapus`
                          : uploadingCount
                            ? `Menyiapkan ${uploadingCount} foto…`
                            : atts.length
                              ? `${atts.length} foto siap. Foto dikirim satu per satu, keterangan menyusul setelahnya.`
                              : "Enter untuk kirim, Shift+Enter baris baru. Foto: tombol gambar, tempel, atau seret ke sini.")}
                    </p>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      )}

      {/* gambar diperbesar */}
      {zoom && (
        <div className="fixed inset-0 z-[950] bg-slate-950/85 flex items-center justify-center p-4" onClick={() => setZoom(null)} role="dialog" aria-label="Gambar dari chat">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Foto dari chat" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white" aria-label="Tutup gambar">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}
    </>
  );
}
