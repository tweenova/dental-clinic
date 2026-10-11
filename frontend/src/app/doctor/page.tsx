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
  PlusCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  Stethoscope,
  User,
  X,
} from "lucide-react";

import {
  amendEncounterClinicalNote,
  ClinicalEncounter,
  ClinicalSOAPNote,
  createClinicalEncounter,
  getActiveEncounterByBooking,
  getDoctorSchedule,
  getEncounterClinicalNote,
  getEncounterNoteRevisions,
  ReceptionBooking,
  saveDraftEncounterNote,
  signEncounterClinicalNote,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DentalChart } from "@/components/doctor/dental-chart";

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
  };

  useEffect(() => {
    loadSchedule();
  }, [date, accessToken]);

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

  return (
    <div className="space-y-8">
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
                      <span className="font-semibold text-ink block">
                        {b.patientName || "Patient"}
                      </span>
                      {b.patientPhone && (
                        <span className="text-[11px] text-ink-soft font-mono">{b.patientPhone}</span>
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
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenSoapModal(b)}
                      >
                        <FileText className="h-3 w-3 mr-1.5" />
                        <span>SOAP Encounter</span>
                      </Button>
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
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="p-1.5 rounded-full text-ink-soft hover:text-ink hover:bg-sand"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

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
    </div>
  );
}
