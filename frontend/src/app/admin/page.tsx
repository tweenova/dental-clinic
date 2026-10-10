"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Globe,
  Layers,
  ListTodo,
  Mail,
  MapPin,
  RefreshCw,
  UserX,
  Users,
} from "lucide-react";

import {
  adminGetAnnouncements,
  adminGetServices,
  adminGetTeam,
  Announcement,
  getLocations,
  getReceptionDashboard,
  ReceptionDashboardStats,
  ServiceItem,
  TeamMember,
} from "@/lib/api";
import { useDirectory } from "@/lib/directory";
import { useAuth } from "@/components/providers/auth-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel } from "@/components/dashboard/panel";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";

interface AdminOverview {
  operations: ReceptionDashboardStats | null;
  activeServices: number;
  activeTeam: number;
  locationCount: number;
  activeAnnouncements: number;
}

/**
 * Admin dashboard: clinic-wide operational visibility (today's appointments,
 * queues and follow-ups from the same real dashboard endpoint the
 * front desk uses, since the backend grants admin the reception scope)
 * plus practice configuration counts from the admin CMS endpoints.
 */
export default function AdminOverviewPage() {
  const { user, accessToken } = useAuth();
  const directory = useDirectory();

  const [data, setData] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const [ops, services, team, locations, announcements] = await Promise.allSettled([
        getReceptionDashboard(accessToken),
        adminGetServices(accessToken ?? undefined),
        adminGetTeam(accessToken ?? undefined),
        getLocations(),
        adminGetAnnouncements(accessToken),
      ]);

      if (ops.status === "rejected") {
        throw ops.reason instanceof Error
          ? ops.reason
          : new Error("Failed to load clinic operations data.");
      }

      const activeCount = <T extends { isActive?: boolean }>(items: T[] | null) =>
        Array.isArray(items) ? items.filter((item) => item.isActive !== false).length : 0;

      setData({
        operations: ops.value,
        activeServices: activeCount(
          services.status === "fulfilled" ? (services.value as ServiceItem[]) : []
        ),
        activeTeam: activeCount(
          team.status === "fulfilled" ? (team.value as TeamMember[]) : []
        ),
        locationCount:
          locations.status === "fulfilled" && Array.isArray(locations.value)
            ? locations.value.length
            : 0,
        activeAnnouncements: activeCount(
          announcements.status === "fulfilled" ? (announcements.value as Announcement[]) : []
        ),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);


  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Practice Administration"
          title={`Welcome back, ${user?.fullName.split(" ")[0] ?? ""}`}
          description="Clinic-wide operations, practice content and configuration."
        />
        <LoadingState title="Loading practice overview..." />
      </div>
    );
  }

  const ops = data?.operations ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Practice Administration"
        title={`Welcome back, ${user?.fullName.split(" ")[0] ?? ""}`}
        description="Clinic-wide operations, practice content and configuration."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => loadOverview(false)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
            </Button>
            <Button href="/admin/website" variant="primary" size="sm">
              <Globe className="h-3.5 w-3.5" />
              <span>Website CMS</span>
            </Button>
          </>
        }
      />

      {error && (
        <ErrorState
          title="Dashboard data could not be loaded"
          description={error}
          onRetry={() => loadOverview()}
        />
      )}

      {!error && data && ops && (
        <>
          {/* Clinic operations */}
          <section className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5">
            <StatCard label="Appointments today" value={ops.todayAppointments} />
            <StatCard label="Confirmed" value={ops.confirmedCount} tone="positive" />
            <StatCard label="Unconfirmed" value={ops.unconfirmedCount} tone="warning" />
            <StatCard label="Checked in" value={ops.checkedInCount} tone="info" />
            <StatCard label="Waiting" value={ops.waitingCount} tone="warning" />
            <StatCard label="In treatment" value={ops.inProgressCount} tone="info" />
            <StatCard label="Completed" value={ops.completedCount} tone="positive" />
            <StatCard label="No shows" value={ops.noShowCount} tone="danger" />
          </section>

          {/* Follow-ups + practice configuration */}
          <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <StatCard
              label="Pending requests"
              value={ops.pendingRequestsCount}
              tone="warning"
              href="/reception/appointments/requests"
            />
            <StatCard
              label="Urgent tasks"
              value={ops.urgentTasksCount}
              tone="danger"
              href="/reception/tasks"
            />
            <StatCard label="New leads" value={ops.newLeadsCount} tone="info" href="/reception/leads" />
            <StatCard label="Active services" value={data.activeServices} href="/admin/services" />
            <StatCard label="Active team" value={data.activeTeam} href="/admin/team" />
            <StatCard label="Clinics" value={data.locationCount} href="/admin/locations" />
          </section>


          {/* Today's flow + needs attention */}
          <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <Panel
              title="Today's appointments"
              description="Every booking scheduled for today across the network."
              action={
                <Button href="/reception/appointments" variant="ghost" size="sm">
                  <span>View all</span>
                </Button>
              }
              flush
            >
              {ops.todayFlow.length === 0 ? (
                <EmptyState
                  title="No appointments today"
                  description="New bookings will appear here as the front desk confirms them."
                  action={
                    <Button href="/reception/schedule" variant="secondary" size="sm">
                      <ListTodo className="h-3.5 w-3.5" />
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {ops.todayFlow.map((item) => (
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
                            <StatusBadge status={item.status} />
                            {item.confirmationStatus === "unconfirmed" && (
                              <StatusBadge status="unconfirmed" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>


            <Panel
              title="Needs attention"
              description="Computed server-side from today's bookings, urgent tasks and new leads."
              action={
                <span className="text-[11px] font-mono text-ink-soft">
                  {ops.needsAttention.length}
                </span>
              }
            >
              {ops.needsAttention.length === 0 ? (
                <EmptyState
                  title="Nothing needs attention"
                  description="Unconfirmed visits, urgent tasks and new leads will surface here."
                  icon={<ListTodo className="h-5 w-5" />}
                />
              ) : (
                <ul className="space-y-1.5">
                  {ops.needsAttention.map((item) => (
                    <li key={`${item.type}-${item.id}`}>
                      <a
                        href={item.link}
                        className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-card)] border border-line hover:border-primary/40 transition-colors"
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


            <Panel title="Clinic activity" description="Today's appointment flow, grouped by provider.">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-[var(--radius-card)] border border-line bg-sand/60">
                    <p className="text-[11px] text-ink-soft">First booking</p>
                    <p className="text-lg font-display text-ink leading-tight mt-0.5">
                      {ops.todayFlow[0]?.appointmentTime ?? "None scheduled"}
                    </p>
                  </div>
                  <div className="p-3 rounded-[var(--radius-card)] border border-line bg-sand/60">
                    <p className="text-[11px] text-ink-soft">Total today</p>
                    <p className="text-lg font-display text-ink leading-tight mt-0.5">
                      {ops.todayAppointments}
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-[var(--radius-card)] border border-line bg-sand/60">
                  <p className="text-[11px] font-semibold text-ink mb-1.5">Waiting and requests</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[11px] font-medium border border-red-200/70 dark:border-red-900/60">
                      <UserX className="h-3 w-3" />
                      {ops.waitingCount} waiting
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[11px] font-medium border border-blue-200/70 dark:border-blue-900/60">
                      <Bell className="h-3 w-3" />
                      {ops.pendingRequestsCount} pending requests
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[11px] font-medium border border-amber-200/70 dark:border-amber-900/60">
                      <ListTodo className="h-3 w-3" />
                      {ops.urgentTasksCount} urgent tasks
                    </span>
                  </div>
                </div>
              </div>
            </Panel>


            <Panel
              title="Practice quick links"
              description="Common practice administration and front-office tasks."
            >
              <div className="grid grid-cols-2 gap-2">
                <a href="/admin/website" className="p-3 rounded-[var(--radius-card)] border border-line flex items-center gap-2 text-xs font-medium text-ink hover:border-primary/40 transition-colors">
                  <Globe className="text-primary" />
                  <span>Website CMS</span>
                </a>
                <a href="/admin/services" className="p-3 rounded-[var(--radius-card)] border border-line flex items-center gap-2 text-xs font-medium text-ink hover:border-primary/40 transition-colors">
                  <Layers className="text-primary" />
                  <span>Services & pricing</span>
                </a>
                <a href="/admin/team" className="p-3 rounded-[var(--radius-card)] border border-line flex items-center gap-2 text-xs font-medium text-ink hover:border-primary/40 transition-colors">
                  <Users className="text-primary" />
                  <span>Staff directory</span>
                </a>
                <a href="/admin/locations" className="p-3 rounded-[var(--radius-card)] border border-line flex items-center gap-2 text-xs font-medium text-ink hover:border-primary/40 transition-colors">
                  <MapPin className="text-primary" />
                  <span>Clinics & locations</span>
                </a>
              </div>
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}

