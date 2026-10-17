"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  Calendar,
  CheckCircle,
  Download,
  Filter,
  Info,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import {
  ActivityLogItem,
  downloadAuthorizedCsv,
  getAuditLogs,
} from "@/lib/api";

const ACTIONS = [
  { value: "", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "view", label: "View / Access" },
  { value: "export", label: "Export" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
];

const ENTITIES = [
  { value: "", label: "All Entities" },
  { value: "patient", label: "Patient Record" },
  { value: "booking", label: "Appointment / Booking" },
  { value: "encounter", label: "Clinical Encounter" },
  { value: "clinical_note", label: "Clinical Note" },
  { value: "consent", label: "Patient Consent" },
  { value: "attachment", label: "Clinical Attachment" },
  { value: "prescription", label: "Prescription" },
  { value: "referral", label: "Referral Letter" },
  { value: "dental_chart", label: "Dental Chart" },
  { value: "medical_alert", label: "Medical Alert" },
  { value: "user", label: "User Account" },
  { value: "audit_log", label: "Audit Log" },
];

export default function AdminAuditPage() {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [patient, setPatient] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Inspect Modal
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAuditLogs(
        {
          page,
          pageSize,
          actor: actor.trim() || undefined,
          action: action || undefined,
          entity: entity || undefined,
          patient: patient.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        accessToken
      );
      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actor, action, entity, patient, dateFrom, dateTo, accessToken]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchLogs();
    });
  }, [fetchLogs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setActor("");
    setAction("");
    setEntity("");
    setPatient("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (actor.trim()) params.set("actor", actor.trim());
      if (action) params.set("action", action);
      if (entity) params.set("entity", entity);
      if (patient.trim()) params.set("patient", patient.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const qs = params.toString() ? `?${params.toString()}` : "";
      await downloadAuthorizedCsv(
        `/api/v1/admin/audit/export${qs}`,
        `marlow_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`,
        accessToken
      );
      // Re-fetch to reflect the logged export action in the audit log
      setTimeout(() => fetchLogs(), 800);
    } catch (err: any) {
      setError(err?.message || "Failed to export audit logs.");
    } finally {
      setExporting(false);
    }
  };

  const getActionBadge = (act: string) => {
    const actLower = act.toLowerCase();
    if (actLower.includes("create") || actLower.includes("sign")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    if (actLower.includes("delete") || actLower.includes("void")) {
      return "bg-rose-50 text-rose-700 border-rose-200";
    }
    if (actLower.includes("update") || actLower.includes("status")) {
      return "bg-amber-50 text-amber-700 border-amber-200";
    }
    if (actLower.includes("login") || actLower.includes("auth")) {
      return "bg-purple-50 text-purple-700 border-purple-200";
    }
    if (actLower.includes("export")) {
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-line pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">Security &amp; Compliance</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Read-Only
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-semibold flex items-center gap-3">
            <Activity className="h-7 w-7 text-primary" />
            Audit Trail Viewer
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1">
            Immutable, tamper-evident chronological event log covering all patient, clinical, administrative, and security activities.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
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
            {exporting ? "Generating CSV..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Immutability Banner */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 text-blue-900 rounded-[var(--radius-card)] text-xs flex items-center gap-2.5">
        <Shield className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <p className="leading-relaxed">
          <strong className="font-semibold">Security Notice:</strong> The audit trail is strictly append-only. 
          To preserve regulatory compliance and evidentiary integrity, modification and deletion are prohibited by application design and database least-privilege roles.
        </p>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 bg-card border-line shadow-sm">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Actor Search */}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Actor (Name/Email)</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-soft" />
                <input
                  type="text"
                  placeholder="Filter actor..."
                  value={actor}
                  onChange={(e) => setActor(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-line bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Action Select */}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Action Type</label>
              <select
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Select */}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Entity</label>
              <select
                value={entity}
                onChange={(e) => {
                  setEntity(e.target.value);
                  setPage(1);
                }}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {ENTITIES.map((ent) => (
                  <option key={ent.value} value={ent.value}>
                    {ent.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Patient Name / ID */}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Patient Name/ID</label>
              <input
                type="text"
                placeholder="Search patient..."
                value={patient}
                onChange={(e) => setPatient(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border border-line bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Date From */}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-line bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-line/60">
            <div className="text-xs text-ink-soft">
              Showing {logs.length} of {total} events recorded
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs py-1 h-7"
              >
                Reset Filters
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="text-xs py-1 h-7 flex items-center gap-1"
              >
                <Filter className="h-3 w-3" />
                Apply
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Error Notice */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs">
          {error}
        </div>
      )}

      {/* Table Card */}
      <Card className="overflow-hidden border-line shadow-sm bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-ink">
            <thead className="bg-surface border-b border-line text-ink-soft uppercase text-[10px] tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Timestamp (UTC)</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Target ID</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60 font-sans">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-soft">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary/60" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-ink-soft">
                    No activity logs match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dateStr = log.createdAt
                    ? new Date(log.createdAt).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "—";

                  return (
                    <tr key={log.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap text-ink-soft font-mono text-[11px]">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-ink">
                            {log.userFullName || "System / Unauthenticated"}
                          </span>
                          <span className="text-[11px] text-ink-soft">
                            {log.userEmail || (log.userId ? `ID: ${log.userId.slice(0, 8)}...` : "—")}
                          </span>
                          {log.userRole && (
                            <span className="mt-0.5 inline-block w-fit px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider bg-slate-100 text-slate-700">
                              {log.userRole}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded border text-[11px] font-medium capitalize ${getActionBadge(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-medium capitalize text-ink">
                        {log.entityType.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-ink-soft">
                        {log.entityId ? `${log.entityId.slice(0, 12)}...` : "—"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-ink-soft">
                        {log.ipAddress || "—"}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="h-7 px-2 text-xs text-primary hover:text-primary-hover hover:bg-primary/5"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Toolbar */}
        <div className="p-3 bg-surface border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-ink-soft">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 rounded border border-line bg-card text-ink focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="h-7 px-2 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="h-7 px-2 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Inspect Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card rounded-xl border border-line shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95">
            <div className="p-4 border-b border-line flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <h3 className="font-display font-semibold text-ink text-base">
                  Audit Log Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-ink-soft hover:text-ink rounded-lg p-1 hover:bg-surface/80 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3 text-xs bg-surface/50 p-3 rounded-lg border border-line/60">
                <div>
                  <span className="text-ink-soft font-medium">Log ID:</span>
                  <div className="font-mono text-ink mt-0.5 select-all">{selectedLog.id}</div>
                </div>
                <div>
                  <span className="text-ink-soft font-medium">Recorded At:</span>
                  <div className="font-mono text-ink mt-0.5">
                    {selectedLog.createdAt ? new Date(selectedLog.createdAt).toISOString() : "—"}
                  </div>
                </div>
                <div>
                  <span className="text-ink-soft font-medium">Actor:</span>
                  <div className="text-ink font-medium mt-0.5">
                    {selectedLog.userFullName || "System"} ({selectedLog.userRole || "no role"})
                  </div>
                  <div className="text-ink-soft text-[11px]">{selectedLog.userEmail || "—"}</div>
                </div>
                <div>
                  <span className="text-ink-soft font-medium">Client IP Address:</span>
                  <div className="font-mono text-ink mt-0.5">{selectedLog.ipAddress || "—"}</div>
                </div>
                <div>
                  <span className="text-ink-soft font-medium">Action:</span>
                  <div className="text-ink font-semibold uppercase mt-0.5">{selectedLog.action}</div>
                </div>
                <div>
                  <span className="text-ink-soft font-medium">Entity &amp; ID:</span>
                  <div className="text-ink font-mono mt-0.5">
                    {selectedLog.entityType}: {selectedLog.entityId || "—"}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-ink mb-1.5">Action Details &amp; Metadata Payload</h4>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-lg font-mono text-[11px] overflow-x-auto max-h-64 select-all">
                  <pre>{JSON.stringify(selectedLog.details || {}, null, 2)}</pre>
                </div>
              </div>
            </div>

            <div className="p-3 bg-surface border-t border-line flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
