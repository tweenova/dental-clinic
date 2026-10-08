"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  ExternalLink,
  Play,
  RefreshCw,
  User,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";

import {
  getReceptionBookings,
  ReceptionBooking,
  updateReceptionBookingStatus,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionCheckInPage() {
  const { accessToken } = useAuth();
  const [bookings, setBookings] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadFlow = async () => {
    setIsLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const data = await getReceptionBookings({ date: todayStr }, accessToken);
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFlow();
    // Auto-refresh every 30 seconds for live waiting room
    const interval = setInterval(loadFlow, 30000);
    return () => clearInterval(interval);
  }, [accessToken]);

  const handleTransition = async (bookingId: string, status: string) => {
    setActionLoadingId(bookingId);
    try {
      await updateReceptionBookingStatus(bookingId, status, undefined, accessToken);
      await loadFlow();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update patient flow state.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const waitingPatients = bookings.filter((b) => b.status === "arrived");
  const inProgressPatients = bookings.filter((b) => b.status === "in_progress");
  const scheduledUpcoming = bookings.filter((b) => b.status === "scheduled");
  const completedPatients = bookings.filter((b) => b.status === "completed");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Live Check-In & Waiting Room Flow
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Real-time patient arrivals, waiting duration tracking, and provider chair handoffs.
          </p>
        </div>

        <button
          onClick={loadFlow}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Flow</span>
        </button>
      </div>

      {/* 3 Columns: Upcoming Arrivals, In Waiting Room, With Provider */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Expected / Not Arrived */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
              Expected Today ({scheduledUpcoming.length})
            </h2>
            <span className="text-[10px] font-mono text-gray-400">Scheduled</span>
          </div>

          <div className="space-y-3">
            {scheduledUpcoming.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400 italic">
                No more pending arrivals expected today.
              </div>
            ) : (
              scheduledUpcoming.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-3 hover:border-emerald-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/reception/patients/${b.patientId}`}
                        className="font-semibold text-xs text-gray-900 dark:text-white hover:text-emerald-600 block"
                      >
                        {b.patientName || "Patient"}
                      </Link>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {b.serviceName || "Visit"} · {b.providerName || "Assigned Provider"}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800">
                      {b.bookingTime}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <button
                      onClick={() => handleTransition(b.id, "no_show")}
                      disabled={actionLoadingId === b.id}
                      className="text-[11px] text-gray-400 hover:text-red-600"
                    >
                      No Show
                    </button>

                    <button
                      onClick={() => handleTransition(b.id, "arrived")}
                      disabled={actionLoadingId === b.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-2xs"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Check In Patient</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: In Waiting Room */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">
              In Waiting Room ({waitingPatients.length})
            </h2>
            <span className="text-[10px] font-mono text-amber-500">Checked In</span>
          </div>

          <div className="space-y-3">
            {waitingPatients.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400 italic">
                Waiting room is currently clear.
              </div>
            ) : (
              waitingPatients.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/reception/patients/${b.patientId}`}
                        className="font-semibold text-xs text-gray-900 dark:text-white hover:text-emerald-600 block"
                      >
                        {b.patientName || "Patient"}
                      </Link>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        {b.serviceName || "Consultation"} · {b.providerName || "Provider"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-amber-700 dark:text-amber-300 block">
                        {b.bookingTime}
                      </span>
                      {b.arrivalTime && (
                        <span className="text-[10px] text-amber-600 font-mono">
                          Arrived: {b.arrivalTime}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-100 dark:border-amber-900/40 flex items-center justify-end">
                    <button
                      onClick={() => handleTransition(b.id, "in_progress")}
                      disabled={actionLoadingId === b.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 shadow-2xs"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Send to Chair / Doctor</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: With Provider / In Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-mono uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold">
              With Provider ({inProgressPatients.length})
            </h2>
            <span className="text-[10px] font-mono text-teal-500">In Progress</span>
          </div>

          <div className="space-y-3">
            {inProgressPatients.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400 italic">
                No active visits in treatment rooms right now.
              </div>
            ) : (
              inProgressPatients.map((b) => (
                <div
                  key={b.id}
                  className="p-4 rounded-2xl bg-teal-50/40 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900/60 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/reception/patients/${b.patientId}`}
                        className="font-semibold text-xs text-gray-900 dark:text-white hover:text-emerald-600 block"
                      >
                        {b.patientName || "Patient"}
                      </Link>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5">
                        {b.serviceName || "Treatment"} · <strong>{b.providerName || "Doctor"}</strong>
                      </p>
                    </div>
                    <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-300">
                      {b.bookingTime}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-teal-100 dark:border-teal-900/40 flex items-center justify-end">
                    <button
                      onClick={() => handleTransition(b.id, "completed")}
                      disabled={actionLoadingId === b.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-2xs"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Complete Checkout</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
