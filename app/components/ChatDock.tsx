"use client";

// ChatDock — tombol "Pesan" melayang di semua halaman My Task + panel chat pembeli Itemku (hanya untuk dibaca).
// Pesan dikumpulkan bot dari chat Tokoku. Balasan ditulis di sini → antrean → bot (login_once) mengirim ke Itemku
// (cara cepat langsung dari halaman Tokoku, cadangan: klik Hubungi Pembeli). Status tiap balasan terlihat di panel.
// Warna biru mengikuti tombol "Pesan" Itemku supaya langsung terbaca sebagai chat Itemku.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  files: string[] | null;
  sent_at: string;
  order_id: string | null;
  product_name: string | null;
};
type Outbox = {
  id: number;
  text: string;
  status: "pending" | "sending" | "sent" | "failed";
  method: "fast" | "ui" | null;
  error: string | null;
  timetoken: string | null;
  created_by: string;
  created_at: string;
  done_at: string | null;
};
type Thread = { conversation: Conversation & { tokoku_url: string }; messages: Message[]; outbox?: Outbox[] };

const POLL_CLOSED = 30_000;
const POLL_INBOX = 15_000;
const POLL_THREAD = 10_000;
const POLL_SENDING = 3_000;     // ada balasan yang sedang dikirim → cek lebih sering
const ITEMKU_BLUE = "#2F80ED";

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
  const endRef = useRef<HTMLDivElement>(null);
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

  // gulir ke pesan terbaru saat isi bertambah
  const msgCount = (thread?.messages.length ?? 0) + (thread?.outbox?.length ?? 0);
  useEffect(() => {
    if (msgCount > lastCount.current) endRef.current?.scrollIntoView({ block: "end" });
    lastCount.current = msgCount;
  }, [msgCount, active]);

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

  const send = async () => {
    const text = draft.trim();
    if (!active || !text || sending) return;
    setSending(true);
    setSendError("");
    try {
      const d = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: active, text }),
      }).then((r) => r.json());
      if (!d.success) throw new Error(d.message || "Balasan belum masuk antrean, coba lagi");
      setDraft("");
      setThread((t) => (t && t.conversation.conversation_id === active ? { ...t, outbox: [...(t.outbox || []), d.item] } : t));
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const openConv = (id: string) => {
    setDraft("");
    setSendError("");
    lastCount.current = 0;
    setThread((t) => (t?.conversation.conversation_id === id ? t : null));
    setActive(id);
  };

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
                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <ul className="flex-1 overflow-y-auto">
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
                              {c.last_text || "Mengirim gambar"}
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
            <section className={`${active ? "flex" : "hidden sm:flex"} flex-1 min-w-0 flex-col bg-slate-50 dark:bg-slate-950`}>
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

                  <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
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
                              <div className="text-center my-3">
                                <span className="text-[11px] font-semibold text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full px-3 py-1">
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
                              <div className={`max-w-[80%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                                {m.files && m.files.length > 0 && (
                                  <div className={`flex flex-wrap gap-1.5 mb-1 ${mine ? "justify-end" : ""}`}>
                                    {m.files.map((f) =>
                                      !/\.(pdf|zip|rar|docx?|xlsx?|txt|mp4|mov)(\?|$)/i.test(f) ? (
                                        <button key={f} onClick={() => setZoom(f)} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img src={f} alt="Gambar dari chat" loading="lazy" className="w-40 h-40 object-cover bg-slate-200 dark:bg-slate-800" />
                                        </button>
                                      ) : (
                                        <a key={f} href={f} target="_blank" rel="noreferrer" className="text-xs underline text-blue-700 dark:text-blue-400">
                                          <i className="fa-solid fa-paperclip mr-1"></i>Lampiran
                                        </a>
                                      ),
                                    )}
                                  </div>
                                )}
                                {m.text && (
                                  <div
                                    className={`px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                                      mine
                                        ? "text-white rounded-2xl rounded-br-md"
                                        : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-bl-md border border-slate-200 dark:border-slate-700"
                                    }`}
                                    style={mine ? { backgroundColor: ITEMKU_BLUE } : undefined}
                                  >
                                    {m.text}
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
                        return (
                          <div key={`o${o.id}`} className="flex justify-end mt-3">
                            <div className="max-w-[80%] flex flex-col items-end">
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
                              <span className={`mt-0.5 px-1 text-[10px] ${st.cls}`}>
                                {o.status === "sending" || o.status === "pending" ? <i className="fa-solid fa-spinner fa-spin mr-1"></i> : null}
                                {st.label}
                                {o.status === "sent" && o.method === "ui" ? " (lewat rincian order)" : ""}
                                {" · "}
                                {o.created_by}
                              </span>
                              {o.status === "failed" && (
                                <span className="mt-0.5 px-1 text-[11px] text-rose-700 dark:text-rose-300 text-right max-w-xs">
                                  {o.error || "Gagal dikirim"}{" "}
                                  <button onClick={() => setDraft(o.text)} className="underline font-semibold">
                                    Tulis ulang
                                  </button>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    <div ref={endRef} />
                  </div>

                  <div className="shrink-0 px-3 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          if (sendError) setSendError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        rows={Math.min(5, Math.max(1, draft.split("\n").length))}
                        maxLength={2000}
                        placeholder={`Balas ${buyerLabel(activeConv)}…`}
                        aria-label="Tulis balasan"
                        className="flex-1 resize-none px-3.5 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={send}
                        disabled={!draft.trim() || sending}
                        aria-label="Kirim balasan"
                        className="w-10 h-10 shrink-0 rounded-full text-white disabled:opacity-40 hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
                        style={{ backgroundColor: ITEMKU_BLUE }}
                      >
                        <i className={`fa-solid ${sending ? "fa-spinner fa-spin" : "fa-paper-plane"}`}></i>
                      </button>
                    </div>
                    <p className={`mt-1.5 px-1 text-[11px] ${sendError ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                      {sendError || "Enter untuk kirim, Shift+Enter untuk baris baru. Bot mengirim ke Itemku, biasanya dalam beberapa puluh detik."}
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
          <img src={zoom} alt="Gambar dari chat" className="max-w-full max-h-full rounded-xl" />
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white" aria-label="Tutup gambar">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      )}
    </>
  );
}
