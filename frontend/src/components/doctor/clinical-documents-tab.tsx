"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileCheck,
  FileText,
  Lock,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";

import {
  PrescriptionItem,
  PrescriptionPrintView,
  ReferralLetterItem,
  ReferralLetterPrintView,
  createPrescription,
  createReferralLetter,
  getEncounterPrescriptions,
  getEncounterReferrals,
  getPrescriptionPrintView,
  getReferralLetterPrintView,
  signPrescription,
  signReferralLetter,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ClinicalDocumentsTabProps {
  encounterId: string;
  patientId: string;
  patientName: string;
}

export function ClinicalDocumentsTab({
  encounterId,
  patientId,
  patientName,
}: ClinicalDocumentsTabProps) {
  const { accessToken } = useAuth();

  const [activeTab, setActiveTab] = useState<"prescriptions" | "referrals">("prescriptions");
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralLetterItem[]>([]);
  const [isFeatureDisabled, setIsFeatureDisabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // New Prescription Modal
  const [isNewRxOpen, setIsNewRxOpen] = useState(false);
  const [rxItems, setRxItems] = useState<
    Array<{ drug: string; dose: string; frequency: string; duration: string; instructions: string }>
  >([{ drug: "", dose: "", frequency: "Once daily", duration: "5 days", instructions: "" }]);
  const [rxNotes, setRxNotes] = useState("");
  const [isSavingRx, setIsSavingRx] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);

  // New Referral Modal
  const [isNewRefOpen, setIsNewRefOpen] = useState(false);
  const [refRecipient, setRefRecipient] = useState("");
  const [refReason, setRefReason] = useState("");
  const [refSummary, setRefSummary] = useState("");
  const [isSavingRef, setIsSavingRef] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);

  // Print Views Modal
  const [printRxData, setPrintRxData] = useState<PrescriptionPrintView | null>(null);
  const [printRefData, setPrintRefData] = useState<ReferralLetterPrintView | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getEncounterPrescriptions(encounterId, accessToken).catch((err: unknown) => {
        if (err instanceof Error && err.message.toLowerCase().includes("disabled")) {
          if (isMounted) setIsFeatureDisabled(true);
        }
        return [];
      }),
      getEncounterReferrals(encounterId, accessToken).catch((err: unknown) => {
        if (err instanceof Error && err.message.toLowerCase().includes("disabled")) {
          if (isMounted) setIsFeatureDisabled(true);
        }
        return [];
      }),
    ])
      .then(([rxRes, refRes]) => {
        if (isMounted) {
          setPrescriptions(rxRes || []);
          setReferrals(refRes || []);
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message.toLowerCase().includes("disabled")) {
          if (isMounted) setIsFeatureDisabled(true);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [encounterId, accessToken]);

  const handleAddRxItem = () => {
    setRxItems((prev) => [
      ...prev,
      { drug: "", dose: "", frequency: "Once daily", duration: "5 days", instructions: "" },
    ]);
  };

  const handleRemoveRxItem = (idx: number) => {
    setRxItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateRxItem = (idx: number, field: string, val: string) => {
    setRxItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: val } : it))
    );
  };

  const handleSaveRx = async (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = rxItems.filter((i) => i.drug.trim());
    if (validItems.length === 0) {
      setRxError("At least one medication is required.");
      return;
    }

    setIsSavingRx(true);
    setRxError(null);
    try {
      const created = await createPrescription(
        {
          encounterId,
          patientId,
          items: validItems,
          notes: rxNotes.trim() || undefined,
        },
        accessToken
      );
      setPrescriptions((prev) => [created, ...prev]);
      setIsNewRxOpen(false);
      setRxItems([{ drug: "", dose: "", frequency: "Once daily", duration: "5 days", instructions: "" }]);
      setRxNotes("");
      setActionMessage("Prescription drafted.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      setRxError(err instanceof Error ? err.message : "Failed to create prescription.");
    } finally {
      setIsSavingRx(false);
    }
  };

  const handleSignRx = async (rxId: string) => {
    if (!confirm("Sign and lock this prescription electronically? Signed prescriptions are immutable.")) {
      return;
    }
    try {
      const signed = await signPrescription(rxId, accessToken);
      setPrescriptions((prev) =>
        prev.map((p) => (p.id === rxId ? { ...p, status: "signed", signedAt: signed.signedAt } : p))
      );
      setActionMessage("Prescription electronically signed and locked.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to sign prescription.");
    }
  };

  const handleOpenRxPrint = async (rxId: string) => {
    try {
      const pv = await getPrescriptionPrintView(rxId, accessToken);
      setPrintRxData(pv);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to load prescription print preview.");
    }
  };

  const handleSaveRef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refRecipient.trim() || !refReason.trim()) {
      setRefError("Recipient name and reason for referral are required.");
      return;
    }

    setIsSavingRef(true);
    setRefError(null);
    try {
      const created = await createReferralLetter(
        {
          encounterId,
          patientId,
          recipient: refRecipient.trim(),
          reason: refReason.trim(),
          summary: refSummary.trim() || undefined,
        },
        accessToken
      );
      setReferrals((prev) => [created, ...prev]);
      setIsNewRefOpen(false);
      setRefRecipient("");
      setRefReason("");
      setRefSummary("");
      setActionMessage("Referral letter drafted.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      setRefError(err instanceof Error ? err.message : "Failed to create referral letter.");
    } finally {
      setIsSavingRef(false);
    }
  };

  const handleSignRef = async (refId: string) => {
    if (!confirm("Sign and lock this referral letter? Signed letters are immutable.")) {
      return;
    }
    try {
      const signed = await signReferralLetter(refId, accessToken);
      setReferrals((prev) =>
        prev.map((r) => (r.id === refId ? { ...r, status: "signed", signedAt: signed.signedAt } : r))
      );
      setActionMessage("Referral letter electronically signed and locked.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to sign referral letter.");
    }
  };

  const handleOpenRefPrint = async (refId: string) => {
    try {
      const pv = await getReferralLetterPrintView(refId, accessToken);
      setPrintRefData(pv);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to load referral print preview.");
    }
  };

  if (isFeatureDisabled) {
    return (
      <Card className="p-8 text-center space-y-3 bg-muted/40 border-dashed">
        <Lock className="h-10 w-10 text-ink-soft mx-auto opacity-70" />
        <h3 className="text-sm font-semibold text-ink">
          Clinical Documents Module Switched Off
        </h3>
        <p className="text-xs text-ink-soft max-w-md mx-auto">
          Prescriptions and external referral letter authoring are controlled by system feature flag{" "}
          <code className="text-[11px] font-mono px-1 py-0.5 bg-muted rounded border border-line">
            clinical_documents_enabled
          </code>{" "}
          (currently disabled).
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-display font-medium text-ink">
            Clinical Documents (Prescriptions & Referrals)
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Patient: {patientName} &bull; Electronic prescriptions, specialist referral letters, and compliant print layouts with legal disclaimers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "prescriptions" ? (
            <Button
              size="sm"
              onClick={() => {
                setRxError(null);
                setIsNewRxOpen(true);
              }}
              className="gap-1.5 bg-primary text-white hover:bg-primary-dark text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Prescription
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setRefError(null);
                setIsNewRefOpen(true);
              }}
              className="gap-1.5 bg-primary text-white hover:bg-primary-dark text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Referral Letter
            </Button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab("prescriptions")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "prescriptions"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-muted"
          }`}
        >
          Prescriptions ({prescriptions.length})
        </button>
        <button
          onClick={() => setActiveTab("referrals")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === "referrals"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-muted"
          }`}
        >
          Referral Letters ({referrals.length})
        </button>
      </div>

      {/* TAB 1: PRESCRIPTIONS */}
      {activeTab === "prescriptions" && (
        <>
          {isLoading ? (
            <div className="p-12 text-center text-xs text-ink-soft">Loading prescriptions...</div>
          ) : prescriptions.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-10 w-10 text-ink-soft mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-ink">No prescriptions authored for this encounter</p>
              <p className="text-xs text-ink-soft mt-1">
                Draft medications, sign with digital credentials, and print clinic-headed slips.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {prescriptions.map((rx) => (
                <Card key={rx.id} className="p-4 border space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                            rx.status === "signed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {rx.status === "signed" ? "Signed & Locked" : "Draft"}
                        </span>
                        <span className="text-xs text-ink-soft">
                          Authored: {new Date(rx.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Items Table */}
                      <div className="overflow-x-auto pt-1">
                        <table className="w-full text-xs text-left">
                          <thead className="border-b border-line text-[10px] text-ink-soft uppercase font-mono">
                            <tr>
                              <th className="py-1">Medication</th>
                              <th className="py-1">Dose</th>
                              <th className="py-1">Frequency</th>
                              <th className="py-1">Duration</th>
                              <th className="py-1">Instructions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line/60">
                            {rx.items.map((it, idx) => (
                              <tr key={idx} className="py-1">
                                <td className="py-1 font-semibold text-ink">{it.drug}</td>
                                <td className="py-1 text-ink-soft">{it.dose}</td>
                                <td className="py-1 text-ink-soft">{it.frequency}</td>
                                <td className="py-1 text-ink-soft">{it.duration}</td>
                                <td className="py-1 text-ink-soft">{it.instructions || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {rx.notes && (
                        <p className="text-xs text-ink-soft italic pt-1">Notes: {rx.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {rx.status !== "signed" ? (
                        <Button
                          size="sm"
                          onClick={() => handleSignRx(rx.id)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Sign & Lock
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRxPrint(rx.id)}
                          className="h-7 text-xs gap-1"
                        >
                          <Printer className="h-3 w-3" />
                          Print Slip
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: REFERRAL LETTERS */}
      {activeTab === "referrals" && (
        <>
          {isLoading ? (
            <div className="p-12 text-center text-xs text-ink-soft">Loading referrals...</div>
          ) : referrals.length === 0 ? (
            <Card className="p-12 text-center">
              <FileCheck className="h-10 w-10 text-ink-soft mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-ink">No referral letters authored</p>
              <p className="text-xs text-ink-soft mt-1">
                Draft specialist referral letters for maxillofacial, orthodontics, or endodontics.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {referrals.map((ref) => (
                <Card key={ref.id} className="p-4 border space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                            ref.status === "signed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                          }`}
                        >
                          {ref.status === "signed" ? "Signed & Locked" : "Draft"}
                        </span>
                        <span className="text-xs font-semibold text-ink">
                          To: {ref.recipient}
                        </span>
                      </div>

                      <p className="text-xs text-ink font-medium">
                        Reason: {ref.reason}
                      </p>

                      {ref.summary && (
                        <p className="text-xs text-ink-soft whitespace-pre-wrap bg-muted/30 p-2 rounded">
                          {ref.summary}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {ref.status !== "signed" ? (
                        <Button
                          size="sm"
                          onClick={() => handleSignRef(ref.id)}
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Sign Letter
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRefPrint(ref.id)}
                          className="h-7 text-xs gap-1"
                        >
                          <Printer className="h-3 w-3" />
                          Print Letter
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* New Prescription Modal */}
      {isNewRxOpen && (
        <div role="dialog" aria-modal="true" aria-label="Draft Electronic Prescription" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl border border-line p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base font-display font-medium text-ink">
                Draft Electronic Prescription
              </h2>
              <button
                onClick={() => setIsNewRxOpen(false)}
                className="text-ink-soft hover:text-ink transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {rxError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md text-xs">
                {rxError}
              </div>
            )}

            <form onSubmit={handleSaveRx} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-ink">Medications</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleAddRxItem}
                    className="text-xs text-primary gap-1 h-7"
                  >
                    <Plus className="h-3 w-3" /> Add Drug
                  </Button>
                </div>

                {rxItems.map((item, idx) => (
                  <div key={idx} className="p-3 bg-muted/40 rounded-lg border border-line space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-ink mb-0.5">Drug Name</label>
                        <input
                          type="text"
                          required
                          value={item.drug}
                          onChange={(e) => handleUpdateRxItem(idx, "drug", e.target.value)}
                          placeholder="e.g. Amoxicillin, Ibuprofen"
                          className="w-full text-xs px-2.5 py-1.5 bg-surface rounded border border-line text-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink mb-0.5">Dose</label>
                        <input
                          type="text"
                          value={item.dose}
                          onChange={(e) => handleUpdateRxItem(idx, "dose", e.target.value)}
                          placeholder="e.g. 500mg, 400mg"
                          className="w-full text-xs px-2.5 py-1.5 bg-surface rounded border border-line text-ink"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-ink mb-0.5">Frequency</label>
                        <input
                          type="text"
                          value={item.frequency}
                          onChange={(e) => handleUpdateRxItem(idx, "frequency", e.target.value)}
                          placeholder="e.g. TDS, BD, PRN"
                          className="w-full text-xs px-2.5 py-1.5 bg-surface rounded border border-line text-ink"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="block text-[11px] font-medium text-ink mb-0.5">Duration</label>
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) => handleUpdateRxItem(idx, "duration", e.target.value)}
                          placeholder="e.g. 5 days, 1 week"
                          className="w-full text-xs px-2.5 py-1.5 bg-surface rounded border border-line text-ink"
                        />
                      </div>
                      <div className="col-span-2 flex items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-[11px] font-medium text-ink mb-0.5">Instructions</label>
                          <input
                            type="text"
                            value={item.instructions}
                            onChange={(e) => handleUpdateRxItem(idx, "instructions", e.target.value)}
                            placeholder="e.g. Take after food"
                            className="w-full text-xs px-2.5 py-1.5 bg-surface rounded border border-line text-ink"
                          />
                        </div>
                        {rxItems.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRxItem(idx)}
                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Pharmacy / Patient Notes
                </label>
                <textarea
                  rows={2}
                  value={rxNotes}
                  onChange={(e) => setRxNotes(e.target.value)}
                  placeholder="Optional administration advice or precautions..."
                  className="w-full text-xs p-2.5 bg-surface rounded-md border border-line text-ink resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewRxOpen(false)}
                  disabled={isSavingRx}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingRx}
                  className="bg-primary text-white hover:bg-primary-dark"
                >
                  {isSavingRx ? "Saving..." : "Save Draft Prescription"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Referral Modal */}
      {isNewRefOpen && (
        <div role="dialog" aria-modal="true" aria-label="Draft Specialist Referral Letter" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg border border-line p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base font-display font-medium text-ink">
                Draft Specialist Referral Letter
              </h2>
              <button
                onClick={() => setIsNewRefOpen(false)}
                className="text-ink-soft hover:text-ink transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {refError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md text-xs">
                {refError}
              </div>
            )}

            <form onSubmit={handleSaveRef} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Recipient Doctor / Specialist <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={refRecipient}
                  onChange={(e) => setRefRecipient(e.target.value)}
                  placeholder="e.g. Specialist Clinician, Oral & Maxillofacial Surgery"
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Reason for Referral <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={refReason}
                  onChange={(e) => setRefReason(e.target.value)}
                  placeholder="e.g. Evaluation of impacted mandibular third molar close to ID canal"
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Clinical Summary & Background
                </label>
                <textarea
                  rows={4}
                  value={refSummary}
                  onChange={(e) => setRefSummary(e.target.value)}
                  placeholder="Summary of patient presentation, symptoms, radiographic observations, and initial management..."
                  className="w-full text-xs p-2.5 bg-surface rounded-md border border-line text-ink resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsNewRefOpen(false)}
                  disabled={isSavingRef}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingRef}
                  className="bg-primary text-white hover:bg-primary-dark"
                >
                  {isSavingRef ? "Saving..." : "Save Draft Referral"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Prescription Printable View Modal */}
      {printRxData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white text-black rounded-xl shadow-2xl w-full max-w-2xl border border-gray-300 p-8 space-y-6 my-8 print:p-0 print:border-none">
            {/* Header with clinic details */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h1 className="text-xl font-bold font-serif text-gray-900">
                  {printRxData.clinicHeader}
                </h1>
                <p className="text-xs text-gray-600">Official Clinical Prescription</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-semibold text-gray-800">{printRxData.doctorName}</p>
                <p className="font-mono text-gray-500">Licence #: {printRxData.licenceNumber}</p>
              </div>
            </div>

            {/* DEMO watermark banner (this is a demonstration project) */}
            <div className="border border-red-300 bg-red-50 text-red-700 text-center text-xs font-bold tracking-widest uppercase py-2 rounded">
              {printRxData.watermark}
            </div>

            {/* Patient Details */}
            <div className="bg-gray-50 p-3 rounded border text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Patient: </span>
                <span className="font-bold">{printRxData.patientName}</span>
              </div>
              <div>
                <span className="text-gray-500">Contact: </span>
                <span className="font-mono">{printRxData.patientPhone || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-500">Date: </span>
                <span>{printRxData.signedAt ? new Date(printRxData.signedAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Status: </span>
                <span className="font-semibold uppercase text-emerald-800">{printRxData.status}</span>
              </div>
            </div>

            {/* Prescribed Items */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">Rx Details</h3>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-1">Medication</th>
                    <th className="py-1">Dosage</th>
                    <th className="py-1">Frequency</th>
                    <th className="py-1">Duration</th>
                    <th className="py-1">Directions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {printRxData.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 font-bold">{it.drug}</td>
                      <td className="py-1.5">{it.dose}</td>
                      <td className="py-1.5">{it.frequency}</td>
                      <td className="py-1.5">{it.duration}</td>
                      <td className="py-1.5">{it.instructions || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {printRxData.notes && (
              <p className="text-xs text-gray-600 italic">Notes: {printRxData.notes}</p>
            )}

            {/* Legal Disclaimer Banner */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900">
              <p className="font-semibold mb-0.5">Legal Disclaimer & Document Integrity Notice:</p>
              <p>{printRxData.legalDisclaimer}</p>
            </div>

            {/* Signature Block */}
            <div className="pt-8 border-t flex items-end justify-between text-xs">
              <div>
                <p className="font-mono text-[10px] text-gray-400">
                  Digitally Authenticated: {printRxData.signedAt ? new Date(printRxData.signedAt).toLocaleString() : "Pending"}
                </p>
              </div>
              <div className="text-right">
                <div className="w-48 border-b border-gray-400 mb-1" />
                <p className="font-semibold">{printRxData.doctorName}</p>
                <p className="text-gray-500 text-[10px]">Authorized Signature</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t print:hidden">
              <Button variant="outline" size="sm" onClick={() => setPrintRxData(null)}>
                Close Preview
              </Button>
              <Button size="sm" onClick={() => window.print()} className="gap-1 bg-primary text-white">
                <Printer className="h-4 w-4" />
                Print Slip
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Referral Letter Printable View Modal */}
      {printRefData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white text-black rounded-xl shadow-2xl w-full max-w-2xl border border-gray-300 p-8 space-y-6 my-8 print:p-0 print:border-none">
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <h1 className="text-xl font-bold font-serif text-gray-900">
                  {printRefData.clinicHeader}
                </h1>
                <p className="text-xs text-gray-600">Specialist Clinical Referral Letter</p>
              </div>
              <div className="text-right text-xs">
                <p className="font-semibold text-gray-800">{printRefData.doctorName}</p>
                <p className="font-mono text-gray-500">Licence #: {printRefData.licenceNumber}</p>
              </div>
            </div>

            {/* DEMO watermark banner (this is a demonstration project) */}
            <div className="border border-red-300 bg-red-50 text-red-700 text-center text-xs font-bold tracking-widest uppercase py-2 rounded">
              {printRefData.watermark}
            </div>

            {/* Recipient Details */}
            <div className="text-xs space-y-1">
              <p className="text-gray-500">To:</p>
              <p className="font-bold text-sm text-gray-900">{printRefData.recipient}</p>
            </div>

            {/* Patient Context */}
            <div className="bg-gray-50 p-3 rounded border text-xs grid grid-cols-2 gap-2">
              <div>
                <span className="text-gray-500">Patient: </span>
                <span className="font-bold">{printRefData.patientName}</span>
              </div>
              <div>
                <span className="text-gray-500">Contact: </span>
                <span>{printRefData.patientPhone || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-500">Date: </span>
                <span>{printRefData.signedAt ? new Date(printRefData.signedAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
              </div>
            </div>

            {/* Referral Body */}
            <div className="space-y-3 text-xs leading-relaxed">
              <div>
                <span className="font-bold text-gray-800">Reason for Referral:</span>
                <p className="mt-0.5 text-gray-900 font-medium">{printRefData.reason}</p>
              </div>

              {printRefData.summary && (
                <div>
                  <span className="font-bold text-gray-800">Clinical Background & Findings:</span>
                  <p className="mt-1 text-gray-700 whitespace-pre-wrap">{printRefData.summary}</p>
                </div>
              )}
            </div>

            {/* Legal Disclaimer */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900">
              <p className="font-semibold mb-0.5">Legal Disclaimer & Document Integrity Notice:</p>
              <p>{printRefData.legalDisclaimer}</p>
            </div>

            {/* Signature Block */}
            <div className="pt-8 border-t flex items-end justify-between text-xs">
              <div>
                <p className="font-mono text-[10px] text-gray-400">
                  Digitally Authenticated: {printRefData.signedAt ? new Date(printRefData.signedAt).toLocaleString() : "Pending"}
                </p>
              </div>
              <div className="text-right">
                <div className="w-48 border-b border-gray-400 mb-1" />
                <p className="font-semibold">{printRefData.doctorName}</p>
                <p className="text-gray-500 text-[10px]">Authorized Signature</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t print:hidden">
              <Button variant="outline" size="sm" onClick={() => setPrintRefData(null)}>
                Close Preview
              </Button>
              <Button size="sm" onClick={() => window.print()} className="gap-1 bg-primary text-white">
                <Printer className="h-4 w-4" />
                Print Letter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
