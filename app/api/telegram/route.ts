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

    const { data: tasks, error } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("completed", false)
      .order("deadline", { ascending: true });

    if (error) {
      throw error;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdue: any[] = [];
    const todayTasks: any[] = [];
    const tomorrow: any[] = [];
    const upcoming: any[] = [];

    for (const task of tasks || []) {
      const deadline = new Date(
        task.deadline + "T00:00:00"
      );

      deadline.setHours(0, 0, 0, 0);

      const diff = Math.round(
        (deadline.getTime() - today.getTime()) /
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

    let message =
      "🔔 *MY TASK MANAGER*\n" +
      "━━━━━━━━━━━━━━━━━━\n\n";

    message += `📅 *${today.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}*\n\n`;

    if (overdue.length > 0) {
      message += "🔴 *TERLAMBAT*\n\n";

      for (const task of overdue) {
        message += `• *${task.title}*\n`;
        message += `  Deadline: ${task.deadline}\n`;

        if (task.priority) {
          message += `  Prioritas: ${task.priority}\n`;
        }

        message += "\n";
      }
    }

    if (todayTasks.length > 0) {
      message += "🔥 *HARI INI*\n\n";

      for (const task of todayTasks) {
        message += `• *${task.title}*\n`;

        if (task.priority) {
          message += `  Prioritas: ${task.priority}\n`;
        }

        if (task.category) {
          message += `  Kategori: ${task.category}\n`;
        }

        message += "\n";
      }
    }

    if (tomorrow.length > 0) {
      message += "🟠 *BESOK*\n\n";

      for (const task of tomorrow) {
        message += `• *${task.title}*\n`;
        message += `  Deadline: ${task.deadline}\n\n`;
      }
    }

    if (upcoming.length > 0) {
      message += "📅 *MENDATANG*\n\n";

      for (const task of upcoming) {
        message += `• *${task.title}*\n`;
        message += `  Deadline: ${task.deadline}\n\n`;
      }
    }

    if (!tasks || tasks.length === 0) {
      message +=
        "🎉 *SEMUA TASK SUDAH SELESAI!*\n\n" +
        "Tidak ada task yang perlu dikerjakan hari ini. Mantap! 💪";
    } else {
      message +=
        "━━━━━━━━━━━━━━━━━━\n" +
        `📊 *Total belum selesai: ${tasks.length} task*\n\n` +
        "Semangat menyelesaikannya! 💪🔥";
    }

    const response = await fetch(
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

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.description || "Telegram gagal mengirim pesan."
      );
    }

    return NextResponse.json({
      success: true,
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
        error: error.message || "Gagal mengirim Telegram.",
      },
      { status: 500 }
    );
  }
}