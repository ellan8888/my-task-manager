// app/api/bot/chat/messages/route.ts — isi chat pembeli Itemku dari bot (login_once), header x-bot-api-key
//   POST { messages: [{ conversation_id, tt, sender: "buyer"|"seller", text, files?, order_id?, product_name?, product_image? }] }
//   Pesan disimpan sekali saja (kunci: percakapan + timetoken). Ringkasan percakapan (pesan terakhir, produk,
//   order, nama pembeli) ikut diperbarui. Notif tetap lewat /api/bot/chat — endpoint ini tidak mengirim notif.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";
import { normalizeOrder, orderInfo } from "@/lib/chat";

export const dynamic = "force-dynamic";

type In = {
  conversation_id?: unknown;
  tt?: unknown;
  sender?: unknown;
  text?: unknown;
  files?: unknown;
  order_id?: unknown;
  product_name?: unknown;
  product_image?: unknown;
};

const CONV_RE = /^[a-z_]*?_(\d+)_(\d+)$/;
const clean = (v: unknown, n: number) => {
  const s = String(v ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/\r/g, "").trim();
  return s ? s.slice(0, n) : null;
};

export async function POST(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const list: In[] = Array.isArray(body.messages) ? body.messages.slice(0, 300) : [];

  const rows = [];
  for (const m of list) {
    const conv = String(m.conversation_id || "").slice(0, 120);
    const tt = String(m.tt || "").replace(/\D/g, "");
    const cm = conv.match(CONV_RE);
    if (!cm || tt.length < 13) continue;
    const sender = m.sender === "seller" ? "seller" : m.sender === "buyer" ? "buyer" : null;
    if (!sender) continue;
    const files = Array.isArray(m.files)
      ? m.files.filter((f): f is string => typeof f === "string" && /^https?:\/\//.test(f)).slice(0, 10)
      : [];
    const text = clean(m.text, 4000);
    if (!text && !files.length) continue;
    rows.push({
      conversation_id: conv,
      tt,
      sender,
      text,
      files: files.length ? files : null,
      sent_at: new Date(Number(tt.slice(0, 13))).toISOString(),     // timetoken = 100 ns → 13 digit pertama = ms
      order_id: normalizeOrder(m.order_id),
      product_name: clean(m.product_name, 200),
      _buyer: Number(cm[1]),
      _image: clean(m.product_image, 500),
    });
  }
  if (!rows.length) return NextResponse.json({ success: true, saved: 0 });

  const { error } = await supabaseAdmin
    .from("chat_messages")
    .upsert(
      rows.map(({ _buyer, _image, ...r }) => (void _buyer, void _image, r)),
      { onConflict: "conversation_id,tt", ignoreDuplicates: true },
    );
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  // Ringkasan per percakapan
  const byConv = new Map<string, typeof rows>();
  for (const r of rows) byConv.set(r.conversation_id, [...(byConv.get(r.conversation_id) || []), r]);
  const { data: existing } = await supabaseAdmin
    .from("chat_conversations")
    .select("conversation_id, order_id, owner, buyer_name, last_message_at")
    .in("conversation_id", [...byConv.keys()]);
  const exMap = new Map((existing || []).map((e) => [e.conversation_id, e]));

  for (const [conv, msgs] of byConv) {
    const ex = exMap.get(conv);
    const latest = msgs.reduce((a, b) => (a.tt > b.tt ? a : b));
    const withOrder = [...msgs].reverse().find((m) => m.order_id);
    const withProduct = [...msgs].reverse().find((m) => m.product_name);
    const patch: Record<string, unknown> = { conversation_id: conv, buyer_id: latest._buyer, updated_at: new Date().toISOString() };
    if (!ex?.last_message_at || new Date(latest.sent_at) >= new Date(ex.last_message_at)) {
      patch.last_message_at = latest.sent_at;
      patch.last_text = latest.text ? latest.text.slice(0, 200) : "Mengirim gambar";
      patch.last_sender = latest.sender;
    }
    if (withProduct) {
      patch.product_name = withProduct.product_name;
      if (withProduct._image) patch.product_image = withProduct._image;
    }
    const orderId = withOrder?.order_id || ex?.order_id || null;
    if (orderId && (orderId !== ex?.order_id || !ex?.buyer_name || !ex?.owner)) {
      const info = await orderInfo(orderId);
      patch.order_id = orderId;
      if (info.owner) patch.owner = info.owner;
      if (info.buyer_name) patch.buyer_name = info.buyer_name;
    }
    await supabaseAdmin.from("chat_conversations").upsert(patch, { onConflict: "conversation_id" });
  }
  return NextResponse.json({ success: true, saved: rows.length });
}
