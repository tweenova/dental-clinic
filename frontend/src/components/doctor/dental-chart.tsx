"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit2,
  FileCheck,
  History,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Zap,
  Check,
  Ban,
  Activity,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  ConditionCatalogItem,
  DentalChartFinding,
  DentalProcedureRecord,
  DentalChartResponse,
  ChartHistoryResponse,
  getPatientDentalChart,
  getPatientChartHistory,
  recordDentalFinding,
  correctDentalFinding,
  resolveDentalFinding,
  createPlannedProcedure,
  updateProcedureStatus,
  getServices,
  ServiceItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface DentalChartProps {
  patientId: string;
  patientName: string;
  encounterId: string;
  token?: string | null;
  onUpdate?: () => void;
}

// Tooth Metadata & Anatomic Rules
const PERMANENT_UPPER_RIGHT = ["1", "2", "3", "4", "5", "6", "7", "8"];
const PERMANENT_UPPER_LEFT = ["9", "10", "11", "12", "13", "14", "15", "16"];
const PERMANENT_LOWER_LEFT = ["17", "18", "19", "20", "21", "22", "23", "24"];
const PERMANENT_LOWER_RIGHT = ["25", "26", "27", "28", "29", "30", "31", "32"];

const PRIMARY_UPPER_RIGHT = ["A", "B", "C", "D", "E"];
const PRIMARY_UPPER_LEFT = ["F", "G", "H", "I", "J"];
const PRIMARY_LOWER_LEFT = ["K", "L", "M", "N", "O"];
const PRIMARY_LOWER_RIGHT = ["P", "Q", "R", "S", "T"];

const POSTERIOR_TEETH = new Set([
  "1", "2", "3", "4", "5", "12", "13", "14", "15", "16",
  "17", "18", "19", "20", "21", "28", "29", "30", "31", "32",
  "A", "B", "I", "J", "K", "L", "S", "T",
]);

const ANTERIOR_TEETH = new Set([
  "6", "7", "8", "9", "10", "11",
  "22", "23", "24", "25", "26", "27",
  "C", "D", "E", "F", "G", "H",
  "M", "N", "O", "P", "Q", "R",
]);

const MAXILLARY_TEETH = new Set([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
]);

const TOOTH_NAMES: Record<string, string> = {
  "1": "Upper Right 3rd Molar",
  "2": "Upper Right 2nd Molar",
  "3": "Upper Right 1st Molar",
  "4": "Upper Right 2nd Premolar",
  "5": "Upper Right 1st Premolar",
  "6": "Upper Right Canine",
  "7": "Upper Right Lateral Incisor",
  "8": "Upper Right Central Incisor",
  "9": "Upper Left Central Incisor",
  "10": "Upper Left Lateral Incisor",
  "11": "Upper Left Canine",
  "12": "Upper Left 1st Premolar",
  "13": "Upper Left 2nd Premolar",
  "14": "Upper Left 1st Molar",
  "15": "Upper Left 2nd Molar",
  "16": "Upper Left 3rd Molar",
  "17": "Lower Left 3rd Molar",
  "18": "Lower Left 2nd Molar",
  "19": "Lower Left 1st Molar",
  "20": "Lower Left 2nd Premolar",
  "21": "Lower Left 1st Premolar",
  "22": "Lower Left Canine",
  "23": "Lower Left Lateral Incisor",
  "24": "Lower Left Central Incisor",
  "25": "Lower Right Central Incisor",
  "26": "Lower Right Lateral Incisor",
  "27": "Lower Right Canine",
  "28": "Lower Right 1st Premolar",
  "29": "Lower Right 2nd Premolar",
  "30": "Lower Right 1st Molar",
  "31": "Lower Right 2nd Molar",
  "32": "Lower Right 3rd Molar",
  "A": "Primary Upper Right 2nd Molar",
  "B": "Primary Upper Right 1st Molar",
  "C": "Primary Upper Right Canine",
  "D": "Primary Upper Right Lateral Incisor",
  "E": "Primary Upper Right Central Incisor",
  "F": "Primary Upper Left Central Incisor",
  "G": "Primary Upper Left Lateral Incisor",
  "H": "Primary Upper Left Canine",
  "I": "Primary Upper Left 1st Molar",
  "J": "Primary Upper Left 2nd Molar",
  "K": "Primary Lower Left 2nd Molar",
  "L": "Primary Lower Left 1st Molar",
  "M": "Primary Lower Left Canine",
  "N": "Primary Lower Left Lateral Incisor",
  "O": "Primary Lower Left Central Incisor",
  "P": "Primary Lower Right Central Incisor",
  "Q": "Primary Lower Right Lateral Incisor",
  "R": "Primary Lower Right Canine",
  "S": "Primary Lower Right 1st Molar",
  "T": "Primary Lower Right 2nd Molar",
};

