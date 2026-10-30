"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import type { Task } from "@/lib/types";
import AppShell from "@/app/components/AppShell";
import { ConfirmDialog, useConfirm } from "@/app/components/ConfirmDialog";
import {
  StatCard,
  FilterPill,
  SearchInput,
  ViewToggle,
  SectionHeader,
  EmptyState,
  KanbanColumn,
} from "@/app/components/ui";

type TaskFilter = "All" | "Today" | "Overdue" | "Done";

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

const dayOf = (date: string) => {
  const d = new Date(date + "T00:00:00");
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const todayTime = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const getDefaultReminder = () => {
  try {
    return localStorage.getItem("defaultReminder") || "20:00";
  } catch {
    return "20:00";
  }
};

async function fetchTasks(username: string): Promise<Task[] | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("username", username)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return null;
  }
  return data || [];
}

const formatDate = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

function getDeadlineStatus(deadline: string) {
  const difference = Math.round((dayOf(deadline) - todayTime()) / 86400000);

  if (difference < 0)
    return {
      displayText: "Overdue",
      icon: "fa-triangle-exclamation",
      className:
        "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30",
    };
  if (difference === 0)
    return {
      displayText: "Hari Ini",
      icon: "fa-fire",
      className:
        "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
    };
  if (difference === 1)
    return {
      displayText: "Besok",
      icon: "fa-calendar-day",
      className:
        "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
    };
  return {
    displayText: `${difference} hari lagi`,
    icon: "fa-calendar-check",
    className:
      "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  };
}

// ══════════════════════════════════════════════════════════════
// PAGE
// ══════════════════════════════════════════════════════════════

export default function TasksPage() {
  const { user: currentUser } = useCurrentUser();
  const { dialog, showConfirm, closeConfirm } = useConfirm();

  const [tasks, setTasks] = useState<Task[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [reminder, setReminder] = useState("20:00");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [category, setCategory] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TaskFilter>("All");
  const [view, setView] = useState<"list" | "kanban">("list");

  // ── Load ─────────────────────────────────────────────────────
  // Reminder default diisi ulang dari localStorage tiap form dibuka (resetForm)
  useEffect(() => {
    if (!currentUser) return;
    fetchTasks(currentUser.username).then((data) => {
      if (data) setTasks(data);
    });
  }, [currentUser]);

  // ── Form handlers ────────────────────────────────────────────
  const resetForm = () => {
    setTitle("");
    setDeadline("");
    setReminder(getDefaultReminder());
    setPriority("Medium");
    setCategory("");
    setNotes("");
    setEditingId(null);
    setShowForm(false);
  };

  const addTask = async () => {
    if (!title || !deadline) {
      alert("Title dan deadline wajib diisi!");
      return;
    }
    if (!currentUser) {
      alert("User belum siap. Coba refresh halaman.");
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
      username: currentUser.username,
    };

    const { error } = await supabase.from("tasks").insert([newTask]);
    if (error) {
      console.error(error);
      alert("Gagal menyimpan task!");
      return;
    }

    setTasks((prev) => [newTask, ...prev]);
    resetForm();
  };

  const updateTask = async () => {
    if (!title || !deadline || editingId === null) {
      alert("Title dan deadline wajib diisi!");
      return;
    }

    const changes = {
      title,
      deadline,
      reminder: reminder || null,
      reminder_sent: false,
      reminder_last_sent: null,
      priority,
      category,
      notes,
    };

    const { error } = await supabase.from("tasks").update(changes).eq("id", editingId);
    if (error) {
      console.error(error);
      alert("Gagal mengupdate task!");
      return;
    }

    setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...changes } : t)));
    resetForm();
  };

  const editTask = (task: Task) => {
    setEditingId(task.id);
    setTitle(task.title);
    setDeadline(task.deadline);
    setReminder(task.reminder || "");
    setPriority(task.priority);
    setCategory(task.category);
    setNotes(task.notes || "");
    setShowForm(true);
  };

  const deleteTask = (id: number) => {
    showConfirm(
      "Hapus Task?",
      "Yakin ingin menghapus task ini? Tindakan ini tidak bisa dibatalkan.",
      "danger",
      "Ya, Hapus",
      async () => {
        closeConfirm();
        const { error } = await supabase.from("tasks").delete().eq("id", id);
        if (error) {
          console.error(error);
          alert("Gagal menghapus task!");
          return;
        }
        setTasks((prev) => prev.filter((t) => t.id !== id));
      }
    );
  };

  const toggleTask = (id: number) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = !task.completed;

    showConfirm(
      next ? "Tandai Selesai?" : "Batalkan Selesai?",
      next ? `Tandai "${task.title}" sebagai selesai?` : `Kembalikan "${task.title}" menjadi belum selesai?`,
      next ? "success" : "info",
      next ? "Ya, Selesai" : "Ya, Kembalikan",
      async () => {
        closeConfirm();
        const { error } = await supabase.from("tasks").update({ completed: next }).eq("id", id);
        if (error) {
          console.error(error);
          alert("Gagal mengubah status task!");
          return;
        }
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: next } : t)));
      }
    );
  };

  // ── Derived data ─────────────────────────────────────────────
  const today = todayTime();
  const completedCount = tasks.filter((t) => t.completed).length;
  const todayCount = tasks.filter((t) => !t.completed && dayOf(t.deadline) === today).length;
  const overdueCount = tasks.filter((t) => !t.completed && dayOf(t.deadline) < today).length;

  const searched = tasks.filter((t) => {
    const q = search.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.category || "").toLowerCase().includes(q);
  });

  const filteredTasks = searched
    .filter((t) => {
      if (filter === "Today") return dayOf(t.deadline) === today;
      if (filter === "Overdue") return !t.completed && dayOf(t.deadline) < today;
      if (filter === "Done") return t.completed;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1; // yang selesai di bawah
      return dayOf(a.deadline) - dayOf(b.deadline);
    });

  const kanbanUrgent = searched.filter((t) => !t.completed && dayOf(t.deadline) <= today);
  const kanbanUpcoming = searched.filter((t) => !t.completed && dayOf(t.deadline) > today);
  const kanbanDone = searched.filter((t) => t.completed);

  // ══════════════════════════════════════════════════════════════
  // JSX
  // ══════════════════════════════════════════════════════════════

  return (
    <>
      <AppShell
        active="tasks"
        title="Tugas Kuliah"
        subtitle="Kelola deadline dan reminder tugas kuliah"
        currentUser={currentUser}
        refreshKey={`${tasks.length}-${completedCount}`}
        headerActions={
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center space-x-2 bg-linear-to-r from-violet-600 via-indigo-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-4 py-2 rounded-xl text-xs md:text-sm font-bold shadow-lg shadow-violet-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <i className="fa-solid fa-plus text-xs"></i>
            <span>Task Baru</span>
          </button>
        }
      >
        {/* METRICS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Tugas" value={tasks.length} icon="fa-book-open" color="violet" footerIcon="fa-layer-group" footerText="Semua tugas kuliah" />
          <StatCard label="Hari Ini" value={todayCount} icon="fa-fire" color="amber" footerIcon="fa-clock" footerText="Deadline hari ini" />
          <StatCard label="Overdue" value={overdueCount} icon="fa-triangle-exclamation" color="rose" footerIcon="fa-bell" footerText="Lewat deadline" />
          <StatCard label="Selesai" value={completedCount} icon="fa-circle-check" color="emerald" footerIcon="fa-square-check" footerText="Sudah tuntas" />
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 lg:pb-0 custom-scrollbar">
            <FilterPill active={filter === "All"} onClick={() => setFilter("All")}>
              Semua ({tasks.length})
            </FilterPill>
            <FilterPill active={filter === "Today"} onClick={() => setFilter("Today")} dot="bg-amber-400">
              Hari Ini
            </FilterPill>
            <FilterPill active={filter === "Overdue"} onClick={() => setFilter("Overdue")} dot="bg-rose-400">
              Overdue
            </FilterPill>
            <FilterPill active={filter === "Done"} onClick={() => setFilter("Done")} dot="bg-emerald-400">
              Selesai
            </FilterPill>
          </div>
          <div className="flex items-center space-x-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Cari tugas / mata kuliah..." />
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        {/* LIST VIEW */}
        {view === "list" && (
          <section>
            <SectionHeader icon="fa-clipboard-list" title="Daftar Tugas" count={filteredTasks.length} />
            <div className="pt-4 pb-6 space-y-3.5">
              {filteredTasks.length === 0 ? (
                <EmptyState
                  icon="fa-regular fa-clipboard"
                  title="Tidak ada tugas ditemukan"
                  desc="Coba ubah filter atau tambah tugas baru."
                />
              ) : (
                filteredTasks.map((task) => {
                  const status = getDeadlineStatus(task.deadline);
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
                            <h4
                              className={`font-extrabold text-base md:text-lg text-slate-900 dark:text-white truncate ${
                                task.completed ? "line-through text-slate-400 dark:text-slate-400" : ""
                              }`}
                            >
                              {task.title}
                            </h4>

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
                              {task.category && (
                                <span className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-500/20">
                                  <i className="fa-solid fa-tag text-[11px]"></i>
                                  <span className="truncate max-w-45">{task.category}</span>
                                </span>
                              )}
                              {task.notes && (
                                <span className="inline-flex items-center gap-1.5 bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 px-3 py-1.5 rounded-xl text-xs font-semibold border border-violet-200 dark:border-violet-500/20">
                                  <i className="fa-regular fa-note-sticky text-[11px] text-violet-500 dark:text-violet-400"></i>
                                  <span className="truncate max-w-45">{task.notes}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {!task.completed ? (
                            <span className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border ${status.className}`}>
                              <i className={`fa-solid ${status.icon} text-[11px]`}></i>
                              {status.displayText}
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

        {/* KANBAN VIEW */}
        {view === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6">
            <KanbanColumn title="Mendesak" icon="fa-fire" color="amber" count={kanbanUrgent.length}>
              {kanbanUrgent.map((t) => (
                <TaskMiniCard key={t.id} task={t} onEdit={editTask} onDelete={deleteTask} />
              ))}
            </KanbanColumn>
            <KanbanColumn title="Mendatang" icon="fa-calendar" color="indigo" count={kanbanUpcoming.length}>
              {kanbanUpcoming.map((t) => (
                <TaskMiniCard key={t.id} task={t} onEdit={editTask} onDelete={deleteTask} />
              ))}
            </KanbanColumn>
            <KanbanColumn title="Selesai" icon="fa-circle-check" color="emerald" count={kanbanDone.length}>
              {kanbanDone.map((t) => (
                <TaskMiniCard key={t.id} task={t} onEdit={editTask} onDelete={deleteTask} />
              ))}
            </KanbanColumn>
          </div>
        )}

        {/* FORM MODAL */}
        {showForm && (
          <div className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-in">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 dark:bg-violet-600/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/30 flex items-center justify-center">
                    <i className="fa-solid fa-pen-to-square text-base"></i>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                      {editingId !== null ? "Edit Tugas" : "Tambah Tugas Baru"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Masukkan rincian tugas</p>
                  </div>
                </div>
                <button onClick={resetForm} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-2 rounded-lg">
                  <i className="fa-solid fa-xmark text-lg"></i>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Tugas</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Laporan PBL"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Deadline</label>
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
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Daily Reminder</label>
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
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Priority</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as "Low" | "Medium" | "High")}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Mata Kuliah</label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="PBPAB, PUDAR..."
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-violet-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1.5">Notes</label>
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
                    {editingId !== null ? "Update Tugas" : "Simpan Tugas"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AppShell>

      <ConfirmDialog dialog={dialog} onClose={closeConfirm} />
    </>
  );
}

// ══════════════════════════════════════════════════════════════
// KANBAN MINI CARD
// ══════════════════════════════════════════════════════════════

function TaskMiniCard({
  task,
  onEdit,
  onDelete,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  onDelete: (id: number) => void;
}) {
  const status = getDeadlineStatus(task.deadline);
  return (
    <div
      className={`bg-slate-50 dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-violet-300 dark:hover:border-violet-500/50 transition shadow-sm ${
        task.completed ? "opacity-70" : ""
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <h5 className={`font-extrabold text-sm text-slate-900 dark:text-white truncate ${task.completed ? "line-through" : ""}`}>
            {task.title}
          </h5>
          {task.category && (
            <p className="text-[11px] text-violet-600 dark:text-violet-400 font-mono mt-0.5 truncate">{task.category}</p>
          )}
        </div>
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
            title="Edit"
          >
            <i className="fa-solid fa-pen-to-square text-xs"></i>
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition"
            title="Hapus"
          >
            <i className="fa-regular fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
        <span className="font-mono">
          <i className="fa-regular fa-calendar mr-1"></i>
          {formatDate(task.deadline)}
        </span>
        {!task.completed && (
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${status.className}`}>{status.displayText}</span>
        )}
      </div>
    </div>
  );
}
