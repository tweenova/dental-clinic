"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Phone,
  PhoneCall,
  Plus,
  RefreshCw,
  User,
} from "lucide-react";

import {
  getReceptionRecalls,
  ReceptionRecall,
  updateReceptionPatient,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionRecallsPage() {
  const { accessToken } = useAuth();

  const [recalls, setRecalls] = useState<ReceptionRecall[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadRecalls = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionRecalls(statusFilter || undefined, accessToken);
      setRecalls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecalls();
  }, [statusFilter, accessToken]);

  const handleMarkContacted = async (patientId: string) => {
    setActionLoadingId(patientId);
    try {
      await updateReceptionPatient(patientId, { recallStatus: "contacted" }, accessToken);
      await loadRecalls();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update recall state.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Preventive Recalls
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Track patients due for routine dental hygiene, 6-month cleanings, and periodic examinations.
          </p>
        </div>

        <button
          onClick={loadRecalls}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1">
          {[
            { id: "", label: "All Recalls" },
            { id: "due", label: "Due Now" },
            { id: "overdue", label: "Overdue" },
            { id: "contacted", label: "Contacted" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recalls Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading recall records...
          </div>
        ) : recalls.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No patients due for recall under this filter
            </p>
            <p className="text-xs text-gray-500">All patient recall cycles are currently managed.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recalls.map((r) => (
              <div
                key={r.patientId}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/reception/patients/${r.patientId}`}
                      className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5"
                    >
                      <User className="h-4 w-4" />
                      <span>{r.patientName}</span>
                    </Link>
                    <span
                      className={`
                        px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold
                        ${
                          r.recallStatus === "overdue"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : r.recallStatus === "due"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }
                      `}
                    >
                      {r.recallStatus}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      <a href={`tel:${r.phone}`} className="hover:underline">
                        {r.phone}
                      </a>
                    </span>
                    {r.lastVisitDate && (
                      <span>Last Visit: <strong className="font-mono">{r.lastVisitDate}</strong></span>
                    )}
                    {r.recallDue && (
                      <span>Due: <strong className="font-mono">{r.recallDue}</strong></span>
                    )}
                    <span>Service: {r.recommendedService || "6-Month Hygiene Recall"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${r.phone}`}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                  >
                    Call
                  </a>

                  {r.recallStatus !== "contacted" && (
                    <button
                      onClick={() => handleMarkContacted(r.patientId)}
                      disabled={actionLoadingId === r.patientId}
                      className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                    >
                      Mark Contacted
                    </button>
                  )}

                  <Link
                    href="/reception/schedule"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-xs"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Book Visit</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
