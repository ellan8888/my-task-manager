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
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reminder, setReminder] = useState("");
  const [priority, setPriority] =
    useState<"Low" | "Medium" | "High">("Medium");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");

const [filter, setFilter] = useState<
  "All" | "Today" | "Upcoming" | "Overdue"
>("All");

  const [notificationPermission, setNotificationPermission] =
  useState<NotificationPermission>("default");

  



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

  

  useEffect(() => {
  if ("Notification" in window) {
    setNotificationPermission(Notification.permission);
  }
}, []);

  useEffect(() => {
    loadTasks();
  }, []);

  useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log(
          "✅ Service Worker registered:",
          registration.scope
        );
      })
      .catch((error) => {
        console.error(
          "❌ Service Worker registration failed:",
          error
        );
      });
  }
}, []);

  // =========================
  // ADD TASK
  // =========================

  

  const addTask = async () => {
    if (!title || !deadline) {
      alert("Title dan daeadline wajib diisi!");
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
};

    const { error } = await supabase
      .from("tasks")
      .insert([newTask]);

    if (error) {
      console.error(error);
      alert("Gagal menyimpan task!");
      return;
    }

    setTasks([newTask, ...tasks]);

    resetForm();
  };

  // =========================
  // EDIT TASK
  // =========================

  const testPushNotification = async () => {
  try {
    const response = await fetch("/api/push", {
      method: "POST",
    });

    const result = await response.json();

    console.log("📨 Push API result:", result);

    if (result.success) {
      alert(
        `✅ Push berhasil dikirim!\n\nTerkirim: ${result.sent}\nGagal: ${result.failed}`
      );
    } else {
      alert(
        `❌ Push gagal:\n${result.message || result.error}`
      );
    }
  } catch (error) {
    console.error(
      "❌ Test push error:",
      error
    );

    alert(
      "❌ Gagal menghubungi Push API."
    );
  }
};

  const enableNotifications = async () => {
  if (!("Notification" in window)) {
    alert("Browser kamu tidak mendukung notifikasi.");
    return;
  }

  try {
    const permission =
      await Notification.requestPermission();

    setNotificationPermission(permission);

    if (permission !== "granted") {
      alert("Permission notifikasi ditolak.");
      return;
    }

    const subscription =
      await registerPushSubscription();

    console.log(
      "📨 Subscription:",
      JSON.stringify(subscription)
    );

    alert("✅ Push notifiction bearhasil diaktifkan!");
  } catch (error) {
    console.error(
      "❌ Gagal mengaktifkan push notification:",
      error
    );

    alert(
      "Gagal mengaktifkan push notification. Cek Console."
    );
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
    const confirmDelete = window.confirm(
      "Yakin ingin menghapus task ini?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Gagal menghapus task!");
      return;
    }

    setTasks(tasks.filter((task) => task.id !== id));
  };

  // =========================
  // TOGGLE COMPLETE
  // =========================

  const toggleTask = async (id: number) => {
    const task = tasks.find((task) => task.id === id);

    if (!task) return;

    const newCompletedStatus = !task.completed;

    const { error } = await supabase
      .from("tasks")
      .update({
        completed: newCompletedStatus,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Gagal mengubah status task!");
      return;
    }

    setTasks(
      tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              completed: newCompletedStatus,
            }
          : task
      )
    );
  };

  // =========================
  // RESET FORM
  // =========================

  const resetForm = () => {
  setTitle("");
  setDeadline("");
  setReminder("");
  setPriority("Medium");
  setCategory("");
  setEditingId(null);
  setShowForm(false);
};

  // =========================
  // DEADLINE STATUS
  // =========================

  const getDeadlineStatus = (deadline: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(deadline + "T00:00:00");
    target.setHours(0, 0, 0, 0);

    const difference =
      Math.ceil(
        (target.getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24)
      );

    if (difference < 0) {
      return {
        label: "Overdue",
        className:
          "bg-red-100 text-red-700",
      };
    }

    if (difference === 0) {
      return {
        label: "Today",
        className:
          "bg-orange-100 text-orange-700",
      };
    }

    if (difference === 1) {
      return {
        label: "Tomorrow",
        className:
          "bg-yellow-100 text-yellow-700",
      };
    }

    return {
      label: `${difference} days left`,
      className:
        "bg-green-100 text-green-700",
    };
  };

  // =========================
  // FORMAT DATE
  // =========================

  const formatDate = (date: string) => {
    return new Date(date + "T00:00:00").toLocaleDateString(
      "en-US",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  };

  const filteredTasks = tasks.filter((task) => {
  const matchesSearch =
    task.title
      .toLowerCase()
      .includes(search.toLowerCase()) ||
    task.category
      .toLowerCase()
      .includes(search.toLowerCase());

  if (!matchesSearch) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const taskDate = new Date(
    task.deadline + "T00:00:00"
  );
  taskDate.setHours(0, 0, 0, 0);

  if (filter === "Today") {
    return taskDate.getTime() === today.getTime();
  }

  if (filter === "Upcoming") {
    return taskDate.getTime() > today.getTime();
  }

  if (filter === "Overdue") {
    return (
      taskDate.getTime() < today.getTime() &&
      !task.completed
    );
  }

  return true;
});

  // =========================
  // STATISTICS
  // =========================

  const completedTasks = tasks.filter(
    (task) => task.completed
  ).length;

  const pendingTasks = tasks.filter(
    (task) => !task.completed
  ).length;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* HEADER */}

      <header className="sticky top-0 z-20 border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
              My Task Manager
            </h1>

            <p className="text-xs text-gray-500 sm:text-sm">
              Organize your day, one task at a time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
  onClick={testPushNotification}
  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100"
