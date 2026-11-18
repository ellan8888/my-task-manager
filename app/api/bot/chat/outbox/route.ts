// app/api/bot/chat/outbox/route.ts — antrean balasan chat untuk bot (login_once), header x-bot-api-key
//   GET  → { items: [{ id, conversation_id, text, created_by, order_id }] }
//          diambil atomik (status → sending) lewat fungsi SQL chat_outbox_claim; yang > 30 menit kedaluwarsa
//   POST { id, status: "sent"|"failed", method?, error?, timetoken? } → hasil pengiriman
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBotRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin.rpc("chat_outbox_claim", { p_limit: 5 });
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, items: data || [] });
}

export async function POST(req: Request) {
  if (!isBotRequest(req)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = Number(body.id);
  const status = body.status === "sent" ? "sent" : body.status === "failed" ? "failed" : null;
  if (!Number.isSafeInteger(id) || !status) {
    return NextResponse.json({ success: false, message: "id / status tidak valid" }, { status: 400 });
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
