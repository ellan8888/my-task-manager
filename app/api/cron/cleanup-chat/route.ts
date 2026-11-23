// app/api/cron/cleanup-chat/route.ts — hapus isi chat pembeli Itemku yang lebih dari 30 hari (+ foto/videonya).
// Dipanggil cron Cloudflare sekali sehari (worker/index.ts), header Authorization: Bearer CRON_SECRET.
// Ringkasan percakapan (chat_conversations) tetap ada supaya pasangan percakapan → order tidak hilang.
import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cronAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CHAT_KEEP_DAYS } from "@/lib/chat";
import { OUT_KEEP_DAYS, purgeOld } from "@/lib/chatMedia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - CHAT_KEEP_DAYS * 86400e3).toISOString();
  const { count, error } = await supabaseAdmin.from("chat_messages").delete({ count: "exact" }).lt("sent_at", cutoff);
  if (error) {
    console.error("[Cleanup Chat] Gagal hapus:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  await supabaseAdmin.from("chat_reads").delete().lt("read_at", cutoff);
  // foto/video chat: kiriman My Task cukup 7 hari, salinan dari Itemku ikut umur isi chat
  let media = { out: 0, in: 0 };
  try {
    media = { out: await purgeOld("out", OUT_KEEP_DAYS), in: await purgeOld("in", CHAT_KEEP_DAYS) };
  } catch (e) {
    console.error("[Cleanup Chat] Gagal hapus media:", e);
  }
  if (count || media.out || media.in) {
    console.log(`[Cleanup Chat] ${count || 0} pesan, ${media.out + media.in} file media sebelum batas umur dihapus`);
  }
  return NextResponse.json({ success: true, deleted: count || 0, media, cutoff });
}
