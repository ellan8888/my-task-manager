import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month"; // "month" | "all"
    const limit = parseInt(searchParams.get("limit") || "10");

    // Tentukan filter tanggal
    let dateFilter: string | null = null;
    if (period === "month") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter = monthStart.toISOString();
    }

    // Query data
    let query = supabaseAdmin
      .from("income_log")
      .select("buyer_name, amount, order_id, completed_at")
      .not("buyer_name", "is", null)
      .neq("buyer_name", "-");

    if (dateFilter) {
      query = query.gte("completed_at", dateFilter);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    // Group by buyer_name
    const grouped: Record<
      string,
      {
        buyer_name: string;
        total_amount: number;
        order_count: number;
        first_order: string;
        last_order: string;
        order_ids: string[];
      }
    > = {};

    for (const row of data || []) {
      const name = (row.buyer_name || "").trim();
      if (!name || name === "-") continue;

      if (!grouped[name]) {
        grouped[name] = {
          buyer_name: name,
          total_amount: 0,
          order_count: 0,
          first_order: row.completed_at,
          last_order: row.completed_at,
          order_ids: [],
        };
      }

      grouped[name].total_amount += row.amount || 0;
      grouped[name].order_count += 1;
      grouped[name].order_ids.push(row.order_id);

      // Update first & last order
      if (row.completed_at < grouped[name].first_order) {
        grouped[name].first_order = row.completed_at;
      }
      if (row.completed_at > grouped[name].last_order) {
        grouped[name].last_order = row.completed_at;
      }
    }

    // Sort by total_amount desc
    const sorted = Object.values(grouped)
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, limit);

    // Hitung statistik tambahan
    const totalCustomers = Object.keys(grouped).length;
    const repeatCustomers = Object.values(grouped).filter(
      (c) => c.order_count > 1
    ).length;

    return NextResponse.json({
      success: true,
      customers: sorted,
      stats: {
        totalCustomers,
        repeatCustomers,
        repeatRate:
          totalCustomers > 0
            ? Math.round((repeatCustomers / totalCustomers) * 100)
            : 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err.message },
      { status: 500 }
    );
  }
}