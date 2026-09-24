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

// ⭐ Helper: log detail error dari web-push
function logPushError(
  context: string,
  error: any,
  subscription: any
) {
  console.error(`❌ ${context}:`, {
    statusCode: error.statusCode,
    body: error.body,
    message: error.message,
    endpoint: subscription?.endpoint?.slice(0, 80),
  });
}

// ⭐ Helper: cek apakah subscription invalid
function isInvalidSubscription(error: any): boolean {
  return (
    error.statusCode === 400 ||
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.statusCode === 404 ||
    error.statusCode === 410
  );
}

// ⭐ Helper: hapus subscription invalid
async function deleteSubscription(endpoint: string) {
  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    console.error(`⚠️ Gagal hapus subscription: ${error.message}`);
  } else {
    console.log(
      `🗑️ Subscription invalid dihapus: ${endpoint.slice(0, 60)}...`
    );
  }
}

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
        "❌ Gagal mengambil subscriptions:",
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
      if (task.reminder_last_sent === today) {
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

      const reminderHour = reminderParts[0];
      const reminderMinute = reminderParts[1];

      const reminderMinutes =
        reminderHour * 60 + reminderMinute;

      const currentMinutes =
        currentHour * 60 + currentMinute;

      if (currentMinutes < reminderMinutes) {
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

            // ⭐ FILTER subscription milik user ini
      const userSubscriptions = subscriptions.filter(
        (sub) => sub.username === task.username
      );

      if (userSubscriptions.length === 0) {
        console.log(
          `⚠️ User ${task.username} nggak punya subscription — skip task "${task.title}"`
        );
        skipped++;
        continue;
      }

      console.log(
        `🚨 Mengirim reminder: ${task.title} → ${userSubscriptions.length} device (user: ${task.username})`
      );

      for (const subscription of userSubscriptions) {
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
        } catch (error: any) {
          logPushError(
            `Push task "${task.title}" gagal`,
            error,
            subscription
          );

          failed++;

          // ⭐ AUTO-DELETE subscription invalid
          if (isInvalidSubscription(error)) {
            await deleteSubscription(subscription.endpoint);
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
      if (!order.schedule_date || !order.schedule_time) {
        console.log(
          `⚠️ Data jadwal Jokian tidak lengkap: ${order.order_id}`
        );

        skipped++;
        continue;
      }

      const scheduleDate = order.schedule_date;

      // Ambil HH:mm saja
      const scheduleTime = order.schedule_time.slice(0, 5);

      const [scheduleHour, scheduleMinute] =
        scheduleTime.split(":").map(Number);

      const scheduleMinutes =
        scheduleHour * 60 + scheduleMinute;

      const currentMinutes =
        currentHour * 60 + currentMinute;

      console.log(
        `🎮 Cek Jokian ${order.order_id}: ` +
        `tanggal ${scheduleDate} ` +
        `jadwal ${scheduleTime} ` +
        `| sekarang ${today} ${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`
      );

      // Cek tanggal
      if (scheduleDate > today) {
        console.log(
          `⏳ Belum waktunya Jokian: ${order.order_id}`
        );

        skipped++;
        continue;
      }

      // Cek jam
      if (
        scheduleDate === today &&
        currentMinutes < scheduleMinutes
      ) {
        console.log(
          `⏳ Belum waktunya Jokian: ${order.order_id}`
        );

        skipped++;
        continue;
      }

      // =========================
      // JADWAL SUDAH TIBA
      // =========================

      console.log(
        `🚨 Mengirim reminder Jokian: ${order.order_id}`
      );

      const payload = JSON.stringify({
        title: "🎮 Waktunya Jokian!",
        body:
          `${order.product || "Jokian"} • ` +
          `Joki: ${order.joki_name || "-"} • ` +
          `Jam ${scheduleTime}`,
        icon: "/icon-192.png",
      });

            let orderNotificationSent = false;

      // ⭐ FILTER subscription milik joki ini
      const jokiSubscriptions = subscriptions.filter(
        (sub) => sub.username === order.joki_name
      );

      if (jokiSubscriptions.length === 0) {
        console.log(
          `⚠️ Joki ${order.joki_name} nggak punya subscription — skip order ${order.order_id}`
        );
        skipped++;
        continue;
      }

      console.log(
        `🚨 Mengirim reminder Jokian: ${order.order_id} → ${jokiSubscriptions.length} device (joki: ${order.joki_name})`
      );

      // =========================
      // KIRIM KE SUBSCRIPTION JOKI
      // =========================

      for (const subscription of jokiSubscriptions) {
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
          logPushError(
            `Push Jokian ${order.order_id} gagal`,
            error,
            subscription
          );

          failed++;

          // ⭐ AUTO-DELETE subscription invalid
          if (isInvalidSubscription(error)) {
            await deleteSubscription(subscription.endpoint);
          }
        }
      }

      // =========================
      // TANDAI REMINDER TERKIRIM
      // =========================

      if (orderNotificationSent) {
        const { error: updateError } =
          await supabaseAdmin
            .from("joki_orders")
            .update({
              reminder_sent: true,
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
      time: `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`,
      sent,
      skipped,
      failed,
      jokiSent,
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