import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⭐ Helper verify signed cookie
function verifySession(
  signedValue: string,
  secret: string
): Record<string, any> | null {
  const parts = signedValue.split(".");
  if (parts.length < 2) return null;
  const signature = parts[parts.length - 1];
  const value = parts.slice(0, -1).join(".");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(value);
  if (signature !== hmac.digest("hex")) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { order_id, token } = body;

    if (!order_id) {
      return NextResponse.json(
        { success: false, message: "order_id wajib" },
        { status: 400 }
      );
    }

    // === AUTH: Admin (session valid) ATAU Buyer dengan token ===
    const cookieStore = await cookies();
    const session = cookieStore.get("auth_session")?.value;

    const parsedSession = session
      ? verifySession(session, process.env.AUTH_SECRET!)
      : null;
    const isAdmin = !!parsedSession;

    console.log(
      `[CompleteOrder] order=${order_id} | isAdmin=${isAdmin} | session=${parsedSession?.username || "none"}`
    );

    // Ambil order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("joki_orders")
      .select("*")
      .eq("order_id", order_id)
      .maybeSingle();

    // Kalau order nggak ketemu → idempotent
    if (fetchError || !order) {
      console.log(`[CompleteOrder] Order ${order_id} udah nggak ada (idempotent)`);
      return NextResponse.json({
        success: true,
        message: "Order sudah selesai",
        already_deleted: true,
      });
    }

    // Validasi auth
    if (!isAdmin) {
      if (!token || token !== order.confirm_token) {
        return NextResponse.json(
          { success: false, message: "Unauthorized" },
          { status: 401 }
        );
      }
      if (order.token_expires_at && new Date(order.token_expires_at) < new Date()) {
        return NextResponse.json(
          { success: false, message: "Token expired" },
          { status: 401 }
        );
      }
    }

    // === 1. CLOSE ROBLOX ===
    if (order.roblox_username) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/remove-account`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: order.roblox_username }),
          }
        );
      } catch (err) {
        console.error("[CompleteOrder] Gagal close roblox:", err);
      }
    }

    

    // === 2. HAPUS ETERNAL_EGG_LOGS — biar DB bersih ===
    // ⭐ Egg udah dikirim ke chat buyer, jadi aman dihapus sekarang
    try {
      const { error: eggDeleteError, count: eggCount } = await supabaseAdmin
        .from("eternal_egg_logs")
        .delete({ count: "exact" })
        .eq("order_id", order_id);

      if (eggDeleteError) {
        console.warn(
          `[CompleteOrder] Gagal hapus eternal_egg_logs untuk ${order_id}:`,
          eggDeleteError
        );
        // ⚠️ Jangan gagalin order — log aja
      } else {
        console.log(
          `[CompleteOrder] ✅ ${eggCount} eternal_egg_logs dihapus untuk ${order_id}`
        );
      }
    } catch (err) {
      console.error(
        `[CompleteOrder] Error hapus eternal_egg_logs untuk ${order_id}:`,
        err
      );
      // Tetap lanjut — jangan gagalin order
    }

    // === 3. DELETE CARD ===
    const { error: deleteError, count } = await supabaseAdmin
      .from("joki_orders")
      .delete({ count: "exact" })
      .eq("order_id", order_id);

    if (deleteError) {
      return NextResponse.json(
        { success: false, message: deleteError.message },
        { status: 500 }
      );
    }

    // Idempotent — kalau 0 row affected, berarti udah dihapus
    if (count === 0) {
      return NextResponse.json({
        success: true,
        message: "Order sudah dihapus",
        already_deleted: true,
      });
    }

    console.log(
      `[CompleteOrder] ✅ ${order_id} dihapus oleh ${isAdmin ? "Admin" : "Buyer (auto)"}`
    );

    // === 4. NOTIF DISCORD (opsional) ===
    const webhookUrl = process.env.DISCORD_WEBHOOK_ORDER || "";
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `✅ **Order Selesai & Card Dihapus**\nOrder: \`${order_id}\`\nBy: **${
            isAdmin ? "Admin" : "Buyer (auto)"
          }**`,
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: "Order selesai" });
  } catch (err: any) {
    console.error("[CompleteOrder] error:", err);
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}