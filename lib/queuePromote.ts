// lib/queuePromote.ts — naikkan order dari antrean ke slot aktif (dipakai API, tanpa panggilan HTTP).
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const DEFAULT_MAX_PARALLEL = 11;

/** Kapasitas slot aktif dari pengaturan di halaman Antrean (queue_settings). */
export async function getMaxParallel(): Promise<number> {
  const { data } = await supabaseAdmin.from("queue_settings").select("max_parallel").eq("id", 1).maybeSingle();
  const n = Number(data?.max_parallel);
  return Number.isFinite(n) && n >= 1 ? n : DEFAULT_MAX_PARALLEL;
}

export type PromoteResult = { promoted: number; order_ids: string[]; message?: string };

export async function promoteQueue(): Promise<PromoteResult> {
  const maxParallel = await getMaxParallel();

  // 1. Slot terpakai (waiting_confirm + processing)
  const { count: activeCount, error: activeError } = await supabaseAdmin
    .from("joki_orders")
    .select("id", { count: "exact", head: true })
    .eq("completed", false)
    .in("queue_status", ["waiting_confirm", "processing"]);
  if (activeError) throw new Error(activeError.message);

  const availableSlots = maxParallel - (activeCount || 0);
  if (availableSlots <= 0) {
    return { promoted: 0, order_ids: [], message: `Slots full (${activeCount}/${maxParallel})` };
  }

  // 2. Ambil antrean terdepan (FIFO)
  const { data: queuedOrders, error: queuedError } = await supabaseAdmin
    .from("joki_orders")
    .select("order_id")
    .eq("queue_status", "queued")
    .eq("completed", false)
    .order("queue_position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(availableSlots);
  if (queuedError) throw new Error(queuedError.message);
  if (!queuedOrders?.length) return { promoted: 0, order_ids: [] };

  // 3. Naikkan — hanya yang MASIH queued (aman kalau dipanggil bersamaan)
  const { data: promoted, error: updateError } = await supabaseAdmin
    .from("joki_orders")
    .update({ queue_status: "waiting_confirm", queue_position: null })
    .in("order_id", queuedOrders.map((o) => o.order_id))
    .eq("queue_status", "queued")
    .select("order_id");
  if (updateError) throw new Error(updateError.message);
  const ids = (promoted || []).map((o) => o.order_id as string);
  if (ids.length) console.log(`✅ Promoted ${ids.length} order(s):`, ids);

  // 4. Rapikan nomor antrean sisanya
  const { data: remaining } = await supabaseAdmin
    .from("joki_orders")
    .select("order_id, queue_position")
    .eq("queue_status", "queued")
    .eq("completed", false)
    .order("queue_position", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  for (let i = 0; i < (remaining?.length || 0); i++) {
    const r = remaining![i];
    if (r.queue_position !== i + 1) {
      await supabaseAdmin.from("joki_orders").update({ queue_position: i + 1 }).eq("order_id", r.order_id);
    }
  }

  return { promoted: ids.length, order_ids: ids };
}
