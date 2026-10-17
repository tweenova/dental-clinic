"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Clock,
  Inbox,
  ListTodo,
  PhoneCall,
  Plus,
  RefreshCw,
  UserX,
  X,
} from "lucide-react";

import {
  createReceptionTask,
  getReceptionDashboard,
  ReceptionAttentionItem,
  ReceptionDashboardStats,
  snoozeReceptionQueueItem,
  updateReceptionBookingStatus,
} from "@/lib/api";
import { useDirectory } from "@/lib/directory";
import { useAuth } from "@/components/providers/auth-provider";
import {
  isRequested,
  isExpected,
  isWaiting,
  isInProgress,
  APPOINTMENT_STATUS,
} from "@/lib/statuses";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel } from "@/components/dashboard/panel";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";

/**
 * Receptionist dashboard: front-desk workflow fed entirely by
 * GET /api/v1/reception/dashboard (real database counts, today's real
 * appointment flow and server-computed needs-action queue).
 */
export default function ReceptionDashboardPage() {
  const { accessToken, user } = useAuth();
  const directory = useDirectory();

  const [stats, setStats] = useState<ReceptionDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Quick task modal state
  const [taskModalItem, setTaskModalItem] = useState<ReceptionAttentionItem | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"urgent" | "high" | "medium" | "low">("high");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Queue filter tab
  const [queueFilter, setQueueFilter] = useState<string>("all");

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      setStats(await getReceptionDashboard(accessToken));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
  }, [accessToken]);

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    setActionLoadingId(bookingId);
    try {
      await updateReceptionBookingStatus(bookingId, newStatus, undefined, accessToken);
      await loadData(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update appointment status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSnooze = async (item: ReceptionAttentionItem, durationHours = 24) => {
    setActionLoadingId(`snooze-${item.id}`);
    try {
      const itemType = item.taskId ? "task" : "booking";
      const itemId = item.targetId || item.bookingId || item.taskId || item.id;
      await snoozeReceptionQueueItem(itemType, itemId, durationHours, accessToken);
      await loadData(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to snooze queue item.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenTaskModal = (item: ReceptionAttentionItem) => {
    setTaskModalItem(item);
    setTaskTitle(`Follow up: ${item.title}`);
    setTaskPriority(item.priority === "urgent" ? "urgent" : "high");
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskModalItem || !taskTitle.trim()) return;
    setIsSubmittingTask(true);
    try {
      await createReceptionTask(
        {
          title: taskTitle.trim(),
          priority: taskPriority,
          bookingId: taskModalItem.bookingId || undefined,
          patientId: taskModalItem.patientId || undefined,
        },
        accessToken
      );
      setTaskModalItem(null);
      await loadData(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Provider schedule derived from today's real bookings.
  const providerSchedule = (stats?.todayFlow ?? []).reduce<
    Array<{ providerId: string; count: number; firstSlot: string; lastSlot: string }>
  >((acc, item) => {
    const key = item.providerId || "unassigned";
    const entry = acc.find((p) => p.providerId === key);
    if (!entry) {
      acc.push({
        providerId: key,
        count: 1,
        firstSlot: item.appointmentTime,
        lastSlot: item.appointmentTime,
      });
    } else {
      entry.count += 1;
      if (item.appointmentTime < entry.firstSlot) entry.firstSlot = item.appointmentTime;
      if (item.appointmentTime > entry.lastSlot) entry.lastSlot = item.appointmentTime;
    }
    return acc;
  }, []);

  const firstAppointment = stats?.todayFlow[0]?.appointmentTime ?? null;

  const filteredQueue = (stats?.needsAttention ?? []).filter((item) => {
    if (queueFilter === "all") return true;
    return item.type === queueFilter;
  });


  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Front-Office Operations"
          title={`Welcome back, ${user?.fullName.split(" ")[0] ?? ""}`}
          description="Today's schedule, waiting-room flow and front-desk follow-ups."
        />
        <LoadingState title="Loading front-desk metrics..." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Front-Office Operations"
        title={`Welcome back, ${user?.fullName.split(" ")[0] ?? ""}`}
        description="Today's schedule, waiting-room flow and front-desk follow-ups."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadData(false)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
            </Button>
            <Button href="/reception/schedule" variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5" />
              <span>New Booking</span>
            </Button>
          </>
        }
      />

      {error && (
        <ErrorState
          title="Dashboard data could not be loaded"
          description={error}
          onRetry={() => loadData()}
        />
      )}

      {!error && stats && (
        <>
          {/* Actionable Front-Desk Queues */}
          <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <StatCard
              label="Online requests"
              value={stats.pendingRequestsCount}
              tone={stats.pendingRequestsCount > 0 ? "warning" : "neutral"}
              href="/reception/appointments/requests"
            />
            <StatCard
              label="Unconfirmed tomorrow"
              value={stats.unconfirmedTomorrowCount}
              tone={stats.unconfirmedTomorrowCount > 0 ? "warning" : "neutral"}
              href="/reception/reminders"
            />
            <StatCard
              label="Waiting delayed"
              value={stats.waitingDelayedCount}
              tone={stats.waitingDelayedCount > 0 ? "danger" : "neutral"}
              href="#needs-action-queue"
            />
            <StatCard
              label="Overdue tasks"
              value={stats.overdueTasksCount}
              tone={stats.overdueTasksCount > 0 ? "danger" : "neutral"}
              href="/reception/tasks"
            />
            <StatCard
              label="Past unresolved"
              value={stats.pastUnresolvedCount}
              tone={stats.pastUnresolvedCount > 0 ? "danger" : "neutral"}
              href="/reception/end-of-day"
            />
            <StatCard
              label="Recalls due"
              value={stats.recallsDueCount}
              tone={stats.recallsDueCount > 0 ? "info" : "neutral"}
              href="/reception/recalls"
            />
          </section>


          {/* Today's appointment flow */}
          <Panel
            title="Today's appointments"
            description="Live status of every booking scheduled for today."
            action={
              <Button href="/reception/appointments" variant="ghost" size="sm">
                <span>View all</span>
              </Button>
            }
            flush
          >
            {stats.todayFlow.length === 0 ? (
              <EmptyState
                title="No appointments today"
                description="When bookings are scheduled for today they will appear here with live status controls."
                action={
                  <Button href="/reception/schedule" variant="secondary" size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Open schedule</span>
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line text-left text-[10px] font-mono uppercase tracking-wider text-ink-soft">
                      <th className="px-4 py-2 font-semibold">Time</th>
                      <th className="px-4 py-2 font-semibold">Patient</th>
                      <th className="px-4 py-2 font-semibold">Provider</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {stats.todayFlow.map((item) => (
                      <tr key={item.id} className="hover:bg-sand/60 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-ink whitespace-nowrap">
                          {item.appointmentTime}
                        </td>
                        <td className="px-4 py-2.5">
                          <a
                            href={`tel:${item.patientPhone}`}
                            className="font-medium text-ink hover:text-primary"
                          >
                            {item.patientName}
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-ink-soft">
                          {item.providerId
                            ? directory.providerName(item.providerId) || "Team member"
                            : "Unassigned"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <StatusBadge status={item.status} />
                            {item.confirmationStatus === "unconfirmed" && (
                              <StatusBadge status="unconfirmed" />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {isRequested(item.status) && (
                              <button
                                onClick={() => handleStatusChange(item.id, APPOINTMENT_STATUS.CONFIRMED)}
                                disabled={actionLoadingId === item.id}
                                className="px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-medium border border-primary/20 transition-colors cursor-pointer"
                              >
                                Confirm
                              </button>
                            )}
                            {isExpected(item.status) && (
                              <button
                                onClick={() => handleStatusChange(item.id, APPOINTMENT_STATUS.ARRIVED)}
                                disabled={actionLoadingId === item.id}
                                className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950 text-[11px] font-medium border border-blue-200/70 dark:border-blue-900/60 transition-colors cursor-pointer"
                              >
                                Check in
                              </button>
                            )}
                            {isWaiting(item.status) && (
                              <button
                                onClick={() => handleStatusChange(item.id, APPOINTMENT_STATUS.IN_PROGRESS)}
                                disabled={actionLoadingId === item.id}
                                className="px-3 py-1 rounded-full bg-clay/10 text-clay hover:bg-clay/20 text-[11px] font-medium border border-clay/25 transition-colors cursor-pointer"
                              >
                                Start visit
                              </button>
                            )}
                            {isInProgress(item.status) && (
                              <button
                                onClick={() => handleStatusChange(item.id, APPOINTMENT_STATUS.COMPLETED)}
                                disabled={actionLoadingId === item.id}
                                className="px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-medium border border-primary/20 transition-colors cursor-pointer"
                              >
                                Complete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>


          {/* Needs-action queue + daily briefing */}
          <section id="needs-action-queue" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Panel
                title="Needs-action queue"
                description="Actionable triage queue: online requests, unconfirmed visits, waiting delays, overdue tasks, and past unresolved visits."
                action={
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                    {stats.needsAttention.length} pending
                  </span>
                }
              >
                {/* Filter tabs */}
                <div className="flex flex-wrap gap-1.5 mb-3 pb-2 border-b border-line">
                  {[
                    { id: "all", label: `All (${stats.needsAttention.length})` },
                    { id: "online_request", label: `Online requests (${stats.pendingRequestsCount})` },
                    { id: "unconfirmed_tomorrow", label: `Tomorrow (${stats.unconfirmedTomorrowCount})` },
                    { id: "waiting_delayed", label: `Waiting delayed (${stats.waitingDelayedCount})` },
                    { id: "overdue_task", label: `Overdue tasks (${stats.overdueTasksCount})` },
                    { id: "past_unresolved", label: `Past unresolved (${stats.pastUnresolvedCount})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setQueueFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        queueFilter === tab.id
                          ? "bg-ink text-sand font-semibold"
                          : "bg-sand hover:bg-sand/80 text-ink-soft hover:text-ink"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {filteredQueue.length === 0 ? (
                  <EmptyState
                    title="No items in this queue"
                    description="Online requests, unconfirmed visits, delayed waiting patients, overdue tasks, and unresolved past visits will appear here with inline actions."
                    icon={<Check className="h-5 w-5" />}
                  />
                ) : (
                  <ul className="space-y-2">
                    {filteredQueue.map((item) => {
                      const isActioning =
                        actionLoadingId === item.id ||
                        actionLoadingId === `snooze-${item.id}` ||
                        actionLoadingId === item.bookingId;
                      return (
                        <li
                          key={`${item.type}-${item.id}`}
                          className="p-3 rounded-xl border border-line bg-card/60 hover:border-primary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                                item.priority === "urgent"
                                  ? "bg-red-500 animate-pulse"
                                  : item.priority === "high"
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-ink">
                                  {item.title}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sand border border-line text-ink-soft uppercase">
                                  {item.type.replace(/_/g, " ")}
                                </span>
                              </div>
                              <p className="text-[11px] text-ink-soft mt-0.5">
                                {item.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {/* Inline Confirm */}
                            {item.bookingId && item.availableActions?.includes("confirm") && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.bookingId!, APPOINTMENT_STATUS.CONFIRMED)}
                                disabled={isActioning}
                                className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-medium border border-primary/20 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Confirm
                              </button>
                            )}

                            {/* Inline Check in */}
                            {item.bookingId && item.availableActions?.includes("check_in") && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(item.bookingId!, APPOINTMENT_STATUS.ARRIVED)}
                                disabled={isActioning}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-[11px] font-medium border border-blue-200/70 transition-colors cursor-pointer disabled:opacity-50"
                              >
                                Check in
                              </button>
                            )}

                            {/* Inline Snooze (24h) */}
                            {item.availableActions?.includes("snooze") && (
                              <button
                                type="button"
                                onClick={() => handleSnooze(item, 24)}
                                disabled={isActioning}
                                className="px-2.5 py-1 rounded-lg bg-sand hover:bg-sand/80 text-ink text-[11px] font-medium border border-line transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                title="Snooze for 24 hours"
                              >
                                <Clock className="h-3 w-3 text-ink-soft" />
                                <span>Snooze</span>
                              </button>
                            )}

                            {/* Inline Create Task */}
                            {item.availableActions?.includes("create_task") && (
                              <button
                                type="button"
                                onClick={() => handleOpenTaskModal(item)}
                                disabled={isActioning}
                                className="px-2.5 py-1 rounded-lg bg-sand hover:bg-sand/80 text-ink text-[11px] font-medium border border-line transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                                title="Create linked follow-up task"
                              >
                                <Plus className="h-3 w-3 text-ink-soft" />
                                <span>+ Task</span>
                              </button>
                            )}

                            {/* Direct Link */}
                            {item.link && (
                              <a
                                href={item.link}
                                className="px-2 py-1 rounded-lg text-ink-soft hover:text-ink hover:bg-sand/60 text-[11px] font-medium transition-colors"
                              >
                                View
                              </a>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>

            <div className="lg:col-span-1">
              <Panel
                title="Daily briefing"
                description="Derived from today's real bookings."
              >
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl border border-line bg-sand/60">
                      <p className="text-[11px] text-ink-soft">First appointment</p>
                      <p className="text-lg font-display text-ink leading-tight mt-0.5">
                        {firstAppointment || "None scheduled"}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-line bg-sand/60">
                      <p className="text-[11px] text-ink-soft">Total bookings</p>
                      <p className="text-lg font-display text-ink leading-tight mt-0.5">
                        {stats.todayAppointments}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-ink mb-1.5">
                      Provider schedules today
                    </p>
                    {providerSchedule.length === 0 ? (
                      <p className="text-xs text-ink-soft italic">
                        No provider appointments booked today.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {providerSchedule.map((p) => (
                          <div
                            key={p.providerId}
                            className="px-3 py-2 rounded-xl border border-line flex items-center justify-between"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-ink truncate">
                                {p.providerId === "unassigned"
                                  ? "Unassigned"
                                  : directory.providerName(p.providerId) || "Team member"}
                              </p>
                              <p className="text-[10px] font-mono text-ink-soft">
                                {p.firstSlot} - {p.lastSlot}
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono">
                              {p.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </div>
          </section>

          {/* Quick links */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <QuickLink href="/reception/appointments/requests" icon={<Inbox className="h-4 w-4" />} label="Intake requests" />
            <QuickLink href="/reception/patients" icon={<ListTodo className="h-4 w-4" />} label="Patient lookup" />
            <QuickLink href="/reception/leads" icon={<UserX className="h-4 w-4" />} label="Lead pipeline" />
            <QuickLink href="/reception/recalls" icon={<PhoneCall className="h-4 w-4" />} label="Recall queue" />
          </section>

          {/* Quick Task Modal */}
          {taskModalItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
              <div className="w-full max-w-md bg-card rounded-2xl border border-line p-5 shadow-elevated space-y-4">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Create Follow-up Task</h3>
                    <p className="text-[11px] text-ink-soft">Linked to {taskModalItem.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaskModalItem(null)}
                    className="p-1 rounded-lg hover:bg-sand text-ink-soft cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateTask} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-ink mb-1">
                      Task Title
                    </label>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-sand/40 focus:outline-hidden focus:border-primary"
                      placeholder="e.g. Call patient to follow up"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-ink mb-1">
                      Priority
                    </label>
                    <select
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as "urgent" | "high" | "medium" | "low")}
                      className="w-full text-xs px-3 py-2 rounded-xl border border-line bg-sand/40 focus:outline-hidden focus:border-primary"
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setTaskModalItem(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isSubmittingTask || !taskTitle.trim()}
                    >
                      {isSubmittingTask ? "Saving..." : "Create Task"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 p-3 rounded-xl border border-line bg-bone hover:border-primary/40 transition-colors text-xs font-medium text-ink"
    >
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

