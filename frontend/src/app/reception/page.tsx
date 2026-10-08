"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle,
  Clock,
  ExternalLink,
  FileCheck,
  Inbox,
  ListTodo,
  Phone,
  Plus,
  RefreshCw,
  Search,
  User,
  UserCheck,
  Users,
  UserX,
  Zap,
} from "lucide-react";

import {
  getReceptionDashboard,
  getReceptionHuddle,
  ReceptionDashboardStats,
  ReceptionDailyHuddle,
  updateReceptionBookingStatus,
  updateReceptionBookingConfirmation,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReceptionDashboardPage() {
  const router = useRouter();
  const { accessToken, user } = useAuth();

  const [stats, setStats] = useState<ReceptionDashboardStats | null>(null);
  const [huddle, setHuddle] = useState<ReceptionDailyHuddle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [statsData, huddleData] = await Promise.all([
        getReceptionDashboard(accessToken),
        getReceptionHuddle(accessToken),
      ]);
      setStats(statsData);
      setHuddle(huddleData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard metrics.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
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

  const handleConfirm = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    try {
      await updateReceptionBookingConfirmation(bookingId, "confirmed", accessToken);
      await loadData(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to confirm appointment.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-xs font-mono uppercase tracking-wider text-ink-soft">
          Loading Front-Desk Command Center...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Top Welcome Header (Matching Admin Overview style) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow mb-1">Front-Office Operations</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Welcome back, {user?.fullName.split(" ")[0]}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Real-time practice schedule, patient arrivals, waiting room flow, and urgent triage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadData(false)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>{isRefreshing ? "Updating..." : "Refresh"}</span>
          </Button>

          <Link href="/reception/schedule">
            <Button variant="primary" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              <span>New Booking</span>
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[var(--radius-card)] border border-red-200 dark:border-red-900 bg-red-50/80 dark:bg-red-950/30 text-red-800 dark:text-red-300 text-xs flex items-center gap-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Today at a Glance (Using Design System Cards) */}
      <section className="space-y-3">
        <p className="eyebrow">1. Today at a Glance</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <Card surface="bone" shadow="subtle" className="p-4">
            <p className="text-[11px] font-medium text-ink-soft">Today Total</p>
            <p className="text-2xl font-display text-ink font-normal mt-1">
              {stats?.todayAppointments ?? 0}
            </p>
          </Card>

          <Card surface="cream" shadow="subtle" className="p-4 border-emerald-200/60 dark:border-emerald-900/40">
            <p className="text-[11px] font-medium text-primary dark:text-emerald-400">Confirmed</p>
            <p className="text-2xl font-display text-primary dark:text-emerald-400 font-semibold mt-1">
              {stats?.confirmed ?? 0}
            </p>
          </Card>

          <Card surface="bone" shadow="subtle" className="p-4 border-amber-200/60 dark:border-amber-900/40">
            <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Unconfirmed</p>
            <p className="text-2xl font-display text-amber-600 dark:text-amber-400 font-semibold mt-1">
              {stats?.unconfirmed ?? 0}
            </p>
          </Card>

          <Card surface="bone" shadow="subtle" className="p-4">
            <p className="text-[11px] font-medium text-blue-700 dark:text-blue-400">Checked In</p>
            <p className="text-2xl font-display text-blue-600 dark:text-blue-400 font-semibold mt-1">
              {stats?.checkedIn ?? 0}
            </p>
          </Card>

          <Card surface="bone" shadow="subtle" className="p-4">
            <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">Waiting</p>
            <p className="text-2xl font-display text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
              {stats?.waiting ?? 0}
            </p>
          </Card>

          <Card surface="cream" shadow="subtle" className="p-4">
            <p className="text-[11px] font-medium text-teal-700 dark:text-teal-400">In Chair</p>
            <p className="text-2xl font-display text-teal-600 dark:text-teal-400 font-semibold mt-1">
              {stats?.inProgress ?? 0}
            </p>
          </Card>

          <Card surface="bone" shadow="subtle" className="p-4">
            <p className="text-[11px] font-medium text-ink-soft">Completed</p>
            <p className="text-2xl font-display text-ink font-normal mt-1">
              {stats?.completed ?? 0}
            </p>
          </Card>

          <Card surface="bone" shadow="subtle" className="p-4 border-red-200/60 dark:border-red-900/40">
            <p className="text-[11px] font-medium text-red-700 dark:text-red-400">No-Show/Can</p>
            <p className="text-2xl font-display text-red-600 dark:text-red-400 font-semibold mt-1">
              {(stats?.noShow ?? 0) + (stats?.cancelled ?? 0)}
            </p>
          </Card>
        </div>
      </section>

      {/* 2. Today's Patient Flow Queue */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="eyebrow">2. Today&apos;s Patient Flow</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold font-mono">
              Live Queue
            </span>
          </div>
          <Link
            href="/reception/check-in"
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            <span>Waiting Room View</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        <Card surface="bone" shadow="card" className="overflow-hidden p-0">
          {(!stats?.todayFlow || stats.todayFlow.length === 0) ? (
            <div className="p-10 text-center space-y-2">
              <Calendar className="h-8 w-8 text-ink-soft/40 mx-auto" />
              <p className="text-sm font-display text-ink">
                No appointments scheduled for today yet.
              </p>
              <p className="text-xs text-ink-soft">
                Book a new appointment or review incoming web requests.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-sand/60 border-b border-line text-ink-soft uppercase font-mono text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3">Provider</th>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Arrival</th>
                    <th className="px-4 py-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {stats.todayFlow.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-sand/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-ink whitespace-nowrap">
                        {item.appointmentTime}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/reception/patients/${item.patientId}`}
                          className="font-medium text-primary hover:underline flex items-center gap-1.5"
                        >
                          <User className="h-3 w-3" />
                          <span>{item.patientName}</span>
                        </Link>
                        {item.patientPhone && (
                          <span className="text-[11px] text-ink-soft font-mono block mt-0.5">
                            {item.patientPhone}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink">
                        {item.providerName || "Assigned Provider"}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {item.serviceName || "General Consultation"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`
                            px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase
                            ${
                              item.status === "scheduled"
                                ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                : item.status === "arrived"
                                ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                : item.status === "in_progress"
                                ? "bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300"
                                : item.status === "completed"
                                ? "bg-primary/10 text-primary font-bold"
                                : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300"
                            }
                          `}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                        {item.confirmationStatus === "unconfirmed" && (
                          <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Unconfirmed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-soft whitespace-nowrap">
                        {item.arrivalTime ? (
                          <span className="font-mono text-ink">
                            {item.arrivalTime}
                            {item.waitingMinutes !== null && item.waitingMinutes !== undefined && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1 font-sans">
                                ({item.waitingMinutes}m wait)
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-ink-soft/60 italic">Not arrived</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {item.confirmationStatus === "unconfirmed" && (
                            <button
                              onClick={() => handleConfirm(item.id)}
                              disabled={actionLoadingId === item.id}
                              className="px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-medium border border-primary/20 transition-colors"
                            >
                              Confirm
                            </button>
                          )}

                          {item.status === "scheduled" && (
                            <button
                              onClick={() => handleStatusChange(item.id, "arrived")}
                              disabled={actionLoadingId === item.id}
                              className="px-2.5 py-1 rounded-full bg-primary text-white hover:bg-primary/90 text-[11px] font-medium shadow-xs transition-colors"
                            >
                              Check In
                            </button>
                          )}

                          {item.status === "arrived" && (
                            <button
                              onClick={() => handleStatusChange(item.id, "in_progress")}
                              disabled={actionLoadingId === item.id}
                              className="px-2.5 py-1 rounded-full bg-secondary text-white hover:bg-secondary/90 text-[11px] font-medium shadow-xs transition-colors"
                            >
                              In Chair
                            </button>
                          )}

                          {item.status === "in_progress" && (
                            <button
                              onClick={() => handleStatusChange(item.id, "completed")}
                              disabled={actionLoadingId === item.id}
                              className="px-2.5 py-1 rounded-full bg-primary text-white hover:bg-primary/90 text-[11px] font-medium shadow-xs transition-colors"
                            >
                              Checkout
                            </button>
                          )}

                          {item.status === "scheduled" && (
                            <button
                              onClick={() => handleStatusChange(item.id, "no_show")}
                              disabled={actionLoadingId === item.id}
                              className="px-2 py-1 rounded-full text-ink-soft hover:text-red-600 text-[11px]"
                            >
                              No-Show
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
        </Card>
      </section>

      {/* 3 & 4. Needs Attention & Quick Actions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3. Needs Attention */}
        <section className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <p className="eyebrow">3. Needs Attention</p>
            <span className="text-[11px] font-mono text-ink-soft">Action Required</span>
          </div>

          <Card surface="bone" shadow="subtle" className="p-5 divide-y divide-line">
            {(!stats?.needsAttention || stats.needsAttention.length === 0) ? (
              <div className="py-6 text-center text-xs text-ink-soft flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>All appointments confirmed, tasks up to date, and queues clear.</span>
              </div>
            ) : (
              stats.needsAttention.map((item, idx) => (
                <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`
                        p-2 rounded-xl mt-0.5 shrink-0
                        ${
                          item.priority === "urgent"
                            ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400"
                            : item.priority === "high"
                            ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                            : "bg-primary/10 text-primary"
                        }
                      `}
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-ink-soft mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <Link
                    href={item.link}
                    className="px-3 py-1.5 rounded-full border border-line text-xs font-medium text-ink hover:bg-sand transition-colors whitespace-nowrap shadow-xs"
                  >
                    Resolve
                  </Link>
                </div>
              ))
            )}
          </Card>
        </section>

        {/* 4. Quick Actions */}
        <section className="space-y-3">
          <p className="eyebrow">4. Quick Actions</p>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/reception/schedule"
              className="p-4 rounded-[var(--radius-card)] bg-bone border border-line hover:border-primary/40 hover:bg-cream transition-all flex flex-col items-start gap-2 shadow-subtle group"
            >
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Calendar className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-ink">New Booking</span>
            </Link>

            <Link
              href="/reception/patients"
              className="p-4 rounded-[var(--radius-card)] bg-bone border border-line hover:border-primary/40 hover:bg-cream transition-all flex flex-col items-start gap-2 shadow-subtle group"
            >
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Users className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-ink">New Patient</span>
            </Link>

            <Link
              href="/reception/check-in"
              className="p-4 rounded-[var(--radius-card)] bg-bone border border-line hover:border-primary/40 hover:bg-cream transition-all flex flex-col items-start gap-2 shadow-subtle group"
            >
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <UserCheck className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-ink">Check-In Desk</span>
            </Link>

            <Link
              href="/reception/appointments/requests"
              className="p-4 rounded-[var(--radius-card)] bg-bone border border-line hover:border-primary/40 hover:bg-cream transition-all flex flex-col items-start gap-2 shadow-subtle group"
            >
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Inbox className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-ink">Web Requests</span>
            </Link>

            <Link
              href="/reception/tasks"
              className="p-4 rounded-[var(--radius-card)] bg-bone border border-line hover:border-primary/40 hover:bg-cream transition-all flex flex-col items-start gap-2 shadow-subtle group"
            >
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <ListTodo className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-ink">Create Task</span>
            </Link>

            <Link
              href="/reception/patients"
              className="p-4 rounded-[var(--radius-card)] bg-bone border border-line hover:border-primary/40 hover:bg-cream transition-all flex flex-col items-start gap-2 shadow-subtle group"
            >
              <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                <Search className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-ink">Search Patient</span>
            </Link>
          </div>
        </section>
      </div>

      {/* 5. Daily Huddle Summary */}
      <section className="space-y-3">
        <p className="eyebrow">5. Daily Operational Huddle</p>

        <Card surface="cream" shadow="subtle" className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">
                Practice Morning Briefing
              </p>
              <p className="text-xs text-ink-soft">
                First appointment: <strong>{huddle?.firstAppointmentTime || "None scheduled"}</strong> · Total Bookings: <strong>{huddle?.totalAppointments || 0}</strong>
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-amber-700 dark:text-amber-400">
                {huddle?.unconfirmedCount || 0} unconfirmed
              </span>
              <span className="text-primary font-semibold">
                {huddle?.requestsCount || 0} intake requests
              </span>
            </div>
          </div>

          {/* Provider Roster */}
          <div>
            <p className="text-xs font-semibold text-ink mb-2">
              Provider Schedules Today
            </p>
            {(!huddle?.providerSchedule || huddle.providerSchedule.length === 0) ? (
              <p className="text-xs text-ink-soft italic">No provider appointments booked today.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {huddle.providerSchedule.map((p) => (
                  <div
                    key={p.providerId}
                    className="p-3.5 rounded-xl bg-bone border border-line flex items-center justify-between shadow-subtle"
                  >
                    <div>
                      <p className="text-xs font-semibold text-ink">
                        {p.providerName}
                      </p>
                      <p className="text-[10px] text-ink-soft font-mono mt-0.5">
                        {p.firstSlot ? `${p.firstSlot} - ${p.lastSlot}` : "Open schedule"}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold font-mono">
                      {p.appointmentsCount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Items */}
          {huddle?.actionItems && huddle.actionItems.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-ink mb-2">
                Huddle Action Items
              </p>
              <ul className="space-y-1 text-xs text-ink-soft">
                {huddle.actionItems.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
