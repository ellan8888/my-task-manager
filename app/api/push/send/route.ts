// app/api/push/send/route.ts — kirim pengumuman ke SEMUA user (khusus superadmin / bot)
import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const key = process.env.BOT_API_KEY;
  const bot = !!key && req.headers.get("x-bot-api-key") === key;
  if (!bot && !isSuperadmin(getSession(req))) {
    return NextResponse.json({ success: false, message: "Khusus owner" }, { status: 403 });
  }
  const { title, body, url } = await req.json().catch(() => ({}));
  if (!title || !body) {
    return NextResponse.json({ success: false, message: "Title & body wajib" }, { status: 400 });
  }
  const r = await notify({ to: "all", title, body, url: url || "/admin", kind: "sistem" });
  return NextResponse.json({ success: true, sent: r.sent, failed: r.failed });
}
