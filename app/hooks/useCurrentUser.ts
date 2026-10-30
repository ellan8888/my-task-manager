"use client";

import { useEffect, useState } from "react";
import type { CurrentUser } from "@/lib/types";

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (cancelled) return;

        if (data.success && data.user) {
          setUser(data.user);
        } else {
          console.warn("[useCurrentUser] Gagal fetch user, redirect ke login");
          window.location.href = "/login";
        }
      } catch (err) {
        console.error("Fetch current user error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}
