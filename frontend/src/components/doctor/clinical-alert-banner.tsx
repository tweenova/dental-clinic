"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  ShieldAlert,
  X,
} from "lucide-react";

import {
  confirmDoctorAlert,
  dismissDoctorAlert,
  getPatientAlertsSummary,
  MedicalAlertItem,
  MedicalAlertsSummary,
  recordDoctorAlert,
  reviewPatientAlertsAtVisit,
  updateMedicalHistoryStatus,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

interface ClinicalAlertBannerProps {
  patientId: string;
  onAlertsChange?: () => void;
}

export function ClinicalAlertBanner({
  patientId,
  onAlertsChange,
}: ClinicalAlertBannerProps) {
  const { accessToken } = useAuth();
  const [summary, setSummary] = useState<MedicalAlertsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newType, setNewType] = useState<"allergy" | "condition" | "medication" | "other">("allergy");
  const [newDescription, setNewDescription] = useState("");
  const [newSeverity, setNewSeverity] = useState<"mild" | "moderate" | "severe" | "life_threatening">("moderate");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAlerts = async () => {
    if (!patientId) return;
    try {
      const data = await getPatientAlertsSummary(patientId, accessToken);
      setSummary(data);
    } catch (err) {
      console.error("Failed to load medical alerts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadAlerts();
    });
  }, [patientId, accessToken]);

  const handleReviewAtVisit = async () => {
    try {
      await reviewPatientAlertsAtVisit(patientId, accessToken);
      await loadAlerts();
      onAlertsChange?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to record clinical review.");
    }
  };

  const handleConfirmPending = async (alertId: string) => {
    try {
      await confirmDoctorAlert(alertId, accessToken);
      await loadAlerts();
      onAlertsChange?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to confirm alert.");
    }
  };

  const handleDismissPending = async (alertId: string) => {
    try {
      await dismissDoctorAlert(alertId, accessToken);
      await loadAlerts();
      onAlertsChange?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to dismiss alert.");
    }
  };

  const handleSetNoneKnown = async () => {
    try {
      await updateMedicalHistoryStatus(patientId, "none_known", accessToken);
      await loadAlerts();
      onAlertsChange?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update medical history status.");
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescription.trim()) return;

    setIsSubmitting(true);
    try {
      await recordDoctorAlert(
        patientId,
        {
          type: newType,
          description: newDescription.trim(),
          severity: newSeverity,
        },
        accessToken
      );
      setIsAddModalOpen(false);
      setNewDescription("");
      await loadAlerts();
      onAlertsChange?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to record medical alert.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !summary) {
    return null;
  }

  const hasConfirmedAlerts = summary.confirmedAlerts.length > 0;
  const hasPendingAlerts = summary.pendingAlerts.length > 0;
  const isNotAsked = summary.medicalHistoryStatus === "not_asked";
  const isNoneKnown = summary.medicalHistoryStatus === "none_known" && !hasConfirmedAlerts;

  return (
    <div className="space-y-3" data-testid="clinical-alert-banner">
      {/* 1. Primary Clinical Alert Banner (Confirmed Alerts or Not Asked prompt) */}
      {hasConfirmedAlerts ? (
        <div className="rounded-2xl border-2 border-red-300 dark:border-red-900/80 bg-red-50/90 dark:bg-red-950/40 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-red-600 text-white shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider font-bold text-red-900 dark:text-red-200">
                    Medical & Allergy Alerts
                  </span>
                  {summary.lastReviewedAt ? (
                    <span className="text-[11px] font-mono text-red-700/80 dark:text-red-300/80">
                      (Reviewed {new Date(summary.lastReviewedAt).toLocaleDateString()})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                      Needs Visit Review
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {summary.confirmedAlerts.map((alert) => (
                    <span
                      key={alert.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white dark:bg-red-900/60 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100 shadow-xs"
                    >
                      <span className="uppercase text-[10px] font-mono tracking-wide opacity-75">
                        {alert.type}:
                      </span>
                      <span>{alert.description}</span>
                      {alert.severity && (
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded-md bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200">
                          {alert.severity.replace("_", " ")}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <button
                onClick={handleReviewAtVisit}
                className="px-3.5 py-1.5 rounded-full bg-red-700 hover:bg-red-800 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Review at this visit
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-3 py-1.5 rounded-full border border-red-300 dark:border-red-800 bg-white dark:bg-red-900/40 text-red-900 dark:text-red-200 hover:bg-red-100/50 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Alert</span>
              </button>
            </div>
          </div>
        </div>
      ) : isNotAsked ? (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Medical history not yet taken
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Please verify patient allergies, medical conditions, and medications before performing procedures.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={handleSetNoneKnown}
                className="px-3 py-1.5 rounded-full border border-amber-300 dark:border-amber-700 bg-white dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-100 text-xs font-medium transition-colors cursor-pointer"
              >
                Mark No Known Allergies
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-3 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Alert</span>
              </button>
            </div>
          </div>
        </div>
      ) : isNoneKnown ? (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                No known allergies or medical conditions recorded.
              </span>
              {summary.lastReviewedAt && (
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
                  (Reviewed {new Date(summary.lastReviewedAt).toLocaleDateString()})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={handleReviewAtVisit}
                className="px-3 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors cursor-pointer"
              >
                Review at this visit
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-2.5 py-1 rounded-full border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 text-xs font-medium transition-colors cursor-pointer"
              >
                + Add Alert
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. Reception Reported Pending Alerts Notice */}
      {hasPendingAlerts && (
        <div className="rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50/80 dark:bg-purple-950/30 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-900 dark:text-purple-200">
            <ShieldAlert className="h-4 w-4 text-purple-600" />
            <span>Front Desk Capture: Unconfirmed Pending Alerts</span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
              Requires Clinician Confirmation
            </span>
          </div>

          <div className="space-y-2">
            {summary.pendingAlerts.map((pending) => (
              <div
                key={pending.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 text-xs"
              >
                <div>
                  <span className="font-semibold text-purple-950 dark:text-purple-100">
                    Reception reported {pending.type}:
                  </span>{" "}
                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                    {pending.description}
                  </span>
                  <span className="text-gray-500 text-[11px] block mt-0.5">
                    Not shown on clinical banner until confirmed by clinician.
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleConfirmPending(pending.id)}
                    className="px-3 py-1 rounded-full bg-purple-700 hover:bg-purple-800 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    Confirm Alert
                  </button>
                  <button
                    onClick={() => handleDismissPending(pending.id)}
                    className="px-3 py-1 rounded-full border border-purple-200 dark:border-purple-700 text-purple-900 dark:text-purple-200 hover:bg-purple-100 text-xs font-medium transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Doctor Add Clinical Alert Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-red-600 font-semibold">
                  Patient Safety
                </p>
                <h2 className="text-base font-display text-gray-900 dark:text-white font-semibold">
                  Record Confirmed Medical Alert
                </h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Alert Category *
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                >
                  <option value="allergy">Allergy (Medication, Latex, etc.)</option>
                  <option value="condition">Medical Condition (Cardiovascular, Diabetes, etc.)</option>
                  <option value="medication">Active Medication (Anticoagulants, Bisphosphonates, etc.)</option>
                  <option value="other">Other Clinical Risk</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Description / Allergen *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Penicillin, Latex, Warfarin 5mg daily"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:border-primary focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Severity Level
                </label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                >
                  <option value="mild">Mild (Localized rash, mild intolerance)</option>
                  <option value="moderate">Moderate (Hives, significant adverse reaction)</option>
                  <option value="severe">Severe (Severe systemic reaction)</option>
                  <option value="life_threatening">Life-Threatening (Anaphylaxis, Angioedema)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newDescription.trim()}
                  className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Recording..." : "Record Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
