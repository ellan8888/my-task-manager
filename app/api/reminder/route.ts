import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notify } from "@/lib/notify";

// Kirim notifikasi lewat lib/notify → otomatis tersimpan di riwayat (ikon lonceng),
// ikut pengaturan bisu / jam tenang user, dan dikirim paralel ke semua perangkatnya.

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

      const r = await notify({
        to: task.username,
        title: task.title,
        body: `Reminder harian • Deadline ${task.deadline}`,
        url: "/",
        kind: "reminder",
      });

      if (!r.sent && !r.stored) {
        console.log(`⚠️ User ${task.username} belum punya perangkat — skip task "${task.title}"`);
        skipped++;
        continue;
      }
      sent += r.sent;
      failed += r.failed;

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
    // Untuk order COUNTDOWN, schedule_date + schedule_time = waktu countdown HABIS
    // (diisi bot saat jokian mulai, ikut berubah saat "Tambah Waktu").
    // Jadi notifikasi di sini = "jokian selesai", bukan "waktunya mulai jokian".
    // Order PROGRESS tidak punya waktu selesai (selesai saat target tercapai) → dilewati.

    for (const order of jokiOrders || []) {
      if (order.order_type === "progress") {
        skipped++;
        continue;
      }
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

      const productName = String(order.product || "Jokian").split("|")[0].trim() || "Jokian";
      const shortOrder = "#" + String(order.order_id || "").replace(/^OD0*/i, "");
      const r = await notify({
        to: order.joki_name || "",
        title: "Jokian Selesai",
        body: `${productName} • Order ${shortOrder} • Waktu habis jam ${scheduleTime} WIB`,
        url: "/joki",
        kind: "joki",
      });
      const orderNotificationSent = r.sent > 0 || r.stored > 0;

      if (!orderNotificationSent) {
        console.log(`⚠️ Joki ${order.joki_name} belum punya perangkat — skip order ${order.order_id}`);
        skipped++;
        continue;
      }
      sent += r.sent;
      jokiSent += r.sent;
      failed += r.failed;

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