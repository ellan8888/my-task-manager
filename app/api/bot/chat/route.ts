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
//        Cadangan: angka "Pesan" belum dibaca naik tapi isi pesan tidak terbaca → notif ke semua staff.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

const CHAT_URL = "https://tokoku.itemku.com/riwayat-pesanan";
const orderUrl = (orderId: string) => {
  const num = orderId.replace(/^OD0*/i, "");
  return /^\d+$/.test(num) ? `https://tokoku.itemku.com/riwayat-pesanan/rincian/${num}` : CHAT_URL;
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
      const res = await notify({
        to: "all",
        kind: "chat",
        title: `${count} pesan belum dibaca di Itemku`,
        body: "Ada pesan pembeli yang belum dibalas — buka chat Tokoku.",
        url: CHAT_URL,
      });
      return NextResponse.json({ success: true, result: res });
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
    } else {
      const { data: conv } = await supabaseAdmin
        .from("chat_conversations")
        .select("order_id, owner")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      linkedOrder = conv?.order_id || null;
      owner = conv?.owner || (linkedOrder ? await ownerOfOrder(linkedOrder) : null);
    }

    const text = String(body.text || "").replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
    const res = await notify({
      to: owner || "all",
      kind: "chat",
      title: linkedOrder ? `Pesan pembeli · ${linkedOrder}` : "Pesan baru dari pembeli Itemku",
      body: text ? (text.length > 160 ? text.slice(0, 157) + "…" : text) : "(pesan tanpa teks / gambar)",
      url: linkedOrder ? orderUrl(linkedOrder) : CHAT_URL,
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
