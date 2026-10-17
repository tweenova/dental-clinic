"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ListTodo,
  Mail,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";

import {
  createReceptionRecallTask,
  getReceptionRecalls,
  ReceptionRecall,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionRecallsPage() {
  const { accessToken } = useAuth();

  const [recalls, setRecalls] = useState<ReceptionRecall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [taskCreatingId, setTaskCreatingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadRecalls = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionRecalls(accessToken);
      setRecalls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadRecalls();
    });
  }, [accessToken]);

  const handleCreateTask = async (recall: ReceptionRecall) => {
    setTaskCreatingId(recall.patientId);
    setFeedbackMessage(null);
    try {
      await createReceptionRecallTask(
        {
          patientId: recall.patientId,
          serviceId: recall.serviceId || undefined,
          dueDate: recall.dueDate,
        },
        accessToken
      );
      setFeedbackMessage(`Call task logged for ${recall.patientName}.`);
      await loadRecalls();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create recall task.");
    } finally {
      setTaskCreatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Preventive & Maintenance Recalls
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Patients due for routine follow-up based on their service catalog intervals (e.g. 90-day perio, 180-day cleanings) with no future visit scheduled.
          </p>
        </div>

        <button
          onClick={loadRecalls}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs cursor-pointer transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {feedbackMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{feedbackMessage}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-emerald-600 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Recall Queue */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading recall queue...
          </div>
        ) : recalls.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No recalls due
            </p>
            <p className="text-xs text-gray-500">
              Every patient with a completed procedure has an active or future appointment booked.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recalls.map((r) => {
              const isOverdue = r.status === "overdue";
              return (
                <div
                  key={`${r.patientId}-${r.lastVisitDate}`}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <Link
                        href={`/reception/patients/${r.patientId}`}
                        className="font-semibold text-sm text-primary hover:underline flex items-center gap-1.5"
                      >
                        <User className="h-4 w-4" />
                        <span>{r.patientName}</span>
                      </Link>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold ${
                          isOverdue
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.recallIntervalDays && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          {r.recallIntervalDays}d cycle
                        </span>
                      )}
                      {r.hasOpenTask && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                          <ListTodo className="h-3 w-3" />
                          <span>Task Open</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-700 dark:text-gray-300">
                      Procedure: <span className="font-semibold">{r.serviceName || "Routine Cleaning & Exam"}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400 text-xs">
                      <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-mono hover:underline">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                        {r.phone}
                      </a>
                      {r.email && (
                        <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:underline">
                          <Mail className="h-3.5 w-3.5 text-primary" />
                          {r.email}
                        </a>
                      )}
                      {r.lastVisitDate && (
                        <span>Last Visit: <strong className="font-mono">{r.lastVisitDate}</strong></span>
                      )}
                      {r.dueDate && (
                        <span className="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          <span>Due: <strong className="font-mono font-semibold">{r.dueDate}</strong></span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`tel:${r.phone}`}
                      className="px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-medium transition-colors"
                    >
                      Call
                    </a>

                    {!r.hasOpenTask ? (
                      <button
                        type="button"
                        disabled={taskCreatingId === r.patientId}
                        onClick={() => handleCreateTask(r)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs font-medium hover:bg-sky-100 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <ListTodo className="h-3.5 w-3.5" />
                        <span>{taskCreatingId === r.patientId ? "Creating..." : "Create Call Task"}</span>
                      </button>
                    ) : (
                      <Link
                        href="/reception/tasks"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-medium hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-colors"
                      >
                        <ListTodo className="h-3.5 w-3.5" />
                        <span>View Task</span>
                      </Link>
                    )}

                    <Link
                      href="/reception/schedule"
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Book Visit</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
