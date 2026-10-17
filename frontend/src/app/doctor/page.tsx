"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  FileCheck,
  FileText,
  History,
  Lock,
  RefreshCw,
  Save,
  ShieldCheck,
  Stethoscope,
  X,
} from "lucide-react";

import {
  amendEncounterClinicalNote,
  applyTemplateToDraftNote,
  ClinicalEncounter,
  ClinicalNoteTemplate,
  ClinicalSOAPNote,
  createClinicalEncounter,
  finishDoctorAppointment,
  getActiveEncounterByBooking,
  getClinicalEncounter,
  getClinicalNoteTemplates,
  getDoctorSchedule,
  getDoctorUnsignedNotes,
  getEncounterClinicalNote,
  getEncounterNoteRevisions,
  ReceptionBooking,
  saveDraftEncounterNote,
  signEncounterClinicalNote,
  startDoctorAppointment,
  UnsignedNoteItem,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DentalChart } from "@/components/doctor/dental-chart";
import { ClinicalAlertBanner } from "@/components/doctor/clinical-alert-banner";
import { getWaitingTimeCategory } from "@/lib/statuses";

export default function DoctorDashboardPage() {
  const { accessToken, user } = useAuth();
  const directory = useDirectory();

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [schedule, setSchedule] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // SOAP Clinical Note & Chart Modal State
  const [selectedBooking, setSelectedBooking] = useState<ReceptionBooking | null>(null);
  const [activeEncounter, setActiveEncounter] = useState<ClinicalEncounter | null>(null);
  const [currentNote, setCurrentNote] = useState<ClinicalSOAPNote | null>(null);
  const [revisions, setRevisions] = useState<ClinicalSOAPNote[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [isAmending, setIsAmending] = useState(false);
  const [activeTab, setActiveTab] = useState<"soap" | "chart">("soap");

  // Form Fields
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [amendmentReason, setAmendmentReason] = useState("");

  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Unsigned Notes & Finish Visit State (Phase 1.2 & 1.3)
  const [unsignedNotes, setUnsignedNotes] = useState<UnsignedNoteItem[]>([]);
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [finishBooking, setFinishBooking] = useState<ReceptionBooking | null>(null);
  const [followUpWeeks, setFollowUpWeeks] = useState<number | "">("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [isFinishing, setIsFinishing] = useState(false);

  // Note Templates State (B3)
  const [templates, setTemplates] = useState<ClinicalNoteTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    queueMicrotask(() => setCurrentTime(Date.now()));
    const ticker = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(ticker);
  }, []);

  const loadUnsignedNotes = async () => {
    try {
      const data = await getDoctorUnsignedNotes(accessToken);
      setUnsignedNotes(data);
    } catch (err) {
      console.error("Failed to load unsigned notes:", err);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await getClinicalNoteTemplates(true, accessToken);
      setTemplates(data || []);
    } catch (err) {
      console.error("Failed to load note templates:", err);
    }
  };

  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      const data = await getDoctorSchedule(date, accessToken);
      setSchedule(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
    await loadUnsignedNotes();
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadSchedule();
      loadUnsignedNotes();
      loadTemplates();
    });

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSchedule();
        loadUnsignedNotes();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = setInterval(() => {
      if (!document.hidden) {
        loadSchedule();
        loadUnsignedNotes();
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [date, accessToken]);

  const handleOpenUnsignedNote = async (item: UnsignedNoteItem) => {
    const matching = schedule.find((b) => b.id === item.bookingId);
    if (matching) {
      await handleOpenSoapModal(matching);
      return;
    }
    const surrogate: ReceptionBooking = {
      id: item.bookingId || item.encounterId,
      bookingNumber: "ENC",
      patientId: item.patientId,
      patientName: item.patientName,
      patientPhone: "",
      patientEmail: "",
      bookingDate: item.date ? item.date.split("T")[0] : "",
      bookingTime: "Encounter",
      status: "in_progress",
      confirmationStatus: "confirmed",
      createdAt: item.date,
      updatedAt: item.date,
    };
    setSelectedBooking(surrogate);
    setActiveTab("soap");
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowRevisions(false);
    setIsAmending(false);
    setIsActionLoading(true);

    try {
      const enc = await getClinicalEncounter(item.encounterId, accessToken);
      setActiveEncounter(enc);
      const note = await getEncounterClinicalNote(enc.id, accessToken);
      setCurrentNote(note);
      if (note) {
        setSubjective(note.subjective || "");
        setObjective(note.objective || "");
        setAssessment(note.assessment || "");
        setPlan(note.plan || "");
      } else {
        setSubjective("");
        setObjective("");
        setAssessment("");
        setPlan("");
      }
      const revs = await getEncounterNoteRevisions(enc.id, accessToken);
      setRevisions(revs);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load clinical encounter.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFinishVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!finishBooking) return;
    setIsFinishing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await finishDoctorAppointment(
        finishBooking.id,
        {
          followUpWeeks: typeof followUpWeeks === "number" ? followUpWeeks : undefined,
          followUpNote: followUpNote.trim() || undefined,
        },
        accessToken
      );
      setIsFinishModalOpen(false);
      setFinishBooking(null);
      setFollowUpWeeks("");
      setFollowUpNote("");
      setSuccessMsg("Visit completed successfully.");
      await loadSchedule();
      await loadUnsignedNotes();
      if (selectedBooking?.id === finishBooking.id) {
        setSelectedBooking(null);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to finish visit.");
    } finally {
      setIsFinishing(false);
    }
  };

  const handleOpenSoapModal = async (booking: ReceptionBooking) => {
    setSelectedBooking(booking);
    setActiveTab("soap");
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowRevisions(false);
    setIsAmending(false);
    setIsActionLoading(true);

    try {
      // 1. Get or create active encounter for this booking
      let enc = await getActiveEncounterByBooking(booking.id, accessToken);
      if (!enc) {
        enc = await createClinicalEncounter(
          {
            patientId: booking.patientId || "",
            bookingId: booking.id,
            chiefComplaint: booking.notes || "Scheduled appointment visit",
            reasonForVisit: directory.serviceName(booking.serviceId) || "Clinical Visit",
            status: "in_progress",
          },
          accessToken
        );
      }
      setActiveEncounter(enc);

      // 2. Fetch current note if exists
      const note = await getEncounterClinicalNote(enc.id, accessToken);
      setCurrentNote(note);

      if (note) {
        setSubjective(note.subjective || "");
        setObjective(note.objective || "");
        setAssessment(note.assessment || "");
        setPlan(note.plan || "");
      } else {
        // Initialize from booking intake notes
        setSubjective(booking.notes ? `Intake complaint: ${booking.notes}` : "");
        setObjective("");
        setAssessment("");
        setPlan("");
      }

      // 3. Load revision history
      const revs = await getEncounterNoteRevisions(enc.id, accessToken);
      setRevisions(revs);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load clinical encounter.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;
    const tmpl = templates.find((t) => t.id === selectedTemplateId);
    if (!tmpl) return;

    if (currentNote?.isSigned && !isAmending) {
      alert("Signed notes are immutable and cannot be modified by note templates.");
      return;
    }

    const hasExistingText = Boolean(
      subjective.trim() || objective.trim() || assessment.trim() || plan.trim()
    );

    if (hasExistingText) {
      const confirmed = confirm(
        `The draft note already contains text.\n\nApplying template "${tmpl.name}" will overwrite current content with the standard structure.\n\nDo you want to proceed?`
      );
      if (!confirmed) return;
    }

    if (currentNote?.id) {
      try {
        const res = await applyTemplateToDraftNote(
          currentNote.id,
          { templateId: tmpl.id, overwriteConfirmed: true },
          accessToken
        );
        setSubjective(res.subjective);
        setObjective(res.objective);
        setAssessment(res.assessment);
        setPlan(res.plan);
        setSuccessMsg(`Template "${tmpl.name}" applied successfully.`);
        setTimeout(() => setSuccessMsg(null), 3000);
        return;
      } catch (err) {
        console.warn("Server apply template fallback:", err);
      }
    }

    setSubjective(tmpl.subjective);
    setObjective(tmpl.objective);
    setAssessment(tmpl.assessment);
    setPlan(tmpl.plan);
    setSuccessMsg(`Template "${tmpl.name}" applied.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEncounter) return;

    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updated = await saveDraftEncounterNote(
        activeEncounter.id,
        { subjective, objective, assessment, plan },
        accessToken
      );
      setCurrentNote(updated);
      setSuccessMsg("Draft saved successfully.");
      const revs = await getEncounterNoteRevisions(activeEncounter.id, accessToken);
      setRevisions(revs);
      await loadSchedule();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSignNote = async () => {
    if (!activeEncounter) return;
    if (!confirm("Are you sure you want to sign this clinical note? Signed notes are locked and can only be amended with a recorded clinical rationale.")) {
      return;
    }

    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // First save current content if draft
      if (!currentNote || !currentNote.isSigned) {
        await saveDraftEncounterNote(
          activeEncounter.id,
          { subjective, objective, assessment, plan },
          accessToken
        );
      }
      const signed = await signEncounterClinicalNote(activeEncounter.id, accessToken);
      setCurrentNote(signed);
      setSuccessMsg("Clinical note electronically signed and locked.");
      const revs = await getEncounterNoteRevisions(activeEncounter.id, accessToken);
      setRevisions(revs);
      await loadSchedule();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to sign note.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleAmendNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEncounter) return;

    if (!amendmentReason.trim()) {
      setErrorMsg("Please provide a clinical rationale for amending this signed note.");
      return;
    }

    setIsActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const amended = await amendEncounterClinicalNote(
        activeEncounter.id,
        {
          amendmentReason,
          subjective,
          objective,
          assessment,
          plan,
        },
        accessToken
      );
      setCurrentNote(amended);
      setIsAmending(false);
      setAmendmentReason("");
      setSuccessMsg(`Revision ${amended.revisionNumber} saved and signed.`);
      const revs = await getEncounterNoteRevisions(activeEncounter.id, accessToken);
      setRevisions(revs);
      await loadSchedule();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create amendment.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const isAdminLevel = !!(user?.role && ["admin", "owner", "superadmin"].includes(user.role.toLowerCase()));
  const isUnlinkedDoctor = !user?.teamMemberId && !isAdminLevel;
  const arrivedPatients = schedule.filter((b) => b.status === "arrived");

  return (
    <div className="space-y-8">
      {/* Unlinked doctor account warning banner */}
      {isUnlinkedDoctor && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 flex items-center gap-3 shadow-xs"
        >
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Your account is not linked to a team member. Contact an administrator.</p>
            <p className="text-[11px] opacity-90 mt-0.5">
              Clinical schedules and dental charting require an active clinical staff identity profile.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow mb-1">Clinical Operations</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Welcome, {user?.fullName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Structured SOAP clinical encounters, dental charting, and signed patient records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3.5 py-1.5 rounded-full border border-line bg-cream text-xs font-mono text-ink shadow-subtle"
          />

          <Button variant="secondary" size="sm" onClick={loadSchedule}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Waiting for you panel (Task 0.6) */}
      <div className="p-5 rounded-2xl border border-line bg-cream shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-display font-semibold text-ink">
              Waiting for you
            </h2>
            <span
              className={`font-mono text-xs px-2.5 py-0.5 rounded-full font-bold ${
                arrivedPatients.length > 0
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300"
                  : "bg-line/50 text-ink-soft"
              }`}
            >
              {arrivedPatients.length}
            </span>
          </div>
          <span className="text-[11px] text-ink-soft font-mono">
            Auto-refreshes every 30s
          </span>
        </div>

        {arrivedPatients.length === 0 ? (
          <p className="text-xs text-ink-soft italic py-2">
            No patients currently waiting for you in the reception lobby.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {arrivedPatients.map((b) => {
              const mins = b.arrivedAt && currentTime > 0
                ? Math.max(0, Math.floor((currentTime - new Date(b.arrivedAt).getTime()) / 60000))
                : 0;
              const cat = getWaitingTimeCategory(mins);
              const badgeClasses =
                cat === "on_time"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200"
                  : cat === "extended"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200"
                  : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border-red-200 animate-pulse";
              const label =
                cat === "on_time"
                  ? `On time (${mins}m)`
                  : cat === "extended"
                  ? `Waiting ${mins}m (>5m)`
                  : `Waiting ${mins}m (>15m)`;

              return (
                <div
                  key={b.id}
                  className="p-4 rounded-xl border border-line bg-bone flex flex-col justify-between gap-3 shadow-xs"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-xs text-ink truncate">
                        {b.patientName}
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${badgeClasses}`}
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {label}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-soft mt-1">
                      {directory.serviceName(b.serviceId) || "Visit"} · Appt: {b.bookingTime}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={async () => {
                      try {
                        await startDoctorAppointment(b.id, accessToken);
                        await loadSchedule();
                      } catch (err) {
                        console.error(err);
                      }
                      await handleOpenSoapModal(b);
                    }}
                  >
                    <span>Attend Patient (Start Visit)</span>
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unsigned Notes Visibility Panel (Phase 1.2) */}
      <div className="rounded-2xl border border-line bg-card p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold font-display text-ink">
              Unsigned Notes ({unsignedNotes.length})
            </h2>
          </div>
          <span className="text-[11px] font-mono text-ink-soft">
            Draft clinical notes awaiting electronic signature
          </span>
        </div>

        {unsignedNotes.length === 0 ? (
          <div className="p-4 rounded-xl border border-line/60 bg-sand/30 text-center text-xs text-ink-soft font-mono">
            No unsigned draft notes. All clinical records are signed and locked.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unsignedNotes.map((note) => (
              <div
                key={note.encounterId}
                className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-xs text-ink truncate">
                      {note.patientName}
                    </p>
                    <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                      Draft
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-soft mt-1">
                    Encounter: {new Date(note.date).toLocaleDateString()}
                    {note.chiefComplaint ? ` · ${note.chiefComplaint}` : ""}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => handleOpenUnsignedNote(note)}
                >
                  <Edit className="h-3 w-3 mr-1.5" />
                  <span>Open &amp; Sign</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Card Table */}
      <Card surface="bone" shadow="card" className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-ink-soft">
            Loading practitioner schedule...
          </div>
        ) : schedule.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Stethoscope className="h-8 w-8 text-ink-soft/40 mx-auto" />
            <p className="text-base font-display text-ink">
              No appointments on your schedule for {date}
            </p>
            <p className="text-xs text-ink-soft">
              The front desk will assign appointments as patients check in.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sand/60 border-b border-line text-ink-soft uppercase font-mono text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-5 py-3.5">Patient</th>
                  <th className="px-5 py-3.5">Procedure</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Clinical Note</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {schedule.map((b) => (
                  <tr key={b.id} className="hover:bg-sand/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-semibold text-ink">
                      {b.bookingTime}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-ink">
                          {b.patientName || "Patient"}
                        </span>
                        {b.paymentStatus === "paid" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                            Paid
                          </span>
                        )}
                        {b.paymentStatus === "unpaid" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                            Unpaid
                          </span>
                        )}
                        {b.paymentStatus === "partial" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
                            Partial
                          </span>
                        )}
                        {b.hasAlerts && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800">
                            Alert
                          </span>
                        )}
                      </div>
                      {b.patientPhone && (
                        <span className="text-[11px] text-ink-soft font-mono block">{b.patientPhone}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-ink">
                      {directory.serviceName(b.serviceId) || "Clinical Examination"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`
                          px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold
                          ${
                            b.status === "in_progress"
                              ? "bg-secondary/15 text-secondary font-bold"
                              : b.status === "completed"
                              ? "bg-primary/10 text-primary font-bold"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }
                        `}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-soft max-w-xs">
                      {b.staffNotes ? (
                        <p className="truncate font-medium text-ink">{b.staffNotes}</p>
                      ) : (
                        <span className="text-ink-soft/50 italic">SOAP Encounter available</span>
                      )}
                      {b.notes && (
                        <p className="text-[10px] text-ink-soft/70 truncate mt-0.5" title={`Patient intake: ${b.notes}`}>
                          Intake: {b.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {b.status === "in_progress" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setFinishBooking(b);
                              setIsFinishModalOpen(true);
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1.5 text-emerald-600" />
                            <span>Finish Visit</span>
                          </Button>
                        )}
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenSoapModal(b)}
                        >
                          <FileText className="h-3 w-3 mr-1.5" />
                          <span>SOAP Encounter</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Clinical Encounter Workspace Modal (SOAP + Dental Odontogram) */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="w-full max-w-5xl rounded-2xl border border-line bg-bone p-6 shadow-modal space-y-5 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-line">
              <div>
                <div className="flex items-center gap-2">
                  <span className="eyebrow">Clinical Encounter</span>
                  {currentNote?.isSigned ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono text-[10px] font-semibold flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      Signed (Rev {currentNote.revisionNumber})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono text-[10px] font-semibold flex items-center gap-1">
                      <Edit className="h-3 w-3" />
                      Draft In Progress
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-display text-ink font-semibold mt-1">
                  {selectedBooking.patientName}
                </h2>
                <p className="text-xs text-ink-soft font-mono">
                  {selectedBooking.bookingDate} at {selectedBooking.bookingTime} &bull; Procedure: {directory.serviceName(selectedBooking.serviceId) || "Clinical Examination"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {activeTab === "soap" && revisions.length > 1 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowRevisions(!showRevisions)}
                  >
                    <History className="h-3.5 w-3.5 mr-1" />
                    <span>Revisions ({revisions.length})</span>
                  </Button>
                )}
                {selectedBooking.status === "in_progress" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setFinishBooking(selectedBooking);
                      setIsFinishModalOpen(true);
                    }}
                  >
                    <CheckCircle className="h-3 w-3 mr-1 text-emerald-600" />
                    <span>Finish Visit</span>
                  </Button>
                )}
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-1.5 rounded-full text-ink-soft hover:text-ink hover:bg-sand"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Clinical Alert & Allergy Safety Banner */}
            {selectedBooking.patientId && (
              <div className="pt-2">
                <ClinicalAlertBanner patientId={selectedBooking.patientId} />
              </div>
            )}

            {/* Workspace Navigation Tabs */}
            <div className="flex border-b border-line gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("soap")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "soap"
                    ? "border-primary text-primary font-bold bg-sand/30 rounded-t-lg"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>SOAP Clinical Notes</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("chart")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "chart"
                    ? "border-primary text-primary font-bold bg-sand/30 rounded-t-lg"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                <Activity className="h-4 w-4" />
                <span>Dental Odontogram & Treatment Plan</span>
              </button>
            </div>

            {/* Notifications */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Tab 1: SOAP Clinical Notes */}
            {activeTab === "soap" && (
              <div className="space-y-4">
                {/* Revision History Viewer */}
                {showRevisions && (
                  <div className="p-4 rounded-xl bg-sand/60 border border-line space-y-3">
                    <h3 className="font-mono text-xs font-semibold uppercase text-ink flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Encounter Note Audit History
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className={`p-3 rounded-lg border text-xs space-y-1 ${
                            rev.isCurrent
                              ? "bg-white border-primary/30 shadow-subtle"
                              : "bg-bone/80 border-line text-ink-soft"
                          }`}
                        >
                          <div className="flex items-center justify-between font-mono text-[10px]">
                            <span className="font-bold text-ink">
                              Revision {rev.revisionNumber} {rev.isCurrent && "(Current)"}
                            </span>
                            <span>{new Date(rev.createdAt).toLocaleString()}</span>
                          </div>
                          {rev.amendmentReason && (
                            <p className="text-amber-800 bg-amber-50 p-1.5 rounded font-mono text-[10px]">
                              <strong>Rationale:</strong> {rev.amendmentReason}
                            </p>
                          )}
                          <p className="line-clamp-2 text-ink">
                            <strong>A:</strong> {rev.assessment || "N/A"} &bull; <strong>P:</strong> {rev.plan || "N/A"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historical Staff Notes / Intake Context */}
                {(selectedBooking.notes || currentNote?.historicalStaffNotes) && (
                  <div className="p-3 rounded-xl bg-sand/40 border border-line text-xs space-y-1">
                    {selectedBooking.notes && (
                      <p className="text-ink-soft">
                        <strong className="font-mono text-[10px] text-ink uppercase">Patient Intake:</strong> {selectedBooking.notes}
                      </p>
                    )}
                    {currentNote?.historicalStaffNotes && (
                      <p className="text-ink-soft">
                        <strong className="font-mono text-[10px] text-ink uppercase">Legacy Chart Notes:</strong> {currentNote.historicalStaffNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Structured 4-Section SOAP Form */}
                <form onSubmit={isAmending ? handleAmendNote : handleSaveDraft} className="space-y-4 text-xs">
                  {isAmending && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                      <label className="font-semibold text-amber-900 flex items-center gap-1.5">
                        <Edit className="h-3.5 w-3.5" />
                        Clinical Amendment Rationale (Required) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Corrected diagnostic classification following second radiograph..."
                        value={amendmentReason}
                        onChange={(e) => setAmendmentReason(e.target.value)}
                        className="w-full p-2.5 rounded-lg border border-amber-300 bg-white text-ink text-xs focus:border-amber-600"
                      />
                    </div>
                  )}

                  {(!currentNote?.isSigned || isAmending) && templates.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-sand/30 rounded-xl border border-line">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs font-semibold text-ink">Template:</span>
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => setSelectedTemplateId(e.target.value)}
                          className="text-xs bg-surface border border-line rounded px-2.5 py-1 text-ink focus:outline-none"
                        >
                          <option value="">Select standard structure...</option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!selectedTemplateId}
                        onClick={handleApplyTemplate}
                        className="text-xs h-7 gap-1"
                      >
                        Apply Template
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Subjective */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-ink flex items-center justify-between">
                        <span>Subjective (Symptoms & History)</span>
                        <span className="font-mono text-[10px] text-ink-soft font-normal">Patient-reported</span>
                      </label>
                      <textarea
                        rows={4}
                        disabled={currentNote?.isSigned && !isAmending}
                        placeholder="Chief complaint, pain scale, medical history updates, onset, triggers..."
                        value={subjective}
                        onChange={(e) => setSubjective(e.target.value)}
                        className="w-full p-3 rounded-xl border border-line bg-cream text-ink font-sans leading-relaxed focus:border-primary disabled:opacity-80"
                      />
                    </div>

                    {/* Objective */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-ink flex items-center justify-between">
                        <span>Objective (Examination Findings)</span>
                        <span className="font-mono text-[10px] text-ink-soft font-normal">Clinical observation</span>
                      </label>
                      <textarea
                        rows={4}
                        disabled={currentNote?.isSigned && !isAmending}
                        placeholder="Visual exam, periodontal probing, vitality tests, radiographic findings..."
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        className="w-full p-3 rounded-xl border border-line bg-cream text-ink font-sans leading-relaxed focus:border-primary disabled:opacity-80"
                      />
                    </div>

                    {/* Assessment */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-ink flex items-center justify-between">
                        <span>Assessment (Diagnoses)</span>
                        <span className="font-mono text-[10px] text-ink-soft font-normal">Clinical diagnosis</span>
                      </label>
                      <textarea
                        rows={4}
                        disabled={currentNote?.isSigned && !isAmending}
                        placeholder="Diagnosis, disease stage, prognosis, tooth-specific conditions..."
                        value={assessment}
                        onChange={(e) => setAssessment(e.target.value)}
                        className="w-full p-3 rounded-xl border border-line bg-cream text-ink font-sans leading-relaxed focus:border-primary disabled:opacity-80"
                      />
                    </div>

                    {/* Plan */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-ink flex items-center justify-between">
                        <span>Plan (Treatment & Next Steps)</span>
                        <span className="font-mono text-[10px] text-ink-soft font-normal">Care plan</span>
                      </label>
                      <textarea
                        rows={4}
                        disabled={currentNote?.isSigned && !isAmending}
                        placeholder="Procedures completed today, prescriptions, recall schedule, post-op instructions..."
                        value={plan}
                        onChange={(e) => setPlan(e.target.value)}
                        className="w-full p-3 rounded-xl border border-line bg-cream text-ink font-sans leading-relaxed focus:border-primary disabled:opacity-80"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-line flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {currentNote?.isSigned && !isAmending && (
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => setIsAmending(true)}
                        >
                          <Edit className="h-3.5 w-3.5 mr-1.5" />
                          <span>Create Amendment</span>
                        </Button>
                      )}
                      {isAmending && (
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          onClick={() => setIsAmending(false)}
                        >
                          <span>Cancel Amendment</span>
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => setSelectedBooking(null)}
                      >
                        Close
                      </Button>

                      {(!currentNote?.isSigned || isAmending) && (
                        <>
                          {!isAmending && (
                            <Button
                              variant="secondary"
                              size="sm"
                              type="submit"
                              disabled={isActionLoading}
                            >
                              <Save className="h-3.5 w-3.5 mr-1.5" />
                              <span>{isActionLoading ? "Saving..." : "Save Draft"}</span>
                            </Button>
                          )}

                          {isAmending ? (
                            <Button
                              variant="primary"
                              size="sm"
                              type="submit"
                              disabled={isActionLoading}
                            >
                              <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                              <span>{isActionLoading ? "Saving..." : "Save & Sign Amendment"}</span>
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              type="button"
                              onClick={handleSignNote}
                              disabled={isActionLoading}
                            >
                              <Lock className="h-3.5 w-3.5 mr-1.5" />
                              <span>{isActionLoading ? "Signing..." : "Sign & Lock Note"}</span>
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Tab 2: Dental Odontogram & Charting */}
            {activeTab === "chart" && (
              <div className="pt-1">
                {activeEncounter ? (
                  <DentalChart
                    patientId={activeEncounter.patientId || selectedBooking.patientId || ""}
                    patientName={selectedBooking.patientName || "Patient"}
                    encounterId={activeEncounter.id}
                    token={accessToken}
                    onUpdate={loadSchedule}
                  />
                ) : (
                  <div className="p-8 text-center text-ink-soft font-mono text-xs">
                    Initializing encounter chart...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Finish Visit Modal with Optional Follow-up (Phase 1.2 & 1.3) */}
      {isFinishModalOpen && finishBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <h2 className="text-base font-display font-semibold text-ink">
                  Complete Visit: {finishBooking.patientName}
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsFinishModalOpen(false);
                  setFinishBooking(null);
                }}
                className="p-1.5 rounded-full text-ink-soft hover:text-ink cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-ink-soft">
              This will finalize the appointment and mark the visit as completed.
              Any unsigned clinical notes will remain in your <strong>Unsigned Notes</strong> queue for review and electronic signature.
            </p>

            <form onSubmit={handleFinishVisit} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl border border-line bg-sand/30 space-y-3">
                <h3 className="font-semibold text-xs text-ink flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>Optional Reception Follow-Up Request</span>
                </h3>
                <p className="text-[11px] text-ink-soft">
                  Create a task for the front desk to book this patient&apos;s next appointment.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-ink">Follow-Up Timing</label>
                    <select
                      value={followUpWeeks}
                      onChange={(e) => setFollowUpWeeks(e.target.value ? Number(e.target.value) : "")}
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-ink"
                    >
                      <option value="">No follow-up needed</option>
                      <option value="1">1 week</option>
                      <option value="2">2 weeks</option>
                      <option value="3">3 weeks</option>
                      <option value="4">4 weeks (1 month)</option>
                      <option value="6">6 weeks</option>
                      <option value="8">8 weeks (2 months)</option>
                      <option value="12">12 weeks (3 months)</option>
                      <option value="26">6 months (recall)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-ink">Instructions / Procedure</label>
                    <input
                      type="text"
                      placeholder="e.g. Crown cementation, suture removal"
                      value={followUpNote}
                      onChange={(e) => setFollowUpNote(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-line bg-card text-xs text-ink"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsFinishModalOpen(false);
                    setFinishBooking(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isFinishing}
                >
                  {isFinishing ? "Completing..." : "Confirm & Finish Visit"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
