// app/api/bot/chat/outbox/route.ts — antrean balasan chat untuk bot (login_once), header x-bot-api-key
//   GET  → { items: [{ id, conversation_id, text, created_by, order_id }] }
//          diambil atomik (status → sending) lewat fungsi SQL chat_outbox_claim; yang > 30 menit kedaluwarsa
//   GET ?peek=1 → { pending: n } — hanya menghitung (tidak mengambil); dipakai thread bot tiap beberapa detik
//   POST { id, status: "sent"|"failed"|"retry", method?, error?, timetoken? } → hasil pengiriman
//        retry = bot belum bisa mengirim di sela langkah lain → kembali ke antrean (diambil lagi di loop biasa)
//        failed = otomatis dicoba ulang sampai MAX_ATTEMPTS (jeda RETRY_DELAY_SEC × percobaan); baru benar-benar
//                 "Gagal" setelah percobaan terakhir. Staff tidak perlu menulis ulang.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_SEC = 15;

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
  return NextResponse.json({ success: true, items: data || [] });
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
    if (attempts < MAX_ATTEMPTS) {
      const { error } = await supabaseAdmin
        .from("chat_outbox")
        .update({
          status: "pending",
          claimed_at: null,
          attempts: attempts + 1,
          next_try_at: new Date(Date.now() + RETRY_DELAY_SEC * attempts * 1000).toISOString(),
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
