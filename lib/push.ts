import { supabase } from "@/lib/supabase";

export async function registerPushSubscription() {
  if (!("serviceWorker" in navigator)) {
    throw new Error(
      "Service Worker tidak didukung browser."
    );
  }

  if (!("PushManager" in window)) {
    throw new Error(
      "Push Notification tidak didukung browser."
    );
  }

  const registration =
    await navigator.serviceWorker.ready;

  let subscription =
    await registration.pushManager.getSubscription();

  if (!subscription) {
    console.log(
      "📨 Membuat Push Subscription..."
    );

    const publicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) {
      throw new Error(
        "NEXT_PUBLIC_VAPID_PUBLIC_KEY belum tersedia."
      );
    }

    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });
  } else {
    console.log(
      "✅ Push subscription sudah ada"
    );
  }

  const subscriptionJSON =
    subscription.toJSON();

  if (
    !subscriptionJSON.endpoint ||
    !subscriptionJSON.keys?.p256dh ||
    !subscriptionJSON.keys?.auth
  ) {
    throw new Error(
      "Data Push Subscription tidak lengkap."
    );
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        endpoint: subscriptionJSON.endpoint,
        p256dh: subscriptionJSON.keys.p256dh,
        auth: subscriptionJSON.keys.auth,
      },
      {
        onConflict: "endpoint",
      }
    );

  if (error) {
    console.error(
      "❌ Gagal menyimpan subscription:",
      error
    );

    throw error;
  }

  console.log(
    "✅ Push Subscription tersimpan di Supabase"
  );

  return subscription;
}