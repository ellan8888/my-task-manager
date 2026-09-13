"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { registerPushSubscription } from "@/lib/push";

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
};

type JokiOrder = {
  id: number;
  order_id: string;
  roblox_username: string | null;
  product: string | null;
  joki_name: string | null;
  schedule_date: string;
  schedule_time: string;
  note: string | null;
  reminder_sent: boolean;
  completed: boolean;
  created_at: string;
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [jokiOrders, setJokiOrders] = useState<JokiOrder[]>([]);
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
  const [filter, setFilter] = useState<"All" | "Today" | "Upcoming" | "Overdue">("All");

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

  // =========================
  // LOAD TASKS
  // =========================

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setTasks(data || []);
  };

  const loadJokiOrders = async () => {
    const { data, error } = await supabase
      .from("joki_orders")
      .select("*")
      .eq("completed", false)
      .order("schedule_date", { ascending: true })
      .order("schedule_time", { ascending: true });

    if (error) {
      console.error("Gagal mengambil data Jokian:", error);
      return;
    }

    setJokiOrders(data || []);
  };

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
    loadTasks();
    loadJokiOrders();
  }, []);

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

  // =========================
  // ADD TASK
  // =========================

  const addTask = async () => {
    if (!title || !deadline) {
      alert("Title dan deadline wajib diisi!");
      return;
    }

    const newTask: Task = {
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

  // =========================
  // TEST PUSH
  // =========================

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

      const subscription = await registerPushSubscription();
      console.log("Subscription:", JSON.stringify(subscription));
      alert("Push notification berhasil diaktifkan!");
    } catch (error) {
      console.error("Gagal mengaktifkan push notification:", error);
      alert("Gagal mengaktifkan push notification. Cek Console.");
    }
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

  // =========================
  // UPDATE TASK
  // =========================

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

  // =========================
  // DELETE TASK
  // =========================

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

  // =========================
  // TOGGLE COMPLETE
  // =========================

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

  // =========================
  // RESET FORM
  // =========================

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

  // =========================
  // DEADLINE STATUS
  // =========================

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

  // =========================
  // FORMAT DATE
  // =========================

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        task.category.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const taskDate = new Date(task.deadline + "T00:00:00");
      taskDate.setHours(0, 0, 0, 0);

      if (filter === "Today") return taskDate.getTime() === today.getTime();
      if (filter === "Upcoming") return taskDate.getTime() > today.getTime();
      if (filter === "Overdue") return taskDate.getTime() < today.getTime() && !task.completed;

      return true;
    })
    .sort((a, b) => {
      return new Date(a.deadline + "T00:00:00").getTime() - new Date(b.deadline + "T00:00:00").getTime();
    });

  // =========================
  // STATISTICS
  // =========================

  const completedTasks = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.filter((task) => !task.completed).length;

  const jokiToday = jokiOrders.filter(o => new Date(`${o.schedule_date}T${o.schedule_time}`).toDateString() === new Date().toDateString()).length;
  const jokiScheduled = jokiOrders.length - jokiToday;

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
      `}</style>

      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased selection:bg-violet-500 selection:text-white flex flex-col relative">

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
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Tokoku-Bot Sync
                  </p>
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

              <button className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 text-sm font-medium transition-all group">
                <i className="fa-solid fa-share-nodes w-5 text-center group-hover:text-violet-500 dark:group-hover:text-violet-400 transition"></i>
                <span>Rekap Teks WA / Discord</span>
                <span className="ml-auto text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded font-mono">
                  Export
                </span>
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200 text-sm font-medium transition-all group"
              >
                <i className="fa-solid fa-robot w-5 text-center group-hover:text-violet-500 dark:group-hover:text-violet-400 transition"></i>
                <span>Webhook Tokoku-bot</span>
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
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center font-bold">
                    E
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Ellan Worker</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Administrator</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                title={isDark ? "Mode Terang" : "Mode Gelap"}
              >
                <i className={`fa-solid ${isDark ? "fa-sun" : "fa-moon"} text-sm`}></i>
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
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

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6">
            {/* Settings Panel */}
            {showSettings && (
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
                    <input
                      type="time"
                      value={defaultReminder}
                      onChange={(e) => updateDefaultReminder(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-200 outline-none transition focus:border-violet-500"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Waktu ini akan menjadi default saat membuat task baru.
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
            )}

            {/* Metrics Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-violet-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-violet-500/10 dark:bg-violet-600/10 rounded-full blur-xl transition"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Total Order
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

              <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-300">
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-xl transition"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <i className="fa-solid fa-calendar-days text-xs"></i>
                      <span>Terjadwal</span>
                    </p>
                    <h3 className="text-2xl md:text-3xl font-black text-indigo-600 dark:text-indigo-300 mt-1">
                      {jokiScheduled}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-500/20">
                    <i className="fa-solid fa-calendar-day text-base"></i>
                  </div>
                </div>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  <i className="fa-solid fa-list-ol mr-1.5"></i>
                  <span>Antrean Berikutnya</span>
                </div>
              </div>

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

            {/* Controls Toolbar */}
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
                  Semua ({tasks.length})
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
                  onClick={() => setFilter("Upcoming")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    filter === "Upcoming"
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Terjadwal
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

            {/* Form Modal */}
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

            {/* Header Section Banner */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-gamepad"></i>
                </div>
                <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base md:text-lg">
                  Jadwal Task & Jokian Aktif
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Menampilkan {filteredTasks.length} task • {jokiOrders.length} jokian
              </p>
            </div>

            {/* LIST VIEW CONTAINER */}
            {currentView === "list" && (
              <div className="space-y-3.5">
                {/* MY TASKS SECTION */}
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-clipboard-list text-violet-600 dark:text-violet-400"></i>
                    <span>My Tasks</span>
                  </h3>
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
                          className={`relative bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 mb-3 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 ${
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
                                  <span className="inline-flex items-center gap-1.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-violet-200 dark:border-violet-500/20">
                                    <i className="fa-regular fa-user text-[11px]"></i>
                                    <span>Ellan</span>
                                  </span>

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
                                  className={`hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border ${deadlineStatus.className}`}
                                >
                                  <i className={`fa-solid ${deadlineStatus.icon} text-[11px]`}></i>
                                  {deadlineStatus.displayText}
                                </span>
                              ) : (
                                <span className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
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

                {/* JOKIAN SECTION */}
                <div className="mt-6">
                  <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-gamepad text-violet-600 dark:text-violet-400"></i>
                    <span>Jadwal Jokian</span>
                  </h3>
                  {jokiOrders.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-600/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-4 border border-violet-200 dark:border-violet-500/20">
                        <i className="fa-solid fa-folder-open text-2xl"></i>
                      </div>
                      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-base">
                        Tidak ada jadwal jokian
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Jadwal dari Tokoku-bot akan muncul otomatis di sini.
                      </p>
                    </div>
                  ) : (
                    jokiOrders.map((order) => {
                      const scheduleDate = new Date(`${order.schedule_date}T${order.schedule_time}`);
                      const isToday = scheduleDate.toDateString() === new Date().toDateString();
                      return (
                        <div
                          key={order.id}
                          className={`bg-white dark:bg-slate-900/50 backdrop-blur-xl border rounded-2xl p-4 md:p-5 transition-all duration-300 mb-3 ${
                            isToday
                              ? "border-amber-300 dark:border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                              : "border-slate-200 dark:border-slate-800 hover:border-violet-300 dark:hover:border-violet-500/40"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                              <button
                                onClick={() =>
                                  showConfirm(
                                    "Selesaikan Jokian?",
                                    `Tandai jokian "${order.roblox_username || "Pembeli"}" sebagai selesai?`,
                                    "success",
                                    "Ya, Selesai",
                                    async () => {
                                      const { error } = await supabase
                                        .from("joki_orders")
                                        .delete()
                                        .eq("id", order.id);
                                      if (error) {
                                        console.error(error);
                                        alert("Gagal menyelesaikan Jokian!");
                                        return;
                                      }
                                      setJokiOrders((current) =>
                                        current.filter((item) => item.id !== order.id)
                                      );
                                      closeConfirm();
                                    }
                                  )
                                }
                                className="mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 border-slate-300 dark:border-slate-600 hover:border-violet-500 text-transparent"
                              >
                                <i className="fa-solid fa-check text-xs"></i>
                              </button>
                              <div className="space-y-2 flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-extrabold text-base md:text-lg text-slate-900 dark:text-white truncate">
                                    {order.roblox_username || "Pembeli"}
                                  </h4>
                                </div>
                                <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
                                  <span>
                                    Order{" "}
                                    <strong className="text-violet-600 dark:text-violet-400 font-semibold">
                                      #{order.order_id}
                                    </strong>
                                  </span>
                                  <button
                                    onClick={() =>
                                      navigator.clipboard.writeText(order.order_id)
                                    }
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
                                  <span className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 dark:border-slate-700/50">
                                    <i className="fa-regular fa-clock text-[11px] text-amber-500 dark:text-amber-400"></i>
                                    <span>{order.schedule_time.slice(0, 5)}</span>
                                  </span>
                                  <span className="inline-flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 dark:border-slate-700/50">
                                    <i className="fa-regular fa-calendar-days text-[11px] text-indigo-500 dark:text-indigo-400"></i>
                                    <span>
                                      {new Date(
                                        `${order.schedule_date}T00:00:00`
                                      ).toLocaleDateString("id-ID", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                      })}
                                    </span>
                                  </span>
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
                              {isToday ? (
                                <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                  <i className="fa-solid fa-fire text-xs text-amber-500 dark:text-amber-400"></i> Hari Ini
                                </span>
                              ) : (
                                <span className="bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                  <i className="fa-solid fa-calendar text-xs"></i> Terjadwal
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* KANBAN VIEW CONTAINER */}
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
                      .filter(
                        (o) =>
                          new Date(`${o.schedule_date}T${o.schedule_time}`).toDateString() ===
                          new Date().toDateString()
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
                            <span className="font-mono text-amber-600 dark:text-amber-400">
                              <i className="fa-regular fa-clock mr-1"></i>
                              {order.schedule_time.slice(0, 5)}
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
                        <i className="fa-solid fa-calendar-days text-xs"></i> Terjadwal
                      </h4>
                    </div>
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full font-bold">
                      {jokiScheduled}
                    </span>
                  </div>
                  <div className="space-y-3 flex-1 min-h-50">
                    {jokiOrders
                      .filter(
                        (o) =>
                          new Date(`${o.schedule_date}T${o.schedule_time}`).toDateString() !==
                          new Date().toDateString()
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
                            <span className="font-mono text-amber-600 dark:text-amber-400">
                              <i className="fa-regular fa-clock mr-1"></i>
                              {order.schedule_time.slice(0, 5)}
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
        </main>

        {/* CUSTOM CONFIRM DIALOG */}
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