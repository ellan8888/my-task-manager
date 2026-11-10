// lib/publicOrder.ts — kolom joki_orders yang AMAN dilihat pembeli / pengunjung tanpa login.
// Jangan tambahkan token, webhook, pendapatan, nama pembeli, atau catatan internal di sini.
export const PUBLIC_ORDER_COLUMNS = [
  "id",
  "order_id",
  "product",
  "roblox_username",
  "joki_name",
  "schedule_date",
  "schedule_time",
  "created_at",
  "completed",
  "completed_by_bot",
  "queue_status",
  "queue_position",
  "processing_started_at",
  "estimated_end_at",
  "buyer_confirmed",
  "order_type",
  "progress_keyword",
  "target_count",
  "progress_count",
  "target_unit",
  "progress_updated_at",
  "counted_rarities",
  "bonus_rarities",
].join(", ");

/** Nama topik broadcast Supabase Realtime saat joki_orders berubah (lihat sql/017). */
export const ORDERS_CHANGED_TOPIC = "joki_orders_changed";
