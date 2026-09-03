import { NextResponse } from "next/server";
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

export async function POST() {
  try {
    const { data: subscriptions, error } =
      await supabaseAdmin
        .from("push_subscriptions")
        .select("*");

    if (error) {
      console.error(
        "❌ Gagal mengambil subscriptions:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: false,
        message: "Belum ada push subscription.",
      });
    }

    const payload = JSON.stringify({
      title: "🔔 My Task Manager",
      body: "Push notification berhasil! 🎉",
      icon: "/icon-192.png",
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
          "❌ Gagal mengirim push:",
          error
        );

        failedCount++;

        // Subscription sudah tidak valid
        if (
          error.statusCode === 404 ||
          error.statusCode === 410
        ) {
          await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq(
              "endpoint",
              subscription.endpoint
            );
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
    });
  } catch (error) {
    console.error(
      "❌ Push API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: "Gagal mengirim push notification.",
      },
      { status: 500 }
    );
  }
}