>
  🧪 Test Paush
</button>
  {notificationPermission !== "granted" && (
    <button
      onClick={enableNotifications}
      className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
    >
      🔔
      <span className="hidden sm:inline ml-1">
        Enable
      </span>
    </button>
  )}

  <button
    onClick={() => {
      resetForm();
      setShowForm(true);
    }}
    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700"
  >
    <span className="sm:hidden">＋</span>
    <span className="hidden sm:inline">
      ＋ Add Task
    </span>
  </button>
</div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 sm:py-8">

        {/* STATISTICS */}

        <section className="grid grid-cols-3 gap-3 sm:gap-5">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">
              Total
            </p>

            <p className="mt-1 text-2xl font-bold text-gray-900">
              {tasks.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">
              Completed
            </p>

            <p className="mt-1 text-2xl font-bold text-green-600">
              {completedTasks}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs text-gray-500">
              Pending
            </p>

            <p className="mt-1 text-2xl font-bold text-orange-500">
              {pendingTasks}
            </p>
          </div>
        </section>

        {/* FORM */}

        {showForm && (
          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId !== null
                  ? "Edit Task"
                  : "Add New Task"}
              </h2>

              <button
                onClick={resetForm}
                className="text-xl text-gray-400 hover:text-gray-700"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">

              {/* TITLE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Task
                </label>

                <input
                  type="text"
                  value={title}
                  onChange={(e) =>
                    setTitle(e.target.value)
                  }
                  placeholder="Contoh: Kerjakan laporan"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
                />
              </div>

              {/* DEADLINE */}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Deadline
                </label>

                <input
                  type="date"
                  value={deadline}
                  onChange={(e) =>
                    setDeadline(e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
                />
              </div>

              <div>
  <label className="mb-1.5 block text-sm font-medium text-gray-700">
    Daily Reminder
  </label>

  <input
    type="time"
    value={reminder}
    onChange={(e) =>
      setReminder(e.target.value)
    }
    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-900"
  />

  <p className="mt-1 text-xs text-gray-400">
    Kamu akan mendapat reminder setiap hari pada waktu ini sampai deadline.
  </p>
</div>

              {/* PRIORITY + CATEGORY */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Priority
                  </label>

                  <select
                    value={priority}
                    onChange={(e) =>
                      setPriority(
                        e.target.value as
                          | "Low"
                          | "Medium"
                          | "High"
                      )
                    }
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-900"
                  >
                    <option value="Low">
                      Low
                    </option>

                    <option value="Medium">
                      Medium
                    </option>

                    <option value="High">
                      High
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Category
                  </label>

                  <input
                    type="text"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value)
                    }
                    placeholder="Kuliah, Kerja, Personal..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-900"
                  />
                </div>
              </div>

              {/* BUTTON */}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={
                    editingId !== null
                      ? updateTask
                      : addTask
                  }
                  className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700"
                >
                  {editingId !== null
                    ? "Update Task"
                    : "Save Task"}
                </button>

                <button
                  onClick={resetForm}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TASK LIST */}

        <section className="mt-7">
          <div className="mb-4">
  <input
    type="text"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="🔍 Search tasks..."
    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-gray-900"
  />
</div>

<div className="mb-5 flex gap-2 overflow-x-auto pb-1">
  {(["All", "Today", "Upcoming", "Overdue"] as const).map(
    (item) => (
      <button
        key={item}
        onClick={() => setFilter(item)}
        className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
          filter === item
            ? "bg-gray-900 text-white"
            : "bg-white text-gray-600 shadow-sm hover:bg-gray-100"
        }`}
      >
        {item}
      </button>
    )
  )}
</div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              My Tasks
            </h2>

            <span className="text-sm text-gray-500">
              {pendingTasks} pending
            </span>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
              <div className="text-4xl">📝</div>

              <h3 className="mt-3 font-semibold text-gray-800">
  No tasks found
</h3>

<p className="mt-1 text-sm text-gray-500">
  Tidak ada task yang sesuai dengan filter kamu.
</p>

              <button
                onClick={() => setShowForm(true)}
                className="mt-5 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white"
              >
                ＋ Add Task
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const deadlineStatus =
                  getDeadlineStatus(task.deadline);

                return (
                  <div
                    key={task.id}
                    className={`rounded-2xl bg-white p-4 shadow-sm transition sm:p-5 ${
                      task.completed
                        ? "opacity-60"
                        : ""
                    }`}
                  >
                    <div className="flex gap-3">

                      {/* CHECKBOX */}

                      <button
                        onClick={() =>
                          toggleTask(task.id)
                        }
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm ${
                          task.completed
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-gray-300 hover:border-gray-500"
                        }`}
                      >
                        {task.completed && "✓"}
                      </button>

                      {/* CONTENT */}

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <h3
                            className={`font-semibold text-gray-900 ${
                              task.completed
                                ? "line-through"
                                : ""
                            }`}
                          >
                            {task.title}
                          </h3>

                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() =>
                                editTask(task)
                              }
                              className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                            >
                              ✏️
                            </button>

                            <button
                              onClick={() =>
                                deleteTask(task.id)
                              }
                              className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-red-50 hover:text-red-600"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        {/* INFO */}

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">

                          <span
                            className={`rounded-full px-2.5 py-1 font-medium ${
                              task.priority === "High"
                                ? "bg-red-100 text-red-700"
                                : task.priority ===
                                  "Medium"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {task.priority}
                          </span>

                          {task.category && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-700">
                              {task.category}
                            </span>
                          )}

                          {!task.completed && (
                            <span
                              className={`rounded-full px-2.5 py-1 font-medium ${deadlineStatus.className}`}
                            >
                              {deadlineStatus.label}
                            </span>
                          )}
                        </div>

                        {/* DATE */}

                        <p className="mt-3 text-xs text-gray-500">
  📅 {formatDate(task.deadline)}
</p>

{task.reminder && (
  <p className="mt-1 text-xs text-gray-500">
    🔔 Daily reminder at {task.reminder.slice(0, 5)}
  </p>
)}

                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}