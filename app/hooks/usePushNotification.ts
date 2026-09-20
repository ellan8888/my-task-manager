"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotification() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      checkSubscription();
    } else {
      setLoading(false);
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (err) {
      console.error("Check subscription error:", err);
    } finally {
      setLoading(false);
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported) {
      return { success: false, message: "Push not supported" };
    }

    try {
      // 1. Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { success: false, message: "Permission denied" };
      }

      // 2. Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      // ★ 3. Subscribe — fix type dengan `as BufferSource`
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as BufferSource,
      });

      // 4. Kirim ke server
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      const data = await res.json();

      if (data.success) {
        setIsSubscribed(true);
        return { success: true, message: "Subscribed!" };
      } else {
        return { success: false, message: data.message };
      }
    } catch (err: any) {
      console.error("Subscribe error:", err);
      return { success: false, message: err.message };
    }
  }, [isSupported]);

  return { isSupported, isSubscribed, loading, subscribe };
}