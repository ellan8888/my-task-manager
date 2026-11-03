// app/api/admin/pendapatan/route.ts — khusus Ellan
// Ringkasan pendapatan per anggota tim untuk periode tertentu (tanggal WIB).
//   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSession } from "@/lib/auth";
import { isEllan } from "@/lib/replacements";
import { TEAM, fetchAll } from "@/lib/teamIncome";

export const dynamic = "force-dynamic";

type IncomeRow = {
  id: number;
  order_id: string;
  joki_name: string | null;
  roblox_username: string | null;
  amount: number | null;
  completed_at: string | null;
  product_title: string | null;
  buyer_name: string | null;
};

const DAY = 86400000;
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
const wibStart = (d: string) => new Date(`${d}T00:00:00+07:00`);
const wibDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

async function loadIncome(fromISO: string, toISO: string) {
  return fetchAll<IncomeRow>((a, b) =>
    supabaseAdmin
      .from("income_log")
      .select("id, order_id, joki_name, roblox_username, amount, completed_at, product_title, buyer_name")
      .gte("completed_at", fromISO)
      .lt("completed_at", toISO)
      .order("completed_at", { ascending: false })
      .range(a, b)
  );
}

export async function GET(request: Request) {
  if (!isEllan(getSession(request))) {
    return NextResponse.json({ success: false, message: "Khusus Ellan" }, { status: 403 });
  }

  try {
    const sp = new URL(request.url).searchParams;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const from = isDate(sp.get("from")) ? sp.get("from")! : today.slice(0, 8) + "01";
    const to = isDate(sp.get("to")) ? sp.get("to")! : today;

    const start = wibStart(from);
    const end = new Date(wibStart(to).getTime() + DAY); // eksklusif
    if (end <= start) {
      return NextResponse.json({ success: false, message: "Rentang tanggal tidak valid" }, { status: 400 });
    }
    const span = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - span);

    const [rows, prevRows] = await Promise.all([
      loadIncome(start.toISOString(), end.toISOString()),
      loadIncome(prevStart.toISOString(), start.toISOString()),
    ]);

    // Kotor & fee dari income_fee_log
    const feeMap = new Map<number, { gross: number; fee: number }>();
    const ids = rows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await supabaseAdmin
        .from("income_fee_log")
        .select("income_log_id, gross_amount, fee_amount")
        .in("income_log_id", ids.slice(i, i + 500));
      for (const f of data || []) {
        feeMap.set(f.income_log_id, { gross: Number(f.gross_amount) || 0, fee: Number(f.fee_amount) || 0 });
      }
    }

    // Penanda hasil Ganti Akun
    const orderIds = [...new Set(rows.map((r) => r.order_id))];
    const replaced = new Map<string, { from_owner: string | null; from_username: string }>();
    for (let i = 0; i < orderIds.length; i += 300) {
      const { data } = await supabaseAdmin
        .from("account_replacements")
        .select("order_id, new_username, old_username, old_added_by")
        .eq("status", "done")
        .in("order_id", orderIds.slice(i, i + 300));
      for (const r of data || []) {
        replaced.set(`${r.order_id}|${r.new_username}`, { from_owner: r.old_added_by, from_username: r.old_username });
      }
    }

    // Ringkasan per user
    const names = new Set(TEAM);
    rows.forEach((r) => names.add((r.joki_name || "ellan").toLowerCase()));
    const users = [...names].map((name) => ({ name, net: 0, gross: 0, fee: 0, count: 0, prev_net: 0, prev_count: 0 }));
    const byName = new Map(users.map((u) => [u.name, u]));

    for (const r of rows) {
      const u = byName.get((r.joki_name || "ellan").toLowerCase())!;
      const net = Number(r.amount) || 0;
      const f = feeMap.get(r.id);
      u.net += net;
      u.gross += f ? f.gross : net;
      u.fee += f ? f.fee : 0;
      u.count += 1;
    }
    for (const r of prevRows) {
      const u = byName.get((r.joki_name || "ellan").toLowerCase());
      if (!u) continue;
      u.prev_net += Number(r.amount) || 0;
      u.prev_count += 1;
    }
    users.sort((a, b) => TEAM.indexOf(a.name) - TEAM.indexOf(b.name) || b.net - a.net);

    // Grafik harian
    const dates: string[] = [];
    for (let t = start.getTime(); t < end.getTime() && dates.length < 400; t += DAY) {
      dates.push(new Date(t + 7 * 3600000).toISOString().slice(0, 10));
    }
    const dateIdx = new Map(dates.map((d, i) => [d, i]));
    const series: Record<string, number[]> = {};
    users.forEach((u) => (series[u.name] = dates.map(() => 0)));
    for (const r of rows) {
      if (!r.completed_at) continue;
      const i = dateIdx.get(wibDay(r.completed_at));
      if (i == null) continue;
      series[(r.joki_name || "ellan").toLowerCase()][i] += Number(r.amount) || 0;
    }

    // Transaksi (maks 300 terbaru)
    const transactions = rows.slice(0, 300).map((r) => {
      const f = feeMap.get(r.id);
      return {
        id: r.id,
        order_id: r.order_id,
        joki_name: (r.joki_name || "ellan").toLowerCase(),
        roblox_username: r.roblox_username,
        product_title: r.product_title,
        buyer_name: r.buyer_name,
        completed_at: r.completed_at,
        net: Number(r.amount) || 0,
        gross: f ? f.gross : Number(r.amount) || 0,
        fee: f ? f.fee : 0,
        replaced: replaced.get(`${r.order_id}|${r.roblox_username}`) || null,
      };
    });

    return NextResponse.json({
      success: true,
      period: { from, to },
      users,
      daily: { dates, series },
      transactions,
      total_count: rows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
