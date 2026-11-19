// app/api/bot/chat/route.ts — notif chat pembeli Itemku (dipanggil login_once, header x-bot-api-key)
//
//   POST { type: "message", conversation_id, buyer_id?, text, order_id? }
//        Pesan baru dari pembeli → notif ke PEMILIK AKUN order itu (kalau diketahui), selain itu ke
//        semua staff. order_id juga disimpan sebagai pasangan percakapan → order untuk pesan berikutnya.
//
//   POST { type: "link", conversation_id, buyer_id?, order_id }
//        Hanya simpan pasangan percakapan → order (nomor order terlihat di percakapan).
//
//   POST { type: "unread", count }
//        Cadangan: angka "Pesan" belum dibaca naik. Notif dikirim PER PEMBELI yang chatnya belum dibalas & belum
//        dinotif (dari chat_conversations), bukan lagi satu notif "N pesan belum dibaca".
//
//   Klik notif → My Task membuka ruang chat pembeli itu (/?chat=<conversation_id>, ditangani ChatDock).
//   Tag notif per percakapan: beberapa pesan dari pembeli yang sama saling menggantikan di HP, beda pembeli = beda notif.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** buka ruang chat pembeli ini di My Task */
const chatUrl = (conversationId: string) => `/?chat=${encodeURIComponent(conversationId)}`;
const buyerLabel = (name: string | null | undefined, buyerId: number | null | undefined) =>
  name || (buyerId ? `Pembeli #${buyerId}` : "Pembeli Itemku");
const MAX_UNREAD_NOTIFS = 6;

/** pratinjau isi pesan: tag HTML (template bot) & spasi berlebih dibuang */
const preview = (raw: unknown) => {
  const t = String(raw || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return t ? (t.length > 160 ? t.slice(0, 157) + "…" : t) : "Mengirim gambar";
};

/** "168321882" / "OD000000168321882" → "OD000000168321882" */
function normalizeOrder(raw: unknown): string | null {
  const v = String(raw || "").trim().toUpperCase();
  const m = v.match(/^(?:OD)?0*(\d{6,})$/);
  return m ? `OD${m[1].padStart(15, "0")}` : null;
}

/** Pemilik order: akun (income_log) atau jokian (joki_orders). */
async function ownerOfOrder(orderId: string): Promise<string | null> {
  const { data: inc } = await supabaseAdmin
    .from("income_log")
    .select("joki_name")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  if (inc?.joki_name) return String(inc.joki_name).toLowerCase();
  const { data: joki } = await supabaseAdmin
    .from("joki_orders")
    .select("joki_name")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  return joki?.joki_name ? String(joki.joki_name).toLowerCase() : null;
}

async function saveLink(conversationId: string, buyerId: number | null, orderId: string) {
  const owner = await ownerOfOrder(orderId);
  await supabaseAdmin.from("chat_conversations").upsert(
    { conversation_id: conversationId, buyer_id: buyerId, order_id: orderId, owner, updated_at: new Date().toISOString() },
    { onConflict: "conversation_id" }
  );
  return owner;
}

export async function POST(request: Request) {
  if (!isBotRequest(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const type = String(body.type || "message");

    if (type === "unread") {
      const count = Math.max(0, Number(body.count) || 0);
      if (!count) return NextResponse.json({ success: true, skipped: true });
      // pembeli yang pesan terakhirnya belum dibalas & belum pernah dinotif sejak pesan itu
      const { data: rows } = await supabaseAdmin
        .from("chat_conversations")
        .select("conversation_id, buyer_id, buyer_name, owner, order_id, last_text, last_message_at, last_notified_at")
        .eq("last_sender", "buyer")
        .gte("last_message_at", new Date(Date.now() - 24 * 3600e3).toISOString())
        .order("last_message_at", { ascending: false })
        .limit(30);
      const todo = (rows || []).filter(
        (c) => !c.last_notified_at || new Date(c.last_message_at) > new Date(c.last_notified_at),
      );
      let sent = 0;
      for (const c of todo.slice(0, MAX_UNREAD_NOTIFS)) {
        await notify({
          to: c.owner || "all",
          kind: "chat",
          tag: `chat:${c.conversation_id}`,
          title: `Chat dari ${buyerLabel(c.buyer_name, c.buyer_id)}`,
          body: preview(c.last_text),
          url: chatUrl(c.conversation_id),
        });
        sent++;
      }
      if (todo.length) {
        await supabaseAdmin
          .from("chat_conversations")
          .update({ last_notified_at: new Date().toISOString() })
          .in("conversation_id", todo.map((c) => c.conversation_id));
      }
      return NextResponse.json({ success: true, notified: sent, pending: todo.length });
    }

    const conversationId = String(body.conversation_id || "").slice(0, 120);
    if (!conversationId) return NextResponse.json({ success: false, message: "conversation_id wajib" }, { status: 400 });
    const buyerId = Number(body.buyer_id) || null;
    const orderId = normalizeOrder(body.order_id);

    if (type === "link") {
      if (!orderId) return NextResponse.json({ success: false, message: "order_id tidak valid" }, { status: 400 });
      const owner = await saveLink(conversationId, buyerId, orderId);
      return NextResponse.json({ success: true, owner });
    }

    // type === "message"
    let owner: string | null = null;
    let linkedOrder: string | null = orderId;
    if (orderId) {
      owner = await saveLink(conversationId, buyerId, orderId);
    }
    const { data: conv } = await supabaseAdmin
      .from("chat_conversations")
      .select("order_id, owner, buyer_name")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (!orderId) {
      linkedOrder = conv?.order_id || null;
      owner = conv?.owner || (linkedOrder ? await ownerOfOrder(linkedOrder) : null);
    }

    const res = await notify({
      to: owner || "all",
      kind: "chat",
      tag: `chat:${conversationId}`,
      title: `Chat dari ${buyerLabel(conv?.buyer_name, buyerId)}`,
      body: (linkedOrder ? `#${linkedOrder.replace(/^OD0*/i, "")} · ` : "") + preview(body.text),
      url: chatUrl(conversationId),
    });
    await supabaseAdmin
      .from("chat_conversations")
      .upsert(
        { conversation_id: conversationId, buyer_id: buyerId, last_notified_at: new Date().toISOString(),
          ...(linkedOrder ? { order_id: linkedOrder, owner } : {}) },
        { onConflict: "conversation_id" }
      );
    return NextResponse.json({ success: true, to: owner || "all", result: res });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
