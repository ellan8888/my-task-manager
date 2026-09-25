import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const OFFLINE_THRESHOLD_SECONDS = 300;
const NOTIF_THROTTLE_MINUTES = 30;
const NOTIF_TARGET = "ellan";

export async function GET(req: Request) {
  // === 1. Cek auth ===
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // === 2. Cek heartbeat terakhir ===
  const { data, error } = await supabaseAdmin
    .from("bot_heartbeats")
    .select("bot_name, last_seen, status")
    .eq("bot_name", "itemku-bot")
    .single();

  if (error || !data) {
    console.error("[Check Bot] Heartbeat nggak ketemu:", error);
    return NextResponse.json(
      { success: false, error: "Heartbeat nggak ketemu" },
      { status: 404 }
    );
  }

  const lastSeen = new Date(data.last_seen).getTime();
  const diffSeconds = Math.floor((Date.now() - lastSeen) / 1000);
  const isOffline = diffSeconds > OFFLINE_THRESHOLD_SECONDS;

  console.log(
    `[Check Bot] Last seen ${diffSeconds}s ago — isOffline=${isOffline}`
  );

  // === 3. Kalau online → return early ===
  if (!isOffline) {
    return NextResponse.json({
      success: true,
      isOnline: true,
      diffSeconds,
      message: "Bot online",
    });
  }

  // === 4. Cek throttle ===
  const { data: lastNotif } = await supabaseAdmin
    .from("bot_offline_notifications")
    .select("id, sent_at")
    .eq("bot_name", "itemku-bot")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastNotif) {
    const lastNotifTime = new Date(lastNotif.sent_at).getTime();
    const notifDiffMinutes = Math.floor((Date.now() - lastNotifTime) / 60000);

    if (notifDiffMinutes < NOTIF_THROTTLE_MINUTES) {
      return NextResponse.json({
        success: true,
        isOnline: false,
        diffSeconds,
        message: `Skip — notif udah dikirim ${notifDiffMinutes} menit lalu`,
      });
    }
  }

  // === 5. Kirim push notif ===
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://my-task-manager-self.vercel.app";

  const diffMinutes = Math.floor(diffSeconds / 60);

  try {
    const pushRes = await fetch(`${baseUrl}/api/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: NOTIF_TARGET,
        title: "🔴 Bot Offline!",
        body: `Bot itemku berhenti ${diffMinutes} menit lalu.`,
        url: "/",
      }),
    });

    await pushRes.json();

    await supabaseAdmin
      .from("bot_offline_notifications")
      .insert({
        bot_name: "itemku-bot",
        sent_at: new Date().toISOString(),
        diff_seconds: diffSeconds,
      });

    console.log(`[Check Bot] ✅ Notif terkirim ke ${NOTIF_TARGET}`);
  } catch (err) {
    console.error("[Check Bot] Gagal kirim push:", err);
    return NextResponse.json(
      { success: false, error: "Gagal kirim push notif" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    isOnline: false,
    diffSeconds,
    notified: true,
    target: NOTIF_TARGET,
  });
}