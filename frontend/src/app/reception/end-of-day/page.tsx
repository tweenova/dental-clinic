"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  UserCheck,
  UserX,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { TextField } from "@/components/ui/text-field";
import {
  getReceptionEndOfDayUnresolved,
  getEndOfDayPaymentsSummary,
  EndOfDayPaymentsSummary,
  normalizePakistanPhone,
  ReceptionEndOfDayItem,
  ReceptionEndOfDayResponse,
  resolveReceptionEndOfDay,
} from "@/lib/api";

type ResolutionType = "completed" | "no_show" | "cancelled";

const QUICK_CANCEL_REASONS = [
  "Patient called to cancel",
  "Patient ill / medical emergency",
  "Doctor unavailable / clinic emergency",
  "Rescheduled via phone",
  "No show & no contact reached",
];

function formatDateDisplay(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function getDaysDifference(dateStr: string, todayStr: string): number {
  try {
    const d1 = new Date(dateStr);
    const d2 = new Date(todayStr);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

export default function ReceptionEndOfDayPage() {
  const { accessToken } = useAuth();

  const getTodayString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayStr = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [data, setData] = useState<ReceptionEndOfDayResponse | null>(null);
  const [paymentsSummary, setPaymentsSummary] = useState<EndOfDayPaymentsSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Tab filter: 'all' | 'today' | 'past'
  const [tabFilter, setTabFilter] = useState<"all" | "today" | "past">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Track session resolution count
  const [sessionResolvedCount, setSessionResolvedCount] = useState<number>(0);

  // Modal state
  const [activeItem, setActiveItem] = useState<ReceptionEndOfDayItem | null>(null);
  const [resolutionType, setResolutionType] = useState<ResolutionType | null>(null);
  const [resolutionReason, setResolutionReason] = useState<string>("");
  const [modalError, setModalError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadUnresolved = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setError("");
    try {
      const [res, payments] = await Promise.all([
        getReceptionEndOfDayUnresolved(selectedDate, accessToken),
        getEndOfDayPaymentsSummary(selectedDate, accessToken).catch(() => null),
      ]);
      setData(res);
      setPaymentsSummary(payments);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load unresolved appointments."
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadUnresolved(true);
    });
  }, [selectedDate, accessToken]);

  const openResolutionModal = (item: ReceptionEndOfDayItem, type: ResolutionType) => {
    setActiveItem(item);
    setResolutionType(type);
    setResolutionReason("");
    setModalError("");
  };

  const closeResolutionModal = () => {
    setActiveItem(null);
    setResolutionType(null);
    setResolutionReason("");
    setModalError("");
  };

  const handleConfirmResolution = async () => {
    if (!activeItem || !resolutionType) return;

    if (resolutionType === "cancelled" && !resolutionReason.trim()) {
      setModalError("Cancellation reason is strictly required.");
      return;
    }

    setIsSubmitting(true);
    setModalError("");

    try {
      await resolveReceptionEndOfDay(
        {
          bookingId: activeItem.id,
          resolution: resolutionType,
          reason: resolutionReason.trim() || undefined,
        },
        accessToken
      );

      setSessionResolvedCount((prev) => prev + 1);
      closeResolutionModal();
      await loadUnresolved(false);
    } catch (err: unknown) {
      setModalError(
        err instanceof Error
          ? err.message
          : "Failed to resolve appointment. Please check your network and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter items
  const items = data?.items || [];
  const filteredItems = items.filter((item) => {
    // Tab filter
    if (tabFilter === "today" && item.preferredDate !== selectedDate) return false;
    if (tabFilter === "past" && item.preferredDate >= selectedDate) return false;

    // Status filter
    if (statusFilter !== "all" && item.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.patientFullName.toLowerCase().includes(q);
      const matchPhone = item.patientPhone.includes(q);
      const matchCode = item.confirmationId.toLowerCase().includes(q);
      const matchDoctor = (item.clinicianName || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchCode && !matchDoctor) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-ink-soft mb-1">
            <Link
              href="/reception"
              className="hover:text-ink transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Reception</span>
            </Link>
            <span>/</span>
            <span className="font-medium text-ink">End-of-Day Review</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-ink tracking-tight">
            End-of-Day Review
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            Reconcile outstanding appointments. Marlow Dental policy strictly requires
            manual staff resolution — appointments are never auto-completed.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-sand/60 px-3 py-1.5 rounded-xl border border-line text-xs">
            <Calendar className="h-4 w-4 text-ink-soft" />
            <label htmlFor="eod-date" className="font-medium text-ink">
              Review Date:
            </label>
            <input
              id="eod-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-paper border border-line rounded px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadUnresolved(false)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Policy Notice Card */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Audited Clinical Reconciliation:</span> Every status
          resolution is logged with your authenticated staff account, timestamp, and optional
          clinical explanation. If a patient attended, mark{" "}
          <span className="font-medium underline">Completed</span>; if they did not show up, mark{" "}
          <span className="font-medium underline">No-Show</span>; if they called to reschedule or
          cancelled, mark <span className="font-medium underline">Cancelled</span> with a recorded reason.
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Unresolved"
          value={data?.totalUnresolved ?? 0}
          tone={(data?.totalUnresolved ?? 0) > 0 ? "warning" : "positive"}
          hint="Today and earlier"
        />
        <StatCard
          label="Today's Pending"
          value={data?.todayCount ?? 0}
          tone="neutral"
          hint={formatDateDisplay(selectedDate)}
        />
        <StatCard
          label="Past Days Overdue"
          value={data?.pastCount ?? 0}
          tone={(data?.pastCount ?? 0) > 0 ? "danger" : "neutral"}
          hint="From prior clinic days"
        />
        <StatCard
          label="Resolved This Session"
          value={sessionResolvedCount}
          tone="positive"
          hint="Actioned by you"
        />
      </div>

      {/* End-of-Day Financial Reconciliation Card */}
      <Card surface="bone" shadow="subtle" className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Banknote className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">
                Daily Financial Reconciliation ({formatDateDisplay(selectedDate)})
              </h3>
              <p className="text-[11px] text-ink-soft">
                Payments collected at reception for this clinic date ({paymentsSummary?.paymentCount ?? 0} transactions).
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-ink-soft block">Total Collected</span>
            <span className="text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400">
              Rs {((paymentsSummary?.totalCents ?? 0) / 100).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-paper border border-line">
            <span className="text-ink-soft text-[11px] block">Cash Collections</span>
            <span className="text-sm font-semibold text-ink">
              Rs {((paymentsSummary?.cashCents ?? 0) / 100).toLocaleString()}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-paper border border-line">
            <span className="text-ink-soft text-[11px] block">Card Payments</span>
            <span className="text-sm font-semibold text-ink">
              Rs {((paymentsSummary?.cardCents ?? 0) / 100).toLocaleString()}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-paper border border-line">
            <span className="text-ink-soft text-[11px] block">Bank Transfers</span>
            <span className="text-sm font-semibold text-ink">
              Rs {((paymentsSummary?.transferCents ?? 0) / 100).toLocaleString()}
            </span>
          </div>
        </div>
      </Card>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-sand/60 rounded-xl border border-line text-xs font-medium self-start">
          <button
            onClick={() => setTabFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tabFilter === "all"
                ? "bg-paper text-ink shadow-xs border border-line"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            All Unresolved ({items.length})
          </button>
          <button
            onClick={() => setTabFilter("today")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tabFilter === "today"
                ? "bg-paper text-ink shadow-xs border border-line"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            Today ({data?.todayCount ?? 0})
          </button>
          <button
            onClick={() => setTabFilter("past")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              tabFilter === "past"
                ? "bg-paper text-ink shadow-xs border border-line"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            Past Days Overdue ({data?.pastCount ?? 0})
          </button>
        </div>

        {/* Search & Status select */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              type="text"
              placeholder="Search patient or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-line bg-paper text-xs text-ink placeholder:text-ink-soft focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl border border-line bg-paper text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All statuses</option>
            <option value="requested">Requested</option>
            <option value="confirmed">Confirmed</option>
            <option value="arrived">Arrived</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>
      </div>

      {/* Main Content List / Table */}
      {isLoading ? (
        <div className="p-12 text-center text-ink-soft text-sm flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <span>Loading unresolved appointments...</span>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-rose-600 bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 text-sm">
          <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-rose-500" />
          <span>{error}</span>
        </div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-3 rounded-2xl">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-display font-semibold text-ink">
            All Caught Up!
          </h2>
          <p className="text-sm text-ink-soft max-w-md">
            No unresolved appointments remain for {formatDateDisplay(selectedDate)} or earlier.
            Every visit was successfully reconciled by reception.
          </p>
          <div className="pt-2 flex gap-3">
            <Button href="/reception" variant="outline" size="sm">
              Return to Dashboard
            </Button>
            <Button href="/reception/schedule" variant="secondary" size="sm">
              View Tomorrow&apos;s Schedule
            </Button>
          </div>
        </Card>
      ) : filteredItems.length === 0 ? (
        <div className="p-8 text-center text-ink-soft text-xs border border-line rounded-2xl bg-sand/30">
          No appointments matched the active filter or search query.
        </div>
      ) : (
        <div className="border border-line rounded-2xl overflow-hidden bg-paper shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-[10px] font-mono uppercase tracking-wider text-ink-soft">
                  <th className="px-4 py-3 font-semibold">Appointment Time</th>
                  <th className="px-4 py-3 font-semibold">Patient</th>
                  <th className="px-4 py-3 font-semibold">Provider & Service</th>
                  <th className="px-4 py-3 font-semibold">Current Status</th>
                  <th className="px-4 py-3 font-semibold">Notes</th>
                  <th className="px-4 py-3 font-semibold text-right">Reconciliation Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredItems.map((item) => {
                  const isPast = item.preferredDate < selectedDate;
                  const daysAgo = getDaysDifference(item.preferredDate, selectedDate);
                  const cleanPhone = normalizePakistanPhone(item.patientPhone);
                  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : null;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-sand/30 transition-colors"
                    >
                      {/* Time & Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono font-medium text-ink">
                          {item.preferredTime}
                        </div>
                        <div className="text-[11px] text-ink-soft flex items-center gap-1 mt-0.5">
                          {formatDateDisplay(item.preferredDate)}
                        </div>
                        {isPast && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            {daysAgo} {daysAgo === 1 ? "day" : "days"} overdue
                          </span>
                        )}
                        {!isPast && (
                          <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-sand text-ink-soft border border-line">
                            Today
                          </span>
                        )}
                      </td>

                      {/* Patient */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {item.patientFullName}
                        </div>
                        <div className="text-[11px] font-mono text-ink-soft mt-0.5">
                          {item.confirmationId}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <a
                            href={`tel:${item.patientPhone}`}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            <span>{item.patientPhone}</span>
                          </a>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 hover:text-emerald-700 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium"
                            >
                              <MessageSquare className="h-2.5 w-2.5" />
                              <span>WA</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Provider & Service */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {item.clinicianName || "Unassigned Provider"}
                        </div>
                        <div className="text-[11px] text-ink-soft mt-0.5">
                          {item.serviceName || "Dental Consultation"}
                        </div>
                      </td>

                      {/* Current Status Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                            item.status === "in_progress"
                              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                              : item.status === "arrived"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                              : item.status === "confirmed"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                              : "bg-sand text-ink-soft border border-line"
                          }`}
                        >
                          {item.status.replace("_", " ")}
                        </span>
                        {item.arrivedAt && (
                          <div className="text-[10px] text-ink-soft mt-1">
                            Arrived at {new Date(item.arrivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 text-ink-soft max-w-xs truncate">
                        {item.staffNotes || item.notes || "—"}
                      </td>

                      {/* Quick Action Buttons */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => openResolutionModal(item, "completed")}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 font-medium text-[11px] transition-colors border border-emerald-600/20"
                            title="Mark visit completed"
                          >
                            Completed
                          </button>
                          <button
                            onClick={() => openResolutionModal(item, "no_show")}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-[11px] transition-colors border border-amber-500/20"
                            title="Mark patient as no-show"
                          >
                            No-Show
                          </button>
                          <button
                            onClick={() => openResolutionModal(item, "cancelled")}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-medium text-[11px] transition-colors border border-rose-500/20"
                            title="Cancel appointment with reason"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Resolution Modal */}
      {activeItem && resolutionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-paper border border-line rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {resolutionType === "completed" && (
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                )}
                {resolutionType === "no_show" && (
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                    <UserX className="h-5 w-5" />
                  </div>
                )}
                {resolutionType === "cancelled" && (
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                    <XCircle className="h-5 w-5" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-semibold text-ink">
                    {resolutionType === "completed" && "Mark Appointment as Completed"}
                    {resolutionType === "no_show" && "Mark Patient as No-Show"}
                    {resolutionType === "cancelled" && "Cancel Appointment"}
                  </h3>
                  <p className="text-xs text-ink-soft">
                    {activeItem.patientFullName} • {activeItem.preferredTime}
                  </p>
                </div>
              </div>
              <button
                onClick={closeResolutionModal}
                disabled={isSubmitting}
                className="text-ink-soft hover:text-ink p-1 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs text-ink">
              <div className="p-3 rounded-xl bg-sand/50 border border-line space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-soft">Confirmation:</span>
                  <span className="font-mono font-medium">{activeItem.confirmationId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Date & Time:</span>
                  <span>{formatDateDisplay(activeItem.preferredDate)} at {activeItem.preferredTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-soft">Current Status:</span>
                  <span className="font-medium capitalize">{activeItem.status}</span>
                </div>
              </div>

              {resolutionType === "cancelled" && (
                <div className="space-y-2">
                  <label className="block font-medium text-ink">
                    Cancellation Reason <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-ink-soft">
                    Marlow clinic policy mandates recording a reason for every cancellation.
                  </p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {QUICK_CANCEL_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setResolutionReason(reason)}
                        className="px-2 py-0.5 rounded-md bg-sand/80 hover:bg-sand text-[10px] text-ink-soft hover:text-ink border border-line transition-colors"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    value={resolutionReason}
                    onChange={(e) => setResolutionReason(e.target.value)}
                    placeholder="Provide details for cancellation..."
                    className="w-full p-2.5 rounded-xl border border-line bg-paper text-xs text-ink placeholder:text-ink-soft focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {resolutionType !== "cancelled" && (
                <div className="space-y-1.5">
                  <label className="block font-medium text-ink">
                    Optional Resolution Note
                  </label>
                  <textarea
                    rows={2}
                    value={resolutionReason}
                    onChange={(e) => setResolutionReason(e.target.value)}
                    placeholder={
                      resolutionType === "completed"
                        ? "e.g. Treatment completed, resolved at front desk..."
                        : "e.g. Called twice, patient did not attend..."
                    }
                    className="w-full p-2.5 rounded-xl border border-line bg-paper text-xs text-ink placeholder:text-ink-soft focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {modalError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs">
                  {modalError}
                </div>
              )}

              <p className="text-[10px] text-ink-soft">
                Audit Trail Notice: This resolution will be committed to the database and logged under your staff account.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button
                variant="outline"
                size="sm"
                onClick={closeResolutionModal}
                disabled={isSubmitting}
              >
                Dismiss
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmResolution}
                disabled={isSubmitting}
                className={
                  resolutionType === "cancelled"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : resolutionType === "no_show"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }
              >
                {isSubmitting ? "Resolving..." : "Confirm Resolution"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
