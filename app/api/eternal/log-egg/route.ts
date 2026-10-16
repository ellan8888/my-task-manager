// app/api/eternal/log-egg/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    const body = await req.json();
    const {
      roblox_username,
      egg_name,
      rarity,
      area,
      size,
      weight,
      earns,
      discord_message_id,
      discord_channel_id,
    } = body;

    if (!roblox_username || !egg_name || !rarity) {
      return NextResponse.json(
        { success: false, message: "roblox_username, egg_name, rarity wajib" },
        { status: 400 }
      );
    }

    // 1. Cari order aktif berdasarkan roblox_username
        // ⭐ 1. Cari SEMUA order progress aktif untuk username ini
    const { data: orders, error: fetchErr } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("roblox_username", roblox_username)
      .eq("order_type", "progress")
      .or("completed.is.null,completed.eq.false")
      .order("created_at", { ascending: true });

    if (fetchErr) {
      return NextResponse.json(
        { success: false, message: fetchErr.message },
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      await supabase.from("eternal_egg_logs").insert({
        order_id: null,
        roblox_username,
        egg_name,
        rarity: rarity.toLowerCase(),
        area,
        size,
        weight,
        earns,
        counted: false,
        discord_message_id,
        discord_channel_id,
      });

      return NextResponse.json({
        success: true,
        matched: false,
        message: "Egg di-log, tapi nggak ada order aktif untuk user ini",
      });
    }

        // ⭐ 2. MATCHING — bedain target vs bonus
    const eggRarity = rarity.toLowerCase();

    // Helper: ambil counted rarities (target)
    const getCountedRarities = (order: any): string[] => {
      const cr = order.counted_rarities;
      if (Array.isArray(cr) && cr.length > 0) {
        return cr.map((r: string) => r.toLowerCase());
      }
      return order.progress_keyword
        ? [order.progress_keyword.toLowerCase()]
        : [];
    };

    // Helper: ambil bonus rarities
    const getBonusRarities = (order: any): string[] => {
      const br = order.bonus_rarities;
      if (Array.isArray(br) && br.length > 0) {
        return br.map((r: string) => r.toLowerCase());
      }
      return [];
    };

    // ⭐ FILTER: cari order yang egg rarity-nya = TARGET atau BONUS
    const candidates = orders
      .map((o) => {
        const counted = getCountedRarities(o);
        const bonus = getBonusRarities(o);
        const isTarget = counted.includes(eggRarity);
        const isBonus = bonus.includes(eggRarity);
        const exact = (o.progress_keyword || "").toLowerCase() === eggRarity;
        return { order: o, isTarget, isBonus, exact };
      })
      .filter((c) => c.isTarget || c.isBonus)
      .sort((a, b) => {
        // ⭐ Prioritas 1: target dulu (yang naikin progress)
        if (a.isTarget !== b.isTarget) return a.isTarget ? -1 : 1;
        // ⭐ Prioritas 2: exact match
        if (a.exact !== b.exact) return a.exact ? -1 : 1;
        // ⭐ Prioritas 3: FIFO
        const aTime = new Date(a.order.created_at).getTime();
        const bTime = new Date(b.order.created_at).getTime();
        return aTime - bTime;
      });

    // Kalau nggak ada order yang cover rarity ini
    if (candidates.length === 0) {
      const fallbackOrder = orders[0];

      await supabase.from("eternal_egg_logs").insert({
        order_id: fallbackOrder.order_id,
        roblox_username,
        egg_name,
        rarity: eggRarity,
        area,
        size,
        weight,
        earns,
        counted: false,
        discord_message_id,
        discord_channel_id,
      });

      return NextResponse.json({
        success: true,
        matched: true,
        order_id: fallbackOrder.order_id,
        counted: false,
        is_bonus: false,
        message: `Egg rarity '${eggRarity}' nggak masuk target/bonus order mana pun`,
      });
    }

    // ⭐ 3. Pilih order menang
    const matched = candidates[0];
    const order = matched.order;
    const orderRarity = (order.progress_keyword || "").toLowerCase();

    // ⭐ isCounted = TRUE kalau egg ini TARGET (naikin progress)
    //    isCounted = FALSE kalau egg ini BONUS (cuma di-log)
    const isCounted = matched.isTarget;
    const isBonusEgg = matched.isBonus && !matched.isTarget;

    // 4. INSERT log egg (semua egg, counted atau nggak)
    const { error: insertErr } = await supabase
      .from("eternal_egg_logs")
      .insert({
        order_id: order.order_id,
        roblox_username,
        egg_name,
        rarity: eggRarity,
        area,
        size,
        weight,
        earns,
        counted: isCounted,
        discord_message_id,
        discord_channel_id,
      });

    if (insertErr) {
      return NextResponse.json(
        { success: false, message: insertErr.message },
        { status: 500 }
      );
    }

    // 5. Kalau counted → increment progress_count
        // 5. Kalau counted → increment progress_count
    let newProgress = order.progress_count || 0;
    let isComplete = false;

    if (isCounted) {
      newProgress = Math.min(
        (order.progress_count || 0) + 1,
        order.target_count || 0
      );

      const { error: updateErr } = await supabase
        .from("joki_orders")
        .update({ progress_count: newProgress })
        .eq("order_id", order.order_id);

      if (updateErr) {
        return NextResponse.json(
          { success: false, message: updateErr.message },
          { status: 500 }
        );
      }

      isComplete = newProgress >= (order.target_count || 0);

      // ⭐ KALAU COMPLETE → kirim webhook ke Discord #progress-complete
      if (isComplete) {
        const webhookUrl = process.env.PROGRESS_COMPLETE_WEBHOOK;
        if (webhookUrl) {
          try {
            await fetch(webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: `✅ **[PROGRESS COMPLETE]**`,
                embeds: [
                  {
                    title: "🎉 Order Progress SELESAI!",
                    color: 0x2ecc71,
                    fields: [
                      { name: "🆔 Order ID", value: order.order_id, inline: false },
                      { name: "👤 Roblox Username", value: order.roblox_username || "-", inline: true },
                      { name: "📦 Produk", value: order.product || "-", inline: false },
                      { name: "🎯 Target", value: `${newProgress}/${order.target_count} ${(order.progress_keyword || "egg").toUpperCase()}`, inline: false },
                    ],
                    footer: { text: "Eternal Order System" },
                    timestamp: new Date().toISOString(),
                  },
                ],
              }),
            });
            console.log(`[log-egg] Notif COMPLETE terkirim untuk ${order.order_id}`);
          } catch (err) {
            console.error("[log-egg] Gagal kirim webhook COMPLETE:", err);
          }
        } else {
          console.warn("[log-egg] PROGRESS_COMPLETE_WEBHOOK belum di-set");
        }
      }
    }

    // 6. Hitung summary per rarity (buat info)
    const { data: raritySummary } = await supabase
      .from("eternal_egg_logs")
      .select("rarity")
      .eq("order_id", order.order_id);

    const summary: Record<string, number> = {};
    for (const row of raritySummary || []) {
      summary[row.rarity] = (summary[row.rarity] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      matched: true,
      order_id: order.order_id,
      egg_name,
      egg_rarity: eggRarity,
      order_rarity: orderRarity,
      counted: isCounted,
      is_bonus: isBonusEgg,
      progress_count: newProgress,
      target_count: order.target_count,
      is_complete: isComplete,
      summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}