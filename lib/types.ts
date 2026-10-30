export type Task = {
  id: number;
  title: string;
  deadline: string;
  reminder: string | null;
  reminder_sent: boolean;
  reminder_last_sent: string | null;
  priority: "Low" | "Medium" | "High";
  category: string;
  completed: boolean;
  notes: string | null;
  username: string | null;
};

export type JokiOrder = {
  id: number;
  order_id: string;
  roblox_username: string | null;
  product: string | null;
  joki_name: string | null;
  schedule_date: string | null;
  schedule_time: string | null;
  note: string | null;
  reminder_sent: boolean;
  completed: boolean;
  completed_by_bot: boolean;
  completed_at: string | null;
  created_at: string;
  estimated_end_at: string | null;
  queue_status: string | null;
  buyer_confirmed: boolean;
  confirm_token: string | null;
  order_type: string | null;
  progress_keyword: string | null;
  progress_count: number | null;
  target_count: number | null;
  target_unit?: string | null;
  bot_process_failed: boolean | null;
  bot_failed_reason: string | null;
  bot_failed_at: string | null;
  // Detail pesanan Itemku (bisa kosong untuk order lama)
  buyer_name?: string | null;
  quantity?: string | null;
  total_income?: number | null;
  detail_url?: string | null;
  response_deadline?: string | null;
};

export type CurrentUser = {
  username: string;
  display_name: string;
  role: string;
};

export type RamAccount = {
  Username: string;
  UserID: number;
  Alias: string;
  Group: string;
};
