import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const vapidPublicKey =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const vapidPrivateKey =
  process.env.VAPID_PRIVATE_KEY;

if (!vapidPublicKey || !vapidPrivateKey) {
  throw new Error(
    "VAPID keys belum tersedia."
  );
}

webpush.setVapidDetails(
  "mailto:admin@example.com",
  vapidPublicKey,
  vapidPrivateKey
);

export async function GET() {
  try {
    const now = new Date();

    // Waktu Indonesia Barat
    const jakartaTime = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).formatToParts(now);

    const getPart = (type: string) =>
      jakartaTime.find(
        (part) => part.type === type
      )?.value;

    const today =
      `${getPart("year")}-${getPart("month")}-${getPart("day")}`;

    const currentHour = Number(
      getPart("hour")
    );

    const currentMinute = Number(
      getPart("minute")
    );

    console.log(
      `🔍 Reminder check: ${today} ${currentHour}:${currentMinute}`
    );

    // =========================
    // AMBIL TASK
    // =========================

    const { data: tasks, error } =
      await supabaseAdmin
        .from("tasks")
        .select("*")
        .eq("completed", false)
        .not("reminder", "is", null);

    if (error) {
      console.error(
        "❌ Gagal mengambil tasks:",
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

        // =========================
    // AMBIL JADWAL JOKIAN
    // =========================

    const { data: jokiOrders, error: jokiError } =
      await supabaseAdmin
        .from("joki_orders")
        .select("*")
        .eq("completed", false)
.eq("schedule_date", today)
.eq("reminder_sent", false);

    if (jokiError) {
      console.error(
        "❌ Gagal mengambil jadwal Jokian:",
        jokiError
      );
    }

    if (
  (!tasks || tasks.length === 0) &&
  (!jokiOrders || jokiOrders.length === 0)
) {
  return NextResponse.json({
    success: true,
    message: "Tidak ada task atau jadwal Jokian.",
    sent: 0,
  });
}

    // =========================
    // AMBIL SUBSCRIPTIONS
    // =========================

    const { data: subscriptions, error: subError } =
      await supabaseAdmin
        .from("push_subscriptions")
        .select("*");

    if (subError) {
      console.error(
        "❌ Gagal mengambil subsgcriptions:",
        subError
      );

      return NextResponse.json(
        {
          success: false,
          error: subError.message,
        },
        { status: 500 }
      );
    }

    if (
      !subscriptions ||
      subscriptions.length === 0
    ) {
      return NextResponse.json({
        success: false,
        message:
          "Belum ada push subscription.",
        sent: 0,
      });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;
        let jokiSent = 0;

    // =========================
    // CEK SETIAP TASK
    // =========================

    for (const task of tasks) {
      if (!task.reminder) {
        continue;
      }

      // Deadline
      const deadline = task.deadline;

      // Kalau deadline sudah lewat
      if (today > deadline) {
        console.log(
          `⛔ Lewat deadline: ${task.title}`
        );

        skipped++;
        continue;
      }

      // Reminder hari ini sudah dikirim
      if (
        task.reminder_last_sent === today
      ) {
        console.log(
          `✅ Sudah dikirim hari ini: ${task.title}`
        );

        skipped++;
        continue;
      }

      // =========================
      // CEK JAM REMINDER
      // =========================

      const reminderParts =
        task.reminder
          .split(":")
          .map(Number);

      const reminderHour =
        reminderParts[0];

      const reminderMinute =
        reminderParts[1];

      const reminderMinutes =
        reminderHour * 60 +
        reminderMinute;

      const currentMinutes =
        currentHour * 60 +
        currentMinute;

      if (
        currentMinutes <
        reminderMinutes
      ) {
        console.log(
          `⏳ Belum waktunya: ${task.title}`
        );

        skipped++;
        continue;
      }

      // =========================
      // KIRIM PUSH
      // =========================

      const payload =
        JSON.stringify({
          title: `🔔 ${task.title}`,
          body: `Reminder harian • Deadline ${task.deadline}`,
          icon: "/icon-192.png",
        });

      console.log(
        `🚨 Mengirim reminder: ${task.title}`
      );

      for (const subscription of subscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint:
                subscription.endpoint,
              keys: {
                p256dh:
                  subscription.p256dh,
                auth:
                  subscription.auth,
              },
            },
            payload
          );

          sent++;
        } catch (error: any) {
          console.error(
            "❌ Push gagal:",
            error
          );

          failed++;

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

      // =========================
      // SIMPAN STATUS
      // =========================

      await supabaseAdmin
        .from("tasks")
        .update({
          reminder_last_sent: today,
        })
        .eq("id", task.id);
    }

          // =========================
// CEK JADWAL JOKIAN
// =========================

for (const order of jokiOrders || []) {
  if (!order.schedule_time) {
    continue;
  }

  // =========================
  // JAM JOKIAN
  // =========================

  const scheduleParts = order.schedule_time
    .slice(0, 5)
    .split(":")
    .map(Number);

  const scheduleHour = scheduleParts[0];
  const scheduleMinute = scheduleParts[1];

  const scheduleMinutes =
    scheduleHour * 60 + scheduleMinute;

  // =========================
  // JAM SEKARANG
  // =========================

  const currentMinutes =
    currentHour * 60 + currentMinute;

  console.log(
    `🎮 Cek Jokian ${order.order_id}: ` +
    `jadwal ${String(scheduleHour).padStart(2, "0")}:${String(scheduleMinute).padStart(2, "0")} ` +
    `| sekarang ${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`
  );

  // =========================
  // BELUM WAKTUNYA
  // =========================

  if (currentMinutes < scheduleMinutes) {
    console.log(
      `⏳ Belum waktunya Jokian: ${order.order_id}`
    );

    skipped++;
    continue;
  }

  // =========================
  // PAYLOAD NOTIFIKASI
  // =========================

  const payload = JSON.stringify({
    title: "🎮 Waktunya Jokian!",
    body: `${order.product || "Jokian"} • Joki: ${
      order.joki_name || "-"
    } • Jam ${order.schedule_time.slice(0, 5)}`,
    icon: "/icon-192.png",
  });

  console.log(
    `🚨 Mengirim reminder Jokian: ${order.order_id}`
  );

  let orderNotificationSent = false;

  // =========================
  // KIRIM KE SEMUA SUBSCRIPTION
  // =========================

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

      sent++;
      jokiSent++;

      orderNotificationSent = true;

      console.log(
        `✅ Notifikasi Jokian berhasil dikirim: ${order.order_id}`
      );
    } catch (error: any) {
      console.error(
        `❌ Push Jokian gagal untuk ${order.order_id}:`,
        error
      );

      failed++;

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

        console.log(
          "🗑️ Subscription tidak valid dihapus."
        );
      }
    }
  }

  // =========================
  // SIMPAN STATUS
  // =========================

  if (orderNotificationSent) {
    const { error: updateError } =
      await supabaseAdmin
        .from("joki_orders")
        .update({
          reminder_sent: true,
          completed: true,
          reminder_last_sent:
            new Date().toISOString(),
        })
        .eq("id", order.id);

    if (updateError) {
      console.error(
        `❌ Gagal update status Jokian ${order.order_id}:`,
        updateError
      );
    } else {
      console.log(
        `✅ Status Jokian diperbarui: ${order.order_id}`
      );
    }
  }
}
    

    return NextResponse.json({
      success: true,
      date: today,
      time: `${String(
        currentHour
      ).padStart(2, "0")}:${String(
        currentMinute
      ).padStart(2, "0")}`,
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    console.error(
      "❌ Reminder API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Gagal menjalankan reminder.",
      },
      { status: 500 }
    );
  }
}