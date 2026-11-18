// app/api/cron/cleanup-chat/route.ts — hapus isi chat pembeli Itemku yang lebih dari 30 hari.
// Dipanggil cron Cloudflare sekali sehari (worker/index.ts), header Authorization: Bearer CRON_SECRET.
// Ringkasan percakapan (chat_conversations) tetap ada supaya pasangan percakapan → order tidak hilang.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CHAT_KEEP_DAYS } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - CHAT_KEEP_DAYS * 86400e3).toISOString();
  const { count, error } = await supabaseAdmin.from("chat_messages").delete({ count: "exact" }).lt("sent_at", cutoff);
  if (error) {
    console.error("[Cleanup Chat] Gagal hapus:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
  await supabaseAdmin.from("chat_reads").delete().lt("read_at", cutoff);
  if (count) console.log(`[Cleanup Chat] ${count} pesan sebelum ${cutoff} dihapus`);
  return NextResponse.json({ success: true, deleted: count || 0, cutoff });
}
