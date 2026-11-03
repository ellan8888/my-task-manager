// app/api/bot/catat-ulang/route.ts — dipakai bot (header x-bot-api-key)
//   GET  → antrian "catat ulang pendapatan" order akun
//   POST → lapor progres/hasil { id, status: processing|done|failed, error?, result? }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const isBot = (request: Request) => {
  const key = process.env.BOT_API_KEY;
  return !!key && request.headers.get("x-bot-api-key") === key;
};

export async function GET(request: Request) {
  if (!isBot(request)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const stuckBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("income_reprocess_requests")
    .select("id, order_id, detail_url, attempts")
    .or(`status.eq.pending,and(status.eq.processing,updated_at.lt.${stuckBefore})`)
    .order("created_at", { ascending: true })
    .limit(3);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data || [] });
}

export async function POST(request: Request) {
  if (!isBot(request)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  const status = body.status as "processing" | "done" | "failed";
  if (!Number.isFinite(id) || !["processing", "done", "failed"].includes(status)) {
    return NextResponse.json({ success: false, message: "id dan status wajib" }, { status: 400 });
  }

  const { data: row } = await supabaseAdmin.from("income_reprocess_requests").select("attempts").eq("id", id).maybeSingle();
  if (!row) return NextResponse.json({ success: false, message: "Tidak ditemukan" }, { status: 404 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { status, updated_at: now };
  if (status === "processing") {
    update.attempts = (row.attempts || 0) + 1;
    update.error = null;
  }
  if (status === "failed") update.error = typeof body.error === "string" ? body.error.slice(0, 500) : "Bot gagal";
  if (status === "done") {
    update.done_at = now;
    update.error = null;
    update.result = typeof body.result === "string" ? body.result.slice(0, 500) : null;
  }

  const { error } = await supabaseAdmin.from("income_reprocess_requests").update(update).eq("id", id);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
