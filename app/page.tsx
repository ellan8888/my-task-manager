"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerPushSubscription } from "@/lib/push";
import Link from "next/link";

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

type Task = {
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
  username: string | null;   // ⭐ TAMBAH
};

type JokiOrder = {
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
};

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [processingOrders, setProcessingOrders] = useState<Set<number>>(new Set());
  const [jokiOrders, setJokiOrders] = useState<JokiOrder[]>([]);
  const [startingOrders, setStartingOrders] = useState<Set<number>>(new Set());

  const [editingUsername, setEditingUsername] = useState<{
    orderId: number;
    value: string;
  } | null>(null);

  const [ramAccounts, setRamAccounts] = useState<{
    Username: string;
    UserID: number;
    Alias: string;
    Group: string;
  }[]>([]);

  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reminder, setReminder] = useState("08:00");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [isDark, setIsDark] = useState(true);
  const [filter, setFilter] = useState<"All" | "Today" | "NotScheduled" | "Overdue">("All");

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [defaultReminder, setDefaultReminder] = useState("20:00");
  const [showSettings, setShowSettings] = useState(false);

  const [currentView, setCurrentView] = useState<"list" | "kanban">("list");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "danger" | "warning" | "info" | "success";
    confirmText: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    message: "",
    variant: "info",
    confirmText: "OK",
    onConfirm: () => {},
  });

  const [botStatus, setBotStatus] = useState<{
    isOnline: boolean;
    lastHeartbeatHuman: string;
  } | null>(null);

  const [currentUser, setCurrentUser] = useState<{
  username: string;
  display_name: string;
  role: string;
} | null>(null);

