"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";

import {
  DoctorPatientSummary,
  DoctorTaskItem,
  createDoctorTask,
  getDoctorTasks,
  markDoctorTaskDone,
  searchDoctorPatients,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DoctorTasksPage() {
  const { accessToken } = useAuth();

  const [tasks, setTasks] = useState<DoctorTaskItem[]>([]);
  const [filter, setFilter] = useState<"pending" | "done" | "all">("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingId, setIsMarkingId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalDescription, setModalDescription] = useState("");
  const [modalPriority, setModalPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [modalDueDate, setModalDueDate] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<DoctorPatientSummary | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientSearchResults, setPatientSearchResults] = useState<DoctorPatientSummary[]>([]);
  const [isSearchingPatients, setIsSearchingPatients] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getDoctorTasks(undefined, accessToken)
      .then((res) => {
        if (isMounted) setTasks(res.items || []);
      })
      .catch((err) => {
        console.error("Failed to load doctor tasks:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  // Live patient search for task creation
  useEffect(() => {
    if (!patientSearch.trim()) return;
    let isMounted = true;
    const timer = setTimeout(async () => {
      setIsSearchingPatients(true);
      try {
        const results = await searchDoctorPatients(patientSearch.trim(), accessToken);
        if (isMounted) setPatientSearchResults(results.slice(0, 5));
      } catch (err) {
        console.error("Patient search error:", err);
      } finally {
        if (isMounted) setIsSearchingPatients(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [patientSearch, accessToken]);

  const handleMarkDone = async (taskId: string) => {
    setIsMarkingId(taskId);
    try {
      const updated = await markDoctorTaskDone(taskId, accessToken);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "done", completedAt: updated.completedAt } : t))
      );
      setActionMessage("Task marked as done.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to mark task done.");
    } finally {
      setIsMarkingId(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim()) {
      setFormError("Task title is required.");
      return;
    }
    if (!selectedPatient) {
      setFormError("Please select a patient linked to this task.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await createDoctorTask(
        {
          title: modalTitle.trim(),
          patientId: selectedPatient.id,
          description: modalDescription.trim() || undefined,
          priority: modalPriority,
          dueDate: modalDueDate ? modalDueDate : undefined,
        },
        accessToken
      );
      setTasks((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setModalTitle("");
      setModalDescription("");
      setModalPriority("medium");
      setModalDueDate("");
      setSelectedPatient(null);
      setPatientSearch("");
      setPatientSearchResults([]);
      setActionMessage("Task created and queued for reception.");
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return t.status === "pending";
    if (filter === "done") return t.status === "done";
    return true;
  });

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "urgent":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
      case "high":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
      case "medium":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="eyebrow mb-1">Doctor Portal</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Clinical Tasks & Handoffs
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Manage your patient tasks, mark completed actions, and assign follow-up items to reception.
          </p>
        </div>
        <Button
          onClick={() => {
            setFormError(null);
            setIsModalOpen(true);
          }}
          className="gap-2 shrink-0 bg-primary text-white hover:bg-primary-dark"
        >
          <Plus className="h-4 w-4" />
          Create Task for Reception
        </Button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Tabs / Filters */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setFilter("pending")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === "pending"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-muted"
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter("done")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === "done"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-muted"
          }`}
        >
          Completed ({doneCount})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-muted"
          }`}
        >
          All Tasks ({tasks.length})
        </button>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="p-12 text-center text-ink-soft">Loading tasks...</div>
      ) : filteredTasks.length === 0 ? (
        <Card className="p-12 text-center">
          <ListTodo className="h-10 w-10 text-ink-soft mx-auto mb-3 opacity-60" />
          <p className="text-base font-medium text-ink">No tasks found</p>
          <p className="text-xs text-ink-soft mt-1">
            {filter === "pending"
              ? "You have completed all pending tasks."
              : "No tasks match the selected filter."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredTasks.map((t) => (
            <Card
              key={t.id}
              className={`p-4 transition-all border ${
                t.status === "done" ? "opacity-75 bg-muted/30" : "hover:border-primary/40"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded border ${getPriorityBadge(
                        t.priority
                      )}`}
                    >
                      {t.priority}
                    </span>

                    {t.isCreatedByMe && (
                      <span className="text-[11px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded">
                        Created by You
                      </span>
                    )}

                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded ${
                        t.status === "done"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                      }`}
                    >
                      {t.status === "done" ? "Completed" : "Pending"}
                    </span>
                  </div>

                  <h3 className={`text-base font-medium ${t.status === "done" ? "line-through text-ink-soft" : "text-ink"}`}>
                    {t.title}
                  </h3>

                  {t.description && (
                    <p className="text-sm text-ink-soft whitespace-pre-wrap">{t.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-ink-soft pt-1">
                    {t.patientId && (
                      <Link
                        href={`/doctor/patients/${t.patientId}`}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                      >
                        <User className="h-3.5 w-3.5" />
                        <span>{t.patientName || "View Patient File"}</span>
                      </Link>
                    )}

                    {t.dueDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Due: {new Date(t.dueDate).toLocaleDateString()}
                      </span>
                    )}

                    {t.createdAt && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Created: {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {t.status !== "done" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isMarkingId === t.id}
                    onClick={() => handleMarkDone(t.id)}
                    className="shrink-0 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:border-emerald-300"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {isMarkingId === t.id ? "Marking..." : "Mark Done"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-lg font-display font-medium text-ink">
                Create Patient Task for Reception
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-ink-soft hover:text-ink transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-4">
              {/* Patient Selection */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Linked Patient <span className="text-rose-500">*</span>
                </label>
                {selectedPatient ? (
                  <div className="flex items-center justify-between p-2.5 bg-muted rounded-md border border-line text-xs">
                    <div>
                      <p className="font-semibold text-ink">
                        {selectedPatient.fullName}
                      </p>
                      <p className="text-ink-soft">
                        Phone: {selectedPatient.phone}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedPatient(null);
                        setPatientSearch("");
                      }}
                      className="text-xs h-7 text-rose-600 hover:text-rose-700"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-soft" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search patient by name or phone..."
                        className="w-full text-xs pl-9 pr-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                      />
                    </div>
                    {isSearchingPatients && (
                      <p className="text-[11px] text-ink-soft mt-1">Searching patients...</p>
                    )}
                    {patientSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-surface border border-line rounded-md shadow-lg overflow-hidden divide-y divide-line">
                        {patientSearchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(p);
                              setPatientSearchResults([]);
                              setPatientSearch("");
                            }}
                            className="w-full text-left p-2.5 hover:bg-muted text-xs transition-colors"
                          >
                            <p className="font-medium text-ink">{p.fullName}</p>
                            <p className="text-[11px] text-ink-soft">
                              Phone: {p.phone}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Task Title */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Task Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g. Call patient regarding post-op check, Collect test results"
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                />
              </div>

              {/* Priority & Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Priority
                  </label>
                  <select
                    value={modalPriority}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      setModalPriority(e.target.value as "low" | "medium" | "high" | "urgent")
                    }
                    className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={modalDueDate}
                    onChange={(e) => setModalDueDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                  >
                  </input>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Notes / Instructions
                </label>
                <textarea
                  rows={3}
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Provide clinical details or specific instructions for reception..."
                  className="w-full text-xs p-3 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink resize-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary text-white hover:bg-primary-dark"
                >
                  {isSubmitting ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
