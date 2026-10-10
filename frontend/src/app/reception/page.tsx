"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Check,
  Inbox,
  ListTodo,
  PhoneCall,
  Plus,
  RefreshCw,
  UserX,
} from "lucide-react";

import {
  getReceptionDashboard,
  ReceptionDashboardStats,
  updateReceptionBookingStatus,
} from "@/lib/api";
import { useDirectory } from "@/lib/directory";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel } from "@/components/dashboard/panel";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";

/**
 * Receptionist dashboard: front-desk workflow fed entirely by
 * GET /api/v1/reception/dashboard (real database counts, today's real
 * appointment flow and server-computed needs-attention items).
 */
export default function ReceptionDashboardPage() {
  const { accessToken, user } = useAuth();
  const directory = useDirectory();

  const [stats, setStats] = useState<ReceptionDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          {/* Today at a glance */}
          <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
            <StatCard label="Today" value={stats.todayAppointments} />
            <StatCard label="Confirmed" value={stats.confirmedCount} tone="positive" />
            <StatCard label="Unconfirmed" value={stats.unconfirmedCount} tone="warning" />
            <StatCard label="Checked in" value={stats.checkedInCount} tone="info" />
            <StatCard label="Waiting" value={stats.waitingCount} tone="warning" />
            <StatCard label="In treatment" value={stats.inProgressCount} tone="info" />
            <StatCard label="Completed" value={stats.completedCount} tone="positive" />
            <StatCard label="Cancelled" value={stats.cancelledCount} tone="danger" />
          </section>

          {/* Front-desk queues */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <StatCard
              label="Pending requests"
              value={stats.pendingRequestsCount}
              tone="warning"
              href="/reception/appointments/requests"
            />
            <StatCard
              label="Urgent tasks"
              value={stats.urgentTasksCount}
              tone="danger"
              href="/reception/tasks"
            />
            <StatCard
              label="New leads"
              value={stats.newLeadsCount}
              tone="info"
              href="/reception/leads"
            />
            <StatCard
              label="Recalls due"
              value={stats.recallsDueCount}
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
                            {item.status === "requested" && (
                              <button
                                onClick={() => handleStatusChange(item.id, "confirmed")}
                                disabled={actionLoadingId === item.id}
                                className="px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-medium border border-primary/20 transition-colors cursor-pointer"
                              >
                                Confirm
                              </button>
                            )}
                            {item.status === "confirmed" && (
                              <button
                                onClick={() => handleStatusChange(item.id, "arrived")}
                                disabled={actionLoadingId === item.id}
                                className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950 text-[11px] font-medium border border-blue-200/70 dark:border-blue-900/60 transition-colors cursor-pointer"
                              >
                                Check in
                              </button>
                            )}
                            {item.status === "arrived" && (
                              <button
                                onClick={() => handleStatusChange(item.id, "in_progress")}
                                disabled={actionLoadingId === item.id}
                                className="px-3 py-1 rounded-full bg-clay/10 text-clay hover:bg-clay/20 text-[11px] font-medium border border-clay/25 transition-colors cursor-pointer"
                              >
                                Start visit
                              </button>
                            )}
                            {item.status === "in_progress" && (
                              <button
                                onClick={() => handleStatusChange(item.id, "completed")}
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


          {/* Attention queue + daily briefing */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel
              title="Needs attention"
              description="Computed server-side from today's bookings, urgent tasks and new leads."
              action={
                <span className="text-[11px] font-mono text-ink-soft">
                  {stats.needsAttention.length}
                </span>
              }
            >
              {stats.needsAttention.length === 0 ? (
                <EmptyState
                  title="Nothing needs attention"
                  description="Unconfirmed visits, urgent tasks and new leads will surface here."
                  icon={<Check className="h-5 w-5" />}
                />
              ) : (
                <ul className="space-y-1.5">
                  {stats.needsAttention.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <a
                        href={item.link}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl border border-line hover:border-primary/40 transition-colors"
                      >
                        <span
                          className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                            item.priority === "urgent" || item.priority === "high"
                              ? "bg-red-500"
                              : item.priority === "medium"
                              ? "bg-amber-500"
                              : "bg-blue-500"
                          }`}
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-medium text-ink truncate">
                            {item.title}
                          </span>
                          <span className="block text-[11px] text-ink-soft truncate">
                            {item.description}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
          </section>

          {/* Quick links */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <QuickLink href="/reception/appointments/requests" icon={<Inbox className="h-4 w-4" />} label="Intake requests" />
            <QuickLink href="/reception/patients" icon={<ListTodo className="h-4 w-4" />} label="Patient lookup" />
            <QuickLink href="/reception/leads" icon={<UserX className="h-4 w-4" />} label="Lead pipeline" />
            <QuickLink href="/reception/recalls" icon={<PhoneCall className="h-4 w-4" />} label="Recall queue" />
          </section>
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

