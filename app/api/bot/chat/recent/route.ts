// app/api/bot/chat/recent/route.ts — chat pembeli terbaru untuk dashboard HP (PhoneBox), header x-bot-api-key
//   GET ?hours=24&limit=10 → { conversations: [{ conversation_id, buyer, last_text, last_sender, last_message_at,
//                                              order_id, product_name, owner, waiting }], waiting }
//   waiting = pesan terakhir dari pembeli (belum dibalas toko). Hanya baca; tidak menandai sudah dibaca.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const hours = Math.min(Math.max(Number(sp.get("hours")) || 24, 1), 24 * 7);
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 10, 1), 30);
  const since = new Date(Date.now() - hours * 3600e3).toISOString();

  const { data, error } = await supabaseAdmin
    .from("chat_conversations")
    .select("conversation_id, buyer_id, buyer_name, order_id, owner, product_name, last_message_at, last_text, last_sender")
    .gte("last_message_at", since)
    .order("last_message_at", { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  const conversations = (data || []).map((c) => ({
    conversation_id: c.conversation_id,
    buyer: c.buyer_name || (c.buyer_id ? `Pembeli ${c.buyer_id}` : "Pembeli"),
    last_text: c.last_text,
    last_sender: c.last_sender,
    last_message_at: c.last_message_at,
    order_id: c.order_id,
    product_name: c.product_name,
    owner: c.owner,
    waiting: c.last_sender === "buyer",
  }));
  return NextResponse.json({ success: true, conversations, waiting: conversations.filter((c) => c.waiting).length });
}
