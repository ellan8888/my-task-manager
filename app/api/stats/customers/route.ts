// app/api/stats/customers/route.ts — Top Customers
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession, isSuperadmin, startOfMonthWIB } from "@/lib/auth";

type Row = {
  buyer_name: string | null;
  amount: number | null;
  order_id: string | null;
  completed_at: string | null;
  created_at: string | null;
};

type Grouped = {
  buyer_name: string;
  total_amount: number;
  order_count: number;
  first_order: string;
  last_order: string;
  order_ids: string[];
};

const PAGE_SIZE = 1000; // batas default Supabase per request

export async function GET(request: Request) {
  try {
    // ⭐ 1. Wajib login
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") === "all" ? "all" : "month";
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10) || 10, 1), 100);

    // ⭐ 2. Ambil semua baris (paginasi, karena Supabase cuma kasih 1000/request)
    const rows: Row[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabaseAdmin
        .from("income_log")
        .select("buyer_name, amount, order_id, completed_at, created_at")
        .not("buyer_name", "is", null)
        .neq("buyer_name", "-")
        .neq("buyer_name", "")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (period === "month") query = query.gte("completed_at", startOfMonthWIB().toISOString());
      // Superadmin lihat semua; user biasa cuma customer dari order miliknya
      if (!isSuperadmin(session)) query = query.eq("joki_name", session.username);

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
      }
      rows.push(...((data || []) as Row[]));
      if (!data || data.length < PAGE_SIZE) break;
    }

    // ⭐ 3. Group per pembeli (case-insensitive, 1 order dihitung sekali)
    const grouped: Record<string, Grouped> = {};
    const seenOrder = new Set<string>();

    for (const row of rows) {
      const name = (row.buyer_name || "").trim();
      if (!name || name === "-") continue;

      const key = name.toLowerCase();
      const when = row.completed_at || row.created_at || "";
      const g = (grouped[key] ??= {
        buyer_name: name,
        total_amount: 0,
        order_count: 0,
        first_order: when,
        last_order: when,
        order_ids: [],
      });

      g.total_amount += row.amount || 0;

      // Order akun bisa punya beberapa baris (1 per akun) → hitung order-nya sekali
      const orderKey = `${key}::${row.order_id ?? ""}`;
      if (!seenOrder.has(orderKey)) {
        seenOrder.add(orderKey);
        g.order_count += 1;
        if (row.order_id) g.order_ids.push(row.order_id);
      }

      if (when && when < g.first_order) g.first_order = when;
      if (when && when > g.last_order) g.last_order = when;
    }

    const all = Object.values(grouped);
    const customers = all.sort((a, b) => b.total_amount - a.total_amount).slice(0, limit);
    const repeatCustomers = all.filter((c) => c.order_count > 1).length;

    return NextResponse.json({
      success: true,
      customers,
      stats: {
        totalCustomers: all.length,
        repeatCustomers,
        repeatRate: all.length > 0 ? Math.round((repeatCustomers / all.length) * 100) : 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
