// app/api/bot/heartbeat/route.ts — bot melapor "masih hidup" (wajib header x-bot-api-key)
// Body: { bot_name, status?, message?, metadata?: { last_loop_at, started_at, idle_seconds, ... } }
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const key = process.env.BOT_API_KEY;
  if (!key || req.headers.get("x-bot-api-key") !== key) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  try {
    const { bot_name, status, message, metadata } = await req.json();
    if (!bot_name) return NextResponse.json({ success: false, message: "bot_name wajib" }, { status: 400 });

    const now = new Date().toISOString();
    const { error } = await supabaseAdmin.from("bot_status").upsert(
      {
        bot_name,
        status: status || "online",
        message: message || null,
        metadata: metadata || null,
        last_heartbeat: now,
        updated_at: now,
      },
      { onConflict: "bot_name" }
    );
    if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
