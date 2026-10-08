"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  ListTodo,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";

import {
  createReceptionTask,
  getReceptionTasks,
  ReceptionTask,
  updateReceptionTask,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionTasksPage() {
  const { accessToken, user } = useAuth();

  const [tasks, setTasks] = useState<ReceptionTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Create Task Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTasks = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionTasks(
        {
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
        },
        accessToken
      );
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [statusFilter, priorityFilter, accessToken]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await createReceptionTask(
        {
          title,
          description: description || undefined,
          priority,
          dueDate: dueDate || undefined,
        },
        accessToken
      );
      setIsModalOpen(false);
      setTitle("");
      setDescription("");
      await loadTasks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: "open" | "in_progress" | "completed" | "cancelled") => {
    try {
      await updateReceptionTask(taskId, { status: newStatus }, accessToken);
      await loadTasks();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update task.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Operational Tasks Board
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Front-desk to-do items, patient chart follow-ups, insurance verification, and recalls.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Create Task</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {[
            { id: "open", label: "Open" },
            { id: "in_progress", label: "In Progress" },
            { id: "completed", label: "Completed" },
            { id: "", label: "All Tasks" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-700 dark:text-gray-300"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Task List */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading tasks...
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No tasks in this queue
            </p>
            <p className="text-xs text-gray-500">All front-desk task items are up to date.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() =>
                      handleStatusChange(
                        task.id,
                        task.status === "completed" ? "open" : "completed"
                      )
                    }
                    className={`mt-0.5 grid h-5 w-5 place-items-center rounded-md border transition-colors ${
                      task.status === "completed"
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-gray-300 dark:border-gray-700 hover:border-emerald-600"
                    }`}
                  >
                    {task.status === "completed" && <Check className="h-3.5 w-3.5" />}
                  </button>

                  <div className="space-y-1">
                    <p
                      className={`text-xs font-semibold ${
                        task.status === "completed"
                          ? "line-through text-gray-400 dark:text-gray-500"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                      {task.dueDate && <span>Due: {task.dueDate}</span>}
                      {task.patientName && <span>Patient: {task.patientName}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`
                      px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold
                      ${
                        task.priority === "urgent"
                          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          : task.priority === "high"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                      }
                    `}
                  >
                    {task.priority}
                  </span>

                  {task.status !== "completed" && (
                    <button
                      onClick={() => handleStatusChange(task.id, "completed")}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium hover:bg-emerald-100"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-display font-semibold text-gray-900 dark:text-white">
                Create Front-Desk Task
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call patient to verify secondary insurance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Description / Details</label>
                <textarea
                  rows={2}
                  placeholder="Details for yourself or team members..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
                >
                  {isSubmitting ? "Creating..." : "Save Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