const [authLoading, setAuthLoading] = useState(true);

  // ══════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleStartProgressOrder = async (order: JokiOrder) => {
    showConfirm(
      "Mulai Orderan?",
      `Mulai proses order "${order.roblox_username || "Pembeli"}"? Bot akan kirim chat ke buyer kalau order sudah mulai diproses.`,
      "info",
      "Ya, Mulai",
      async () => {
        closeConfirm();
        setStartingOrders((prev) => new Set(prev).add(order.id));

        try {
          const res = await fetch("/api/queue/start-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: order.order_id }),
          });
          const data = await res.json();

          if (!data.success) {
            alert(data.message || "Gagal memulai order");
            setStartingOrders((prev) => {
              const next = new Set(prev);
              next.delete(order.id);
              return next;
            });
            return;
          }

          setJokiOrders((current) =>
            current.map((item) =>
              item.id === order.id ? { ...item, queue_status: "processing" } : item
            )
          );

          setTimeout(() => {
            setStartingOrders((prev) => {
              const next = new Set(prev);
              next.delete(order.id);
              return next;
            });
          }, 1000);
        } catch (err) {
          console.error(err);
          alert("Terjadi kesalahan");
          setStartingOrders((prev) => {
            const next = new Set(prev);
            next.delete(order.id);
            return next;
          });
        }
      }
    );
  };

  const handleRestartBot = async () => {
    if (!confirm("Jalankan ulang bot?\n\nIni bakal menjalankan login.py di komputer kamu.")) {
      return;
    }

    setRestarting(true);
    try {
      const res = await fetch("/api/bot/restart", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        alert("✅ Bot sedang di-restart...\n\nTunggu 30-60 detik.");
        setTimeout(fetchBotStatus, 5000);
        setTimeout(fetchBotStatus, 15000);
      } else {
        alert(`❌ Gagal: ${data.message}`);
      }
    } catch (err) {
      alert("❌ Gagal menghubungi restart server");
    } finally {
      setRestarting(false);
    }
  };

  const fetchBotStatus = async () => {
    try {
      const res = await fetch("/api/bot/status");
      const data = await res.json();
      if (data.success) {
        setBotStatus({
          isOnline: data.isOnline,
          lastHeartbeatHuman: data.lastHeartbeatHuman,
        });
      }
    } catch (err) {
      console.error("Fetch bot status error:", err);
    }
  };

  const showConfirm = (
    title: string,
    message: string,
    variant: "danger" | "warning" | "info" | "success",
    confirmText: string,
    onConfirm: () => void
  ) => {
    setConfirmDialog({ open: true, title, message, variant, confirmText, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  };

  const updateDefaultReminder = (value: string) => {
    setDefaultReminder(value);
    localStorage.setItem("defaultReminder", value);
    setReminder(value);
  };

  // ══════════════════════════════════════════════════════════════
  // LOAD TASKS & ORDERS
  // ══════════════════════════════════════════════════════════════

  const loadTasks = async (username?: string) => {
  const targetUser = username || currentUser?.username;
  
  if (!targetUser) {
    console.log("[loadTasks] Skip — belum ada user");
    return;
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("username", targetUser)   // ⭐ FILTER
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`[loadTasks] User ${targetUser}: ${data?.length || 0} tasks`);
  setTasks(data || []);
};

  const loadJokiOrders = async (username?: string) => {
  const targetUser = username || currentUser?.username;
  
  if (!targetUser) {
    console.log("[loadJokiOrders] Skip — belum ada user");
    return;
  }

  const { data, error } = await supabase
    .from("joki_orders")
    .select("*")
    .eq("completed", false)
    .eq("joki_name", targetUser)     // ⭐ FILTER: cuma joki_name = user
    .order("schedule_date", { ascending: true })
    .order("schedule_time", { ascending: true });

  if (error) {
    console.error("Gagal mengambil data Jokian:", error);
    return;
  }
  
  console.log(`[loadJokiOrders] User ${targetUser}: ${data?.length || 0} orders`);
  setJokiOrders(data || []);
};

  const [now, setNow] = useState(Date.now());

  // ══════════════════════════════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

useEffect(() => {
  const init = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      
      if (data.success && data.user) {
        setCurrentUser(data.user);
        await loadJokiOrders(data.user.username);
        await loadTasks(data.user.username);   // ⭐ TAMBAH INI
      } else {
        console.warn("[init] Gagal fetch user, redirect ke login");
        window.location.href = "/login";
      }
    } catch (err) {
      console.error("Fetch current user error:", err);
    } finally {
      setAuthLoading(false);
    }
  };
  
  init();
}, []);

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
  loadTasks();

  if (!currentUser) return;  // ⭐ tunggu user ready

  // Realtime subscription
  const channel = supabase
    .channel("joki_orders_realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "joki_orders" },
      (payload) => {
        console.log("[Home] Joki order changed:", payload);
        loadJokiOrders();  // function udah filter otomatis
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [currentUser]);  // ⭐ Depend on currentUser

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const darkMode = savedTheme ? savedTheme === "dark" : prefersDark;
    setIsDark(darkMode);

    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem("theme", newMode ? "dark" : "light");

    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Workers registered:", registration.scope);
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  useEffect(() => {
    const savedReminder = localStorage.getItem("defaultReminder");
    if (savedReminder) {
      setDefaultReminder(savedReminder);
      setReminder(savedReminder);
    }
  }, []);

  useEffect(() => {
    const savedSidebar = localStorage.getItem("sidebarOpen");
    if (savedSidebar !== null) {
      setSidebarOpen(savedSidebar === "true");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sidebarOpen", String(sidebarOpen));
  }, [sidebarOpen]);

  // ══════════════════════════════════════════════════════════════
  // TASK HANDLERS
  // ══════════════════════════════════════════════════════════════

  const addTask = async () => {
    if (!title || !deadline) {
      alert("Title dan deadline wajib diisi!");
      return;
    }

const newTask = {
  id: Date.now(),
  title,
  deadline,
  reminder: reminder || null,
  reminder_sent: false,
  reminder_last_sent: null,
  priority,
  category,
  completed: false,
  notes,
  username: currentUser?.username || "ellan",   // ⭐ TAMBAH
};

const { error } = await supabase.from("tasks").insert([newTask]);
    if (error) {
      console.error(error);
      alert("Gagal menyimpan task!");
      return;
    }

    setTasks([newTask, ...tasks]);
    resetForm();
  };

  const updateTask = async () => {
    if (!title || !deadline || editingId === null) {
      alert("Title dan deadline wajib diisi!");
      return;
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        title,
        deadline,
        reminder: reminder || null,
        reminder_sent: false,
        reminder_last_sent: null,
        priority,
        category,
        notes,
      })
      .eq("id", editingId);

    if (error) {
      console.error(error);
      alert("Gagal mengupdate task!");
      return;
    }

    setTasks(
      tasks.map((task) =>
        task.id === editingId
          ? {
              ...task,
              title,
              deadline,
              reminder: reminder || null,
              reminder_sent: false,
              reminder_last_sent: null,
              priority,
              category,
            }
          : task
      )
    );

    resetForm();
  };

  const deleteTask = async (id: number) => {
    showConfirm(
      "Hapus Task?",
      "Yakin ingin menghapus task ini? Tindakan ini tidak bisa dibatalkan.",
      "danger",
      "Ya, Hapus",
      async () => {
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) {
          console.error(error);
          alert("Gagal menghapus task!");
          return;
        }
        setTasks(tasks.filter((task) => task.id !== id));
        closeConfirm();
      }
    );
  };

  const editTask = (task: Task) => {
    setEditingId(task.id);
    setTitle(task.title);
    setDeadline(task.deadline);
    setReminder(task.reminder || "");
    setPriority(task.priority);
    setCategory(task.category);
    setShowForm(true);
    setNotes(task.notes || "");
  };

  const toggleTask = async (id: number) => {
    const task = tasks.find((task) => task.id === id);
    if (!task) return;

    const newCompletedStatus = !task.completed;

    showConfirm(
      newCompletedStatus ? "Tandai Selesai?" : "Batalkan Selesai?",
      newCompletedStatus
        ? `Tandai "${task.title}" sebagai selesai?`
        : `Kembalikan "${task.title}" menjadi belum selesai?`,
      newCompletedStatus ? "success" : "info",
      newCompletedStatus ? "Ya, Selesai" : "Ya, Kembalikan",
      async () => {
        const { error } = await supabase
          .from("tasks")
          .update({ completed: newCompletedStatus })
          .eq("id", id);

        if (error) {
          console.error(error);
          alert("Gagal mengubah status task!");
          return;
        }

        setTasks((current) =>
          current.map((item) =>
            item.id === id ? { ...item, completed: newCompletedStatus } : item
          )
        );
        closeConfirm();
      }
    );
  };

  const resetForm = () => {
    setTitle("");
    setDeadline("");
    setReminder(defaultReminder);
    setPriority("Medium");
    setCategory("");
    setEditingId(null);
    setShowForm(false);
    setNotes("");
  };

  // ══════════════════════════════════════════════════════════════
  // JOKI ORDER HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleCompleteOrder = async (order: JokiOrder) => {
  const isAlreadyCompleted = 
    order.completed_by_bot === true || 
    order.queue_status === "completed";

  showConfirm(
    isAlreadyCompleted ? "Hapus dari Daftar?" : "Selesaikan Jokian Manual?",
    isAlreadyCompleted
      ? `Order "${order.roblox_username || "Pembeli"}" sudah selesai. Hapus dari daftar?`
      : `Selesaikan jokian "${order.roblox_username || "Pembeli"}" sekarang?\n\nBot akan proses selesai & kirim chat konfirmasi ke buyer.`,
    "success",
    isAlreadyCompleted ? "Ya, Hapus" : "Ya, Selesaikan",
    async () => {
      closeConfirm();

      // ═══════════════════════════════════════════════════════
      // ⭐ OPTIMISTIC UPDATE — hapus card dari UI DULUAN
      // ═══════════════════════════════════════════════════════
      setJokiOrders((current) =>
        current.filter((item) => item.id !== order.id)
      );

      try {
        if (isAlreadyCompleted) {
          // === CARD BURAM: bot udah selesai ===
          // Cuma hapus row — nggak perlu trigger bot
          console.log("[handleCompleteOrder] Card udah selesai bot, hapus aja");

          const resComplete = await fetch("/api/queue/complete-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order_id: order.order_id }),
          });
          const dataComplete = await resComplete.json().catch(() => null);
          console.log("[handleCompleteOrder] complete-order:", dataComplete);

          if (!dataComplete?.success) {
            // ⭐ Rollback — card muncul lagi
            alert(dataComplete?.message || "Gagal hapus order");
            await loadJokiOrders();   // reload dari DB
            return;
          }

          return;
        }

        // === CARD NORMAL: belum selesai ===
        // Cuma trigger bot via manual-complete
        const resManual = await fetch("/api/queue/manual-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order_id: order.order_id }),
        });
        const dataManual = await resManual.json().catch(() => null);
        console.log("[handleCompleteOrder] manual-complete:", dataManual);

        if (!dataManual?.success) {
          // ⭐ Rollback — card muncul lagi
          alert(dataManual?.message || "Gagal trigger bot");
          await loadJokiOrders();   // reload dari DB
          return;
        }

        // ⭐ Flag udah di-set. Card udah dihapus dari UI.
        // Bot bakal proses di background:
        //   1. Chat "Joki Selesai" + link konfirmasi
        //   2. Klik "Joki Selesai" → "Mengerti" → "OK"
        //   3. Hapus row joki_orders
        console.log(
          "[handleCompleteOrder] ✅ Flag set — bot bakal proses di background"
        );

      } catch (err) {
        console.error(err);
        alert("Terjadi kesalahan");
        // ⭐ Rollback — reload dari DB
        await loadJokiOrders();
      }
    }
  );
};

  const isUsernameUsedInOtherCards = (username: string, currentOrderId: number) => {
    return jokiOrders.some(
      (o) => o.id !== currentOrderId &&
             o.roblox_username?.toLowerCase() === username.toLowerCase()
    );
  };

  const fetchRamAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/get-accounts");
      const data = await res.json();

      if (data.success && Array.isArray(data.accounts)) {
        setRamAccounts(data.accounts);
        console.log("RAM accounts loaded:", data.accounts);
      } else {
        console.error("Gagal load RAM accounts:", data.message);
      }
    } catch (err) {
      console.error("Error fetch RAM accounts:", err);
    } finally {
      setLoadingAccounts(false);
    }
  };

   const updateOrderUsername = async (orderId: number, newUsername: string) => {
    if (!newUsername.trim()) {
      alert("Username tidak boleh kosong!");
      return;
    }

    try {
      // ⭐ Ambil username lama & order_id dulu
      const oldOrder = jokiOrders.find((o) => o.id === orderId);
      const oldUsername = oldOrder?.roblox_username || "";
      const orderIdStr = oldOrder?.order_id;

      if (!orderIdStr) {
        alert("Order ID nggak ketemu!");
        return;
      }

      // ⭐ Panggil API baru yang handle update + reclaim
      const res = await fetch("/api/queue/update-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderIdStr,
          old_username: oldUsername,
          new_username: newUsername.trim(),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.message || "Gagal mengupdate username!");
        return;
      }

      // ⭐ Update state lokal (username + progress_count)
      setJokiOrders((current) =>
        current.map((item) =>
          item.id === orderId
            ? {
                ...item,
                roblox_username: newUsername.trim(),
                progress_count: data.progress_count ?? item.progress_count,
              }
            : item
        )
      );

      // Info kalau ada egg yang ke-reclaim
      if (data.reclaimed_eggs > 0) {
        console.log(
          `✅ ${data.reclaimed_eggs} egg lama berhasil di-reclaim. ` +
          `Progress sekarang: ${data.progress_count}`
        );
      }

      setEditingUsername(null);
    } catch (err) {
      console.error(err);
      alert("Gagal mengupdate username!");
    }
  };

  // ══════════════════════════════════════════════════════════════
  // PUSH NOTIFICATION
  // ══════════════════════════════════════════════════════════════

  const testPushNotification = async () => {
    try {
      const response = await fetch("/api/push", { method: "POST" });
      const result = await response.json();
      console.log("Push API result:", result);

      if (result.success) {
        alert(`Push berhasil dikirim!\n\nTerkirim: ${result.sent}\nGagal: ${result.failed}`);
      } else {
        alert(`Push gagal:\n${result.message || result.error}`);
      }
    } catch (error) {
      console.error("Test push error:", error);
      alert("Gagal menghubungi Push API.");
    }
  };

  const enableNotifications = async () => {
  if (!("Notification" in window)) {
    alert("Browser kamu tidak mendukung notifikasi.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission !== "granted") {
      alert("Permission notifikasi ditolak.");
      return;
    }

    // ⭐ Validasi user udah ready
    if (!currentUser?.username) {
      alert("User belum siap. Coba refresh halaman.");
      return;
    }

    // ⭐ PASS USERNAME
    const subscription = await registerPushSubscription(
      currentUser.username
    );
    console.log("Subscription:", JSON.stringify(subscription));
    alert("Push notification berhasil diaktifkan!");
  } catch (error) {
    console.error("Gagal mengaktifkan push notification:", error);
    alert("Gagal mengaktifkan push notification. Cek Console.");
  }
};

  // ══════════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════════

  const getDeadlineStatus = (deadline: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(deadline + "T00:00:00");
    target.setHours(0, 0, 0, 0);

    const difference = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (difference < 0) {
      return {
        label: "Overdue",
        displayText: "Overdue",
        icon: "fa-triangle-exclamation",
        className: "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
      };
    }
    if (difference === 0) {
      return {
        label: "Today",
        displayText: "Hari Ini",
        icon: "fa-fire",
        className: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
      };
    }
    if (difference === 1) {
      return {
        label: "Tomorrow",
        displayText: "Besok",
        icon: "fa-calendar-day",
        className: "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
      };
    }
    return {
      label: `${difference} days left`,
      displayText: `${difference} hari lagi`,
      icon: "fa-calendar-check",
      className: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
    };
  };

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // ══════════════════════════════════════════════════════════════
  // FILTERED DATA
  // ══════════════════════════════════════════════════════════════

  const filteredTasks = tasks
    .filter((task) => {
      if (filter === "NotScheduled") return false;

      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.category.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const taskDate = new Date(task.deadline + "T00:00:00");
      taskDate.setHours(0, 0, 0, 0);

      if (filter === "Today") return taskDate.getTime() === today.getTime();
      if (filter === "Overdue") return taskDate.getTime() < today.getTime() && !task.completed;

      return true;
    })
    .sort((a, b) => {
      return new Date(a.deadline + "T00:00:00").getTime() - new Date(b.deadline + "T00:00:00").getTime();
    });

  const filteredJokiOrders = jokiOrders.filter((o) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (filter === "All") return true;

    if (filter === "Today") {
      if (o.completed_by_bot || o.queue_status === "completed") return false;
      if (!o.estimated_end_at) return false;

      const endDate = new Date(o.estimated_end_at);
      endDate.setHours(0, 0, 0, 0);
      return endDate.getTime() === today.getTime();
    }

    if (filter === "NotScheduled") {
      return (
        !o.estimated_end_at &&
        o.completed_by_bot !== true &&
        o.queue_status !== "completed"
      );
    }

    if (filter === "Overdue") {
      if (o.completed_by_bot || o.queue_status === "completed") return false;
      if (!o.estimated_end_at) return false;

      const endDate = new Date(o.estimated_end_at);
      endDate.setHours(0, 0, 0, 0);
      return endDate.getTime() < today.getTime();
    }

    return true;
  });

  // ⭐ Split jadi 2 — sudah dijadwalkan vs belum dijadwalkan
    // ⭐ Split jadi 3 — countdown, progress, belum dijadwalkan
  const countdownJokiOrders = filteredJokiOrders.filter((o) => {
    const isProgressOrder =
      o.order_type === "progress" ||
      (o.progress_keyword != null && (o.target_count ?? 0) > 0);
    if (isProgressOrder) return false;   // progress → ke section lain
    // Countdown: punya estimated_end_at ATAU sudah selesai
    if (o.estimated_end_at) return true;
    if (o.completed_by_bot || o.queue_status === "completed") return true;
    return false;
  });

  const progressJokiOrders = filteredJokiOrders
    .filter((o) => {
      const isProgressOrder =
        o.order_type === "progress" ||
        (o.progress_keyword != null && (o.target_count ?? 0) > 0);
      return isProgressOrder;
    })
    .sort((a, b) => {
      const aWaiting = a.queue_status === "waiting_confirm" ? 1 : 0;
      const bWaiting = b.queue_status === "waiting_confirm" ? 1 : 0;

      if (aWaiting !== bWaiting) {
        return aWaiting - bWaiting;
      }

      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });

  const unscheduledJokiOrders = filteredJokiOrders.filter((o) => {
    const isProgressOrder =
      o.order_type === "progress" ||
      (o.progress_keyword != null && (o.target_count ?? 0) > 0);
    if (isProgressOrder) return false;
    if (o.estimated_end_at) return false;
    if (o.completed_by_bot || o.queue_status === "completed") return false;
    return true;
  });

  // ══════════════════════════════════════════════════════════════
  // STATISTICS
  // ══════════════════════════════════════════════════════════════

  const completedTasks = tasks.filter((task) => task.completed).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const jokiToday = jokiOrders.filter((o) => {
    if (o.completed_by_bot || o.queue_status === "completed") return false;
    if (!o.estimated_end_at) return false;
    if (o.order_type === "progress") return false;

    const endDate = new Date(o.estimated_end_at);
    endDate.setHours(0, 0, 0, 0);
    return endDate.getTime() === today.getTime();
  }).length;

  const jokiNotScheduled = jokiOrders.filter((o) =>
    !o.estimated_end_at &&
    o.completed_by_bot !== true &&
    o.queue_status !== "completed" &&
    o.order_type !== "progress" &&
    (o.progress_keyword == null || (o.target_count ?? 0) === 0)
  ).length;

  // ══════════════════════════════════════════════════════════════
  // JSX
  // ══════════════════════════════════════════════════════════════

  return (
    <>
      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator {
          opacity: 0;
          cursor: pointer;
          position: absolute;
          right: 0;
          top: 0;
          width: 100%;
          height: 100%;
        }

        input[type="date"],
        input[type="time"] {
          color-scheme: dark;
        }
        html:not(.dark) input[type="date"],
        html:not(.dark) input[type="time"] {
          color-scheme: light;
        }

        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-in {
          animation: modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        body, aside, main, header {
          transition: background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease;
        }
        .custom-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          display: none;
        }

        html, body {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        html::-webkit-scrollbar,
        body::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-violet-500 selection:text-white flex flex-col relative">

        {/* SIDEBAR */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 h-screen bg-white dark:bg-slate-900/95 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between p-5 transform-gpu will-change-transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-800/80">
              <div className="flex items-center space-x-3.5">
                <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30 ring-2 ring-violet-500/20">
                  <i className="fa-solid fa-gamepad text-xl"></i>
                </div>
                <div>
                  <h1 className="font-extrabold text-lg leading-tight tracking-tight text-slate-900 dark:text-white">
                    My Task Manager
                  </h1>
                  <div className="text-xs font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {botStatus === null ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        <span className="text-slate-500 dark:text-slate-400">Cek bot...</span>
                      </>
                    ) : botStatus.isOnline ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Bot Online • {botStatus.lastHeartbeatHuman}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                        <span className="text-rose-600 dark:text-rose-400">
                          Bot Offline • {botStatus.lastHeartbeatHuman}
                        </span>
                        <button
                          onClick={handleRestartBot}
                          disabled={restarting}
                          className="ml-1 px-2 py-0.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold transition disabled:opacity-50 flex items-center gap-1"
                          title="Jalankan ulang bot"
                        >
                          {restarting ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                          ) : (
                            <>
                              <i className="fa-solid fa-rotate-right"></i>
                              <span>Restart</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <nav className="mt-6 space-y-2">
              <a href="#" className="flex items-center space-x-3.5 px-4 py-3 rounded-2xl bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-200 font-semibold text-sm border border-violet-200 dark:border-violet-500/40 transition-all">
                <i className="fa-solid fa-list-check w-5 text-center text-violet-600 dark:text-violet-300"></i>
                <span>Daftar Order Jokian</span>
                <span className="ml-auto bg-violet-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {jokiOrders.length}
                </span>
              </a>

              <a
                href="/queue"
                className="flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 text-sm font-medium transition-all group"
              >
                <i className="fa-solid fa-list-ol w-5 text-center group-hover:text-violet-500 dark:group-hover:text-violet-400 transition"></i>
                <span>Queue Jokian</span>
                <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-mono">
                  Live
                </span>
              </a>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 text-sm font-medium transition-all group"
              >
                <i className="fa-solid fa-robot w-5 text-center group-hover:text-violet-500 dark:group-hover:text-violet-400 transition"></i>
                <span>Notification</span>
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500"></span>
              </button>
            </nav>

            <div className="mt-8 p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-2.5">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Progres Hari Ini</span>
                <span className="text-violet-600 dark:text-violet-400">
                  {tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-linear-to-r from-violet-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-500">
                {completedTasks} dari {tasks.length} tugas selesai
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
            <Link
              href="/admin"
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:border-violet-500/50 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-all group cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
                    E
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition">
                    {currentUser?.display_name || "Loading..."}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition flex items-center gap-1">
                    <i className="fa-solid fa-shield-halved text-[9px]"></i>
                    {currentUser?.role === "superadmin" ? "Superadmin" : "User"}
                  </p>
                </div>
              </div>
              <i className="fa-solid fa-chevron-right text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all text-xs"></i>
            </Link>

            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center space-x-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              title={isDark ? "Mode Terang" : "Mode Gelap"}
            >
              <i className={`fa-solid ${isDark ? "fa-sun" : "fa-moon"} text-sm text-slate-700 dark:text-slate-300`}></i>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {isDark ? "Mode Terang" : "Mode Gelap"}
              </span>
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main
          className={`flex-1 flex flex-col h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            sidebarOpen ? "md:ml-72" : "md:ml-0"
          }`}
        >
          <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/60 backdrop-blur-md px-4 md:px-8 flex items-center justify-between z-20 shrink-0">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
                title={sidebarOpen ? "Tutup Sidebar" : "Buka Sidebar"}
              >
                <i className={`fa-solid ${sidebarOpen ? "fa-bars-staggered" : "fa-bars"} text-base`}></i>
              </button>

              <div>
                <h2 className="text-base md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  <span>Pusat Kendali Task</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  Kelola dan pantau antrean real-time
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                onClick={testPushNotification}
                className="flex items-center space-x-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold border border-slate-200 dark:border-slate-800 transition shadow-sm active:scale-95"
              >
                <i className="fa-solid fa-bolt text-amber-500 dark:text-amber-400"></i>
                <span className="hidden sm:inline">Simulasi Webhook</span>
              </button>

              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="flex items-center space-x-2 bg-linear-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold shadow-lg shadow-violet-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span> Task Baru</span>
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="px-4 md:px-8 py-4 space-y-4">

              {/* METRICS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Task */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-violet-500/50 transition-all duration-300">
                  <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-violet-500/10 dark:bg-violet-600/10 rounded-full blur-xl transition"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Total Task
                      </p>
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
                        {tasks.length + jokiOrders.length}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center border border-violet-200 dark:border-violet-500/20">
                      <i className="fa-solid fa-boxes-stacked text-base"></i>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                    <i className="fa-solid fa-robot mr-1.5"></i>
                    <span>Sync Tokoku-bot</span>
                  </div>
                </div>

                {/* Hari Ini */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-amber-500/50 transition-all duration-300">
                  <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/10 dark:bg-amber-600/10 rounded-full blur-xl transition"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <i className="fa-solid fa-fire text-xs"></i>
                        <span>Hari Ini</span>
                      </p>
                      <h3 className="text-2xl md:text-3xl font-black text-amber-600 dark:text-amber-300 mt-1">
                        {jokiToday}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-500/20">
                      <i className="fa-solid fa-fire text-base"></i>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <i className="fa-solid fa-clock mr-1.5"></i>
                    <span>Prioritas Pengerjaan</span>
                  </div>
                </div>

                {/* Belum Dijadwalkan */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-300">
                  <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-xl transition"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <i className="fa-solid fa-clock text-xs"></i>
                        <span>Belum Dijadwalkan</span>
                      </p>
                      <h3 className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-300 mt-1">
                        {jokiNotScheduled}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                      <i className="fa-solid fa-clock text-base"></i>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    <i className="fa-solid fa-hourglass-half mr-1.5"></i>
                    <span>Nunggu Jadwal</span>
                  </div>
                </div>

                {/* Selesai */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300">
                  <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-xl transition"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <i className="fa-solid fa-circle-check text-xs"></i>
                        <span>Selesai</span>
                      </p>
                      <h3 className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                        {completedTasks}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-500/20">
                      <i className="fa-solid fa-circle-check text-base"></i>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <i className="fa-solid fa-square-check mr-1.5"></i>
                    <span>Sudah Tuntas</span>
                  </div>
                </div>
              </div>

              {/* TOOLBAR */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 lg:pb-0 custom-scrollbar">
                  <button
                    onClick={() => setFilter("All")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                      filter === "All"
                        ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    Semua ({tasks.length + jokiOrders.length})
                  </button>
                  <button
                    onClick={() => setFilter("Today")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      filter === "Today"
                        ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span> Hari Ini
                  </button>
                  <button
                    onClick={() => setFilter("NotScheduled")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      filter === "NotScheduled"
                        ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Belum Dijadwalkan
                  </button>
                  <button
                    onClick={() => setFilter("Overdue")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      filter === "Overdue"
                        ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                        : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400"></span> Overdue
                  </button>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="relative flex-1 md:w-64">
                    <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari Task / Category..."
                      className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>

                  <button className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-violet-600 dark:text-violet-400 text-xs font-semibold border border-slate-200 dark:border-slate-700/60 transition flex items-center gap-1.5">
                    <i className="fa-regular fa-copy"></i>
                    <span className="hidden md:inline">Salin Rekap</span>
                  </button>

                  <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setCurrentView("list")}
                      className={`p-2 rounded-lg text-xs transition ${
                        currentView === "list"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <i className="fa-solid fa-list-ul"></i>
                    </button>
                    <button
                      onClick={() => setCurrentView("kanban")}
                      className={`p-2 rounded-lg text-xs transition ${
                        currentView === "kanban"
                          ? "bg-violet-600 text-white shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <i className="fa-solid fa-table-columns"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* SETTINGS PANEL */}
              {showSettings && (
                <div className="px-4 md:px-8 pt-6">
                  <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
                    <div className="mb-4">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <i className="fa-solid fa-bell text-violet-600 dark:text-violet-400"></i>
                        <span>Notification Settings</span>
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Atur pengaturan reminder My Task Manager.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            Push Notification
                          </p>
                          <p className="text-xs text-slate-500">
                            Terima reminder meskipun aplikasi tidak sedang dibuka.
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            notificationPermission === "granted"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                              : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          }`}
                        >
                          {notificationPermission === "granted" ? "ON" : "OFF"}
                        </span>
                      </div>
                      <div>
  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
    Default Daily Reminder
  </label>
  <div className="relative">
    <input
      type="text"
      value={defaultReminder}
      onChange={(e) => {
        let val = e.target.value.replace(/[^0-9:]/g, "");
        if (val.length === 2 && !val.includes(":")) {
          val = val + ":";
        }
        updateDefaultReminder(val.slice(0, 5));
      }}
      placeholder="20:00"
      maxLength={5}
      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 pr-11 text-sm text-slate-900 dark:text-slate-200 outline-none transition focus:border-violet-500 font-mono"
    />
    <i className="fa-regular fa-clock absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
  </div>
  <p className="mt-1 text-xs text-slate-500">
    Format 24 jam (HH:MM), contoh: <span className="font-mono">20:00</span>
  </p>
</div>
                      {notificationPermission !== "granted" && (
                        <button
                          onClick={enableNotifications}
                          className="w-full rounded-xl bg-slate-200 dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2"
                        >
                          <i className="fa-solid fa-bell"></i>
                          <span>Enable Push Notification</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* FORM MODAL */}
              {showForm && (
                <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center">
                          <i className="fa-solid fa-pen-to-square text-base"></i>
                        </div>
                        <div>
                          <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                            {editingId !== null ? "Edit Task" : "Tambah Task Baru"}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Masukkan rincian task
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={resetForm}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg"
                      >
                        <i className="fa-solid fa-xmark text-lg"></i>
                      </button>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          Task
                        </label>
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="Contoh: Kerjakan laporan"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                            Deadline
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              value={deadline}
                              onChange={(e) => setDeadline(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
                            />
                            <i className="fa-regular fa-calendar absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                            Daily Reminder
                          </label>
                          <div className="relative">
                            <input
                              type="time"
                              value={reminder}
                              onChange={(e) => setReminder(e.target.value)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
                            />
                            <i className="fa-regular fa-clock absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                            Priority
                          </label>
                          <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as any)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                            Category
                          </label>
                          <input
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Kuliah, Kerja..."
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">
                          Notes
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={3}
                          placeholder="Tambahkan catatan..."
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition resize-none"
                        ></textarea>
                      </div>

                      <div className="pt-4 flex justify-end space-x-3 border-t border-slate-200 dark:border-slate-800/80">
                        <button
                          onClick={resetForm}
                          className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                          Batal
                        </button>
                        <button
                          onClick={editingId !== null ? updateTask : addTask}
                          className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/30 transition"
                        >
                          {editingId !== null ? "Update Task" : "Simpan Task"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* HEADER SECTION BANNER */}
              <div className="flex items-center justify-between px-4 md:px-8 pt-6 pb-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-xs">
                    <i className="fa-solid fa-gamepad"></i>
                  </div>
                  <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base md:text-lg">
                    Jadwal Task & Jokian Aktif
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Menampilkan {filteredTasks.length} task • {filteredJokiOrders.length} jokian
                </p>
              </div>

              {/* LIST VIEW */}
              {currentView === "list" && (
                <>
                  {/* MY TASKS SECTION */}
                  {filter !== "NotScheduled" && (
                    <section className="px-4 md:px-8">
                      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <i className="fa-solid fa-clipboard-list text-violet-600 dark:text-violet-400"></i>
                          <span>My Tasks</span>
                        </h3>
                      </div>

                      <div className="pt-4 pb-6 space-y-3.5">
                        {filteredTasks.length === 0 ? (
                          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3 border border-violet-200 dark:border-violet-500/20">
                              <i className="fa-regular fa-clipboard text-2xl"></i>
                            </div>
                            <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                              Tidak ada task ditemukan
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">
                              Coba ubah filter atau tambah task baru.
                            </p>
                          </div>
                        ) : (
                          filteredTasks.map((task) => {
                            const deadlineStatus = getDeadlineStatus(task.deadline);

                            return (
                              <div
                                key={task.id}
                                className={`relative bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 ${
                                  task.completed ? "opacity-60" : ""
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                  <div className="flex items-start gap-4 min-w-0 flex-1">
                                    <button
                                      onClick={() => toggleTask(task.id)}
                                      className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
                                        task.completed
                                          ? "bg-emerald-500 border-emerald-500 text-white"
                                          : "border-slate-300 dark:border-slate-600 bg-transparent hover:border-violet-500 text-transparent"
                                      }`}
                                    >
                                      <i className="fa-solid fa-check text-xs"></i>
                                    </button>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2.5">
                                        <h4
                                          className={`font-extrabold text-base md:text-lg text-slate-900 dark:text-white truncate ${
                                            task.completed ? "line-through text-slate-400 dark:text-slate-400" : ""
                                          }`}
                                        >
                                          {task.title}
                                        </h4>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 mt-3">
                                        {task.reminder && (
                                          <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/70">
                                            <i className="fa-regular fa-clock text-[11px] text-amber-500 dark:text-amber-400"></i>
                                            <span>{task.reminder.slice(0, 5)}</span>
                                          </span>
                                        )}

                                        <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700/70">
                                          <i className="fa-regular fa-calendar text-[11px] text-indigo-500 dark:text-indigo-400"></i>
                                          <span>{formatDate(task.deadline)}</span>
                                        </span>

                                        {(task.notes || task.category) && (
                                          <span className="inline-flex items-center gap-1.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-violet-200 dark:border-violet-500/20">
                                            <i className="fa-regular fa-note-sticky text-[11px] text-violet-500 dark:text-violet-400"></i>
                                            <span className="truncate max-w-45">
                                              {task.notes || task.category}
                                            </span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 shrink-0">
                                    {!task.completed ? (
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border ${deadlineStatus.className}`}
                                      >
                                        <i className={`fa-solid ${deadlineStatus.icon} text-[11px]`}></i>
                                        {deadlineStatus.displayText}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                        <i className="fa-solid fa-check text-[11px]"></i>
                                        Selesai
                                      </span>
                                    )}

                                    <button
                                      onClick={() => editTask(task)}
                                      className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                      title="Edit Task"
                                    >
                                      <i className="fa-solid fa-pen-to-square text-base"></i>
                                    </button>

                                    <button
                                      onClick={() => deleteTask(task.id)}
                                      className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                      title="Hapus Task"
                                    >
                                      <i className="fa-regular fa-trash-can text-base"></i>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </section>
                  )}

                                    {/* ══════════════════════════════════════════════════════ */}
                  {/* SECTION 1A: JADWAL JOKIAN — COUNTDOWN                  */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <section className="px-4 md:px-8">
                    <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <i className="fa-solid fa-hourglass-half text-violet-600 dark:text-violet-400"></i>
                        <span>Jadwal Jokian (Countdown)</span>
                        <span className="text-xs font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
                          {countdownJokiOrders.length}
                        </span>
                      </h3>
                    </div>

                    <div className="pt-4 pb-6 space-y-3.5">
                      {countdownJokiOrders.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-600/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-500/20">
                            <i className="fa-solid fa-hourglass-half text-2xl"></i>
                          </div>
                          <h4 className="font-bold text-slate-700 dark:text-slate-200 text-base">
                            Tidak ada jadwal countdown aktif
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Order joki dengan countdown akan muncul di sini.
                          </p>
                        </div>
                      ) : (
                        countdownJokiOrders.map((order) => (
                          <JokiOrderCard
                            key={order.id}
                            order={order}
                            now={now}
                            isProcessing={processingOrders.has(order.id)}
                            isStarting={startingOrders.has(order.id)}
                            isAdmin={true}
                            editingUsername={editingUsername}
                            ramAccounts={ramAccounts}
                            loadingAccounts={loadingAccounts}
                            setEditingUsername={setEditingUsername}
                            fetchRamAccounts={fetchRamAccounts}
                            updateOrderUsername={updateOrderUsername}
                            handleCompleteOrder={handleCompleteOrder}
                            handleStartProgressOrder={handleStartProgressOrder}
                            isUsernameUsedInOtherCards={isUsernameUsedInOtherCards}
                          />
                        ))
                      )}
                    </div>
                  </section>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* SECTION 1B: PROGRESS ORDER                             */}
                  {/* ══════════════════════════════════════════════════════ */}
                  <section className="px-4 md:px-8">
                    <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <i className="fa-solid fa-egg text-violet-600 dark:text-violet-400"></i>
                        <span>Progress Order</span>
                        <span className="text-xs font-bold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
                          {progressJokiOrders.length}
                        </span>
                      </h3>
                    </div>

                    <div className="pt-4 pb-6 space-y-3.5">
                      {progressJokiOrders.length === 0 ? (
                        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-4 border border-violet-200 dark:border-violet-500/20">
                            <i className="fa-solid fa-egg text-2xl"></i>
                          </div>
                          <h4 className="font-bold text-slate-700 dark:text-slate-200 text-base">
                            Tidak ada progress order aktif
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Order progress (egg/eternal) akan muncul di sini.
                          </p>
                        </div>
                      ) : (
                        progressJokiOrders.map((order) => (
                          <JokiOrderCard
                            key={order.id}
                            order={order}
                            now={now}
                            isProcessing={processingOrders.has(order.id)}
                            isStarting={startingOrders.has(order.id)}
                            isAdmin={true}
                            editingUsername={editingUsername}
                            ramAccounts={ramAccounts}
                            loadingAccounts={loadingAccounts}
                            setEditingUsername={setEditingUsername}
                            fetchRamAccounts={fetchRamAccounts}
                            updateOrderUsername={updateOrderUsername}
                            handleCompleteOrder={handleCompleteOrder}
                            handleStartProgressOrder={handleStartProgressOrder}
                            isUsernameUsedInOtherCards={isUsernameUsedInOtherCards}
                          />
                        ))
                      )}
                    </div>
                  </section>

                  {/* ══════════════════════════════════════════════════════ */}
                  {/* SECTION 2: BELUM DIJADWALKAN                          */}
                  {/* ══════════════════════════════════════════════════════ */}
                  {unscheduledJokiOrders.length > 0 && (
                    <section className="px-4 md:px-8">
                      <div className="sticky top-0 z-20 -mx-4 md:-mx-8 px-4 md:px-8 py-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800/60">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                          <i className="fa-solid fa-clock text-indigo-600 dark:text-indigo-400"></i>
                          <span>Belum Dijadwalkan</span>
                          <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                            {unscheduledJokiOrders.length}
                          </span>
                        </h3>
                      </div>

                      <div className="pt-4 pb-6 space-y-3.5">
                        {unscheduledJokiOrders.map((order) => (
                          <JokiOrderCard
                            key={order.id}
                            order={order}
                            now={now}
                            isProcessing={processingOrders.has(order.id)}
                            isStarting={startingOrders.has(order.id)}
                            isAdmin={true}
                            editingUsername={editingUsername}
                            ramAccounts={ramAccounts}
                            loadingAccounts={loadingAccounts}
                            setEditingUsername={setEditingUsername}
                            fetchRamAccounts={fetchRamAccounts}
                            updateOrderUsername={updateOrderUsername}
                            handleCompleteOrder={handleCompleteOrder}
                            handleStartProgressOrder={handleStartProgressOrder}
                            isUsernameUsedInOtherCards={isUsernameUsedInOtherCards}
                          />
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* KANBAN VIEW */}
              {currentView === "kanban" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
                        <h4 className="font-extrabold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <i className="fa-solid fa-fire text-xs"></i> Hari Ini
                        </h4>
                      </div>
                      <span className="text-xs bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                        {jokiToday}
                      </span>
                    </div>
                    <div className="space-y-3 flex-1 min-h-50">
                      {jokiOrders
                        .filter((o) => {
                          if (o.completed_by_bot || o.queue_status === "completed") return false;
                          if (!o.estimated_end_at) return false;
                          const endDate = new Date(o.estimated_end_at);
                          endDate.setHours(0, 0, 0, 0);
                          const todayMidnight = new Date();
                          todayMidnight.setHours(0, 0, 0, 0);
                          return endDate.getTime() === todayMidnight.getTime();
                        })
                        .map((order) => (
                          <div
                            key={order.id}
                            className="bg-slate-50 dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-violet-300 dark:hover:border-violet-500/50 transition shadow-sm"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                  {order.roblox_username || "Pembeli"}
                                </h5>
                                <p className="text-[11px] text-violet-600 dark:text-violet-400 font-mono mt-0.5">
                                  #{order.order_id}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                              <span className="font-semibold text-violet-600 dark:text-violet-300">
                                <i className="fa-regular fa-user mr-1 text-[11px]"></i>
                                {order.joki_name || "Ellan"}
                              </span>
                              <span className="font-mono text-amber-600 dark:text-amber-400">
                                <i className="fa-regular fa-clock mr-1"></i>
                                {order.schedule_time ? order.schedule_time.slice(0, 5) : "-"}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                        <h4 className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <i className="fa-solid fa-clock text-xs"></i> Belum Dijadwalkan
                        </h4>
                      </div>
                      <span className="text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">
                        {jokiNotScheduled}
                      </span>
                    </div>
                    <div className="space-y-3 flex-1 min-h-50">
                      {jokiOrders
                        .filter((o) =>
                          !o.estimated_end_at &&
                          o.completed_by_bot !== true &&
                          o.queue_status !== "completed"
                        )
                        .map((order) => (
                          <div
                            key={order.id}
                            className="bg-slate-50 dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-violet-300 dark:hover:border-violet-500/50 transition shadow-sm"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                  {order.roblox_username || "Pembeli"}
                                </h5>
                                <p className="text-[11px] text-violet-600 dark:text-violet-400 font-mono mt-0.5">
                                  #{order.order_id}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                              <span className="font-semibold text-violet-600 dark:text-violet-300">
                                <i className="fa-regular fa-user mr-1 text-[11px]"></i>
                                {order.joki_name || "Ellan"}
                              </span>
                              <span className="font-mono text-slate-500 dark:text-slate-400">
                                <i className="fa-solid fa-hourglass-half mr-1"></i>
                                Belum dijadwalkan
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900/40 rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="flex items-center space-x-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                        <h4 className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-check text-xs"></i> Selesai
                        </h4>
                      </div>
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                        {completedTasks}
                      </span>
                    </div>
                    <div className="space-y-3 flex-1 min-h-50">
                      {tasks
                        .filter((t) => t.completed)
                        .map((task) => (
                          <div
                            key={task.id}
                            className="bg-slate-50 dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-violet-300 dark:hover:border-violet-500/50 transition shadow-sm opacity-70"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-extrabold text-sm text-slate-900 dark:text-white line-through">
                                  {task.title}
                                </h5>
                                <p className="text-[11px] text-violet-600 dark:text-violet-400 font-mono mt-0.5">
                                  {task.category}
                                </p>
                              </div>
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => editTask(task)}
                                  className="text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
                                  title="Edit Task"
                                >
                                  <i className="fa-solid fa-pen-to-square text-xs"></i>
                                </button>
                                <button
                                  onClick={() => deleteTask(task.id)}
                                  className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
                                  title="Hapus Task"
                                >
                                  <i className="fa-regular fa-trash-can text-xs"></i>
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
                              <span className="font-semibold text-violet-600 dark:text-violet-300">
                                <i className="fa-regular fa-user mr-1 text-[11px]"></i>Task
                              </span>
                              <span className="font-mono text-amber-600 dark:text-amber-400">
                                <i className="fa-regular fa-clock mr-1"></i>
                                {formatDate(task.deadline)}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* CONFIRM DIALOG */}
        {confirmDialog.open && (
          <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md z-60 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 md:p-7 shadow-2xl relative animate-in">
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    confirmDialog.variant === "danger"
                      ? "bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30"
                      : confirmDialog.variant === "warning"
                      ? "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30"
                      : confirmDialog.variant === "success"
                      ? "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30"
                      : "bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-500/30"
                  }`}
                >
                  <i
                    className={`fa-solid text-xl ${
                      confirmDialog.variant === "danger"
                        ? "fa-triangle-exclamation"
                        : confirmDialog.variant === "warning"
                        ? "fa-circle-exclamation"
                        : confirmDialog.variant === "success"
                        ? "fa-circle-check"
                        : "fa-circle-info"
                    }`}
                  ></i>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    {confirmDialog.title}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {confirmDialog.message}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
                <button
                  onClick={closeConfirm}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className={`px-6 py-2.5 rounded-xl text-xs font-extrabold text-white shadow-lg transition ${
                    confirmDialog.variant === "danger"
                      ? "bg-linear-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/30"
                      : confirmDialog.variant === "success"
                      ? "bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-emerald-600/30"
                      : "bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-600/30"
                  }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// JOKI ORDER CARD COMPONENT — di-extract biar gak duplikat
// ══════════════════════════════════════════════════════════════

function JokiOrderCard({
  order,
  now,
  isProcessing,
  isStarting,
  isAdmin,
  editingUsername,
  ramAccounts,
  loadingAccounts,
  setEditingUsername,
  fetchRamAccounts,
  updateOrderUsername,
  handleCompleteOrder,
  handleStartProgressOrder,
  isUsernameUsedInOtherCards,
}: {
  order: JokiOrder;
  now: number;
  isProcessing: boolean;
  isStarting: boolean;
  isAdmin: boolean;
  editingUsername: { orderId: number; value: string } | null;
  ramAccounts: { Username: string; UserID: number; Alias: string; Group: string }[];
  loadingAccounts: boolean;
  setEditingUsername: (val: { orderId: number; value: string } | null) => void;
  fetchRamAccounts: () => void;
  updateOrderUsername: (orderId: number, username: string) => void;
  handleCompleteOrder: (order: JokiOrder) => void;
  handleStartProgressOrder: (order: JokiOrder) => void;
  isUsernameUsedInOtherCards: (username: string, currentOrderId: number) => boolean;
}) {
  const isCompletedByBot =
    order.completed_by_bot === true || order.queue_status === "completed";

  const isProgressOrder =
    order.order_type === "progress" ||
    (order.progress_keyword != null && (order.target_count ?? 0) > 0);

  const endDate = order.estimated_end_at
    ? new Date(order.estimated_end_at)
    : null;

  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  let daysLeft: number | null = null;
  let isToday = false;
  let isOverdue = false;

  if (endDate) {
    const endDateMidnight = new Date(endDate);
    endDateMidnight.setHours(0, 0, 0, 0);
    const diffMs = endDateMidnight.getTime() - todayMidnight.getTime();
    daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));
    isToday = daysLeft === 0;
    isOverdue = daysLeft < 0;
  }

  return (
    <div
      className={`bg-white dark:bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-4 md:p-5 transition-all duration-500 ease-out ${
        isProcessing
          ? "opacity-0 scale-95 blur-sm pointer-events-none"
          : isCompletedByBot
          ? "border-emerald-300 dark:border-emerald-500/40 opacity-60"
          : isToday
          ? "border-amber-300 dark:border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
          : "border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/40"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3.5 flex-1 min-w-0">
          <button
            onClick={() => handleCompleteOrder(order)}
            disabled={isProcessing}
            className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
              isProcessing
                ? "border-emerald-500 bg-emerald-500 text-white cursor-wait"
                : isCompletedByBot
                ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                : "border-slate-300 dark:border-slate-600 hover:border-violet-500 text-transparent"
            }`}
            title={isCompletedByBot ? "Konfirmasi Selesai" : "Selesaikan"}
          >
            {isProcessing ? (
              <i className="fa-solid fa-spinner fa-spin text-xs"></i>
            ) : (
              <i className="fa-solid fa-check text-xs"></i>
            )}
          </button>

          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              {editingUsername?.orderId === order.id ? (
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingUsername.value}
                      onChange={(e) =>
                        setEditingUsername({ orderId: order.id, value: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const trimmed = editingUsername.value.trim();
                          if (isUsernameUsedInOtherCards(trimmed, order.id)) {
                            alert(`Username "${trimmed}" sudah dipakai di card lain!`);
                            return;
                          }
                          updateOrderUsername(order.id, trimmed);
                        } else if (e.key === "Escape") {
                          setEditingUsername(null);
                        }
                      }}
                      autoFocus
                      placeholder="Ketik atau pilih dari dropdown..."
                      className="bg-slate-50 dark:bg-slate-950 border border-violet-500 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 min-w-0 flex-1"
                    />
                    <button
                      onClick={() => {
                        const trimmed = editingUsername.value.trim();
                        if (isUsernameUsedInOtherCards(trimmed, order.id)) {
                          alert(`Username "${trimmed}" sudah dipakai di card lain!`);
                          return;
                        }
                        updateOrderUsername(order.id, trimmed);
                      }}
                      className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition shrink-0"
                      title="Simpan"
                    >
                      <i className="fa-solid fa-check text-xs"></i>
                    </button>
                    <button
                      onClick={() => setEditingUsername(null)}
                      className="w-7 h-7 rounded-lg bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 flex items-center justify-center transition shrink-0"
                      title="Batal"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  </div>

                  {loadingAccounts ? (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 px-2">
                      <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>
                      Memuat akun dari RAM...
                    </div>
                  ) : ramAccounts.length > 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto scrollbar-hide">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-1 border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
                        Akun di RAM ({ramAccounts.length})
                      </div>
                      {ramAccounts.map((acc) => {
                        const isUsed = isUsernameUsedInOtherCards(acc.Username, order.id);
                        const isCurrent =
                          acc.Username.toLowerCase() === editingUsername.value.toLowerCase();

                        return (
                          <button
                            key={acc.UserID}
                            onClick={() => {
                              if (isUsed) return;
                              setEditingUsername({
                                orderId: order.id,
                                value: acc.Username,
                              });
                            }}
                            disabled={isUsed}
                            className={`w-full text-left px-2 py-1.5 text-xs flex items-center justify-between gap-2 transition border-b border-slate-100 dark:border-slate-800/50 last:border-0 ${
                              isUsed
                                ? "text-slate-400 dark:text-slate-600 cursor-not-allowed bg-slate-100/50 dark:bg-slate-900/30"
                                : isCurrent
                                ? "bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold"
                                : "text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 cursor-pointer"
                            }`}
                          >
                            <span className="truncate font-mono">{acc.Username}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {isUsed && (
                                <span className="text-[9px] font-bold bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded">
                                  DIPAKAI
                                </span>
                              )}
                              {acc.Alias && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-20">
                                  {acc.Alias}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic px-2">
                      Tidak ada akun di RAM atau gagal load.
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <h4
                    className={`font-extrabold text-base md:text-lg truncate ${
                      isCompletedByBot
                        ? "text-slate-400 dark:text-slate-500 line-through"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {order.roblox_username || "Pembeli"}
                  </h4>

                  <button
                    onClick={() => {
                      setEditingUsername({
                        orderId: order.id,
                        value: order.roblox_username || "",
                      });
                      fetchRamAccounts();
                    }}
                    className="w-6 h-6 rounded-md text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition shrink-0"
                    title="Edit Username"
                  >
                    <i className="fa-solid fa-pen text-[10px]"></i>
                  </button>

                  {isCompletedByBot && (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-emerald-200 dark:border-emerald-500/30">
                      <i className="fa-solid fa-robot text-[9px]"></i>
                      Bot Selesai
                    </span>
                  )}
                </>
              )}

              {isProcessing && (
                <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-blue-200 dark:border-blue-500/30 animate-pulse">
                  <i className="fa-solid fa-spinner fa-spin text-[9px]"></i>
                  Memproses...
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>
                Order{" "}
                <strong className="text-violet-600 dark:text-violet-400 font-semibold">
                  #{order.order_id}
                </strong>
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(order.order_id)}
                className="text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition p-0.5"
                title="Copy Order ID"
              >
                <i className="fa-regular fa-copy text-xs"></i>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="inline-flex items-center space-x-1.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded-lg font-semibold border border-violet-200 dark:border-violet-500/20">
                <i className="fa-regular fa-user text-[11px]"></i>
                <span>{order.joki_name || "Ellan"}</span>
              </span>
              {order.schedule_time && (
                <span className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 dark:border-slate-700/50">
                  <i className="fa-regular fa-clock text-[11px] text-amber-500 dark:text-amber-400"></i>
                  <span>{order.schedule_time.slice(0, 5)}</span>
                </span>
              )}
              {order.schedule_date && (
                <span className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 dark:border-slate-700/50">
                  <i className="fa-regular fa-calendar-days text-[11px] text-indigo-500 dark:text-indigo-400"></i>
                  <span>
                    {new Date(`${order.schedule_date}T00:00:00`).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </span>
              )}
              {order.note && (
                <span className="inline-flex items-center space-x-1.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded-lg font-mono text-[11px] border border-violet-200 dark:border-violet-500/20">
                  <i className="fa-regular fa-note-sticky text-[11px] text-violet-500 dark:text-violet-400"></i>
                  <span>{order.note}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end space-x-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800/60">
          {isCompletedByBot && order.buyer_confirmed ? (
            <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-circle-check text-xs"></i> Buyer Konfirmasi
            </span>
          ) : isCompletedByBot ? (
            <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-hourglass-half text-xs"></i> Menunggu Buyer
            </span>
          ) : isProgressOrder ? (
            <span className="bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-egg text-xs"></i>
              {(order.progress_keyword || "Egg").toUpperCase()} {order.progress_count ?? 0}/
              {order.target_count ?? 0}
            </span>
          ) : isOverdue ? (
            <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-triangle-exclamation text-xs"></i> Overdue
            </span>
          ) : isToday ? (
            <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-fire text-xs text-amber-500 dark:text-amber-400"></i> Hari Ini
            </span>
          ) : daysLeft === 1 ? (
            <span className="bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-calendar-day text-xs"></i> Besok
            </span>
          ) : daysLeft !== null && daysLeft > 1 ? (
            <span className="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-calendar-check text-xs"></i> {daysLeft} hari lagi
            </span>
          ) : (
            <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <i className="fa-solid fa-clock text-xs"></i> Belum dijadwalkan
            </span>
          )}
        </div>
      </div>

      {isProgressOrder && (
        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <i className="fa-solid fa-egg text-violet-500 dark:text-violet-400"></i>
              Progress {(order.progress_keyword || "Egg").toUpperCase()}
            </span>
            <span className="text-sm font-black text-violet-600 dark:text-violet-400 font-mono">
              {order.progress_count ?? 0} / {order.target_count ?? 0}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div
              className="h-full bg-linear-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{
                width: `${
                  order.target_count
                    ? Math.min(100, ((order.progress_count ?? 0) / order.target_count) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {!isProgressOrder && order.estimated_end_at && (
        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <i className="fa-regular fa-clock text-amber-500 dark:text-amber-400"></i>
              Sisa Waktu
            </span>
            <span
              className={`text-sm font-black font-mono tracking-tight ${
                new Date(order.estimated_end_at).getTime() - now <= 0
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {(() => {
                const remaining = Math.max(
                  0,
                  new Date(order.estimated_end_at!).getTime() - now
                );
                const h = Math.floor(remaining / 3600000);
                const m = Math.floor((remaining % 3600000) / 60000);
                const s = Math.floor((remaining % 60000) / 1000);
                if (remaining === 0) return "SEGERA SELESAI";
                return `${h > 0 ? h + ":" : ""}${m
                  .toString()
                  .padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
              })()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
              <i className="fa-solid fa-flag-checkered text-emerald-500 dark:text-emerald-400"></i>
              Selesai Jam
            </span>
            <span className="text-sm font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
              {new Date(order.estimated_end_at).toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              WIB
            </span>
          </div>
        </div>
      )}

      {order.queue_status === "waiting_confirm" && order.order_type === "progress" && (
        <button
          onClick={() => handleStartProgressOrder(order)}
          disabled={isStarting}
          className="w-full mt-3 bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition shadow-lg shadow-violet-600/30 flex items-center justify-center gap-2 text-sm"
        >
          {isStarting ? (
            <>
              <i className="fa-solid fa-spinner fa-spin"></i>
              Memulai...
            </>
          ) : (
            <>
              <i className="fa-solid fa-play"></i>
              Mulai Orderan
            </>
          )}
        </button>
      )}
    </div>
  );
}