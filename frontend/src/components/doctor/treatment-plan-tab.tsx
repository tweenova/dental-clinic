"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Layers,
  Plus,
  Printer,
  X,
} from "lucide-react";

import {
  TreatmentPlanItem,
  TreatmentPlanResponse,
  addTreatmentPlanItem,
  getPatientTreatmentPlan,
  updateTreatmentPlanItemStatus,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface TreatmentPlanTabProps {
  patientId: string;
  patientName: string;
  patientFileNumber?: string;
  onRefreshParent?: () => void;
}

export default function TreatmentPlanTab({
  patientId,
  patientName,
  patientFileNumber,
}: TreatmentPlanTabProps) {
  const { accessToken } = useAuth();
  const directory = useDirectory();

  const [plan, setPlan] = useState<TreatmentPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Add Item Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [procedureName, setProcedureName] = useState("");
  const [toothNumber, setToothNumber] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [estimatedCostRupees, setEstimatedCostRupees] = useState<string>("");
  const [itemNotes, setItemNotes] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Status Change Modal (especially for complete or decision date)
  const [statusTargetItem, setStatusTargetItem] = useState<TreatmentPlanItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<"proposed" | "accepted" | "declined" | "completed">("accepted");
  const [decisionDate, setDecisionDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [procedureIdInput, setProcedureIdInput] = useState<string>("");
  const [statusNotes, setStatusNotes] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Print Mode State
  const [isPrintView, setIsPrintView] = useState(false);

  const loadPlan = async () => {
    try {
      const data = await getPatientTreatmentPlan(patientId, accessToken);
      setPlan(data);
    } catch (err) {
      console.error("Failed to load treatment plan:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    getPatientTreatmentPlan(patientId, accessToken)
      .then((data) => {
        if (isMounted) setPlan(data);
      })
      .catch((err) => {
        console.error("Failed to load treatment plan:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [patientId, accessToken]);

  const handleServiceSelect = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    if (!serviceId) return;
    const svc = directory.services.find((s) => s.id === serviceId);
    if (svc) {
      if (!procedureName) setProcedureName(svc.title);
      if (svc.cashPrice) {
        const cleanPrice = svc.cashPrice.replace(/[^0-9.]/g, "");
        if (cleanPrice) {
          setEstimatedCostRupees(cleanPrice);
        }
      }
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedureName.trim()) {
      setAddError("Procedure name is required.");
      return;
    }

    setIsAdding(true);
    setAddError(null);
    try {
      const parsedCost = estimatedCostRupees
        ? Math.round(parseFloat(estimatedCostRupees) * 100)
        : null;

      await addTreatmentPlanItem(
        {
          patientId,
          procedureName: procedureName.trim(),
          toothNumber: toothNumber ? parseInt(toothNumber, 10) : null,
          serviceId: selectedServiceId || null,
          estimatedCostCents: parsedCost,
          notes: itemNotes.trim() || null,
        },
        accessToken
      );

      await loadPlan();
      setIsAddOpen(false);
      setProcedureName("");
      setToothNumber("");
      setSelectedServiceId("");
      setEstimatedCostRupees("");
      setItemNotes("");
      setActionMessage("Proposed procedure added to treatment plan.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to add treatment plan item.");
    } finally {
      setIsAdding(false);
    }
  };

  const openStatusModal = (
    item: TreatmentPlanItem,
    newStatus: "proposed" | "accepted" | "declined" | "completed"
  ) => {
    setStatusTargetItem(item);
    setTargetStatus(newStatus);
    setDecisionDate(new Date().toISOString().split("T")[0]);
    setProcedureIdInput(item.completedProcedureId || "");
    setStatusNotes(item.notes || "");
    setStatusError(null);
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusTargetItem) return;

    if (targetStatus === "completed" && !procedureIdInput.trim()) {
      setStatusError(
        "Completing a treatment plan item requires linking a procedure record ID. Complete the procedure on the Dental Odontogram first."
      );
      return;
    }

    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      await updateTreatmentPlanItemStatus(
        statusTargetItem.id,
        {
          status: targetStatus,
          decisionDate: decisionDate || null,
          completedProcedureId: procedureIdInput.trim() || null,
          notes: statusNotes.trim() || null,
        },
        accessToken
      );

      await loadPlan();
      setStatusTargetItem(null);
      setActionMessage(`Treatment item status updated to ${targetStatus}.`);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : "Failed to update item status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "accepted":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
      case "declined":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
      case "completed":
        return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    }
  };

  if (isPrintView && plan) {
    return (
      <div className="bg-white text-black p-8 rounded-xl shadow-lg border border-gray-300 space-y-6 print:border-none print:shadow-none print:p-0">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-bold font-serif text-gray-900">
              Marlow Dental Clinic — Treatment Plan Summary
            </h1>
            <p className="text-xs text-gray-600">
              Personalized Dental Care Estimate & Proposed Sequence
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{patientName}</p>
            <p className="text-xs text-gray-500">File #: {patientFileNumber || "N/A"}</p>
            <p className="text-xs text-gray-500">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Grouped Procedures Table */}
        <div className="space-y-4">
          {Object.entries(plan.groupedByTooth).map(([toothGroup, items]) => (
            <div key={toothGroup} className="space-y-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 bg-gray-100 px-3 py-1.5 rounded">
                {toothGroup}
              </h3>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-1">Procedure</th>
                    <th className="py-1">Status</th>
                    <th className="py-1 text-right">Estimate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-1.5 font-medium">{it.procedureName}</td>
                      <td className="py-1.5 capitalize">{it.status}</td>
                      <td className="py-1.5 text-right font-mono font-medium">
                        {it.estimatedCostFormatted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t pt-4 flex justify-end gap-6 text-xs">
          <div>
            <span className="text-gray-600">Total Proposed: </span>
            <span className="font-bold font-mono text-gray-900">{plan.totalEstimatedFormatted}</span>
          </div>
          <div>
            <span className="text-emerald-700">Patient Accepted: </span>
            <span className="font-bold font-mono text-emerald-800">{plan.acceptedEstimatedFormatted}</span>
          </div>
        </div>

        <p className="text-[10px] text-gray-400 italic text-center pt-4 border-t">
          Estimates are based on initial clinical evaluation and service catalog pricing. Actual treatment requirements may vary during clinical execution.
        </p>

        <div className="flex justify-end gap-2 print:hidden pt-2">
          <Button variant="outline" size="sm" onClick={() => setIsPrintView(false)}>
            Close Print View
          </Button>
          <Button size="sm" onClick={() => window.print()} className="gap-1 bg-primary text-white">
            <Printer className="h-4 w-4" />
            Print Document
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-display font-medium text-ink">
            Clinical Treatment Plan
          </h2>
          <p className="text-xs text-ink-soft mt-0.5">
            Grouped by tooth with catalog pricing estimates, patient decision tracking, and audited procedure completion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPrintView(true)}
            className="gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Summary
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setAddError(null);
              setIsAddOpen(true);
            }}
            className="gap-1.5 bg-primary text-white hover:bg-primary-dark text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Planned Item
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Summary Stats Cards */}
      {plan && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-3.5 space-y-1">
            <span className="text-[11px] font-mono text-ink-soft uppercase">Total Planned Items</span>
            <p className="text-xl font-bold font-display text-ink">{plan.totalItems}</p>
          </Card>
          <Card className="p-3.5 space-y-1">
            <span className="text-[11px] font-mono text-ink-soft uppercase">Total Estimated Value</span>
            <p className="text-xl font-bold font-mono text-ink">{plan.totalEstimatedFormatted}</p>
          </Card>
          <Card className="p-3.5 space-y-1 bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
            <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 uppercase">
              Accepted Plan Value
            </span>
            <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
              {plan.acceptedEstimatedFormatted}
            </p>
          </Card>
        </div>
      )}

      {/* Plan Items Grouped by Tooth */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-ink-soft">Loading treatment plan...</div>
      ) : !plan || plan.totalItems === 0 ? (
        <Card className="p-12 text-center">
          <Layers className="h-10 w-10 text-ink-soft mx-auto mb-2 opacity-60" />
          <p className="text-sm font-medium text-ink">No treatment plan items proposed</p>
          <p className="text-xs text-ink-soft mt-1">
            Propose restoration, endodontic, or surgical procedures organized by tooth.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(plan.groupedByTooth).map(([toothGroup, items]) => (
            <Card key={toothGroup} className="overflow-hidden border">
              <div className="bg-muted/60 px-4 py-2.5 border-b border-line flex items-center justify-between">
                <span className="font-semibold text-xs text-ink uppercase tracking-wider font-mono">
                  {toothGroup}
                </span>
                <span className="text-[11px] text-ink-soft">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>

              <div className="divide-y divide-line/60">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${getStatusBadge(
                            item.status
                          )}`}
                        >
                          {item.status}
                        </span>

                        <span className="text-xs font-semibold text-ink">
                          {item.procedureName}
                        </span>
                      </div>

                      {item.notes && (
                        <p className="text-xs text-ink-soft whitespace-pre-wrap">{item.notes}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-soft pt-0.5">
                        <span className="font-mono font-medium text-ink">
                          Estimate: {item.estimatedCostFormatted}
                        </span>

                        {item.decisionDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Decided: {new Date(item.decisionDate).toLocaleDateString()}
                          </span>
                        )}

                        {item.completedProcedureId && (
                          <span className="text-purple-600 font-mono text-[10px]">
                            Proc ID: {item.completedProcedureId.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Transition Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {item.status === "proposed" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStatusModal(item, "accepted")}
                            className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:border-emerald-300"
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openStatusModal(item, "declined")}
                            className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:border-rose-300"
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {item.status === "accepted" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStatusModal(item, "completed")}
                          className="h-7 text-xs text-purple-600 hover:text-purple-700 hover:border-purple-300"
                        >
                          Mark Completed
                        </Button>
                      )}

                      {item.status === "declined" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStatusModal(item, "proposed")}
                          className="h-7 text-xs text-amber-600 hover:text-amber-700"
                        >
                          Re-propose
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Planned Item Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base font-display font-medium text-ink">
                Add Planned Treatment Item
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-ink-soft hover:text-ink transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {addError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-4">
              {/* Service Selection */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Catalog Service (Optional template)
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => handleServiceSelect(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                >
                  <option value="">Select from Service Catalog...</option>
                  {directory.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.cashPrice ? s.cashPrice : "Custom"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Procedure Name */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Procedure Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={procedureName}
                  onChange={(e) => setProcedureName(e.target.value)}
                  placeholder="e.g. MO Composite Restoration, Root Canal Treatment"
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                />
              </div>

              {/* Tooth Number & Estimated Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Tooth Number (1–32)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={toothNumber}
                    onChange={(e) => setToothNumber(e.target.value)}
                    placeholder="e.g. 14 (Leave empty for general)"
                    className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Estimated Cost (PKR Rs)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="50"
                    value={estimatedCostRupees}
                    onChange={(e) => setEstimatedCostRupees(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Clinical Notes / Phasing
                </label>
                <textarea
                  rows={2}
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="e.g. Phase 1 priority, evaluate vitality before preparing..."
                  className="w-full text-xs p-2.5 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isAdding}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isAdding}
                  className="bg-primary text-white hover:bg-primary-dark"
                >
                  {isAdding ? "Adding..." : "Add to Treatment Plan"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Transition Modal */}
      {statusTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base font-display font-medium text-ink">
                Update Status: {statusTargetItem.procedureName}
              </h2>
              <button
                onClick={() => setStatusTargetItem(null)}
                className="text-ink-soft hover:text-ink transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {statusError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md text-xs">
                {statusError}
              </div>
            )}

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Target Status
                </label>
                <select
                  value={targetStatus}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setTargetStatus(e.target.value as "proposed" | "accepted" | "declined" | "completed")
                  }
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                >
                  <option value="proposed">Proposed</option>
                  <option value="accepted">Accepted by Patient</option>
                  <option value="declined">Declined by Patient</option>
                  <option value="completed">Completed (Requires procedure ID)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Decision Date
                </label>
                <input
                  type="date"
                  value={decisionDate}
                  onChange={(e) => setDecisionDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none text-ink"
                />
              </div>

              {targetStatus === "completed" && (
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Completed Procedure Record ID <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={procedureIdInput}
                    onChange={(e) => setProcedureIdInput(e.target.value)}
                    placeholder="Enter or paste procedure UUID"
                    className="w-full text-xs px-3 py-2 font-mono bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                  />
                  <p className="text-[11px] text-ink-soft mt-1">
                    Strict Clinical Rule: Completing an item happens ONLY through a procedure record.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Notes / Decision Context
                </label>
                <textarea
                  rows={2}
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Optional decision notes..."
                  className="w-full text-xs p-2.5 bg-surface rounded-md border border-line focus:outline-none text-ink resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStatusTargetItem(null)}
                  disabled={isUpdatingStatus}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="bg-primary text-white hover:bg-primary-dark"
                >
                  {isUpdatingStatus ? "Updating..." : "Confirm Status"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
