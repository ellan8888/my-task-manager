import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifySession(signedValue: string, secret: string) {
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

// ⭐ Helper: push notif ke user
async function sendPush(username: string, title: string, body: string, url: string) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://my-task-manager-self.vercel.app";

    await fetch(`${baseUrl}/api/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, title, body, url }),
    });
  } catch (e) {
    console.error("[Push] Gagal kirim:", e);
  }
}

// ══════════════════════════════════════════════════════
// GET — List withdrawals
// ══════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filterJoki = searchParams.get("joki_name");
    const filterStatus = searchParams.get("status");

    const cookieStore = await cookies();
    const session = cookieStore.get("auth_session")?.value;
    const parsed = session
      ? verifySession(session, process.env.AUTH_SECRET!)
      : null;

    if (!parsed) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    let query = supabaseAdmin
      .from("withdrawals")
      .select("*")
      .order("requested_at", { ascending: false });

    // User biasa → cuma liat milik sendiri
    if (parsed.role !== "superadmin") {
      query = query.eq("joki_name", parsed.username);
    } else if (filterJoki) {
      query = query.eq("joki_name", filterJoki);
    }

    if (filterStatus) {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Totals per joki
    const totals: Record<string, number> = {};          // approved
    const pendingTotals: Record<string, number> = {};   // pending

    for (const w of data || []) {
      if (w.status === "approved") {
        totals[w.joki_name] = (totals[w.joki_name] || 0) + w.amount;
      } else if (w.status === "pending") {
        pendingTotals[w.joki_name] =
          (pendingTotals[w.joki_name] || 0) + w.amount;
      }
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      totals,
      pendingTotals,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════
// POST — User request tarik
// ══════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("auth_session")?.value;
    const parsed = session
      ? verifySession(session, process.env.AUTH_SECRET!)
      : null;

    if (!parsed) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { amount, note, joki_name } = body;

    // User biasa → cuma bisa request untuk dirinya sendiri
    const targetJoki =
      parsed.role === "superadmin"
        ? (joki_name || parsed.username)
        : parsed.username;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, message: "Jumlah harus > 0" },
        { status: 400 }
      );
    }

    // ⭐ Validasi saldo cukup
    const { data: incomeData } = await supabaseAdmin
      .from("income_log")
      .select("amount")
      .eq("joki_name", targetJoki);

    const totalIncome = (incomeData || []).reduce(
      (sum, r) => sum + (r.amount || 0),
      0
    );

    const { data: withdrawalData } = await supabaseAdmin
      .from("withdrawals")
      .select("amount, status")
      .eq("joki_name", targetJoki);

    // Cuma approved & pending yang ngurangin saldo
    const totalWithdrawn = (withdrawalData || [])
      .filter((w) => w.status === "approved" || w.status === "pending")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const sisaSaldo = totalIncome - totalWithdrawn;

    if (amount > sisaSaldo) {
      return NextResponse.json(
        {
          success: false,
          message: `Saldo nggak cukup. Sisa: Rp ${sisaSaldo.toLocaleString("id-ID")}`,
        },
        { status: 400 }
      );
    }

    // ⭐ Insert request
    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .insert([
        {
          joki_name: targetJoki,
          amount,
          note: note || null,
          status: "pending",
          requested_by: parsed.username,
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // ⭐ Push notif ke superadmin (ellan)
    await sendPush(
    "ellan",
    `💰 ${targetJoki} Request Tarik`,
    `Rp ${amount.toLocaleString("id-ID")}${note ? ` • ${note}` : ""}`,
    "/admin"
    );

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════
// PATCH — Superadmin approve / reject
// ══════════════════════════════════════════════════════
export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("auth_session")?.value;
    const parsed = session
      ? verifySession(session, process.env.AUTH_SECRET!)
      : null;

    // ⭐ Cuma superadmin
    if (!parsed || parsed.role !== "superadmin") {
      return NextResponse.json(
        { success: false, message: "Cuma superadmin yang bisa approve" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { id, action, reject_reason, transfer_note } = body;

    if (!id || !action) {
      return NextResponse.json(
        { success: false, message: "id & action wajib" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, message: "action harus approve / reject" },
        { status: 400 }
      );
    }

    const updateData: any = {
      status: action === "approve" ? "approved" : "rejected",
      approved_at: new Date().toISOString(),
      approved_by: parsed.username,
    };

    if (action === "reject" && reject_reason) {
      updateData.reject_reason = reject_reason;
    }
    if (action === "approve" && transfer_note) {
      updateData.transfer_note = transfer_note;
    }

    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // ⭐ Push notif ke user
    if (data && data.joki_name) {
      if (action === "approve") {
        await sendPush(
          data.joki_name,
          "✅ Tarik Disetujui!",
          `Rp ${data.amount.toLocaleString("id-ID")} udah ditransfer${transfer_note ? ` • ${transfer_note}` : ""}`,
          "/admin"
        );
      } else {
        await sendPush(
          data.joki_name,
          "❌ Tarik Ditolak",
          `Rp ${data.amount.toLocaleString("id-ID")} • Alasan: ${reject_reason || "-"}`,
          "/admin"
        );
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}