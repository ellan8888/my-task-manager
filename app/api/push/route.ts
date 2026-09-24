import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error(
    "VAPID keys belum tersedia di environment variables."
  );
}

webpush.setVapidDetails(
  "mailto:admin@example.com",
  vapidPublicKey,
  vapidPrivateKey
);

// ⭐ Helper: cek subscription invalid
function isInvalidSubscription(error: any): boolean {
  return (
    error.statusCode === 400 ||
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.statusCode === 404 ||
    error.statusCode === 410
  );
}

export async function POST(req: NextRequest) {
  try {
    // ⭐ Parse body (opsional — kalau nggak ada, fallback ke default)
    let body: {
      username?: string;
      title?: string;
      body?: string;
      url?: string;
    } = {};

    try {
      body = await req.json();
    } catch {
      // Body kosong / bukan JSON → pakai default
      body = {};
    }

    const targetUsername = body.username;   // ⭐ filter per user (opsional)
    const title = body.title || "🔔 My Task Manager";
    const notifBody = body.body || "Push notification berhasil! 🎉";
    const url = body.url || "/";

    console.log(
      `[Push] Target: ${targetUsername || "SEMUA"} | Title: "${title}"`
    );

    // ⭐ Query subscription — filter per username kalau di-set
    let query = supabaseAdmin
      .from("push_subscriptions")
      .select("*");

    if (targetUsername) {
      query = query.eq("username", targetUsername);
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error("❌ Gagal mengambil subscriptions:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: targetUsername
          ? `User "${targetUsername}" belum punya subscription.`
          : "Belum ada push subscription.",
        sent: 0,
      });
    }

    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: "/icon-192.png",
      url,                     // ⭐ biar bisa redirect pas klik notif
      data: { url },           // ⭐ fallback untuk SW
    });

    let successCount = 0;
    let failedCount = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          payload
        );

        successCount++;
      } catch (error: any) {
        console.error(
          `❌ Gagal kirim ke ${subscription.username || "?"} (${subscription.endpoint.slice(0, 50)}):`,
          {
            statusCode: error.statusCode,
            body: error.body,
            message: error.message,
          }
        );

        failedCount++;

        // ⭐ AUTO-DELETE subscription invalid
        if (isInvalidSubscription(error)) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);

          console.log(
            `🗑️ Subscription invalid dihapus: ${subscription.endpoint.slice(0, 50)}`
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      target: targetUsername || "all",
      sent: successCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error("❌ Push API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengirim push notification.",
      },
      { status: 500 }
    );
  }
}