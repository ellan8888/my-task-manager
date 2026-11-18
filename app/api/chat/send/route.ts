// app/api/chat/send/route.ts — staff membalas chat pembeli Itemku dari My Task
//   POST { conversation_id, text } → masuk antrean (chat_outbox); login_once yang mengirim ke Itemku.
//   Boleh membalas = boleh melihat: pemilik order, atau semua staff kalau ordernya belum diketahui.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { canSeeConversation, chatUser } from "@/lib/chat";

export const dynamic = "force-dynamic";

const MAX_LEN = 2000;
const MAX_WAITING = 5;          // balasan menunggu per percakapan (cegah kirim beruntun tidak sengaja)

export async function POST(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const conv = String(body.conversation_id || "").slice(0, 120);
  const text = String(body.text || "").replace(/\r/g, "").trim();
  if (!conv || !text) return NextResponse.json({ success: false, message: "Tulis pesannya dulu" }, { status: 400 });
  if (text.length > MAX_LEN) {
    return NextResponse.json({ success: false, message: `Pesan terlalu panjang (maks. ${MAX_LEN} huruf)` }, { status: 400 });
  }

  const { data: c } = await supabaseAdmin
    .from("chat_conversations")
    .select("conversation_id, owner")
    .eq("conversation_id", conv)
    .maybeSingle();
  if (!c || !canSeeConversation(session, c.owner)) {
    return NextResponse.json({ success: false, message: "Percakapan tidak ditemukan" }, { status: 404 });
  }

  const { count } = await supabaseAdmin
    .from("chat_outbox")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conv)
    .in("status", ["pending", "sending"]);
  if ((count || 0) >= MAX_WAITING) {
    return NextResponse.json(
      { success: false, message: "Masih ada beberapa balasan yang belum terkirim — tunggu sebentar" },
      { status: 429 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("chat_outbox")
    .insert({ conversation_id: conv, text, created_by: chatUser(session) })
    .select("id, conversation_id, text, status, method, error, timetoken, created_by, created_at")
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, item: data });
}
