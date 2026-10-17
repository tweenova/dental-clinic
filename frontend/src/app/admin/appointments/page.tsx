"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  User,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  UserCheck,
  UserX,
  Stethoscope,
  Scissors,
  ArrowRight,
  ChevronDown,
  ShieldAlert,
  Info,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import {
  getReceptionBookings,
  rescheduleReceptionBooking,
  cancelReceptionBooking,
  markNoShowReceptionBooking,
  ReceptionBooking,
  adminGetServices,
  getTeamMembers,
  ServiceItem,
  TeamMember,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AdminAppointmentsPage() {
  const { accessToken } = useAuth();

  // Data states
  const [bookings, setBookings] = useState<ReceptionBooking[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filter states
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedClinician, setSelectedClinician] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal action states
  const [actionBooking, setActionBooking] = useState<ReceptionBooking | null>(null);
  const [modalType, setModalType] = useState<"reschedule" | "reassign" | "change_service" | "cancel" | "no_show" | null>(null);

  // Form states for modals
  const [targetDate, setTargetDate] = useState<string>("");
  const [targetTime, setTargetTime] = useState<string>("");
  const [targetClinicianId, setTargetClinicianId] = useState<string>("");
  const [targetServiceId, setTargetServiceId] = useState<string>("");
  const [cancelReason, setCancelReason] = useState<string>("");
  const [actionStaffNotes, setActionStaffNotes] = useState<string>("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState("");

  // Double-booking override state
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [overrideDoubleBooking, setOverrideDoubleBooking] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  // Fetch data
  const loadData = async () => {
    setIsLoading(true);
    setError("");
    try {
      const [bookingsData, tmData, servicesData] = await Promise.all([
        getReceptionBookings(
          {
            date: selectedDate || undefined,
            status: selectedStatus !== "all" ? selectedStatus : undefined,
            provider_id: selectedClinician !== "all" ? selectedClinician : undefined,
            search: searchQuery.trim() || undefined,
          },
          accessToken
        ),
        getTeamMembers().catch(() => []),
        adminGetServices(accessToken || undefined).catch(() => ({ items: [] })),
      ]);

      setBookings(bookingsData);
      setTeamMembers(tmData || []);
      setServices(servicesData.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load appointments.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedStatus, selectedClinician]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Open modals helper
  const openActionModal = (
    booking: ReceptionBooking,
    type: "reschedule" | "reassign" | "change_service" | "cancel" | "no_show"
  ) => {
    setActionBooking(booking);
    setModalType(type);
    setActionError("");
    setConflictWarning(null);
    setOverrideDoubleBooking(false);
    setOverrideReason("");
    setActionStaffNotes(booking.staffNotes || "");

    if (type === "reschedule") {
      setTargetDate(booking.bookingDate);
      setTargetTime(booking.bookingTime);
      setTargetClinicianId(booking.providerId || "");
    } else if (type === "reassign") {
      setTargetDate(booking.bookingDate);
      setTargetTime(booking.bookingTime);
      setTargetClinicianId(booking.providerId || "");
    } else if (type === "change_service") {
      setTargetDate(booking.bookingDate);
      setTargetTime(booking.bookingTime);
      setTargetServiceId(booking.serviceId || "");
    } else if (type === "cancel") {
      setCancelReason("");
    }
  };

  const closeActionModal = () => {
    setActionBooking(null);
    setModalType(null);
    setActionError("");
    setConflictWarning(null);
  };

  // Submit action handler
  const handleExecuteAction = async () => {
    if (!actionBooking) return;
    setIsSubmittingAction(true);
    setActionError("");

    try {
      if (modalType === "reschedule") {
        if (!targetDate || !targetTime) {
          setActionError("Both appointment date and time are required.");
          setIsSubmittingAction(false);
          return;
        }
        await rescheduleReceptionBooking(
          actionBooking.id,
          {
            bookingDate: targetDate,
            bookingTime: targetTime,
            teamMemberId: actionBooking.providerId || null,
            staffNotes: actionStaffNotes.trim() || null,
            overrideDoubleBooking,
            overrideReason: overrideDoubleBooking ? overrideReason : null,
          },
          accessToken
        );
        setSuccessMsg(`Appointment for ${actionBooking.patientName} successfully rescheduled to ${targetDate} at ${targetTime}.`);
      } else if (modalType === "reassign") {
        if (!targetClinicianId) {
          setActionError("Please select a clinician to assign.");
          setIsSubmittingAction(false);
          return;
        }
        await rescheduleReceptionBooking(
          actionBooking.id,
          {
            bookingDate: actionBooking.bookingDate,
            bookingTime: actionBooking.bookingTime,
            teamMemberId: targetClinicianId,
            staffNotes: actionStaffNotes.trim() || null,
            overrideDoubleBooking,
            overrideReason: overrideDoubleBooking ? overrideReason : null,
          },
          accessToken
        );
        const doc = teamMembers.find((m) => m.id === targetClinicianId);
        const docName = doc ? (doc.displayName || `${doc.firstName} ${doc.lastName}`.trim()) : "selected provider";
        setSuccessMsg(`Appointment successfully reassigned to Dr./Clinician ${docName}.`);
      } else if (modalType === "change_service") {
        if (!targetServiceId) {
          setActionError("Please select a procedure or treatment service.");
          setIsSubmittingAction(false);
          return;
        }
        await rescheduleReceptionBooking(
          actionBooking.id,
          {
            bookingDate: actionBooking.bookingDate,
            bookingTime: actionBooking.bookingTime,
            teamMemberId: actionBooking.providerId || null,
            serviceId: targetServiceId,
            staffNotes: actionStaffNotes.trim() || null,
            overrideDoubleBooking,
            overrideReason: overrideDoubleBooking ? overrideReason : null,
          },
          accessToken
        );
        const srv = services.find((s) => s.id === targetServiceId || s.code === targetServiceId);
        setSuccessMsg(`Service updated to "${srv?.title || targetServiceId}".`);
      } else if (modalType === "cancel") {
        if (!cancelReason.trim()) {
          setActionError("A formal cancellation reason is strictly required.");
          setIsSubmittingAction(false);
          return;
        }
        await cancelReceptionBooking(actionBooking.id, cancelReason.trim(), actionStaffNotes.trim() || undefined, accessToken);
        setSuccessMsg(`Appointment cancelled. Reason logged to clinic audit trail.`);
      } else if (modalType === "no_show") {
        await markNoShowReceptionBooking(actionBooking.id, actionStaffNotes.trim() || undefined, accessToken);
        setSuccessMsg(`Appointment marked as No-Show. Recorded in patient appointment history.`);
      }

      closeActionModal();
      await loadData();
    } catch (err: any) {
      if (err?.message?.includes("Double-booking conflict") || err?.message?.includes("409")) {
        setConflictWarning(err.message);
      } else {
        setActionError(err?.message || "Failed to execute appointment action.");
      }
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Status badge styling helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">Confirmed</span>;
      case "arrived":
      case "checked_in":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 border border-blue-200">Arrived</span>;
      case "in_progress":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 border border-purple-200">In Progress</span>;
      case "completed":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-800 border border-gray-200">Completed</span>;
      case "cancelled":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-100 text-red-800 border border-red-200">Cancelled</span>;
      case "no_show":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 border border-amber-200">No Show</span>;
      case "requested":
      case "pending":
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">Pending</span>;
    }
  };

  // Service lookup
  const getServiceName = (serviceId?: string) => {
    if (!serviceId) return "General Consultation";
    const found = services.find((s) => s.id === serviceId || s.code === serviceId);
    return found ? found.title : serviceId;
  };

  // Clinician lookup
  const getClinicianName = (teamMemberId?: string) => {
    if (!teamMemberId) return "Unassigned / Any Doctor";
    const found = teamMembers.find((m) => m.id === teamMemberId);
    return found ? (found.displayName || `${found.firstName} ${found.lastName}`.trim()) : "Clinician Assigned";
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-forest dark:text-cream">Appointments Operations</h1>
          <p className="text-sm text-ink-soft dark:text-ink-soft/80">
            Administrative scheduling management with conflict protection, audit logging, and reception parity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-forest" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-800/40 rounded-xl flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-900 dark:text-blue-200 space-y-0.5">
          <span className="font-semibold">Privacy &amp; Least-Privilege Policy:</span>
          <p>
            Administrative appointments view is strictly scoped to scheduling, clinician assignments, and operational statuses.
            In compliance with patient confidentiality protocols, clinical examination findings, chart notes, and odontograms are never exposed here.
          </p>
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-700 hover:text-emerald-900 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-700 hover:text-red-900 text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="p-4 bg-white dark:bg-forest-soft border-line space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
          {/* Date Picker Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">
              Filter by Date
            </label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full h-9 rounded-lg border border-line bg-cream/30 dark:bg-forest px-3 text-xs text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
              />
              {selectedDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDate("")}
                  className="px-2 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-9 rounded-lg border border-line bg-cream/30 dark:bg-forest px-3 text-xs text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="arrived">Arrived</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          {/* Clinician Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">
              Clinician / Doctor
            </label>
            <select
              value={selectedClinician}
              onChange={(e) => setSelectedClinician(e.target.value)}
              className="w-full h-9 rounded-lg border border-line bg-cream/30 dark:bg-forest px-3 text-xs text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
            >
              <option value="all">All Clinicians</option>
              {teamMembers.map((tm) => (
                <option key={tm.id} value={tm.id}>
                  {tm.displayName || `${tm.firstName} ${tm.lastName}`.trim()} ({tm.role || "Doctor"})
                </option>
              ))}
            </select>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-soft" />
              <input
                type="text"
                placeholder="Search patient, phone, ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-cream/30 dark:bg-forest pl-8 pr-3 h-9 text-xs text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
              />
            </div>
            <Button variant="primary" size="sm" type="submit" className="h-9 px-3">
              Search
            </Button>
          </form>
        </div>
      </Card>

      {/* Appointments Table / Cards */}
      <Card className="border-line overflow-hidden bg-white dark:bg-forest-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cream/50 dark:bg-forest/50 border-b border-line text-ink-soft uppercase tracking-wider text-[11px] font-semibold">
              <tr>
                <th className="py-3 px-4">Ref / Patient</th>
                <th className="py-3 px-4">Schedule</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Clinician</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Admin Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-soft">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-forest" />
                    <span>Loading appointments...</span>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-soft">
                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 text-ink-soft/40" />
                    <p className="font-medium text-ink">No appointments found matching your filters.</p>
                    <p className="text-[11px] text-ink-soft mt-1">Try broadening your date or status selection.</p>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-cream/20 dark:hover:bg-forest/20 transition-colors">
                    {/* Patient & Ref */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink dark:text-cream text-sm">
                        {booking.patientName}
                      </div>
                      <div className="text-[11px] text-ink-soft flex items-center gap-2 mt-0.5">
                        <span className="font-mono bg-cream dark:bg-forest px-1.5 py-0.5 rounded border border-line">
                          #{booking.bookingNumber || booking.id.slice(0, 8)}
                        </span>
                        <span>{booking.patientPhone}</span>
                      </div>
                    </td>

                    {/* Schedule Date & Time */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-ink dark:text-cream flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5 text-forest" />
                        <span>{booking.bookingDate}</span>
                      </div>
                      <div className="text-[11px] text-ink-soft flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3.5 w-3.5 text-ink-soft" />
                        <span>{booking.bookingTime}</span>
                      </div>
                    </td>

                    {/* Service */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-ink dark:text-cream">
                        {getServiceName(booking.serviceId || undefined)}
                      </div>
                    </td>

                    {/* Clinician */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-ink dark:text-cream">
                        <User className="h-3.5 w-3.5 text-forest" />
                        <span>{getClinicianName(booking.providerId || undefined)}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderStatusBadge(booking.status)}
                    </td>

                    {/* Administrative notes */}
                    <td className="py-3 px-4 max-w-[180px] truncate text-[11px] text-ink-soft">
                      {booking.staffNotes || booking.notes || "—"}
                    </td>

                    {/* Actions Menu */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {/* Reschedule */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => openActionModal(booking, "reschedule")}
                          disabled={booking.status === "cancelled" || booking.status === "completed"}
                        >
                          Reschedule
                        </Button>

                        {/* Reassign */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => openActionModal(booking, "reassign")}
                          disabled={booking.status === "cancelled" || booking.status === "completed"}
                        >
                          Reassign
                        </Button>

                        {/* Change Service */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => openActionModal(booking, "change_service")}
                          disabled={booking.status === "cancelled" || booking.status === "completed"}
                        >
                          Service
                        </Button>

                        {/* Cancel */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => openActionModal(booking, "cancel")}
                          disabled={booking.status === "cancelled"}
                        >
                          Cancel
                        </Button>

                        {/* No-show */}
                        {booking.status !== "no_show" && booking.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px] text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                            onClick={() => openActionModal(booking, "no_show")}
                          >
                            No-Show
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --- Action Modals --- */}
      {modalType && actionBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg bg-white dark:bg-forest-soft border-line p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-serif text-lg text-forest dark:text-cream">
                  {modalType === "reschedule" && "Reschedule Appointment"}
                  {modalType === "reassign" && "Reassign Clinician"}
                  {modalType === "change_service" && "Change Procedure / Service"}
                  {modalType === "cancel" && "Cancel Appointment"}
                  {modalType === "no_show" && "Mark as No-Show"}
                </h3>
                <p className="text-xs text-ink-soft">
                  Patient: <strong className="text-ink dark:text-cream">{actionBooking.patientName}</strong> (#{actionBooking.bookingNumber || actionBooking.id.slice(0, 8)})
                </p>
              </div>
              <button onClick={closeActionModal} className="text-ink-soft hover:text-ink">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {/* Error in modal */}
            {actionError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Conflict Warning & Double-Booking Override */}
            {conflictWarning && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-300 rounded-lg text-xs space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{conflictWarning}</span>
                </div>
                <div className="pt-2 border-t border-amber-200 dark:border-amber-800 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={overrideDoubleBooking}
                      onChange={(e) => setOverrideDoubleBooking(e.target.checked)}
                      className="rounded border-line text-forest focus:ring-forest"
                    />
                    <span>Authorize Emergency Double-Booking Override</span>
                  </label>
                  {overrideDoubleBooking && (
                    <div>
                      <label className="block text-[11px] font-medium mb-1">
                        Required Audit Justification / Override Reason:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Urgent trauma referral override with head clinician agreement"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="w-full text-xs h-8 rounded-lg border border-line bg-cream/30 dark:bg-forest px-2.5 text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Body: Reschedule */}
            {modalType === "reschedule" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                      New Date
                    </label>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={(e) => setTargetDate(e.target.value)}
                      className="w-full text-xs h-9 rounded-lg border border-line bg-cream/30 dark:bg-forest px-3 text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                      New Time Slot
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 10:30 AM"
                      value={targetTime}
                      onChange={(e) => setTargetTime(e.target.value)}
                      className="w-full text-xs h-9 rounded-lg border border-line bg-cream/30 dark:bg-forest px-3 text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                    Administrative Notes
                  </label>
                  <textarea
                    rows={2}
                    value={actionStaffNotes}
                    onChange={(e) => setActionStaffNotes(e.target.value)}
                    placeholder="Notes on schedule modification (optional)"
                    className="w-full text-xs rounded-lg border border-line bg-cream/20 p-2 text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
              </div>
            )}

            {/* Modal Body: Reassign Clinician */}
            {modalType === "reassign" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                    Select New Clinician
                  </label>
                  <select
                    value={targetClinicianId}
                    onChange={(e) => setTargetClinicianId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-line bg-cream/20 dark:bg-forest px-3 text-xs text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                  >
                    <option value="">-- Choose clinician --</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.displayName || `${m.firstName} ${m.lastName}`.trim()} ({m.role || "Doctor"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                    Administrative Notes
                  </label>
                  <textarea
                    rows={2}
                    value={actionStaffNotes}
                    onChange={(e) => setActionStaffNotes(e.target.value)}
                    placeholder="Reason for reassignment"
                    className="w-full text-xs rounded-lg border border-line bg-cream/20 p-2 text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
              </div>
            )}

            {/* Modal Body: Change Service */}
            {modalType === "change_service" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                    Select New Service / Procedure
                  </label>
                  <select
                    value={targetServiceId}
                    onChange={(e) => setTargetServiceId(e.target.value)}
                    className="w-full h-9 rounded-lg border border-line bg-cream/20 dark:bg-forest px-3 text-xs text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                  >
                    <option value="">-- Choose procedure --</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({s.duration} - {s.cashPrice})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                    Administrative Notes
                  </label>
                  <textarea
                    rows={2}
                    value={actionStaffNotes}
                    onChange={(e) => setActionStaffNotes(e.target.value)}
                    placeholder="Reason for procedure change"
                    className="w-full text-xs rounded-lg border border-line bg-cream/20 p-2 text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
              </div>
            )}

            {/* Modal Body: Cancel with reason */}
            {modalType === "cancel" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                    Mandatory Cancellation Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Patient emergency, duplicate request, patient requested cancellation via phone"
                    className="w-full text-xs rounded-lg border border-line bg-cream/20 p-2 text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                  <p className="text-[11px] text-ink-soft mt-1">
                    This reason is recorded permanently in the clinic audit trail and linked to the patient history.
                  </p>
                </div>
              </div>
            )}

            {/* Modal Body: No-Show */}
            {modalType === "no_show" && (
              <div className="space-y-3">
                <p className="text-xs text-ink dark:text-cream">
                  Are you sure you want to mark this appointment as <strong className="text-amber-600">No-Show</strong>?
                  The patient did not arrive within the clinic grace period.
                </p>
                <div>
                  <label className="block text-xs font-medium text-ink dark:text-cream mb-1">
                    Administrative Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={actionStaffNotes}
                    onChange={(e) => setActionStaffNotes(e.target.value)}
                    placeholder="e.g. Called twice, phone went to voicemail"
                    className="w-full text-xs rounded-lg border border-line bg-cream/20 p-2 text-ink dark:text-cream focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button variant="ghost" size="sm" onClick={closeActionModal} disabled={isSubmittingAction}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteAction}
                disabled={isSubmittingAction}
                className={modalType === "cancel" ? "bg-red-600 hover:bg-red-700 text-white" : modalType === "no_show" ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
              >
                {isSubmittingAction ? "Processing..." : "Confirm Action"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
