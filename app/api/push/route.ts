// app/api/push/route.ts — kirim notifikasi (DIKUNCI)
//
//   Bot (header x-bot-api-key)  → boleh kirim ke user mana pun / semua
//   Superadmin (login)          → boleh kirim ke user mana pun / semua
//   User lain (login)           → hanya ke dirinya sendiri (tombol "Tes notifikasi")
//
// Body: { username?, title?, body?, url?, kind?, test? }
//   tanpa username: bot/superadmin → semua user; user biasa → dirinya sendiri
import { NextRequest, NextResponse } from "next/server";
import { getSession, isSuperadmin } from "@/lib/auth";
import { notify, NOTIFY_KINDS, type NotifyKind } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isBot = (req: NextRequest) => {
  const key = process.env.BOT_API_KEY;
  return !!key && req.headers.get("x-bot-api-key") === key;
};

export async function POST(req: NextRequest) {
  const bot = isBot(req);
  const session = bot ? null : getSession(req);
  if (!bot && !session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const b = (await req.json().catch(() => ({}))) as {
    username?: string;
    title?: string;
    body?: string;
    url?: string;
    kind?: string;
    test?: boolean;
  };
  const privileged = bot || isSuperadmin(session);
  const self = session?.username?.toLowerCase();

  let to: string | "all";
  if (b.test || !privileged) {
    if (!self) return NextResponse.json({ success: false, message: "Target tidak valid" }, { status: 400 });
    if (b.username && b.username.toLowerCase() !== self && !privileged) {
      return NextResponse.json({ success: false, message: "Hanya boleh mengirim ke diri sendiri" }, { status: 403 });
    }
    to = self;
  } else {
    to = b.username ? b.username : "all";
  }

  const test = b.test || (!privileged && !b.title);
  const result = await notify({
    to,
    title: b.title || (test ? "Tes notifikasi" : "My Task Manager"),
    body: b.body || (test ? "Notifikasi di perangkat ini sudah aktif." : ""),
    url: b.url || "/",
    kind: NOTIFY_KINDS.includes(b.kind as NotifyKind) ? (b.kind as NotifyKind) : undefined,
    force: test,
  });

  return NextResponse.json({
    success: true,
    target: to,
    sent: result.sent,
    failed: result.failed,
    skipped: result.skipped,
    stored: result.stored,
    message: result.sent === 0 && !result.skipped ? "Belum ada perangkat yang aktif untuk target ini" : undefined,
  });
}