const ALL_SURFACES = [
  { code: "M", name: "Mesial" },
  { code: "D", name: "Distal" },
  { code: "O", name: "Occlusal (Posterior)" },
  { code: "I", name: "Incisal (Anterior)" },
  { code: "B", name: "Buccal (Posterior)" },
  { code: "F", name: "Facial (Anterior)" },
  { code: "L", name: "Lingual" },
  { code: "P", name: "Palatal (Upper)" },
];

export function DentalChart({
  patientId,
  patientName,
  encounterId,
  token,
  onUpdate,
}: DentalChartProps) {
  const [dentitionMode, setDentitionMode] = useState<"permanent" | "primary" | "both">("permanent");
  const [selectedTooth, setSelectedTooth] = useState<string>("8");
  const [chartData, setChartData] = useState<DentalChartResponse | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Finding Form State
  const [selectedCondition, setSelectedCondition] = useState<string>("caries");
  const [selectedSurfaces, setSelectedSurfaces] = useState<string[]>([]);
  const [findingNotes, setFindingNotes] = useState<string>("");
  const [isSubmittingFinding, setIsSubmittingFinding] = useState<boolean>(false);

  // Procedure Form State
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [procedureSurfaces, setProcedureSurfaces] = useState<string[]>([]);
  const [procedureNotes, setProcedureNotes] = useState<string>("");
  const [isSubmittingProcedure, setIsSubmittingProcedure] = useState<boolean>(false);

  // Correction Modal State
  const [correctingFinding, setCorrectingFinding] = useState<DentalChartFinding | null>(null);
  const [correctionReason, setCorrectionReason] = useState<string>("");
  const [correctionCondition, setCorrectionCondition] = useState<string>("");
  const [correctionSurfaces, setCorrectionSurfaces] = useState<string[]>([]);
  const [correctionNotes, setCorrectionNotes] = useState<string>("");
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState<boolean>(false);

  // History Drawer State
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyData, setHistoryData] = useState<ChartHistoryResponse | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  const loadChart = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [chartRes, servicesRes] = await Promise.all([
        getPatientDentalChart(patientId, token),
        getServices(),
      ]);
      setChartData(chartRes);
      setServices(servicesRes.filter((s) => s.isActive !== false));
      if (servicesRes.length > 0 && !selectedServiceId) {
        setSelectedServiceId(servicesRes[0].id);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load dental chart.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      loadChart();
    }
  }, [patientId, token]);

  // Derive findings per tooth
  const findingsByTooth = useMemo(() => {
    const map = new Map<string, DentalChartFinding[]>();
    if (!chartData?.findings) return map;
    for (const f of chartData.findings) {
      if (f.status === "active") {
        const list = map.get(f.tooth) || [];
        list.push(f);
        map.set(f.tooth, list);
      }
    }
    return map;
  }, [chartData?.findings]);

  // Derive procedures per tooth
  const proceduresByTooth = useMemo(() => {
    const map = new Map<string, DentalProcedureRecord[]>();
    if (!chartData?.procedures) return map;
    for (const p of chartData.procedures) {
      const list = map.get(p.tooth) || [];
      list.push(p);
      map.set(p.tooth, list);
    }
    return map;
  }, [chartData?.procedures]);

  // Find condition metadata
  const currentConditionMeta = useMemo(() => {
    return chartData?.conditionCatalog.find((c) => c.value === selectedCondition);
  }, [chartData?.conditionCatalog, selectedCondition]);

  // Check surface validity for selected tooth
  const isSurfaceValidForTooth = (surfaceCode: string, tooth: string) => {
    const isPosterior = POSTERIOR_TEETH.has(tooth);
    const isAnterior = ANTERIOR_TEETH.has(tooth);
    const isMaxillary = MAXILLARY_TEETH.has(tooth);

    if (surfaceCode === "O" && !isPosterior) return false;
    if (surfaceCode === "I" && !isAnterior) return false;
    if (surfaceCode === "P" && !isMaxillary) return false;
    return true;
  };

  const handleToggleSurface = (code: string) => {
    if (selectedSurfaces.includes(code)) {
      setSelectedSurfaces(selectedSurfaces.filter((s) => s !== code));
    } else {
      setSelectedSurfaces([...selectedSurfaces, code]);
    }
  };

  const handleToggleProcedureSurface = (code: string) => {
    if (procedureSurfaces.includes(code)) {
      setProcedureSurfaces(procedureSurfaces.filter((s) => s !== code));
    } else {
      setProcedureSurfaces([...procedureSurfaces, code]);
    }
  };

  const handleToggleCorrectionSurface = (code: string) => {
    if (correctionSurfaces.includes(code)) {
      setCorrectionSurfaces(correctionSurfaces.filter((s) => s !== code));
    } else {
      setCorrectionSurfaces([...correctionSurfaces, code]);
    }
  };

  // Record Finding
  const handleRecordFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTooth || !selectedCondition) return;

    if (currentConditionMeta?.requiresSurfaces && selectedSurfaces.length === 0) {
      setErrorMsg(`Condition "${currentConditionMeta.label}" requires at least one surface (e.g. M, D, O, I, B, F, L, P).`);
      return;
    }

    setIsSubmittingFinding(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await recordDentalFinding(
        encounterId,
        {
          tooth: selectedTooth,
          condition: selectedCondition,
          surfaces: currentConditionMeta?.toothLevelOnly ? [] : selectedSurfaces,
          notes: findingNotes.trim() || undefined,
        },
        token
      );
      setSuccessMsg(`Recorded ${currentConditionMeta?.label || selectedCondition} on Tooth ${selectedTooth}.`);
      setSelectedSurfaces([]);
      setFindingNotes("");
      await loadChart();
      onUpdate?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to record finding.");
    } finally {
      setIsSubmittingFinding(false);
    }
  };

  // Resolve Finding
  const handleResolveFinding = async (finding: DentalChartFinding) => {
    if (!confirm(`Mark "${finding.conditionLabel}" on Tooth ${finding.tooth} as treated/resolved?`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await resolveDentalFinding(finding.id, { notes: `Resolved during encounter ${encounterId}` }, token);
      setSuccessMsg(`Finding on Tooth ${finding.tooth} resolved.`);
      await loadChart();
      onUpdate?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to resolve finding.");
    }
  };

  // Open Correction Modal
  const handleOpenCorrection = (finding: DentalChartFinding) => {
    setCorrectingFinding(finding);
    setCorrectionCondition(finding.condition);
    setCorrectionSurfaces([...finding.surfaces]);
    setCorrectionNotes(finding.notes || "");
    setCorrectionReason("");
  };

  // Submit Correction
  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingFinding) return;
    if (!correctionReason.trim()) {
      setErrorMsg("A clinical reason is mandatory when correcting a charted finding.");
      return;
    }

    setIsSubmittingCorrection(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await correctDentalFinding(
        correctingFinding.id,
        {
          reason: correctionReason.trim(),
          condition: correctionCondition,
          surfaces: correctionSurfaces,
          notes: correctionNotes.trim() || undefined,
        },
        token
      );
      setSuccessMsg(`Corrected finding on Tooth ${correctingFinding.tooth}.`);
      setCorrectingFinding(null);
      await loadChart();
      onUpdate?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to correct finding.");
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  // Create Planned Procedure
  const handleCreateProcedure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTooth || !selectedServiceId) return;

    setIsSubmittingProcedure(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await createPlannedProcedure(
        encounterId,
        {
          tooth: selectedTooth,
          serviceId: selectedServiceId,
          surfaces: procedureSurfaces,
          notes: procedureNotes.trim() || undefined,
        },
        token
      );
      setSuccessMsg(`Added planned procedure to Tooth ${selectedTooth}.`);
      setProcedureSurfaces([]);
      setProcedureNotes("");
      await loadChart();
      onUpdate?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add procedure.");
    } finally {
      setIsSubmittingProcedure(false);
    }
  };

  // Update Procedure Status
  const handleUpdateProcedureStatus = async (procedureId: string, newStatus: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await updateProcedureStatus(procedureId, { status: newStatus }, token);
      setSuccessMsg(`Procedure status updated to ${newStatus.replace("_", " ")}.`);
      await loadChart();
      onUpdate?.();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to update procedure status.");
    }
  };

  // Load Full History
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setIsLoadingHistory(true);
    try {
      const data = await getPatientChartHistory(patientId, token);
      setHistoryData(data);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case "caries":
        return "bg-red-500 text-white border-red-600";
      case "restoration":
        return "bg-blue-500 text-white border-blue-600";
      case "crown":
        return "bg-amber-500 text-white border-amber-600";
      case "root_canal_treated":
        return "bg-purple-500 text-white border-purple-600";
      case "missing":
        return "bg-stone-500 text-white border-stone-600 line-through";
      case "fracture":
        return "bg-orange-500 text-white border-orange-600";
      case "impacted":
        return "bg-indigo-500 text-white border-indigo-600";
      case "periodontal_pocket":
        return "bg-rose-500 text-white border-rose-600";
      default:
        return "bg-slate-500 text-white border-slate-600";
    }
  };

  const renderToothButton = (tooth: string) => {
    const findings = findingsByTooth.get(tooth) || [];
    const procedures = proceduresByTooth.get(tooth) || [];
    const isSelected = selectedTooth === tooth;
    const isMissing = findings.some((f) => f.condition === "missing");

    return (
      <button
        key={tooth}
        type="button"
        onClick={() => setSelectedTooth(tooth)}
        className={`
          relative flex flex-col items-center justify-between p-1.5 rounded-lg border text-xs font-mono transition-all
          min-w-[42px] h-[64px] sm:min-w-[48px] sm:h-[72px] shadow-xs
          ${
            isSelected
              ? "border-primary bg-primary/10 ring-2 ring-primary/40 font-bold scale-105 z-10"
              : isMissing
              ? "border-stone-300 bg-stone-100 text-stone-400 opacity-70"
              : "border-line bg-white hover:border-primary/50 hover:bg-sand/30 text-ink"
          }
        `}
        title={`${tooth}: ${TOOTH_NAMES[tooth] || "Tooth"}`}
      >
        <span className={`text-xs font-bold ${isMissing ? "line-through" : ""}`}>{tooth}</span>

        {/* Indicators for findings & procedures */}
        <div className="flex flex-wrap gap-0.5 justify-center items-center max-w-full">
          {findings.slice(0, 3).map((f) => (
            <span
              key={f.id}
              className={`w-2 h-2 rounded-full ${
                f.condition === "caries"
                  ? "bg-red-500"
                  : f.condition === "restoration"
                  ? "bg-blue-500"
                  : f.condition === "crown"
                  ? "bg-amber-500"
                  : f.condition === "root_canal_treated"
                  ? "bg-purple-500"
                  : f.condition === "missing"
                  ? "bg-stone-500"
                  : "bg-orange-500"
              }`}
              title={`${f.conditionLabel} (${f.surfaces.join("") || "all"})`}
            />
          ))}
          {findings.length > 3 && (
            <span className="text-[8px] font-bold text-ink-soft">+{findings.length - 3}</span>
          )}
        </div>

        {procedures.length > 0 && (
          <span className="text-[9px] font-sans font-bold px-1 rounded bg-secondary/15 text-secondary truncate max-w-full">
            {procedures.some((p) => p.status === "in_progress") ? "Active" : "Plan"}
          </span>
        )}
      </button>
    );
  };

  const selectedToothFindings = selectedTooth ? findingsByTooth.get(selectedTooth) || [] : [];
  const selectedToothProcedures = selectedTooth ? proceduresByTooth.get(selectedTooth) || [] : [];

  return (
    <div className="space-y-6">
      {/* Top Banner / Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-sand/40 border border-line">
        <div>
          <h3 className="font-display text-base text-ink font-semibold flex items-center gap-2">
            <span>Dental Odontogram & Charting</span>
            <span className="text-xs font-mono font-normal text-ink-soft">
              ({patientName})
            </span>
          </h3>
          <p className="text-xs text-ink-soft">
            Cumulative patient dental anatomy, active pathology, and multidisciplinary treatment plan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Dentition View Mode Switcher */}
          <div className="flex items-center rounded-lg border border-line bg-white p-0.5 text-xs font-mono">
            <button
              type="button"
              onClick={() => setDentitionMode("permanent")}
              className={`px-3 py-1 rounded-md transition-colors ${
                dentitionMode === "permanent" ? "bg-primary text-white font-semibold" : "text-ink hover:bg-sand"
              }`}
            >
              Permanent (1–32)
            </button>
            <button
              type="button"
              onClick={() => setDentitionMode("primary")}
              className={`px-3 py-1 rounded-md transition-colors ${
                dentitionMode === "primary" ? "bg-primary text-white font-semibold" : "text-ink hover:bg-sand"
              }`}
            >
              Primary (A–T)
            </button>
            <button
              type="button"
              onClick={() => setDentitionMode("both")}
              className={`px-3 py-1 rounded-md transition-colors ${
                dentitionMode === "both" ? "bg-primary text-white font-semibold" : "text-ink hover:bg-sand"
              }`}
            >
              Mixed
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={handleOpenHistory}>
            <History className="h-3.5 w-3.5 mr-1.5" />
            <span>Audit History</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={loadChart} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Arch Visualizer */}
      <Card surface="bone" shadow="card" className="p-4 space-y-4">
        {/* Maxillary (Upper) Arch */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-ink-soft px-1">
            <span className="font-semibold text-ink">Maxillary Arch (Upper)</span>
            <span className="text-[10px]">Right Quadrant 1 &bull; Left Quadrant 2</span>
          </div>

          {(dentitionMode === "permanent" || dentitionMode === "both") && (
            <div className="flex justify-between items-center gap-1 overflow-x-auto pb-1">
              <div className="flex gap-1">
                {PERMANENT_UPPER_RIGHT.map(renderToothButton)}
              </div>
              <div className="h-12 w-px bg-line mx-1" title="Midline" />
              <div className="flex gap-1">
                {PERMANENT_UPPER_LEFT.map(renderToothButton)}
              </div>
            </div>
          )}

          {(dentitionMode === "primary" || dentitionMode === "both") && (
            <div className="flex justify-between items-center gap-1 overflow-x-auto pb-1 pt-1 border-t border-line/40">
              <div className="flex gap-1 justify-end flex-1">
                {PRIMARY_UPPER_RIGHT.map(renderToothButton)}
              </div>
              <div className="h-10 w-px bg-line mx-1" title="Midline" />
              <div className="flex gap-1 justify-start flex-1">
                {PRIMARY_UPPER_LEFT.map(renderToothButton)}
              </div>
            </div>
          )}
        </div>

        {/* Arch Separator / Midline */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-dashed border-line"></div>
          <span className="flex-shrink mx-4 text-[10px] font-mono uppercase text-ink-soft">
            Occlusal Plane
          </span>
          <div className="flex-grow border-t border-dashed border-line"></div>
        </div>

        {/* Mandibular (Lower) Arch */}
        <div className="space-y-2">
          {(dentitionMode === "primary" || dentitionMode === "both") && (
            <div className="flex justify-between items-center gap-1 overflow-x-auto pb-1">
              <div className="flex gap-1 justify-end flex-1">
                {PRIMARY_LOWER_RIGHT.map(renderToothButton)}
              </div>
              <div className="h-10 w-px bg-line mx-1" title="Midline" />
              <div className="flex gap-1 justify-start flex-1">
                {PRIMARY_LOWER_LEFT.map(renderToothButton)}
              </div>
            </div>
          )}

          {(dentitionMode === "permanent" || dentitionMode === "both") && (
            <div className="flex justify-between items-center gap-1 overflow-x-auto pb-1 pt-1 border-t border-line/40">
              <div className="flex gap-1">
                {PERMANENT_LOWER_RIGHT.map(renderToothButton)}
              </div>
              <div className="h-12 w-px bg-line mx-1" title="Midline" />
              <div className="flex gap-1">
                {PERMANENT_LOWER_LEFT.map(renderToothButton)}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-mono text-ink-soft px-1">
            <span className="font-semibold text-ink">Mandibular Arch (Lower)</span>
            <span className="text-[10px]">Right Quadrant 4 &bull; Left Quadrant 3</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-line text-[11px] text-ink-soft">
          <span className="font-mono text-[10px] uppercase font-bold text-ink">Legend:</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Caries</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Restoration</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Crown</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Root Canal</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-stone-500" /> Missing</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Fracture</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Impacted</span>
        </div>
      </Card>

      {/* Selected Tooth Operations (Findings + Treatment Plan) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Record / View Findings for Tooth */}
        <Card surface="bone" shadow="card" className="p-5 space-y-4">
          <div className="flex items-start justify-between pb-3 border-b border-line">
            <div>
              <span className="eyebrow">Diagnostic Findings</span>
              <h4 className="text-base font-display text-ink font-semibold">
                Tooth {selectedTooth}: {TOOTH_NAMES[selectedTooth] || "Unknown"}
              </h4>
              <p className="text-xs text-ink-soft font-mono">
                {MAXILLARY_TEETH.has(selectedTooth) ? "Maxillary (Upper)" : "Mandibular (Lower)"} &bull;{" "}
                {POSTERIOR_TEETH.has(selectedTooth) ? "Posterior" : "Anterior"}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-mono text-xs font-bold">
              Tooth {selectedTooth}
            </span>
          </div>

          {/* Active Findings on this Tooth */}
          <div className="space-y-2">
            <h5 className="font-mono text-xs font-semibold uppercase text-ink">
              Current Active Findings ({selectedToothFindings.length})
            </h5>
            {selectedToothFindings.length === 0 ? (
              <p className="text-xs text-ink-soft italic p-3 rounded-lg bg-sand/30 border border-line">
                No active clinical findings charted on Tooth {selectedTooth}.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedToothFindings.map((f) => (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl border border-line bg-white shadow-xs flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${getConditionColor(f.condition)}`}>
                          {f.conditionLabel}
                        </span>
                        {f.surfaces.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-sand border border-line font-mono text-[10px] font-bold text-ink">
                            Surfaces: {f.surfaces.join(", ")}
                          </span>
                        )}
                      </div>
                      {f.notes && <p className="text-ink-soft text-xs">{f.notes}</p>}
                      <p className="text-[10px] text-ink-soft/70 font-mono">
                        Recorded: {new Date(f.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenCorrection(f)}
                        title="Correct charted error with audit rationale"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        <span>Correct</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleResolveFinding(f)}
                        title="Mark finding resolved/treated"
                      >
                        <Check className="h-3 w-3 mr-1 text-emerald-600" />
                        <span>Resolve</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form: Record New Finding on Selected Tooth */}
          <form onSubmit={handleRecordFinding} className="space-y-3 pt-3 border-t border-line text-xs">
            <h5 className="font-mono text-xs font-semibold uppercase text-ink flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Chart New Finding on Tooth {selectedTooth}
            </h5>

            {/* Condition Picker */}
            <div className="space-y-1">
              <label className="font-semibold text-ink">Pathology / Condition</label>
              <select
                value={selectedCondition}
                onChange={(e) => {
                  setSelectedCondition(e.target.value);
                  const meta = chartData?.conditionCatalog.find((c) => c.value === e.target.value);
                  if (meta?.toothLevelOnly) {
                    setSelectedSurfaces([]);
                  }
                }}
                className="w-full p-2 rounded-lg border border-line bg-cream text-ink text-xs focus:border-primary"
              >
                {chartData?.conditionCatalog.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} {c.toothLevelOnly ? "(Whole Tooth)" : "(Surface-specific)"}
                  </option>
                ))}
              </select>
            </div>

            {/* Surfaces Selector */}
            {!currentConditionMeta?.toothLevelOnly && (
              <div className="space-y-1.5">
                <label className="font-semibold text-ink flex items-center justify-between">
                  <span>Anatomical Surfaces</span>
                  {currentConditionMeta?.requiresSurfaces && (
                    <span className="text-[10px] text-primary font-mono font-normal">* At least 1 required</span>
                  )}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ALL_SURFACES.map((surf) => {
                    const isValid = isSurfaceValidForTooth(surf.code, selectedTooth);
                    const isChecked = selectedSurfaces.includes(surf.code);
                    return (
                      <button
                        key={surf.code}
                        type="button"
                        disabled={!isValid}
                        onClick={() => handleToggleSurface(surf.code)}
                        className={`
                          p-2 rounded-lg border text-xs font-mono flex flex-col items-center justify-center transition-colors
                          ${
                            !isValid
                              ? "opacity-30 bg-bone border-line text-ink-soft cursor-not-allowed"
                              : isChecked
                              ? "bg-primary text-white border-primary font-bold shadow-xs"
                              : "bg-white hover:bg-sand border-line text-ink"
                          }
                        `}
                        title={!isValid ? "Not applicable for this tooth" : surf.name}
                      >
                        <span className="font-bold">{surf.code}</span>
                        <span className="text-[9px] truncate max-w-full font-sans opacity-90">{surf.name.split(" ")[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Finding Notes */}
            <div className="space-y-1">
              <label className="font-semibold text-ink">Clinical Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Incipient enamel demineralization, radiolucency noted..."
                value={findingNotes}
                onChange={(e) => setFindingNotes(e.target.value)}
                className="w-full p-2 rounded-lg border border-line bg-cream text-ink text-xs focus:border-primary"
              />
            </div>

            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmittingFinding}
              className="w-full"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              <span>{isSubmittingFinding ? "Recording..." : `Record Finding on Tooth ${selectedTooth}`}</span>
            </Button>
          </form>
        </Card>

        {/* Right Column: Treatment Plan & Procedures */}
        <Card surface="bone" shadow="card" className="p-5 space-y-4">
          <div className="flex items-start justify-between pb-3 border-b border-line">
            <div>
              <span className="eyebrow">Treatment Plan</span>
              <h4 className="text-base font-display text-ink font-semibold">
                Planned & Executed Procedures
              </h4>
              <p className="text-xs text-ink-soft">
                Add services to treatment plan and track status transitions.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-secondary/15 text-secondary font-mono text-xs font-bold">
              {chartData?.procedures.length || 0} Total
            </span>
          </div>

          {/* Form: Add Procedure to Treatment Plan */}
          <form onSubmit={handleCreateProcedure} className="space-y-3 p-3.5 rounded-xl bg-sand/40 border border-line text-xs">
            <h5 className="font-mono text-xs font-semibold uppercase text-ink flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-secondary" />
              Add Procedure for Tooth {selectedTooth}
            </h5>

            {/* Service / Procedure Catalog Selector */}
            <div className="space-y-1">
              <label className="font-semibold text-ink">Clinic Procedure (Service Catalog)</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full p-2 rounded-lg border border-line bg-white text-ink text-xs focus:border-primary"
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.category}) — ${s.cashPrice}
                  </option>
                ))}
              </select>
            </div>

            {/* Surfaces */}
            <div className="space-y-1">
              <label className="font-semibold text-ink">Surfaces (Optional)</label>
              <div className="flex flex-wrap gap-1">
                {ALL_SURFACES.map((surf) => {
                  const isValid = isSurfaceValidForTooth(surf.code, selectedTooth);
                  const isChecked = procedureSurfaces.includes(surf.code);
                  return (
                    <button
                      key={surf.code}
                      type="button"
                      disabled={!isValid}
                      onClick={() => handleToggleProcedureSurface(surf.code)}
                      className={`
                        px-2 py-1 rounded border text-xs font-mono transition-colors
                        ${
                          !isValid
                            ? "opacity-30 bg-bone border-line text-ink-soft cursor-not-allowed"
                            : isChecked
                            ? "bg-secondary text-white border-secondary font-bold"
                            : "bg-white hover:bg-sand border-line text-ink"
                        }
                      `}
                    >
                      {surf.code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Procedure Notes */}
            <div className="space-y-1">
              <label className="font-semibold text-ink">Treatment Plan Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Composite shade A2, local anesthesia 2% lidocaine..."
                value={procedureNotes}
                onChange={(e) => setProcedureNotes(e.target.value)}
                className="w-full p-2 rounded-lg border border-line bg-white text-ink text-xs focus:border-primary"
              />
            </div>

            <Button
              variant="secondary"
              size="sm"
              type="submit"
              disabled={isSubmittingProcedure || !selectedServiceId}
              className="w-full"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              <span>{isSubmittingProcedure ? "Adding..." : "Add to Treatment Plan"}</span>
            </Button>
          </form>

          {/* Procedures List */}
          <div className="space-y-2">
            <h5 className="font-mono text-xs font-semibold uppercase text-ink">
              Patient Procedures
            </h5>
            {chartData?.procedures.length === 0 ? (
              <p className="text-xs text-ink-soft italic p-3 rounded-lg bg-sand/30 border border-line">
                No procedures recorded in treatment plan yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {chartData?.procedures.map((p) => {
                  const service = services.find((s) => s.id === p.serviceId);
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                        p.status === "completed"
                          ? "bg-emerald-50/50 border-emerald-200"
                          : p.status === "in_progress"
                          ? "bg-blue-50/50 border-blue-200 shadow-xs"
                          : p.status === "cancelled"
                          ? "bg-stone-50 border-stone-200 opacity-60 line-through"
                          : "bg-white border-line"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-ink">
                            <span className="px-1.5 py-0.5 rounded bg-sand font-mono text-[10px] text-ink font-bold">
                              Tooth {p.tooth}
                            </span>
                            <span>{service?.title || "Dental Procedure"}</span>
                          </div>
                          {p.surfaces.length > 0 && (
                            <p className="text-[10px] font-mono text-ink-soft">
                              Surfaces: {p.surfaces.join(", ")}
                            </p>
                          )}
                          {p.notes && <p className="text-xs text-ink-soft mt-0.5">{p.notes}</p>}
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`
                            px-2 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase
                            ${
                              p.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.status === "in_progress"
                                ? "bg-blue-100 text-blue-800"
                                : p.status === "cancelled"
                                ? "bg-stone-200 text-stone-700"
                                : "bg-amber-100 text-amber-800"
                            }
                          `}
                        >
                          {p.status.replace("_", " ")}
                        </span>
                      </div>

                      {/* Status Transition Action Buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-line/50 text-[10px] font-mono">
                        <span className="text-ink-soft">
                          {p.completedAt
                            ? `Completed: ${new Date(p.completedAt).toLocaleDateString()}`
                            : `Created: ${new Date(p.createdAt).toLocaleDateString()}`}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {p.status === "planned" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateProcedureStatus(p.id, "in_progress")}
                                className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold transition-colors"
                              >
                                Start Procedure
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateProcedureStatus(p.id, "cancelled")}
                                className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {p.status === "in_progress" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateProcedureStatus(p.id, "completed")}
                                className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors flex items-center gap-1"
                              >
                                <Check className="h-3 w-3" />
                                Complete
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateProcedureStatus(p.id, "cancelled")}
                                className="px-2 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Finding Correction Modal */}
      {correctingFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-bone p-6 shadow-modal space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-line">
              <div>
                <span className="eyebrow text-amber-700">Audit Correction</span>
                <h4 className="text-base font-display text-ink font-semibold">
                  Correct Finding on Tooth {correctingFinding.tooth}
                </h4>
                <p className="text-xs text-ink-soft">
                  Original: {correctingFinding.conditionLabel} ({correctingFinding.surfaces.join(", ") || "Whole Tooth"})
                </p>
              </div>
              <button
                onClick={() => setCorrectingFinding(null)}
                className="p-1 rounded-full text-ink-soft hover:text-ink hover:bg-sand"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-4 text-xs">
              {/* Mandatory Correction Rationale */}
              <div className="space-y-1.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <label className="font-semibold text-amber-900 flex items-center gap-1">
                  <Edit2 className="h-3.5 w-3.5" />
                  Mandatory Clinical Correction Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Corrected surface from O to MO after bitewing radiograph review..."
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-amber-300 bg-white text-ink text-xs focus:border-amber-600"
                />
              </div>

              {/* Condition */}
              <div className="space-y-1">
                <label className="font-semibold text-ink">Corrected Condition</label>
                <select
                  value={correctionCondition}
                  onChange={(e) => setCorrectionCondition(e.target.value)}
                  className="w-full p-2 rounded-lg border border-line bg-cream text-ink text-xs"
                >
                  {chartData?.conditionCatalog.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Surfaces */}
              <div className="space-y-1">
                <label className="font-semibold text-ink">Corrected Surfaces</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ALL_SURFACES.map((surf) => {
                    const isValid = isSurfaceValidForTooth(surf.code, correctingFinding.tooth);
                    const isChecked = correctionSurfaces.includes(surf.code);
                    return (
                      <button
                        key={surf.code}
                        type="button"
                        disabled={!isValid}
                        onClick={() => handleToggleCorrectionSurface(surf.code)}
                        className={`
                          p-2 rounded-lg border text-xs font-mono transition-colors
                          ${
                            !isValid
                              ? "opacity-30 bg-bone border-line text-ink-soft cursor-not-allowed"
                              : isChecked
                              ? "bg-primary text-white border-primary font-bold shadow-xs"
                              : "bg-white hover:bg-sand border-line text-ink"
                          }
                        `}
                      >
                        {surf.code}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-ink">Updated Notes</label>
                <input
                  type="text"
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  className="w-full p-2 rounded-lg border border-line bg-cream text-ink text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setCorrectingFinding(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isSubmittingCorrection}
                >
                  <FileCheck className="h-3.5 w-3.5 mr-1.5" />
                  <span>{isSubmittingCorrection ? "Saving..." : "Save Correction"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Patient Chart History Audit Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-line bg-bone p-6 shadow-modal space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-line shrink-0">
              <div>
                <span className="eyebrow">Audit Trail</span>
                <h4 className="text-lg font-display text-ink font-semibold">
                  Complete Dental Chart History — {patientName}
                </h4>
                <p className="text-xs text-ink-soft font-mono">
                  Full chronological record of all findings, resolutions, corrections, and procedures.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 rounded-full text-ink-soft hover:text-ink hover:bg-sand"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-6 flex-1 pr-2 text-xs">
              {isLoadingHistory ? (
                <div className="p-12 text-center font-mono text-ink-soft">
                  Loading complete audit history...
                </div>
              ) : (
                <>
                  {/* Historical Findings */}
                  <div className="space-y-3">
                    <h5 className="font-mono text-xs font-semibold uppercase text-ink flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      All Charted Findings ({historyData?.findings.length || 0})
                    </h5>
                    {historyData?.findings.length === 0 ? (
                      <p className="text-ink-soft italic">No findings recorded in history.</p>
                    ) : (
                      <div className="space-y-2">
                        {historyData?.findings.map((f) => (
                          <div
                            key={f.id}
                            className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                              f.status === "active"
                                ? "bg-white border-line shadow-xs"
                                : "bg-sand/30 border-line/60 text-ink-soft"
                            }`}
                          >
                            <div className="flex items-center justify-between font-mono text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-ink">Tooth {f.tooth}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getConditionColor(f.condition)}`}>
                                  {f.conditionLabel}
                                </span>
                                {f.surfaces.length > 0 && (
                                  <span className="px-1.5 py-0.5 rounded bg-sand border border-line text-[10px]">
                                    {f.surfaces.join(", ")}
                                  </span>
                                )}
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full uppercase font-bold text-[10px] ${
                                  f.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"
                                }`}
                              >
                                {f.status}
                              </span>
                            </div>

                            {f.notes && <p className="text-ink">{f.notes}</p>}

                            {f.correctionReason && (
                              <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 font-mono text-[10px]">
                                <strong>Correction Rationale:</strong> {f.correctionReason} (at {f.correctedAt ? new Date(f.correctedAt).toLocaleString() : "N/A"})
                              </div>
                            )}

                            {f.resolvedAt && (
                              <div className="p-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono text-[10px]">
                                <strong>Resolved:</strong> {new Date(f.resolvedAt).toLocaleString()}
                              </div>
                            )}

                            <div className="flex justify-between text-[10px] text-ink-soft font-mono pt-1">
                              <span>Encounter: {f.encounterId}</span>
                              <span>Recorded: {new Date(f.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Historical Procedures */}
                  <div className="space-y-3 pt-4 border-t border-line">
                    <h5 className="font-mono text-xs font-semibold uppercase text-ink flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-secondary" />
                      All Procedures ({historyData?.procedures.length || 0})
                    </h5>
                    {historyData?.procedures.length === 0 ? (
                      <p className="text-ink-soft italic">No procedures recorded in history.</p>
                    ) : (
                      <div className="space-y-2">
                        {historyData?.procedures.map((p) => {
                          const s = services.find((srv) => srv.id === p.serviceId);
                          return (
                            <div
                              key={p.id}
                              className="p-3 rounded-xl border border-line bg-white shadow-xs text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between font-mono text-[11px]">
                                <span className="font-bold text-ink">
                                  Tooth {p.tooth} &bull; {s?.title || "Procedure"}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full uppercase font-bold text-[10px] ${
                                    p.status === "completed"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : p.status === "in_progress"
                                      ? "bg-blue-100 text-blue-800"
                                      : p.status === "cancelled"
                                      ? "bg-stone-200 text-stone-700"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {p.status.replace("_", " ")}
                                </span>
                              </div>
                              {p.surfaces.length > 0 && (
                                <p className="text-[10px] font-mono text-ink-soft">
                                  Surfaces: {p.surfaces.join(", ")}
                                </p>
                              )}
                              {p.notes && <p className="text-ink-soft">{p.notes}</p>}
                              <div className="flex justify-between text-[10px] text-ink-soft font-mono pt-1">
                                <span>Created: {new Date(p.createdAt).toLocaleDateString()}</span>
                                {p.completedAt && (
                                  <span>Completed: {new Date(p.completedAt).toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-line shrink-0">
              <Button variant="secondary" size="sm" onClick={() => setShowHistoryModal(false)}>
                Close History
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

