// app/api/redeem/request-transfer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { notify } from "@/lib/notify";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { proof_url, notes } = await request.json();
    // Identitas dari sesi login, bukan dari isi request
    const username = getSession(request)?.username;

    if (!username || !proof_url) {
      return NextResponse.json(
        { success: false, message: username ? "proof_url wajib" : "Silakan login dulu" },
        { status: 400 }
      );
    }

    const user = username.toLowerCase().trim();

    // Cek apakah user masih punya pending
    const { data: existing } = await supabaseAdmin
      .from("redeem_purchases")
      .select("id")
      .eq("username", user)
      .eq("status", "pending")
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Kamu masih punya request pending. Tunggu admin verify.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("redeem_purchases")
      .insert({
        username: user,
        amount: 20000,
        payment_method: "transfer",
        status: "pending",
        proof_url,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // ══════════════════════════════════════════════════════════
    // ⭐ PUSH NOTIF KE SEMUA SUPERADMIN
    // ══════════════════════════════════════════════════════════
    try {
      // Ambil semua superadmin aktif
      const { data: admins, error: adminsErr } = await supabaseAdmin
        .from("users")
        .select("username")
        .eq("role", "superadmin")
        .eq("is_active", true);

      if (adminsErr) {
        console.warn(
          "[request-transfer] Gagal ambil superadmin:",
          adminsErr.message
        );
      }

      // Fallback kalau query gagal / kosong
      const adminUsernames =
        admins && admins.length > 0
          ? admins.map((a) => a.username).filter(Boolean)
          : ["ellan"];

      console.log(
        `[request-transfer] Push ke ${adminUsernames.length} superadmin:`,
        adminUsernames
      );

      // Kirim ke semua superadmin sekaligus (riwayat + push)
      const r = await notify({
        to: adminUsernames,
        title: "Pending Transfer Baru!",
        body: `${user} — Rp 20.000${notes ? ` • "${notes}"` : ""}`,
        url: "/redeem",
        kind: "transfer",
      });
      console.log(`[request-transfer] Notif superadmin: sent=${r.sent}, failed=${r.failed}`);
    } catch (notifErr) {
      // ⚠️ Notif gagal ≠ request gagal — tetap return success
      console.error("[request-transfer] Gagal kirim push notif:", notifErr);
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}