// app/api/chat/inbox/route.ts — daftar chat pembeli Itemku untuk staff yang login (hanya baca)
//   GET ?count=1 → { unread }                         (ringan; dipakai tombol "Pesan" berkala)
//   GET          → { conversations: [...], unread }   (percakapan 30 hari terakhir, terbaru di atas)
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { CHAT_KEEP_DAYS, canSeeAllChats, chatUser } from "@/lib/chat";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = getSession(req);
  if (!session) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const user = chatUser(session);
  const all = canSeeAllChats(session);

  const { data: unread, error: e1 } = await supabaseAdmin.rpc("chat_unread_count", { p_username: user, p_see_all: all });
  if (e1) return NextResponse.json({ success: false, message: e1.message }, { status: 500 });
  if (new URL(req.url).searchParams.get("count")) {
    return NextResponse.json({ success: true, unread: Number(unread) || 0 });
  }

  const since = new Date(Date.now() - CHAT_KEEP_DAYS * 86400e3).toISOString();
  let q = supabaseAdmin
    .from("chat_conversations")
    .select("conversation_id, buyer_id, buyer_name, order_id, owner, product_name, product_image, last_message_at, last_text, last_sender")
    .gte("last_message_at", since)
    .order("last_message_at", { ascending: false })
    .limit(150);
  if (!all) q = q.or(`owner.is.null,owner.eq.${user}`);
  const [{ data: convs, error }, { data: reads }] = await Promise.all([
    q,
    supabaseAdmin.from("chat_reads").select("conversation_id, read_at").eq("username", user).gte("read_at", since),
  ]);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  const readMap = new Map((reads || []).map((r) => [r.conversation_id, r.read_at as string]));

  const conversations = (convs || []).map((c) => {
    const readAt = readMap.get(c.conversation_id);
    return {
      ...c,
      unread: c.last_sender === "buyer" && (!readAt || new Date(c.last_message_at) > new Date(readAt)),
    };
  });
  return NextResponse.json({ success: true, conversations, unread: Number(unread) || 0, see_all: all });
}
