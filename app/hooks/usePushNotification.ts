"use client";

import { useCallback, useEffect, useState } from "react";
import { getPushStatus, registerPushSubscription } from "@/lib/push";

/** Status & aksi notifikasi push untuk perangkat ini (memakai lib/push yang sama dengan menu utama) */
export function usePushNotification() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPushStatus().then((s) => {
      setIsSupported(s.supported);
      setIsSubscribed(s.subscribed && s.permission === "granted");
      setLoading(false);
    });
  }, []);

  const subscribe = useCallback(async () => {
    try {
      await registerPushSubscription();
      setIsSubscribed(true);
      return { success: true, message: "Notifikasi aktif" };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi" };
    }
  }, []);

  return { isSupported, isSubscribed, loading, subscribe };
}
