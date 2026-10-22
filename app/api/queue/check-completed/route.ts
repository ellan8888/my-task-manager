// app/api/queue/check-completed/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⭐ Helper: Convert target_unit ke angka asli
function parseRealTarget(targetCount: number | null, targetUnit: string | null): number {
  let realTarget = targetCount || 1;
  
  if (targetUnit && targetUnit !== "Joki") {
    const match = targetUnit.match(/^(\d+(?:\.\d+)?)([TBMK]?)$/i);
    if (match) {
      const num = parseFloat(match[1]);
      const suffix = match[2].toUpperCase();
      const multiplier =
        suffix === "T" ? 1e12 :
        suffix === "B" ? 1e9 :
        suffix === "M" ? 1e6 :
        suffix === "K" ? 1e3 : 1;
      realTarget = num * multiplier;
    }
  }
  
  return realTarget;
}

export async function POST() {
  try {
    const now = new Date().toISOString();
    const completedIds: string[] = [];

    // 1. Cek COUNTDOWN ORDER
    const { data: expiredCountdown, error: countdownError } = await supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("queue_status", "processing")
      .eq("completed", false)
      .not("estimated_end_at", "is", null)
      .lte("estimated_end_at", now);

    if (countdownError) console.error("[CheckCompleted] Countdown error:", countdownError);

    if (expiredCountdown && expiredCountdown.length > 0) {
      const countdownIds = expiredCountdown.map((o) => o.order_id);
      await supabaseAdmin
        .from("joki_orders")
        .update({ queue_status: "completed" })
        .in("order_id", countdownIds);
        
      completedIds.push(...countdownIds);
    }

    // 2. Cek PROGRESS ORDER
    const { data: processingProgress, error: progressError } = await supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("queue_status", "processing")
      .eq("completed", false)
      .eq("order_type", "progress");

    if (progressError) console.error("[CheckCompleted] Progress error:", progressError);

    if (processingProgress && processingProgress.length > 0) {
      const reachedIds: string[] = [];

      for (const order of processingProgress) {
        const progressCount = order.progress_count || 0;
        const realTarget = parseRealTarget(order.target_count, order.target_unit);

        // ⭐ FIX: Jangan sampai target 0 atau negatif dianggap selesai!
        // Pastikan target > 0 dan progress beneran nyampe target.
        if (realTarget > 0 && progressCount > 0 && progressCount >= realTarget) {
          console.log(`[CheckCompleted] 🎯 Target reached: ${order.order_id} (${progressCount} >= ${realTarget})`);
          reachedIds.push(order.order_id);
        }
      }

      if (reachedIds.length > 0) {
        await supabaseAdmin
          .from("joki_orders")
          .update({ queue_status: "completed" })
          .in("order_id", reachedIds);
          
        completedIds.push(...reachedIds);
      }
    }

    // 3. Promote antrian kalau ada yang selesai
    if (completedIds.length > 0) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      fetch(`${baseUrl}/api/queue/promote`, { method: "POST" }).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      completed: completedIds.length,
      order_ids: completedIds,
    });
  } catch (error: any) {
    console.error("[CheckCompleted] Fatal error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}