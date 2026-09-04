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

    let message = "🔔 *My Task Manager — Daily Reminder*\n\n";

    if (!tasks || tasks.length === 0) {
      message += "🎉 Tidak ada task yang belum selesai!\n\n";
      message += "Semua task sudah beres. Mantap! 💪";
    } else {
      message += `📋 *${tasks.length} task belum selesai:*\n\n`;

      for (const task of tasks) {
        const deadline = new Date(
          task.deadline + "T00:00:00"
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diff =
          Math.ceil(
            (deadline.getTime() - today.getTime()) /
              (1000 * 60 * 60 * 24)
          );

        let status = "";

        if (diff < 0) {
          status = "🔴 TERLAMBAT";
        } else if (diff === 0) {
          status = "🔥 HARI INI";
        } else if (diff === 1) {
          status = "🟠 BESOK";
        } else {
          status = `🟢 ${diff} hari lagi`;
        }

        message += `*${task.title}*\n`;
        message += `📅 Deadline: ${task.deadline}\n`;
        message += `⏰ Status: ${status}\n`;

        if (task.priority) {
          message += `⚡ Prioritas: ${task.priority}\n`;
        }

        if (task.category) {
          message += `📁 Kategori: ${task.category}\n`;
        }

        message += "\n";
      }

      message += `📊 *Total belum selesai: ${tasks.length}*`;
    }

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
          "Gagal mengirim pesan Telegram."
      );
    }

    return NextResponse.json({
      success: true,
      message: "Telegram reminder berhasil dikirim.",
      totalTasks: tasks?.length || 0,
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