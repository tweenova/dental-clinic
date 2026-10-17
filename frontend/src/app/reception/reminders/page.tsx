"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  Moon,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  User,
  UserCheck,
  UserX,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getReceptionReminders,
  markAppointmentReminded,
  normalizePakistanPhone,
  ReceptionReminderItem,
  runReminderScheduler,
  togglePatientMessagingOptOut,
} from "@/lib/api";

function formatAppointmentDate(dateStr: string): string {
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

function renderTemplateMessage(
  template: string,
  item: ReceptionReminderItem
): string {
  const clinician = item.clinicianName || "our dental team";
  const formattedDate = formatAppointmentDate(item.preferredDate);
  return template
    .replace(/{patient_name}/g, item.patientFullName)
    .replace(/{appointment_date}/g, formattedDate)
    .replace(/{appointment_time}/g, item.preferredTime)
    .replace(/{clinician_name}/g, clinician)
    .replace(/{doctor_name}/g, clinician)
    .replace(/{clinic_name}/g, "Dental Clinic")
    .replace(/{clinic_phone}/g, "[Clinic Phone]")
    .replace(/{confirmation_id}/g, item.confirmationId);
}

export default function ReceptionRemindersPage() {
  const { accessToken } = useAuth();

  // Selected date defaults to tomorrow
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const d = String(tomorrow.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  const [template, setTemplate] = useState<string>("");
  const [items, setItems] = useState<ReceptionReminderItem[]>([]);
  const [providerMode, setProviderMode] = useState<string>("simulated");
  const [quietHoursActive, setQuietHoursActive] = useState<boolean>(false);
  const [quietHoursStart, setQuietHoursStart] = useState<string>("21:00");
  const [quietHoursEnd, setQuietHoursEnd] = useState<string>("08:00");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [schedulerNotice, setSchedulerNotice] = useState<string | null>(null);

  // Per-item edited message overrides
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);

  const fetchReminders = async (targetDate: string) => {
    setIsLoading(true);
    setError("");
    try {
      const resp = await getReceptionReminders(targetDate, accessToken);
      setTemplate(resp.template);
      setItems(resp.items);
      setProviderMode(resp.providerMode || "simulated");
      setQuietHoursActive(!!resp.quietHoursActive);
      setQuietHoursStart(resp.quietHoursStart || "21:00");
      setQuietHoursEnd(resp.quietHoursEnd || "08:00");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load reminders.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      fetchReminders(selectedDate);
    });
  }, [selectedDate, accessToken]);

  const handleMarkReminded = async (itemId: string) => {
    setActionLoadingId(itemId);
    try {
      const updated = await markAppointmentReminded(itemId, accessToken);
      setItems((prev) =>
        prev.map((it) =>
          it.id === itemId
            ? {
                ...it,
                remindedAt: updated.remindedAt,
                remindedByUserId: updated.remindedByUserId,
                remindedByName: updated.remindedByName || "You",
                deliveryStatus: it.deliveryStatus === "none" ? "simulated" : it.deliveryStatus,
              }
            : it
        )
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to mark as reminded.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleOptOut = async (patientId: string, currentOptOut: boolean, bookingId: string) => {
    const nextOptOut = !currentOptOut;
    const confirmMsg = nextOptOut
      ? "Opt out this patient from automated reminders? Receptionists can still reach out manually."
      : "Re-enable automated reminders for this patient?";
    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(bookingId);
    try {
      await togglePatientMessagingOptOut(patientId, nextOptOut, accessToken);
      setItems((prev) =>
        prev.map((it) =>
          it.patientId === patientId
            ? { ...it, optedOut: nextOptOut }
            : it
        )
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update opt-out status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRunScheduler = async (forceQuietHours: boolean = false) => {
    setIsDispatching(true);
    setSchedulerNotice(null);
    try {
      const resp = await runReminderScheduler(selectedDate, forceQuietHours, accessToken);
      setSchedulerNotice(resp.message);
      await fetchReminders(selectedDate);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Scheduler execution failed.");
    } finally {
      setIsDispatching(false);
    }
  };

  const filteredItems = items.filter((it) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      it.patientFullName.toLowerCase().includes(q) ||
      it.patientPhone.includes(q) ||
      (it.clinicianName && it.clinicianName.toLowerCase().includes(q))
    );
  });

  const remindedCount = items.filter((it) => !!it.remindedAt).length;
  const pendingCount = items.length - remindedCount;
  const optedOutCount = items.filter((it) => it.optedOut).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/reception"
              className="text-xs text-ink-soft hover:text-ink flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Reception
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-primary" />
            Appointment Reminders Worklist
          </h1>
          <p className="text-xs text-ink-soft mt-1">
            Review confirmed appointments for upcoming days. Open WhatsApp with prefilled logistics or dial patient directly.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-bone border border-line rounded-xl px-3 py-1.5 shadow-sm">
            <Calendar className="h-4 w-4 text-ink-soft" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-ink focus:outline-none"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchReminders(selectedDate)}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => handleRunScheduler(false)}
            disabled={isDispatching}
            className="flex items-center gap-1.5 shadow-sm"
          >
            <Send className={`h-3.5 w-3.5 ${isDispatching ? "animate-spin" : ""}`} />
            Dispatch Reminders (Scheduler)
          </Button>
        </div>
      </div>

      {/* Quiet Hours Warning Banner */}
      {quietHoursActive && (
        <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 flex items-start justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-start gap-2.5">
            <Moon className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold">Quiet Hours Currently Active ({quietHoursStart} – {quietHoursEnd} PKT)</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                Automated outreach is held to respect patient night resting hours. Manual WhatsApp & direct phone links remain available for staff.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRunScheduler(true)}
            disabled={isDispatching}
            className="text-[11px] text-amber-800 hover:text-amber-900 border border-amber-300 shrink-0"
          >
            Force Dispatch Anyway
          </Button>
        </div>
      )}

      {/* Scheduler Notice Banner */}
      {schedulerNotice && (
        <div className="p-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            <span>{schedulerNotice}</span>
          </div>
          <button
            onClick={() => setSchedulerNotice(null)}
            className="text-xs text-blue-700 hover:underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card surface="bone" shadow="card" className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold">
              Confirmed for Date
            </span>
            <span className="text-2xl font-extrabold text-ink">{items.length}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Clock className="h-5 w-5" />
          </div>
        </Card>

        <Card surface="bone" shadow="card" className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold">
              Pending Outreach
            </span>
            <span className="text-2xl font-extrabold text-amber-600">{pendingCount}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Bell className="h-5 w-5" />
          </div>
        </Card>

        <Card surface="bone" shadow="card" className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold">
              Marked Reminded
            </span>
            <span className="text-2xl font-extrabold text-emerald-600">{remindedCount}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </Card>

        <Card surface="bone" shadow="card" className="p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-ink-soft block font-semibold">
              Opted-Out Patients
            </span>
            <span className="text-2xl font-extrabold text-rose-600">{optedOutCount}</span>
          </div>
          <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600">
            <UserX className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Search & Provider Status Notice */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft" />
          <input
            type="text"
            placeholder="Search patient, phone, or clinician..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-bone pl-9 pr-3 py-2 text-xs text-ink placeholder:text-ink-soft focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="text-[11px] text-ink-soft bg-bone border border-line px-3 py-2 rounded-xl flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-medium text-ink">
            Provider: <strong className="font-semibold uppercase text-primary">{providerMode}</strong> (honest simulated tracking)
          </span>
          <span className="text-ink-soft">|</span>
          <span>WhatsApp links format phone to Pakistan international standard (<strong>92...</strong>).</span>
        </div>
      </div>

      {/* Worklist Table / Cards */}
      {isLoading ? (
        <Card surface="bone" shadow="card" className="p-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
          <p className="text-xs text-ink-soft">Loading confirmed appointments for {selectedDate}...</p>
        </Card>
      ) : error ? (
        <Card surface="bone" shadow="card" className="p-6 text-center text-red-600 text-xs">
          {error}
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card surface="bone" shadow="card" className="p-12 text-center">
          <Clock className="h-8 w-8 text-ink-soft mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-ink">No confirmed appointments found</p>
          <p className="text-xs text-ink-soft mt-1">
            There are no confirmed appointments scheduled for {formatAppointmentDate(selectedDate)}.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const rawMessage = editedMessages[item.id] ?? renderTemplateMessage(template, item);
            const pkPhone = normalizePakistanPhone(item.patientPhone);
            const waUrl = `https://wa.me/${pkPhone}?text=${encodeURIComponent(rawMessage)}`;
            const telUrl = `tel:${item.patientPhone.replace(/\s+/g, "")}`;
            const isExpanded = expandedMessageId === item.id;
            const isReminded = !!item.remindedAt;
            const isOptedOut = !!item.optedOut;

            return (
              <Card
                key={item.id}
                surface="bone"
                shadow="card"
                className={`p-4 transition-all border ${
                  isOptedOut
                    ? "border-rose-300/40 bg-rose-50/10"
                    : isReminded
                    ? "border-emerald-500/20 bg-emerald-50/10"
                    : "border-line"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Patient & Appointment Details */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-ink">{item.patientFullName}</span>
                      <span className="text-[11px] font-mono text-ink-soft bg-bone border border-line px-2 py-0.5 rounded-full">
                        {item.confirmationId}
                      </span>

                      {/* Opted Out Pill */}
                      {isOptedOut && (
                        <span className="text-[10px] font-semibold text-rose-700 bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <UserX className="h-3 w-3" />
                          Opted Out of Automated Reminders
                        </span>
                      )}

                      {/* Delivery Status Pill */}
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.deliveryStatus === "simulated"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : item.deliveryStatus === "delivered"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.deliveryStatus === "failed"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : item.deliveryStatus === "opted_out"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-stone-100 text-stone-600 border-stone-200"
                        }`}
                      >
                        Status: {item.deliveryStatus === "none" || !item.deliveryStatus ? "Not Dispatched" : item.deliveryStatus}
                      </span>

                      {/* Reminded Confirmation */}
                      {isReminded ? (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Reminded {new Date(item.remindedAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          {item.remindedByName ? ` by ${item.remindedByName}` : ""}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-full">
                          Pending Reminder
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-ink-soft flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-ink">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        {item.preferredTime} ({formatAppointmentDate(item.preferredDate)})
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {item.clinicianName ? `Dr. ${item.clinicianName}` : "Any Clinician"}
                      </span>
                      {item.serviceName && (
                        <span className="bg-bone border border-line px-2 py-0.5 rounded text-[11px]">
                          {item.serviceName}
                        </span>
                      )}
                      <span className="font-mono text-ink">{item.patientPhone}</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Toggle Message Preview/Edit */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedMessageId(isExpanded ? null : item.id)}
                      className="text-xs flex items-center gap-1"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      {isExpanded ? "Hide Message" : "Edit Message"}
                    </Button>

                    {/* Opt-out Toggle */}
                    {item.patientId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleOptOut(item.patientId!, isOptedOut, item.id)}
                        disabled={actionLoadingId === item.id}
                        className={`text-xs flex items-center gap-1 ${
                          isOptedOut ? "text-emerald-700 hover:text-emerald-800" : "text-rose-600 hover:text-rose-700"
                        }`}
                      >
                        {isOptedOut ? "Opt Back In" : "Opt Out"}
                      </Button>
                    )}

                    {/* Open WhatsApp */}
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (isOptedOut) {
                          if (!window.confirm("Patient has opted out of automated communications. Confirm sending manual WhatsApp message?")) {
                            e.preventDefault();
                          }
                        }
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open WhatsApp
                    </a>

                    {/* Direct Call */}
                    <a
                      href={telUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-line bg-bone hover:bg-cream text-ink shadow-sm transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      Call
                    </a>

                    {/* Mark Reminded */}
                    <Button
                      variant={isReminded ? "ghost" : "primary"}
                      size="sm"
                      onClick={() => handleMarkReminded(item.id)}
                      disabled={actionLoadingId === item.id}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      {actionLoadingId === item.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                      {isReminded ? "Mark Again" : "Mark Reminded"}
                    </Button>
                  </div>
                </div>

                {/* Inline Message Preview/Editor */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-line space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-ink-soft">
                      <span className="font-medium">Prefilled WhatsApp Message Preview:</span>
                      <span>Normalized recipient: <strong className="font-mono text-ink">+{pkPhone}</strong></span>
                    </div>
                    <textarea
                      rows={3}
                      value={rawMessage}
                      onChange={(e) =>
                        setEditedMessages((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="w-full text-xs rounded-xl border border-line bg-bone p-2.5 text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex justify-between items-center text-[10px] text-ink-soft">
                      <span>Logistical details only. No clinical or diagnostic data included.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditedMessages((prev) => {
                            const copy = { ...prev };
                            delete copy[item.id];
                            return copy;
                          });
                        }}
                        className="text-primary hover:underline"
                      >
                        Reset to default template
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
