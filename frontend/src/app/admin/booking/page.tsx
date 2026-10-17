"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Edit2,
  Info,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminCreateClosure,
  adminCreateRescheduleTasks,
  adminDeleteClosure,
  adminDeleteProviderAvailability,
  adminDeleteProviderTimeOff,
  adminGetBookingSettings,
  adminGetClosures,
  adminGetProviderAvailabilities,
  adminGetProviderTimeOff,
  adminGetWorkingHours,
  adminSaveProviderAvailability,
  adminSaveProviderTimeOff,
  adminUpdateBookingMode,
  adminUpdateClosure,
  adminUpdateOnlineBookingRules,
  adminUpdateWorkingHours,
  AdminBookingSettings,
  AffectedBookingItem,
  ClinicClosureItem,
  getTeamMembers,
  ProviderAvailabilityItem,
  ProviderTimeOffItem,
  TeamMember,
  WorkingHoursItem,
} from "@/lib/api";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function AdminBookingPage() {
  const { accessToken } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<"hours" | "clinicians" | "rules">("hours");

  // Settings State
  const [settings, setSettings] = useState<AdminBookingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Mode Change Form & Modal
  const [targetMode, setTargetMode] = useState<"open" | "paused" | "closed">("open");
  const [modeMessage, setModeMessage] = useState("");
  const [resumeOn, setResumeOn] = useState("");
  const [showModeConfirm, setShowModeConfirm] = useState(false);
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);

  // Affected Bookings & Reschedule Tasks Modal
  const [affectedBookings, setAffectedBookings] = useState<AffectedBookingItem[]>([]);
  const [showAffectedModal, setShowAffectedModal] = useState(false);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [tasksCreatedCount, setTasksCreatedCount] = useState<number | null>(null);

  // Working Hours State
  const [workingHours, setWorkingHours] = useState<WorkingHoursItem[]>([]);
  const [hoursSaving, setHoursSaving] = useState(false);

  // Closures State
  const [closures, setClosures] = useState<ClinicClosureItem[]>([]);
  const [closureModalOpen, setClosureModalOpen] = useState(false);
  const [editingClosure, setEditingClosure] = useState<ClinicClosureItem | null>(null);
  const [closureStart, setClosureStart] = useState("");
  const [closureEnd, setClosureEnd] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [closureMessage, setClosureMessage] = useState("");
  const [isSavingClosure, setIsSavingClosure] = useState(false);

  // Clinician Schedules State
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedClinicianId, setSelectedClinicianId] = useState<string>("");
  const [clinicianAvails, setClinicianAvails] = useState<ProviderAvailabilityItem[]>([]);
  const [clinicianTimeOffs, setClinicianTimeOffs] = useState<ProviderTimeOffItem[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  // Clinician Shift Modal State
  const [shiftModalOpen, setShiftModalOpen] = useState(false);
  const [shiftDayOfWeek, setShiftDayOfWeek] = useState(0);
  const [shiftStartTime, setShiftStartTime] = useState("09:00");
  const [shiftEndTime, setShiftEndTime] = useState("17:00");
  const [shiftBreakStart, setShiftBreakStart] = useState("");
  const [shiftBreakEnd, setShiftBreakEnd] = useState("");
  const [isSavingShift, setIsSavingShift] = useState(false);

  // Clinician Time Off Modal State
  const [timeOffModalOpen, setTimeOffModalOpen] = useState(false);
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("");
  const [timeOffApproved, setTimeOffApproved] = useState(true);
  const [isSavingTimeOff, setIsSavingTimeOff] = useState(false);

  // Online Booking Rules State
  const [slotInterval, setSlotInterval] = useState(15);
  const [minLeadTime, setMinLeadTime] = useState(2);
  const [advanceDays, setAdvanceDays] = useState(60);
  const [reminderTemplate, setReminderTemplate] = useState("");
  const [fileNumberPrefix, setFileNumberPrefix] = useState("MD-");
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  const [isSavingRules, setIsSavingRules] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsData, hoursData, closuresData, membersData] = await Promise.all([
        adminGetBookingSettings(accessToken),
        adminGetWorkingHours(accessToken),
        adminGetClosures(accessToken),
        getTeamMembers().catch(() => []),
      ]);
      setSettings(settingsData);
      setWorkingHours(hoursData);
      setClosures(closuresData);
      setModeMessage(settingsData.pauseMessage || "");
      setResumeOn(settingsData.resumeOn || "");
      setSlotInterval(settingsData.slotIntervalMinutes || 15);
      setMinLeadTime(settingsData.minLeadTimeHours ?? 2);
      setAdvanceDays(settingsData.advanceBookingDays || 60);
      setFileNumberPrefix(settingsData.fileNumberPrefix || "MD-");
      setPaymentsEnabled(settingsData.paymentsEnabled ?? true);
      setReminderTemplate(
        settingsData.reminderTemplate ||
          "Dear {patient_name}, this is a reminder for your dental appointment on {appointment_date} at {appointment_time} with {clinician_name} at Marlow Dental. Please reply to confirm or call us if you need to reschedule."
      );

      const activeDoctors = membersData.filter((m) => m.isActive);
      setTeamMembers(activeDoctors);
      if (activeDoctors.length > 0 && !selectedClinicianId) {
        setSelectedClinicianId(activeDoctors[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load booking administration data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadAll();
    });
  }, [accessToken]);

  // Load clinician availability and time off when selected clinician changes
  useEffect(() => {
    if (!selectedClinicianId || !accessToken) return;
    queueMicrotask(() => {
      setSchedulesLoading(true);
      Promise.all([
        adminGetProviderAvailabilities(selectedClinicianId, accessToken).catch(() => []),
        adminGetProviderTimeOff(selectedClinicianId, false, accessToken).catch(() => []),
      ])
        .then(([avails, timeOffs]) => {
          setClinicianAvails(avails);
          setClinicianTimeOffs(timeOffs);
        })
        .finally(() => setSchedulesLoading(false));
    });
  }, [selectedClinicianId, accessToken]);

  // Mode Change Handlers
  const handleInitiateModeChange = (mode: "open" | "paused" | "closed") => {
    setTargetMode(mode);
    if (mode === "open") {
      setModeMessage("");
      setResumeOn("");
    } else if (!modeMessage) {
      setModeMessage(
        mode === "paused"
          ? "Online booking is temporarily paused. For urgent scheduling, please call our clinic directly."
          : "Clinic is closed. Online booking is disabled."
      );
    }
    setShowModeConfirm(true);
  };

  const handleConfirmModeChange = async () => {
    setIsUpdatingMode(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await adminUpdateBookingMode(
        {
          mode: targetMode,
          message: targetMode !== "open" ? modeMessage.trim() : undefined,
          resumeOn: targetMode !== "open" && resumeOn ? resumeOn : undefined,
        },
        accessToken
      );
      setSettings(res.settings);
      setShowModeConfirm(false);
      setSuccessMsg(
        targetMode === "open"
          ? "Booking mode reopened successfully. Public scheduling is live."
          : `Booking mode set to ${targetMode.toUpperCase()}. Public scheduling has been updated.`
      );

      if (res.affectedBookings && res.affectedBookings.length > 0) {
        setAffectedBookings(res.affectedBookings);
        setShowAffectedModal(true);
        setTasksCreatedCount(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update booking mode.");
    } finally {
      setIsUpdatingMode(false);
    }
  };

  const handleCreateTasksForAffected = async () => {
    if (affectedBookings.length === 0) return;
    setIsCreatingTasks(true);
    try {
      const res = await adminCreateRescheduleTasks(
        affectedBookings.map((b) => b.id),
        accessToken
      );
      setTasksCreatedCount(res.tasksCreated);
      setSuccessMsg(`Created ${res.tasksCreated} follow-up task(s) for the reception team.`);
    } catch (err: any) {
      setError(err.message || "Failed to create reschedule tasks.");
    } finally {
      setIsCreatingTasks(false);
    }
  };

  // Working Hours Handlers
  const handleWorkingHoursChange = (
    index: number,
    field: keyof WorkingHoursItem,
    value: any
  ) => {
    setWorkingHours((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveWorkingHours = async () => {
    setHoursSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const updated = await adminUpdateWorkingHours(workingHours, accessToken);
      setWorkingHours(updated);
      setSuccessMsg("Clinic operating hours updated successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to update operating hours.");
    } finally {
      setHoursSaving(false);
    }
  };

  // Closure Handlers
  const openNewClosureModal = () => {
    setEditingClosure(null);
    setClosureStart("");
    setClosureEnd("");
    setClosureReason("");
    setClosureMessage("");
    setClosureModalOpen(true);
  };

  const openEditClosureModal = (c: ClinicClosureItem) => {
    setEditingClosure(c);
    setClosureStart(c.startDate);
    setClosureEnd(c.endDate);
    setClosureReason(c.reason);
    setClosureMessage(c.message || "");
    setClosureModalOpen(true);
  };

  const handleSaveClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closureStart || !closureEnd || !closureReason.trim()) {
      setError("Please fill out all required closure fields.");
      return;
    }
    setIsSavingClosure(true);
    setError("");
    setSuccessMsg("");

    try {
      if (editingClosure) {
        const updated = await adminUpdateClosure(
          editingClosure.id,
          {
            startDate: closureStart,
            endDate: closureEnd,
            reason: closureReason.trim(),
            message: closureMessage.trim() || undefined,
          },
          accessToken
        );
        setClosures((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setSuccessMsg("Closure successfully updated.");
      } else {
        const res = await adminCreateClosure(
          {
            startDate: closureStart,
            endDate: closureEnd,
            reason: closureReason.trim(),
            message: closureMessage.trim() || undefined,
          },
          accessToken
        );
        setClosures((prev) => [res.closure, ...prev]);
        setSuccessMsg("Closure created and added to booking calendar.");

        if (res.affectedBookings && res.affectedBookings.length > 0) {
          setAffectedBookings(res.affectedBookings);
          setShowAffectedModal(true);
          setTasksCreatedCount(null);
        }
      }
      setClosureModalOpen(false);
    } catch (err: any) {
      setError(err.message || "Failed to save closure.");
    } finally {
      setIsSavingClosure(false);
    }
  };

  const handleDeleteClosure = async (id: string) => {
    if (!confirm("Are you sure you want to remove this planned closure?")) return;
    try {
      await adminDeleteClosure(id, accessToken);
      setClosures((prev) => prev.filter((c) => c.id !== id));
      setSuccessMsg("Planned closure removed.");
    } catch (err: any) {
      setError(err.message || "Failed to delete closure.");
    }
  };

  // Clinician Shift Handlers
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinicianId) return;
    setIsSavingShift(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await adminSaveProviderAvailability(
        {
          teamMemberId: selectedClinicianId,
          dayOfWeek: shiftDayOfWeek,
          startTime: shiftStartTime,
          endTime: shiftEndTime,
          breakStartTime: shiftBreakStart.trim() || null,
          breakEndTime: shiftBreakEnd.trim() || null,
          isActive: true,
        },
        accessToken
      );
      setClinicianAvails((prev) => [...prev.filter((a) => a.id !== res.availability.id), res.availability]);
      setSuccessMsg("Clinician working schedule saved.");
      setShiftModalOpen(false);

      if (res.affectedBookings && res.affectedBookings.length > 0) {
        setAffectedBookings(res.affectedBookings);
        setShowAffectedModal(true);
        setTasksCreatedCount(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save clinician schedule.");
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteShift = async (availId: string) => {
    if (!confirm("Remove this shift from the clinician's recurring weekly schedule?")) return;
    try {
      await adminDeleteProviderAvailability(availId, accessToken);
      setClinicianAvails((prev) => prev.filter((a) => a.id !== availId));
      setSuccessMsg("Shift removed.");
    } catch (err: any) {
      setError(err.message || "Failed to delete shift.");
    }
  };

  // Clinician Time Off Handlers
  const handleSaveTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinicianId || !timeOffStart || !timeOffEnd || !timeOffReason.trim()) {
      setError("Please fill out all required time-off fields.");
      return;
    }
    setIsSavingTimeOff(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await adminSaveProviderTimeOff(
        {
          teamMemberId: selectedClinicianId,
          startDate: timeOffStart,
          endDate: timeOffEnd,
          reason: timeOffReason.trim(),
          isApproved: timeOffApproved,
        },
        accessToken
      );
      setClinicianTimeOffs((prev) => [res.timeOff, ...prev.filter((t) => t.id !== res.timeOff.id)]);
      setSuccessMsg("Clinician vacation / time-off saved.");
      setTimeOffModalOpen(false);

      if (res.affectedBookings && res.affectedBookings.length > 0) {
        setAffectedBookings(res.affectedBookings);
        setShowAffectedModal(true);
        setTasksCreatedCount(null);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save time off.");
    } finally {
      setIsSavingTimeOff(false);
    }
  };

  const handleDeleteTimeOff = async (timeOffId: string) => {
    if (!confirm("Remove this planned leave entry?")) return;
    try {
      await adminDeleteProviderTimeOff(timeOffId, accessToken);
      setClinicianTimeOffs((prev) => prev.filter((t) => t.id !== timeOffId));
      setSuccessMsg("Time-off entry removed.");
    } catch (err: any) {
      setError(err.message || "Failed to delete time off.");
    }
  };

  // Online Booking Rules Handler
  const handleSaveOnlineRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingRules(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await adminUpdateOnlineBookingRules(
        {
          slotIntervalMinutes: Number(slotInterval),
          minLeadTimeHours: Number(minLeadTime),
          advanceBookingDays: Number(advanceDays),
          reminderTemplate: reminderTemplate,
          fileNumberPrefix: fileNumberPrefix.trim() || "MD-",
          paymentsEnabled: paymentsEnabled,
        },
        accessToken
      );
      setSettings(res);
      setSuccessMsg("Online booking rules updated successfully.");
    } catch (err: any) {
      setError(err.message || "Failed to update online booking rules.");
    } finally {
      setIsSavingRules(false);
    }
  };

  const currentMode = settings?.bookingMode || "open";

  return (
    <div className="space-y-8 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Booking &amp; Operating Hours
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
            Single source of truth for public scheduling availability, emergency pause controls, and clinician schedules.
          </p>
        </div>
        <Button
          onClick={loadAll}
          variant="secondary"
          size="sm"
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 p-4 text-xs sm:text-sm text-red-700 dark:text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs sm:text-sm text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 hover:text-emerald-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("hours")}
          className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "hours"
              ? "bg-forest text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Booking Mode &amp; Working Hours
        </button>
        <button
          onClick={() => setActiveTab("clinicians")}
          className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "clinicians"
              ? "bg-forest text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Clinician Schedules &amp; Time Off
        </button>
        <button
          onClick={() => setActiveTab("rules")}
          className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "rules"
              ? "bg-forest text-white shadow-sm"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
        >
          Online Booking Rules
        </button>
      </div>

      {/* TAB 1: EMERGENCY MODE & CLINIC OPERATING HOURS */}
      {activeTab === "hours" && (
        <div className="space-y-8">
          {/* Passed Resume Date Banner */}
          {settings?.isResumePassed && currentMode !== "open" && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/50 p-5 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    Action Required: Scheduled Resume Date Has Passed ({settings.resumeOn})
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    The planned pause date has arrived. By safety policy, public booking is <strong>not automatically reopened</strong> without verification. Please confirm clinic staffing and click below to reopen online booking.
                  </p>
                </div>
              </div>
              <div className="pl-8">
                <Button
                  onClick={() => handleInitiateModeChange("open")}
                  variant="primary"
                  size="sm"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white"
                >
                  <Play className="h-3.5 w-3.5 mr-1" />
                  <span>Reopen Public Booking Now</span>
                </Button>
              </div>
            </div>
          )}

          {/* Emergency Pause & Booking Mode Banner */}
          <Card
            surface="cream"
            shadow="subtle"
            className={`p-6 border-2 transition-all ${
              currentMode === "open"
                ? "border-emerald-300 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20"
                : currentMode === "paused"
                ? "border-amber-400 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/30"
                : "border-rose-400 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      currentMode === "open"
                        ? "bg-emerald-500 animate-pulse"
                        : currentMode === "paused"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                  />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    Booking Mode: {currentMode}
                  </h2>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {currentMode === "open" &&
                    "Public appointment booking via /book is active. Patients can select available slots."}
                  {currentMode === "paused" &&
                    `Public booking submissions are paused. Receptionists can still schedule normally. ${
                      settings?.pauseMessage ? `Message: "${settings.pauseMessage}"` : ""
                    }`}
                  {currentMode === "closed" &&
                    `Public booking is closed. Internal receptionist booking requires a recorded override reason. ${
                      settings?.pauseMessage ? `Message: "${settings.pauseMessage}"` : ""
                    }`}
                </p>

                {currentMode !== "open" && settings?.resumeOn && (
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300 pt-1">
                    Scheduled review date: <strong>{settings.resumeOn}</strong>
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {currentMode !== "open" ? (
                  <Button
                    onClick={() => handleInitiateModeChange("open")}
                    variant="primary"
                    size="sm"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    <span>Reopen Public Booking</span>
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => handleInitiateModeChange("paused")}
                      variant="secondary"
                      size="sm"
                      className="border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200"
                    >
                      <Pause className="h-3.5 w-3.5 mr-1 text-amber-600" />
                      <span>Pause Booking</span>
                    </Button>
                    <Button
                      onClick={() => handleInitiateModeChange("closed")}
                      variant="primary"
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      <span>Emergency Close</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Clinic Operating Hours */}
          <Card surface="cream" shadow="subtle" className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-line gap-2">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Clock className="h-4 w-4 text-forest" />
                  <span>Working Hours</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Controls the master operating envelope for all 7 days in Asia/Karachi timezone.
                </p>
              </div>
              <Button
                onClick={handleSaveWorkingHours}
                variant="primary"
                size="sm"
                disabled={hoursSaving}
              >
                {hoursSaving ? "Saving..." : "Save Operating Hours"}
              </Button>
            </div>

            <div className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
              {workingHours.map((wh, idx) => (
                <div
                  key={wh.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="w-28 font-medium text-gray-800 dark:text-gray-200">
                    {DAY_NAMES[wh.dayOfWeek]}
                  </div>

                  <div className="flex items-center gap-3 flex-1 flex-wrap">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wh.isClosed}
                        onChange={(e) =>
                          handleWorkingHoursChange(idx, "isClosed", e.target.checked)
                        }
                        className="rounded border-gray-300 text-forest focus:ring-forest"
                      />
                      <span className="text-gray-600 dark:text-gray-400">Closed</span>
                    </label>

                    {!wh.isClosed && (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={wh.openTime || "08:00"}
                          onChange={(e) =>
                            handleWorkingHoursChange(idx, "openTime", e.target.value)
                          }
                          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white"
                        />
                        <span className="text-gray-400">to</span>
                        <input
                          type="time"
                          value={wh.closeTime || "18:00"}
                          onChange={(e) =>
                            handleWorkingHoursChange(idx, "closeTime", e.target.value)
                          }
                          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Planned Clinic Closures */}
          <Card surface="cream" shadow="subtle" className="p-6">
            <div className="flex items-center justify-between pb-4 border-b border-line">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-forest" />
                  <span>Planned Clinic Closures &amp; Holidays</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Public holidays and planned clinic maintenance. Automatically greyed out on /book datepicker.
                </p>
              </div>
              <Button onClick={openNewClosureModal} variant="primary" size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span>Add Closure</span>
              </Button>
            </div>

            <div className="mt-4">
              {closures.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center italic">
                  No planned closures currently scheduled.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {closures.map((c) => (
                    <div
                      key={c.id}
                      className="py-3 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {c.reason}
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {c.startDate} {c.startDate !== c.endDate ? `to ${c.endDate}` : ""}
                        </div>
                        {c.message && (
                          <div className="text-gray-600 dark:text-gray-300 italic text-[11px]">
                            &ldquo;{c.message}&rdquo;
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => openEditClosureModal(c)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteClosure(c.id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: CLINICIAN SCHEDULES & TIME OFF */}
      {activeTab === "clinicians" && (
        <div className="space-y-6">
          <Card surface="cream" shadow="subtle" className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Users className="h-4 w-4 text-forest" />
                  <span>Clinician Schedules &amp; Individual Time Off</span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Configure recurring chairside weekly shifts, lunch breaks, and planned clinician vacations.
                </p>
              </div>

              {/* Clinician Selector Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Clinician:</span>
                <select
                  value={selectedClinicianId}
                  onChange={(e) => setSelectedClinicianId(e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-white"
                >
                  {teamMembers.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      {tm.displayName} ({tm.professionalTitle || tm.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {schedulesLoading ? (
              <div className="py-12 flex justify-center items-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Recurring Shifts & Breaks */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Weekly Recurring Shifts &amp; Breaks
                    </h4>
                    <Button
                      onClick={() => setShiftModalOpen(true)}
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Weekly Shift</span>
                    </Button>
                  </div>

                  {clinicianAvails.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center italic bg-bone rounded-xl border border-line">
                      No custom weekly shifts set. Clinician inherits general clinic operating hours.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {clinicianAvails.map((a) => (
                        <div
                          key={a.id}
                          className="rounded-xl border border-line bg-bone p-3.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {DAY_NAMES[a.dayOfWeek]}
                            </div>
                            <div className="text-gray-600 dark:text-gray-300 font-mono text-[11.5px] mt-0.5">
                              {a.startTime} – {a.endTime}
                            </div>
                            {a.breakStartTime && a.breakEndTime && (
                              <div className="text-amber-800 dark:text-amber-300 text-[11px] mt-1 flex items-center gap-1">
                                <Pause className="h-2.5 w-2.5" />
                                <span>Break: {a.breakStartTime} – {a.breakEndTime}</span>
                              </div>
                            )}
                          </div>
                          <Button
                            onClick={() => handleDeleteShift(a.id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Approved Time Off & Vacations */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Planned Vacations &amp; Leaves
                    </h4>
                    <Button
                      onClick={() => setTimeOffModalOpen(true)}
                      variant="secondary"
                      size="sm"
                      className="gap-1.5"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Time Off</span>
                    </Button>
                  </div>

                  {clinicianTimeOffs.length === 0 ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400 py-4 text-center italic bg-bone rounded-xl border border-line">
                      No planned vacations or leaves recorded.
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-line rounded-xl bg-bone">
                      {clinicianTimeOffs.map((to) => (
                        <div
                          key={to.id}
                          className="p-3.5 flex items-center justify-between gap-4 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <span>{to.reason}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  to.isApproved
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                }`}
                              >
                                {to.isApproved ? "Approved (Blocks Slots)" : "Pending Review"}
                              </span>
                            </div>
                            <div className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">
                              {to.startDate} {to.startDate !== to.endDate ? `to ${to.endDate}` : ""}
                            </div>
                          </div>
                          <Button
                            onClick={() => handleDeleteTimeOff(to.id)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 3: ONLINE BOOKING RULES */}
      {activeTab === "rules" && (
        <Card surface="cream" shadow="subtle" className="p-6 max-w-2xl">
          <form onSubmit={handleSaveOnlineRules} className="space-y-6">
            <div className="pb-4 border-b border-line">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="h-4 w-4 text-forest" />
                <span>Online Booking Engine Rules</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Configure patient slot intervals, advance booking windows, and lead time constraints.
              </p>
            </div>

            <div className="space-y-4">
              {/* Slot Interval */}
              <div>
                <label htmlFor="rule-interval" className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Default Slot Interval (Minutes)
                </label>
                <select
                  id="rule-interval"
                  value={slotInterval}
                  onChange={(e) => setSlotInterval(parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                >
                  <option value={10}>10 minutes</option>
                  <option value={15}>15 minutes (Standard Practice Default)</option>
                  <option value={20}>20 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Step interval between generated start times on the public /book appointment picker.
                </p>
              </div>

              {/* Minimum Lead Time */}
              <div>
                <label htmlFor="rule-lead" className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Minimum Lead Time (Hours)
                </label>
                <input
                  id="rule-lead"
                  type="number"
                  min={0}
                  max={48}
                  value={minLeadTime}
                  onChange={(e) => setMinLeadTime(parseInt(e.target.value, 10) || 0)}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Appointments cannot be booked online fewer than this many hours ahead of local Asia/Karachi time.
                </p>
              </div>

              {/* Advance Booking Window */}
              <div>
                <label htmlFor="rule-advance" className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Advance Booking Window (Days)
                </label>
                <input
                  id="rule-advance"
                  type="number"
                  min={1}
                  max={365}
                  value={advanceDays}
                  onChange={(e) => setAdvanceDays(parseInt(e.target.value, 10) || 60)}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Maximum number of days ahead patients are allowed to book on the appointment calendar.
                </p>
              </div>

              {/* Patient Sequential File Number Prefix */}
              <div>
                <label htmlFor="rule-file-prefix" className="block text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Patient File Number Prefix
                </label>
                <input
                  id="rule-file-prefix"
                  type="text"
                  maxLength={15}
                  value={fileNumberPrefix}
                  onChange={(e) => setFileNumberPrefix(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                  placeholder="MD-"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Prefix for auto-generated sequential patient chart numbers (e.g. MD-0001, MD-0002).
                </p>
              </div>

              {/* Reminder Message Template (Logistics only, no clinical content) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="rule-template" className="block text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Appointment Reminder Message Template
                  </label>
                  <span className="text-[10px] text-gray-500 font-medium">No clinical content</span>
                </div>
                <textarea
                  id="rule-template"
                  rows={4}
                  value={reminderTemplate}
                  onChange={(e) => setReminderTemplate(e.target.value)}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                  placeholder="Dear {patient_name}, this is a reminder for your dental appointment on {appointment_date} at {appointment_time} with {clinician_name} at Marlow Dental."
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Available placeholders: <code className="bg-bone px-1 py-0.5 rounded border border-line">{"{patient_name}"}</code>,{" "}
                  <code className="bg-bone px-1 py-0.5 rounded border border-line">{"{appointment_date}"}</code>,{" "}
                  <code className="bg-bone px-1 py-0.5 rounded border border-line">{"{appointment_time}"}</code>,{" "}
                  <code className="bg-bone px-1 py-0.5 rounded border border-line">{"{clinician_name}"}</code>,{" "}
                  <code className="bg-bone px-1 py-0.5 rounded border border-line">{"{clinic_name}"}</code>.
                </p>
              </div>

              {/* Optional Front Desk Visit Payments Toggle */}
              <div className="p-3.5 rounded-xl border border-line bg-bone/60 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentsEnabled}
                    onChange={(e) => setPaymentsEnabled(e.target.checked)}
                    className="rounded border-line text-forest focus:ring-forest h-4 w-4"
                  />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    Enable Front Desk Visit Payment Collection
                  </span>
                </label>
                <p className="text-[11px] text-gray-500 pl-6">
                  Allows receptionists to record visit payments (cash, card, bank transfer) and view cash reconciliation totals at end-of-day.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-line flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={isSavingRules}>
                {isSavingRules ? "Saving Rules..." : "Save Booking Rules"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* MODAL: Shift / Recurring Availability */}
      {shiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card surface="cream" shadow="elevated" className="w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-base font-semibold text-ink">Add Weekly Shift</h3>
              <button onClick={() => setShiftModalOpen(false)} className="text-ink-soft hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium mb-1">Day of the Week</label>
                <select
                  value={shiftDayOfWeek}
                  onChange={(e) => setShiftDayOfWeek(parseInt(e.target.value, 10))}
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2"
                >
                  {DAY_NAMES.map((name, i) => (
                    <option key={name} value={i}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    value={shiftStartTime}
                    onChange={(e) => setShiftStartTime(e.target.value)}
                    required
                    className="w-full rounded-xl border border-line bg-bone px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Shift End Time</label>
                  <input
                    type="time"
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    required
                    className="w-full rounded-xl border border-line bg-bone px-3 py-2"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-line p-3 bg-cream/40 space-y-2">
                <span className="font-semibold block text-[11px] uppercase tracking-wider text-ink-soft">
                  Optional Mid-Shift Break (Lunch)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1">Break Start</label>
                    <input
                      type="time"
                      value={shiftBreakStart}
                      onChange={(e) => setShiftBreakStart(e.target.value)}
                      className="w-full rounded-xl border border-line bg-bone px-2.5 py-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1">Break End</label>
                    <input
                      type="time"
                      value={shiftBreakEnd}
                      onChange={(e) => setShiftBreakEnd(e.target.value)}
                      className="w-full rounded-xl border border-line bg-bone px-2.5 py-1.5"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShiftModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSavingShift}>
                  {isSavingShift ? "Saving..." : "Save Shift"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Time Off / Vacation */}
      {timeOffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card surface="cream" shadow="elevated" className="w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="text-base font-semibold text-ink">Add Clinician Vacation / Leave</h3>
              <button onClick={() => setTimeOffModalOpen(false)} className="text-ink-soft hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTimeOff} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={timeOffStart}
                    onChange={(e) => setTimeOffStart(e.target.value)}
                    required
                    className="w-full rounded-xl border border-line bg-bone px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={timeOffEnd}
                    onChange={(e) => setTimeOffEnd(e.target.value)}
                    required
                    className="w-full rounded-xl border border-line bg-bone px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Annual Vacation, Conference, Medical Leave"
                  value={timeOffReason}
                  onChange={(e) => setTimeOffReason(e.target.value)}
                  required
                  className="w-full rounded-xl border border-line bg-bone px-3 py-2"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={timeOffApproved}
                  onChange={(e) => setTimeOffApproved(e.target.checked)}
                  className="rounded border-line text-forest focus:ring-forest"
                />
                <span>Approve Leave (Blocks slots on public calendar)</span>
              </label>

              <div className="pt-3 border-t border-line flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setTimeOffModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSavingTimeOff}>
                  {isSavingTimeOff ? "Saving..." : "Save Leave"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Affected Bookings Warning Modal (Strict policy: Never auto-cancel) */}
      {showAffectedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border-2 border-amber-400 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Schedule Notice: {affectedBookings.length} Existing Booking(s) Impacted
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  Changing this schedule conflicts with future patient bookings. By clinical policy, <strong>these bookings have NOT been cancelled</strong>. Please review them or assign them to an alternate clinician.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 p-3 max-h-60 overflow-y-auto divide-y divide-amber-200 dark:divide-amber-900/40">
              {affectedBookings.map((b) => (
                <div key={b.id} className="py-2 text-xs flex justify-between items-center gap-2">
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {b.patientFullName}
                    </span>{" "}
                    <span className="font-mono text-gray-500">({b.confirmationId})</span>
                    <div className="text-gray-600 dark:text-gray-400 text-[11px]">
                      {b.preferredDate} at {b.preferredTime} · Tel: {b.patientPhone}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                    {b.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowAffectedModal(false)}
              >
                Dismiss Notice
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleCreateTasksForAffected}
                disabled={isCreatingTasks || tasksCreatedCount !== null}
                className="bg-amber-700 hover:bg-amber-800 text-white"
              >
                <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                <span>
                  {tasksCreatedCount !== null
                    ? `Tasks Created (${tasksCreatedCount})`
                    : isCreatingTasks
                    ? "Dispatching..."
                    : "Create Reception Follow-up Tasks"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mode Confirmation Modal */}
      {showModeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white capitalize">
              Confirm Mode: {targetMode}
            </h3>

            {targetMode !== "open" && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Public Banner Message (shown on /book)
                  </label>
                  <textarea
                    rows={3}
                    value={modeMessage}
                    onChange={(e) => setModeMessage(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-xs text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Scheduled Resume Review Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={resumeOn}
                    onChange={(e) => setResumeOn(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-xs text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button variant="ghost" size="sm" onClick={() => setShowModeConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                className={targetMode === "closed" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                onClick={handleConfirmModeChange}
                disabled={isUpdatingMode}
              >
                {isUpdatingMode ? "Updating..." : `Confirm ${targetMode}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Closure Edit/Create Modal */}
      {closureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveClosure}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {editingClosure ? "Edit Clinic Closure" : "Add Planned Closure"}
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  id="closure-start"
                  label="Start Date"
                  type="date"
                  value={closureStart}
                  onChange={(e) => setClosureStart(e.target.value)}
                  required
                />
                <TextField
                  id="closure-end"
                  label="End Date"
                  type="date"
                  value={closureEnd}
                  onChange={(e) => setClosureEnd(e.target.value)}
                  required
                />
              </div>

              <TextField
                id="closure-reason"
                label="Reason"
                placeholder="e.g. Public Holiday, Clinic Maintenance"
                value={closureReason}
                onChange={(e) => setClosureReason(e.target.value)}
                required
              />

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Optional Patient Message
                </label>
                <textarea
                  rows={2}
                  value={closureMessage}
                  onChange={(e) => setClosureMessage(e.target.value)}
                  placeholder="e.g. Closed for Pakistan Day. Desk reopens tomorrow at 8 AM."
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-xs text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
              <Button variant="ghost" size="sm" onClick={() => setClosureModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSavingClosure}>
                {isSavingClosure ? "Saving..." : editingClosure ? "Update Closure" : "Save Closure"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
