// app/api/chat/messages/route.ts — isi satu percakapan pembeli Itemku (hanya baca), staff yang login
//   GET ?c=<conversation_id>  → { conversation, messages }  + tandai sudah dibaca oleh staff ini
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { canSeeConversation, chatUser, tokokuOrderUrl } from "@/lib/chat";

export const dynamic = "force-dynamic";

const LIMIT = 300;

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const conv = String(new URL(req.url).searchParams.get("c") || "").slice(0, 120);
  if (!conv) return NextResponse.json({ success: false, message: "Percakapan tidak dipilih" }, { status: 400 });

  const { data: c } = await supabaseAdmin
    .from("chat_conversations")
    .select("conversation_id, buyer_id, buyer_name, order_id, owner, product_name, product_image, last_message_at")
    .eq("conversation_id", conv)
    .maybeSingle();
  if (!c || !canSeeConversation(session, c.owner)) {
    return NextResponse.json({ success: false, message: "Percakapan tidak ditemukan" }, { status: 404 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("chat_messages")
    .select("tt, sender, text, files, sent_at, order_id, product_name")
    .eq("conversation_id", conv)
    .order("sent_at", { ascending: false })
    .limit(LIMIT);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });

  await supabaseAdmin
    .from("chat_reads")
    .upsert({ username: chatUser(session), conversation_id: conv, read_at: new Date().toISOString() }, { onConflict: "username,conversation_id" });

  return NextResponse.json({
    success: true,
    conversation: { ...c, tokoku_url: tokokuOrderUrl(c.order_id) },
    messages: (rows || []).reverse(),
  });
}
