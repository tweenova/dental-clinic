"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  UserCheck,
  AlertTriangle,
  XCircle,
  Activity,
  CalendarClock,
  Timer,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import {
  AppointmentsReportData,
  CancellationsReportData,
  OperationalTimingReportData,
  RecallComplianceReportData,
  adminGetTeam,
  downloadAuthorizedCsv,
  getAppointmentsReport,
  getCancellationsReport,
  getOperationalTimingReport,
  getRecallComplianceReport,
  TeamMember,
} from "@/lib/api";

type ReportTab = "appointments" | "cancellations" | "recalls" | "operations";

export default function AdminReportsPage() {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportTab>("appointments");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Common date filters (defaults to current month)
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [clinicianId, setClinicianId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Report Data States
  const [apptData, setApptData] = useState<AppointmentsReportData | null>(null);
  const [cancData, setCancData] = useState<CancellationsReportData | null>(null);
  const [recallData, setRecallData] = useState<RecallComplianceReportData | null>(null);
  const [opsData, setOpsData] = useState<OperationalTimingReportData | null>(null);

  // Fetch Team for Clinician selector
  useEffect(() => {
    async function loadTeam() {
      try {
        const members = await adminGetTeam(accessToken || undefined);
        setTeam(members.filter((m) => m.role.toLowerCase().includes("dentist") || m.role.toLowerCase().includes("doctor") || m.role.toLowerCase().includes("hygienist") || m.role.toLowerCase() === "clinician"));
      } catch {
        // Fallback or ignore
      }
    }
    loadTeam();
  }, [accessToken]);

  // Load Report based on active tab
  const loadActiveReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "appointments") {
        const res = await getAppointmentsReport(
          {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            clinicianId: clinicianId || undefined,
            status: statusFilter || undefined,
          },
          accessToken
        );
        setApptData(res);
      } else if (activeTab === "cancellations") {
        const res = await getCancellationsReport(
          {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            clinicianId: clinicianId || undefined,
          },
          accessToken
        );
        setCancData(res);
      } else if (activeTab === "recalls") {
        const res = await getRecallComplianceReport(
          {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            status: statusFilter || undefined,
          },
          accessToken
        );
        setRecallData(res);
      } else if (activeTab === "operations") {
        const res = await getOperationalTimingReport(
          {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            clinicianId: clinicianId || undefined,
          },
          accessToken
        );
        setOpsData(res);
      }
    } catch (err: any) {
      setError(err?.message || `Failed to generate ${activeTab} report.`);
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateFrom, dateTo, clinicianId, statusFilter, accessToken]);

  useEffect(() => {
    queueMicrotask(() => {
      loadActiveReport();
    });
  }, [loadActiveReport]);

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      let endpoint = "";
      let defaultFilename = "";

      if (activeTab === "appointments") {
        if (clinicianId) params.set("clinicianId", clinicianId);
        if (statusFilter) params.set("status", statusFilter);
        endpoint = `/api/v1/admin/reports/appointments/export`;
        defaultFilename = `appointments_report_${dateFrom}_to_${dateTo}.csv`;
      } else if (activeTab === "cancellations") {
        if (clinicianId) params.set("clinicianId", clinicianId);
        endpoint = `/api/v1/admin/reports/cancellations-no-shows/export`;
        defaultFilename = `cancellations_report_${dateFrom}_to_${dateTo}.csv`;
      } else if (activeTab === "recalls") {
        if (statusFilter) params.set("status", statusFilter);
        endpoint = `/api/v1/admin/reports/recall-compliance/export`;
        defaultFilename = `recall_compliance_report_${dateFrom}_to_${dateTo}.csv`;
      } else if (activeTab === "operations") {
        if (clinicianId) params.set("clinicianId", clinicianId);
        endpoint = `/api/v1/admin/reports/operational-timing/export`;
        defaultFilename = `operational_timing_report_${dateFrom}_to_${dateTo}.csv`;
      }

      const qs = params.toString() ? `?${params.toString()}` : "";
      await downloadAuthorizedCsv(`${endpoint}${qs}`, defaultFilename, accessToken);
    } catch (err: any) {
      setError(err?.message || "Failed to download report export.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-line pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">Practice Intelligence</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              Audited Exports
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-semibold flex items-center gap-3">
            <BarChart3 className="h-7 w-7 text-primary" />
            Executive Reports &amp; Analytics
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1">
            High-level practice volume, cancellation tracking, recall adherence, and operational chair timings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadActiveReport}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportCsv}
            disabled={exporting || loading}
            className="flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting CSV..." : "Export Report CSV"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-line gap-2 overflow-x-auto text-xs sm:text-sm">
        <button
          onClick={() => setActiveTab("appointments")}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "appointments"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Appointments Breakdown
        </button>

        <button
          onClick={() => setActiveTab("cancellations")}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "cancellations"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <XCircle className="h-4 w-4" />
          Cancellations &amp; No-Shows
        </button>

        <button
          onClick={() => setActiveTab("recalls")}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "recalls"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <CalendarClock className="h-4 w-4" />
          Recall Compliance
        </button>

        <button
          onClick={() => setActiveTab("operations")}
          className={`pb-3 px-4 font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "operations"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <Timer className="h-4 w-4" />
          Operational Timing (Medians)
        </button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 bg-card border-line shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block font-medium text-ink-soft mb-1">Start Date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block font-medium text-ink-soft mb-1">End Date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {activeTab !== "recalls" && (
            <div>
              <label className="block font-medium text-ink-soft mb-1">Clinician</label>
              <select
                value={clinicianId}
                onChange={(e) => setClinicianId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Clinicians</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.displayName || `${m.firstName} ${m.lastName}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "appointments" && (
            <div>
              <label className="block font-medium text-ink-soft mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_operatory">In Operatory</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
          )}

          {activeTab === "recalls" && (
            <div>
              <label className="block font-medium text-ink-soft mb-1">Recall Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">All Statuses</option>
                <option value="pending">Due / Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Error Notice */}
      {error && (
        <div role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      {loading && (
        <Card role="status" aria-live="polite" className="p-8 text-center text-sm text-ink-soft">
          Loading report...
        </Card>
      )}

      {!loading && !error && activeTab === "appointments" && !apptData && (
        <Card className="p-8 text-center text-sm text-ink-soft">
          No appointment report data is available for this selection.
        </Card>
      )}

      {/* TAB 1: APPOINTMENTS BREAKDOWN */}
      {!loading && !error && activeTab === "appointments" && apptData && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-4 bg-card border-line shadow-sm">
              <span className="text-[11px] font-medium text-ink-soft uppercase tracking-wider">Total Booked</span>
              <div className="text-2xl font-bold font-display text-ink mt-1">{apptData.summary.total}</div>
            </Card>
            <Card className="p-4 bg-emerald-50/50 border-emerald-200 shadow-sm">
              <span className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider">Completed</span>
              <div className="text-2xl font-bold font-display text-emerald-700 mt-1">{apptData.summary.completed}</div>
            </Card>
            <Card className="p-4 bg-rose-50/50 border-rose-200 shadow-sm">
              <span className="text-[11px] font-medium text-rose-800 uppercase tracking-wider">Cancelled</span>
              <div className="text-2xl font-bold font-display text-rose-700 mt-1">{apptData.summary.cancelled}</div>
            </Card>
            <Card className="p-4 bg-amber-50/50 border-amber-200 shadow-sm">
              <span className="text-[11px] font-medium text-amber-800 uppercase tracking-wider">No-Shows</span>
              <div className="text-2xl font-bold font-display text-amber-700 mt-1">{apptData.summary.noShow}</div>
            </Card>
            <Card className="p-4 bg-blue-50/50 border-blue-200 shadow-sm">
              <span className="text-[11px] font-medium text-blue-800 uppercase tracking-wider">Confirmed</span>
              <div className="text-2xl font-bold font-display text-blue-700 mt-1">{apptData.summary.confirmed}</div>
            </Card>
            <Card className="p-4 bg-slate-50 border-slate-200 shadow-sm">
              <span className="text-[11px] font-medium text-slate-700 uppercase tracking-wider">Pending</span>
              <div className="text-2xl font-bold font-display text-slate-800 mt-1">{apptData.summary.pending}</div>
            </Card>
          </div>

          {/* Status Breakdown & Clinician Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Breakdown */}
            <Card className="p-5 bg-card border-line shadow-sm">
              <h3 className="font-display font-semibold text-ink text-sm mb-4">Volume by Appointment Status</h3>
              <div className="space-y-3">
                {apptData.byStatus.map((s) => (
                  <div key={s.status} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize font-medium text-ink">{s.status.replace(/_/g, " ")}</span>
                      <span className="text-ink-soft">
                        {s.count} visits ({s.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-line/40">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, s.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Clinician Volume */}
            <Card className="p-5 bg-card border-line shadow-sm">
              <h3 className="font-display font-semibold text-ink text-sm mb-4">Volume by Clinician</h3>
              <div className="overflow-y-auto max-h-64 divide-y divide-line/60 text-xs">
                {apptData.byClinician.length === 0 ? (
                  <p className="text-ink-soft py-4 text-center">No clinician appointment data recorded in this period.</p>
                ) : (
                  apptData.byClinician.map((c) => (
                    <div key={c.clinicianId} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-primary/70" />
                        <span className="font-medium text-ink">{c.clinicianName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{c.total} total</span>
                        <span className="text-[11px] text-ink-soft">
                          ({c.statuses["completed"] || 0} completed)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: CANCELLATIONS & NO-SHOWS */}
      {!loading && !error && activeTab === "cancellations" && cancData && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-rose-50/60 border-rose-200 shadow-sm">
              <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Cancellations</span>
              <div className="text-3xl font-bold font-display text-rose-700 mt-1">{cancData.summary.totalCancellations}</div>
            </Card>
            <Card className="p-4 bg-amber-50/60 border-amber-200 shadow-sm">
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider">No-Shows</span>
              <div className="text-3xl font-bold font-display text-amber-700 mt-1">{cancData.summary.totalNoShows}</div>
            </Card>
            <Card className="p-4 bg-purple-50/60 border-purple-200 shadow-sm">
              <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider">Combined Lost Bookings</span>
              <div className="text-3xl font-bold font-display text-purple-700 mt-1">{cancData.summary.combinedLoss}</div>
            </Card>
            <Card className="p-4 bg-card border-line shadow-sm">
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Cancellation Rate</span>
              <div className="text-3xl font-bold font-display text-ink mt-1">
                {cancData.summary.cancellationRatePercent}%
              </div>
            </Card>
          </div>

          {/* Cancellation Reasons Breakdown */}
          <Card className="p-5 bg-card border-line shadow-sm">
            <h3 className="font-display font-semibold text-ink text-sm mb-4">Documented Reasons for Cancellation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cancData.cancellationReasons.map((r) => (
                <div key={r.reason} className="p-3 bg-surface rounded-lg border border-line/60">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-ink">{r.reason}</span>
                    <span className="font-bold text-ink">{r.count} ({r.percentage}%)</span>
                  </div>
                  <div className="w-full bg-line/60 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-rose-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, r.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Incident Records Table */}
          <Card className="overflow-hidden border-line shadow-sm bg-card">
            <div className="p-4 border-b border-line bg-surface flex items-center justify-between">
              <h3 className="font-display font-semibold text-ink text-sm">
                Cancellation &amp; No-Show Incident Log ({cancData.items.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink">
                <thead className="bg-surface/60 border-b border-line text-ink-soft uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Date &amp; Time</th>
                    <th className="py-2.5 px-4">Patient</th>
                    <th className="py-2.5 px-4">Clinician</th>
                    <th className="py-2.5 px-4">Service</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {cancData.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-soft">
                        No cancellations or no-shows recorded for this selection.
                      </td>
                    </tr>
                  ) : (
                    cancData.items.map((item) => (
                      <tr key={item.bookingId} className="hover:bg-surface/50">
                        <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px] text-ink-soft">
                          {item.appointmentDate} {item.appointmentTime}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap font-medium text-ink">
                          {item.patientName}
                          <span className="block text-[10px] text-ink-soft font-mono">{item.patientPhone}</span>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-ink-soft">{item.clinicianName}</td>
                        <td className="py-2.5 px-4 whitespace-nowrap text-ink">{item.serviceName}</td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.status === "no_show"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {item.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-ink font-medium max-w-xs truncate">
                          {item.reason}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: RECALL COMPLIANCE */}
      {!loading && !error && activeTab === "recalls" && recallData && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4 bg-card border-line shadow-sm">
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Total Recalls Scheduled</span>
              <div className="text-3xl font-bold font-display text-ink mt-1">{recallData.summary.totalRecalls}</div>
            </Card>
            <Card className="p-4 bg-emerald-50/60 border-emerald-200 shadow-sm">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">Completed / Attended</span>
              <div className="text-3xl font-bold font-display text-emerald-700 mt-1">{recallData.summary.completedRecalls}</div>
            </Card>
            <Card className="p-4 bg-rose-50/60 border-rose-200 shadow-sm">
              <span className="text-xs font-semibold text-rose-800 uppercase tracking-wider">Overdue Recalls</span>
              <div className="text-3xl font-bold font-display text-rose-700 mt-1">{recallData.summary.overdue}</div>
            </Card>
            <Card className="p-4 bg-blue-50/60 border-blue-200 shadow-sm">
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Adherence Compliance Rate</span>
              <div className="text-3xl font-bold font-display text-blue-700 mt-1">
                {recallData.summary.complianceRatePercent}%
              </div>
            </Card>
          </div>

          {/* Compliance By Recall Reason */}
          <Card className="p-5 bg-card border-line shadow-sm">
            <h3 className="font-display font-semibold text-ink text-sm mb-4">Adherence by Clinical Recall Reason</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recallData.byReason.map((r) => (
                <div key={r.reason} className="p-3 bg-surface rounded-lg border border-line/60">
                  <span className="font-semibold text-xs text-ink">{r.reason}</span>
                  <div className="flex items-center justify-between text-xs text-ink-soft mt-1">
                    <span>{r.completed} of {r.total} attended</span>
                    <span className="font-bold text-primary">{r.complianceRatePercent}%</span>
                  </div>
                  <div className="w-full bg-line/60 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, r.complianceRatePercent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recall Records List */}
          <Card className="overflow-hidden border-line shadow-sm bg-card">
            <div className="p-4 border-b border-line bg-surface">
              <h3 className="font-display font-semibold text-ink text-sm">
                Recall Patients Register ({recallData.records.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink">
                <thead className="bg-surface/60 border-b border-line text-ink-soft uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Due Date</th>
                    <th className="py-2.5 px-4">Patient Name</th>
                    <th className="py-2.5 px-4">Phone</th>
                    <th className="py-2.5 px-4">Recall Reason</th>
                    <th className="py-2.5 px-4">Interval</th>
                    <th className="py-2.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {recallData.records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-ink-soft">
                        No recall records found for the selected dates.
                      </td>
                    </tr>
                  ) : (
                    recallData.records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-surface/50">
                        <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px]">
                          {rec.dueDate}
                          {rec.isOverdue && (
                            <span className="ml-2 inline-block px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 text-[9px] font-bold uppercase">
                              Overdue
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-ink">{rec.patientName}</td>
                        <td className="py-2.5 px-4 font-mono text-ink-soft">{rec.patientPhone}</td>
                        <td className="py-2.5 px-4 text-ink">{rec.reason}</td>
                        <td className="py-2.5 px-4 text-ink-soft">{rec.intervalMonths} months</td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rec.status === "completed"
                                ? "bg-emerald-100 text-emerald-800"
                                : rec.isOverdue
                                ? "bg-rose-100 text-rose-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: OPERATIONAL TIMING (MEDIANS) */}
      {!loading && !error && activeTab === "operations" && opsData && (
        <div className="space-y-6">
          {/* Workflow Guardrail Banner */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 text-blue-900 rounded-[var(--radius-card)] text-xs flex items-center gap-2.5">
            <Timer className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <p className="leading-relaxed">
              <strong className="font-semibold">Aggregate Clinic Operations:</strong> Timings represent clinic-wide operational workflows 
              (from patient reception arrival to chair start, and operatory start to procedure completion). 
              Per Marlow Dental policy, metrics reflect system aggregates and medians to prevent per-person staff scoring.
            </p>
          </div>

          {/* Median Timing KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 bg-card border-line shadow-sm">
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Median Reception Wait Time</span>
              <div className="text-3xl font-bold font-display text-primary mt-2">
                {opsData.aggregate.medianWaitMinutes !== null ? `${opsData.aggregate.medianWaitMinutes} min` : "—"}
              </div>
              <p className="text-[11px] text-ink-soft mt-1">
                Average: {opsData.aggregate.averageWaitMinutes !== null ? `${opsData.aggregate.averageWaitMinutes} min` : "—"}
                {" "}(Arrival → Chair Seated)
              </p>
            </Card>

            <Card className="p-5 bg-card border-line shadow-sm">
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Median Chair Procedural Time</span>
              <div className="text-3xl font-bold font-display text-emerald-600 mt-2">
                {opsData.aggregate.medianChairMinutes !== null ? `${opsData.aggregate.medianChairMinutes} min` : "—"}
              </div>
              <p className="text-[11px] text-ink-soft mt-1">
                Average: {opsData.aggregate.averageChairMinutes !== null ? `${opsData.aggregate.averageChairMinutes} min` : "—"}
                {" "}(Operatory Start → Completion)
              </p>
            </Card>

            <Card className="p-5 bg-card border-line shadow-sm">
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Median Total Cycle Time</span>
              <div className="text-3xl font-bold font-display text-indigo-600 mt-2">
                {opsData.aggregate.medianTotalCycleMinutes !== null ? `${opsData.aggregate.medianTotalCycleMinutes} min` : "—"}
              </div>
              <p className="text-[11px] text-ink-soft mt-1">
                Total Completed Encounters: {opsData.aggregate.totalCompletedVisits}
              </p>
            </Card>
          </div>

          {/* Distribution Curves */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Wait Time Distribution */}
            <Card className="p-5 bg-card border-line shadow-sm">
              <h3 className="font-display font-semibold text-ink text-sm mb-4">Patient Waiting Time Distribution</h3>
              <div className="space-y-3">
                {opsData.waitingTimeDistribution.map((w) => (
                  <div key={w.bracket} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium text-ink">{w.bracket}</span>
                      <span className="text-ink-soft">{w.count} visits ({w.percentage}%)</span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-line/40">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: `${Math.min(100, w.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Chair Time Distribution */}
            <Card className="p-5 bg-card border-line shadow-sm">
              <h3 className="font-display font-semibold text-ink text-sm mb-4">Operatory Chair Time Distribution</h3>
              <div className="space-y-3">
                {opsData.chairTimeDistribution.map((c) => (
                  <div key={c.bracket} className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium text-ink">{c.bracket}</span>
                      <span className="text-ink-soft">{c.count} visits ({c.percentage}%)</span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2 overflow-hidden border border-line/40">
                      <div
                        className="bg-emerald-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, c.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Daily Operational Trends Table */}
          <Card className="overflow-hidden border-line shadow-sm bg-card">
            <div className="p-4 border-b border-line bg-surface">
              <h3 className="font-display font-semibold text-ink text-sm">
                Daily Operational Flow History
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-ink">
                <thead className="bg-surface/60 border-b border-line text-ink-soft uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Completed Visits</th>
                    <th className="py-2.5 px-4">Median Reception Wait</th>
                    <th className="py-2.5 px-4">Median Chair Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {opsData.dailyTrends.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-ink-soft">
                        No operational encounter records found for this period.
                      </td>
                    </tr>
                  ) : (
                    opsData.dailyTrends.map((d) => (
                      <tr key={d.date} className="hover:bg-surface/50">
                        <td className="py-2.5 px-4 font-mono text-[11px]">{d.date}</td>
                        <td className="py-2.5 px-4 font-bold text-ink">{d.completedEncounters}</td>
                        <td className="py-2.5 px-4 font-mono text-primary">
                          {d.medianWaitMinutes !== null ? `${d.medianWaitMinutes} min` : "—"}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-emerald-600">
                          {d.medianChairMinutes !== null ? `${d.medianChairMinutes} min` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
