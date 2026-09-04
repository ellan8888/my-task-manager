import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json(
        {
          success: false,
          error: "Telegram environment variables belum tersedia.",
        },
        { status: 500 }
      );
    }

    // =========================
    // TANGGAL HARI INI WIB
    // =========================

    const now = new Date();

    const jakartaParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const getPart = (type: string) =>
      jakartaParts.find((part) => part.type === type)?.value || "";

    const today = `${getPart("year")}-${getPart(
      "month"
    )}-${getPart("day")}`;

    // =========================
    // CEK APAKAH SUDAH TERKIRIM HARI INI
    // =========================

    const { data: existingLog, error: logCheckError } =
      await supabaseAdmin
        .from("telegram_daily_log")
        .select("id")
        .eq("sent_date", today)
        .maybeSingle();

    if (logCheckError) {
      throw logCheckError;
    }

    if (existingLog) {
      return NextResponse.json({
        success: true,
        sent: false,
        message: "Telegram reminder hari ini sudah dikirim.",
        date: today,
      });
    }

    // =========================
    // AMBIL TASK BELUM SELESAI
    // =========================

    const { data: tasks, error: taskError } =
      await supabaseAdmin
        .from("tasks")
        .select("*")
        .eq("completed", false)
        .order("deadline", { ascending: true });

    if (taskError) {
      throw taskError;
    }

    // =========================
    // KELOMPOKKAN TASK
    // =========================

    const overdue: any[] = [];
    const todayTasks: any[] = [];
    const tomorrow: any[] = [];
    const upcoming: any[] = [];

    const todayDate = new Date(`${today}T00:00:00`);

    for (const task of tasks || []) {
      const deadline = new Date(
        `${task.deadline}T00:00:00`
      );

      const diff = Math.round(
        (deadline.getTime() - todayDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );

      if (diff < 0) {
        overdue.push(task);
      } else if (diff === 0) {
        todayTasks.push(task);
      } else if (diff === 1) {
        tomorrow.push(task);
      } else {
        upcoming.push(task);
      }
    }

    // =========================
    // PRIORITAS
    // =========================

    const priorityIcon = (priority: string) => {
      switch (priority?.toLowerCase()) {
        case "high":
          return "🔴";
        case "medium":
          return "🟡";
        case "low":
          return "🟢";
        default:
          return "⚪";
      }
    };

    // =========================
    // FORMAT TASK
    // =========================

    const formatTask = (task: any, showDeadline = true) => {
      let text = `${priorityIcon(task.priority)} *${task.title}*\n`;

      if (showDeadline) {
        text += `   📅 ${task.deadline}\n`;
      }

      if (task.category) {
        text += `   📁 ${task.category}\n`;
      }

      return text + "\n";
    };

    // =========================
    // BUAT PESAN
    // =========================

    let message =
      "🔔 *MY TASK MANAGER*\n" +
      "━━━━━━━━━━━━━━━━━━\n\n";

    message += `📅 *${today}*\n\n`;

    if (overdue.length > 0) {
      message += `🔴 *TERLAMBAT — ${overdue.length}*\n\n`;

      for (const task of overdue) {
        message += formatTask(task);
      }
    }

    if (todayTasks.length > 0) {
      message += `🔥 *HARI INI — ${todayTasks.length}*\n\n`;

      for (const task of todayTasks) {
        message += formatTask(task, false);
      }
    }

    if (tomorrow.length > 0) {
      message += `🟠 *BESOK — ${tomorrow.length}*\n\n`;

      for (const task of tomorrow) {
        message += formatTask(task);
      }
    }

    if (upcoming.length > 0) {
      message += `📅 *MENDATANG — ${upcoming.length}*\n\n`;

      for (const task of upcoming) {
        message += formatTask(task);
      }
    }

    if (!tasks || tasks.length === 0) {
      message +=
        "🎉 *SEMUA TASK SUDAH SELESAI!*\n\n" +
        "Tidak ada task yang belum selesai. Mantap! 💪";
    } else {
      message +=
        "━━━━━━━━━━━━━━━━━━\n" +
        `📊 *TOTAL BELUM SELESAI: ${tasks.length} TASK*\n\n` +
        "💪 Semangat menyelesaikannya!";
    }

    // =========================
    // KIRIM KE TELEGRAM
    // =========================

    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

    const telegramResult = await telegramResponse.json();

    if (!telegramResponse.ok) {
      throw new Error(
        telegramResult.description ||
          "Telegram gagal mengirim pesan."
      );
    }

    // =========================
    // CATAT BAHWA HARI INI SUDAH TERKIRIM
    // =========================

    const { error: insertLogError } =
      await supabaseAdmin
        .from("telegram_daily_log")
        .insert({
          sent_date: today,
        });

    if (insertLogError) {
      throw insertLogError;
    }

    return NextResponse.json({
      success: true,
      sent: true,
      date: today,
      totalTasks: tasks?.length || 0,
      overdue: overdue.length,
      today: todayTasks.length,
      tomorrow: tomorrow.length,
      upcoming: upcoming.length,
    });
  } catch (error: any) {
    console.error("❌ Telegram error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error.message ||
          "Gagal mengirim Telegram reminder.",
      },
      { status: 500 }
    );
  }
}