// app/api/bot/status/route.ts — status bot itemku untuk tampilan My Task
import { NextResponse } from "next/server";
import { getBotStatus, humanDuration } from "@/lib/botStatus";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await getBotStatus();
    const diffSeconds = s.heartbeatAgeSec ?? 0;
    return NextResponse.json({
      success: true,
      state: s.state, // online | stuck | offline | unknown
      isOnline: s.isOnline,
      bot: s.lastHeartbeat ? { last_heartbeat: s.lastHeartbeat, last_loop_at: s.lastLoopAt, started_at: s.startedAt } : null,
      diffSeconds,
      diffMinutes: Math.floor(diffSeconds / 60),
      loopAgeSec: s.loopAgeSec,
      lastHeartbeatHuman: s.lastHeartbeat ? `${humanDuration(diffSeconds)} lalu` : "belum pernah",
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err instanceof Error ? err.message : "Error" }, { status: 500 });
  }
}
