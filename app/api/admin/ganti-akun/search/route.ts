// app/api/admin/ganti-akun/search/route.ts
// Cari akun yang SUDAH LAKU (calon akun bermasalah) berdasarkan username atau nomor order.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { cleanOrderId, isEllan } from "@/lib/replacements";

export const dynamic = "force-dynamic";

type IncomeRow = {
  order_id: string;
  roblox_username: string | null;
  amount: number | null;
  joki_name: string | null;
  completed_at: string | null;
  buyer_name: string | null;
  product_title: string | null;
};

export async function GET(request: Request) {
  const session = getSession(request);
  if (!isEllan(session)) {
    return NextResponse.json({ success: false, message: "Khusus Ellan" }, { status: 403 });
  }

  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 3) return NextResponse.json({ success: true, data: [] });

  try {
    const isOrder = /^OD\s*\d{4,}/i.test(q);
    let incomes: IncomeRow[] = [];
    let usernames: string[] = [];

    if (isOrder) {
      const { data, error } = await supabaseAdmin
        .from("income_log")
        .select("order_id, roblox_username, amount, joki_name, completed_at, buyer_name, product_title")
        .ilike("order_id", `%${cleanOrderId(q).replace(/\s/g, "")}%`)
        .limit(20);
      if (error) throw error;
      incomes = data || [];
      usernames = incomes.map((r) => r.roblox_username).filter((u): u is string => !!u);
    } else {
      const { data, error } = await supabaseAdmin
        .from("accounts_stock")
        .select("username")
        .eq("logged_out", true)
        .ilike("username", `%${q}%`)
        .limit(20);
      if (error) throw error;
      usernames = (data || []).map((r) => r.username);
      if (usernames.length) {
        const { data: inc, error: incErr } = await supabaseAdmin
          .from("income_log")
          .select("order_id, roblox_username, amount, joki_name, completed_at, buyer_name, product_title")
          .in("roblox_username", usernames);
        if (incErr) throw incErr;
        incomes = inc || [];
      }
    }

    if (!usernames.length) return NextResponse.json({ success: true, data: [] });

    const { data: stock, error: stockErr } = await supabaseAdmin
      .from("accounts_stock")
      .select("username, kategori, added_by, logged_out, logged_out_at")
      .in("username", usernames)
      .eq("logged_out", true);
    if (stockErr) throw stockErr;

    // Penggantian yang masih berjalan untuk akun ini
    const { data: active } = await supabaseAdmin
      .from("account_replacements")
      .select("old_username, status")
      .in("old_username", usernames)
      .in("status", ["pending", "processing", "failed", "finalize_failed"]);
    const activeSet = new Set((active || []).map((r) => r.old_username.toLowerCase()));

    const result = (stock || []).map((acc) => {
      const inc = incomes
        .filter((r) => r.roblox_username === acc.username)
        .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""))[0];
      return {
        username: acc.username,
        kategori: acc.kategori,
        added_by: acc.added_by,
        sold_at: inc?.completed_at || acc.logged_out_at,
        order_id: inc?.order_id || null,
        income: inc?.amount ?? null,
        buyer_name: inc?.buyer_name || null,
        product_title: inc?.product_title || null,
        has_active_replacement: activeSet.has(acc.username.toLowerCase()),
      };
    });

    result.sort((a, b) => (b.sold_at || "").localeCompare(a.sold_at || ""));
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (err as { message?: string })?.message || "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
