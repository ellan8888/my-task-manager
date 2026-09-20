"use client";

import { usePushNotification } from "@/app/hooks/usePushNotification";
import { useToast } from "@/app/components/ToastProvider";

export function PushNotificationButton() {
  const toast = useToast();
  const { isSupported, isSubscribed, loading, subscribe } = usePushNotification();

  // Kalau nggak support / udah subscribed / masih loading → nggak tampil
  if (loading || !isSupported || isSubscribed) return null;

  const handleSubscribe = async () => {
    const result = await subscribe();
    if (result.success) {
      toast.success("Notif aktif! Kamu bakal dapet notif walau web ditutup.");
    } else {
      toast.error(`Gagal: ${result.message}`);
    }
  };

  return (
    <button
      onClick={handleSubscribe}
      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition"
      title="Aktifkan notifikasi push"
    >
      <i className="fa-solid fa-bell"></i>
      <span className="hidden sm:inline">Aktifkan Notif</span>
    </button>
  );
}