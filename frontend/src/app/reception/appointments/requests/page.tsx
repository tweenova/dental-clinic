"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  Mail,
  Phone,
  RefreshCw,
  User,
  X,
  XCircle,
} from "lucide-react";

import {
  getReceptionRequests,
  ReceptionRequestItem,
  triageReceptionRequest,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionRequestsPage() {
  const { accessToken } = useAuth();

  const [requests, setRequests] = useState<ReceptionRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionRequests(statusFilter || undefined, accessToken);
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [statusFilter, accessToken]);

  const handleTriage = async (id: string, action: "confirm" | "schedule" | "decline") => {
    setActionLoadingId(id);
    try {
      await triageReceptionRequest(id, action, undefined, accessToken);
      await loadRequests();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to triage request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/reception/appointments"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Appointments</span>
          </Link>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Public Website Intake Requests
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Review, contact, and schedule appointments requested through the public booking wizard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-700 dark:text-gray-300 shadow-xs"
          >
            <option value="pending">Pending Triage</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Declined / Cancelled</option>
            <option value="">All Requests</option>
          </select>

          <button
            onClick={loadRequests}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs"
          >
            <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Requests Queue */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading intake queue...
          </div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Inbox className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No intake requests found
            </p>
            <p className="text-xs text-gray-500">
              When patients request appointments online, they will appear in this triage queue.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                      <User className="h-4 w-4 text-gray-400" />
                      {req.fullName}
                    </span>
                    <span
                      className={`
                        px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold
                        ${
                          req.status === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : req.status === "confirmed"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }
                      `}
                    >
                      {req.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      <a href={`tel:${req.phone}`} className="hover:underline font-mono">
                        {req.phone}
                      </a>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-blue-600" />
                      <a href={`mailto:${req.email}`} className="hover:underline">
                        {req.email}
                      </a>
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Calendar className="h-3.5 w-3.5 text-purple-600" />
                      Requested: <strong>{req.preferredDate}</strong> at <strong>{req.preferredTime}</strong>
                    </span>
                  </div>

                  {req.notes && (
                    <p className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      <strong>Patient Note:</strong> {req.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {req.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleTriage(req.id, "confirm")}
                        disabled={actionLoadingId === req.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Accept & Confirm</span>
                      </button>

                      <button
                        onClick={() => handleTriage(req.id, "decline")}
                        disabled={actionLoadingId === req.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 shadow-xs"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Decline</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
