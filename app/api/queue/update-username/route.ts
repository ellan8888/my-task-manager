import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, old_username, new_username } = body;

    if (!order_id || !new_username) {
      return NextResponse.json(
        { success: false, message: "order_id & new_username wajib" },
        { status: 400 }
      );
    }

    console.log(
      `[UpdateUsername] order=${order_id} | '${old_username}' → '${new_username}'`
    );

    // ⭐ 1. Update roblox_username di joki_orders
    const { error: updateErr } = await supabase
      .from("joki_orders")
      .update({ roblox_username: new_username })
      .eq("order_id", order_id);

    if (updateErr) {
      console.error("[UpdateUsername] Update error:", updateErr);
      return NextResponse.json(
        { success: false, message: updateErr.message },
        { status: 500 }
      );
    }

    // ⭐ 2. Cari egg lama dengan order_id = NULL & username lama
    //     Exact match — biar nggak salah claim
    let reclaimedCount = 0;

    if (old_username && old_username !== new_username) {
      console.log(
        `[UpdateUsername] Cari orphan egg untuk username lama: '${old_username}'`
      );

      const { data: orphanEggs, error: orphanErr } = await supabase
        .from("eternal_egg_logs")
        .select("id")
        .is("order_id", null)
        .eq("roblox_username", old_username); // ⭐ EXACT MATCH

      if (orphanErr) {
        console.error("[UpdateUsername] Query orphan error:", orphanErr);
      } else if (orphanEggs && orphanEggs.length > 0) {
        const eggIds = orphanEggs.map((e) => e.id);

        const { error: eggUpdateErr } = await supabase
          .from("eternal_egg_logs")
          .update({ order_id })
          .in("id", eggIds);

        if (!eggUpdateErr) {
          reclaimedCount = orphanEggs.length;
          console.log(
            `[UpdateUsername] ✅ ${reclaimedCount} egg lama di-reclaim`
          );
        } else {
          console.error("[UpdateUsername] Gagal reclaim egg:", eggUpdateErr);
        }
      } else {
        console.log(
          `[UpdateUsername] Nggak ada orphan egg untuk '${old_username}'`
        );
      }
    }

    // ⭐ 3. Hitung ulang progress_count
    const { count: newProgressCount } = await supabase
      .from("eternal_egg_logs")
      .select("*", { count: "exact", head: true })
      .eq("order_id", order_id)
      .eq("counted", true);

    // ⭐ 4. Update progress_count di joki_orders
    const { error: progressErr } = await supabase
      .from("joki_orders")
      .update({ progress_count: newProgressCount || 0 })
      .eq("order_id", order_id);

    if (progressErr) {
      console.error("[UpdateUsername] Gagal update progress:", progressErr);
    }

    console.log(
      `[UpdateUsername] ✅ Done. Progress: ${newProgressCount || 0}, Reclaimed: ${reclaimedCount}`
    );

    return NextResponse.json({
      success: true,
      order_id,
      new_username,
      reclaimed_eggs: reclaimedCount,
      progress_count: newProgressCount || 0,
    });
  } catch (err: any) {
    console.error("[UpdateUsername] error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}