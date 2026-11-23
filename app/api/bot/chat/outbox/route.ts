// app/api/bot/chat/outbox/route.ts — antrean balasan chat untuk bot (login_once), header x-bot-api-key
//   GET  → { items: [{ id, conversation_id, text, created_by, order_id, files: [{path,name,mime,size,url}] }] }
//          files = foto dari My Task; url = signed URL 15 menit untuk diunduh bot
//          diambil atomik (status → sending) lewat fungsi SQL chat_outbox_claim; yang > 30 menit kedaluwarsa
//   GET ?peek=1 → { pending: n } — hanya menghitung (tidak mengambil); dipakai thread bot tiap beberapa detik
//   POST { id, status: "sent"|"failed"|"retry", method?, error?, timetoken? } → hasil pengiriman
//        retry = bot belum bisa mengirim di sela langkah lain → kembali ke antrean (diambil lagi di loop biasa)
//        failed = TIDAK pernah final: balasan kembali ke antrean dan dicoba terus sampai terkirim
//                 (jeda RETRY_DELAY_SEC × percobaan, maks. MAX_DELAY_SEC). Anti-dobel ada di chat_outbox_claim (032):
//                 balasan yang ternyata sudah muncul di chat Itemku langsung ditandai Terkirim.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";
import { signedUrl, type ChatFile } from "@/lib/chatMedia";

export const dynamic = "force-dynamic";

const RETRY_DELAY_SEC = 15;
const MAX_DELAY_SEC = 60;

export async function GET(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (new URL(req.url).searchParams.get("peek")) {
    const { count, error } = await supabaseAdmin
      .from("chat_outbox")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or(`next_try_at.is.null,next_try_at.lte.${new Date().toISOString()}`);     // yang masih jeda tidak dihitung
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true, pending: count || 0 });
  }
  const { data, error } = await supabaseAdmin.rpc("chat_outbox_claim", { p_limit: 5 });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  const items = await Promise.all(
    ((data || []) as { files?: ChatFile[] | null }[]).map(async (it) => ({
      ...it,
      files: await Promise.all(
        (Array.isArray(it.files) ? it.files : []).map(async (f) => ({ ...f, url: await signedUrl(f.path, 900) })),
      ),
    })),
  );
  return NextResponse.json({ success: true, items });
}

export async function POST(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const status = body.status === "sent" ? "sent" : body.status === "failed" ? "failed" : body.status === "retry" ? "retry" : null;
  if (!Number.isSafeInteger(id) || !status) {
    return NextResponse.json({ success: false, message: "id / status tidak valid" }, { status: 400 });
  }
  if (status === "retry") {
    const { error } = await supabaseAdmin
      .from("chat_outbox")
      .update({ status: "pending", claimed_at: null })
      .eq("id", id)
      .eq("status", "sending");
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }
  if (status === "failed") {
    const { data: row } = await supabaseAdmin.from("chat_outbox").select("attempts").eq("id", id).maybeSingle();
    const attempts = row?.attempts ?? 1;
    {
      const { error } = await supabaseAdmin
        .from("chat_outbox")
        .update({
          status: "pending",
          claimed_at: null,
          attempts: attempts + 1,
          next_try_at: new Date(Date.now() + Math.min(RETRY_DELAY_SEC * attempts, MAX_DELAY_SEC) * 1000).toISOString(),
          error: body.error ? String(body.error).slice(0, 300) : null,           // alasan percobaan sebelumnya
        })
        .eq("id", id)
        .eq("status", "sending");
      if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      return NextResponse.json({ success: true, retry: attempts + 1 });
    }
  }
  const { error } = await supabaseAdmin
    .from("chat_outbox")
    .update({
      status,
      method: body.method === "fast" || body.method === "ui" ? body.method : null,
      error: body.error ? String(body.error).slice(0, 300) : null,
      timetoken: body.timetoken ? String(body.timetoken).replace(/\D/g, "").slice(0, 20) : null,
      done_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "sending");
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
