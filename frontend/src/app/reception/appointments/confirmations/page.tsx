"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";

import {
  getReceptionConfirmations,
  ReceptionBooking,
  updateReceptionBookingConfirmation,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionConfirmationsPage() {
  const { accessToken } = useAuth();

  const [date, setDate] = useState(() => {
    // Tomorrow by default
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });

  const [confirmations, setConfirmations] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadConfirmations = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionConfirmations(date, accessToken);
      setConfirmations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfirmations();
  }, [date, accessToken]);

  const handleConfirm = async (id: string) => {
    setActionLoadingId(id);
    try {
      await updateReceptionBookingConfirmation(id, "confirmed", accessToken);
      await loadConfirmations();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to confirm booking.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            Appointment Confirmations
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Reach out to patients scheduled in upcoming days to verify attendance and reduce no-shows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-mono text-gray-900 dark:text-white shadow-xs"
          />

          <button
            onClick={loadConfirmations}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs"
          >
            <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>

      {/* Confirmation List */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading confirmation queue...
          </div>
        ) : confirmations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No unconfirmed appointments for {date}
            </p>
            <p className="text-xs text-gray-500">All bookings for this date have been verified.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {confirmations.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      {item.patientName}
                    </span>
                    <span className="font-mono text-xs text-gray-500 font-semibold">
                      {item.bookingTime}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                    {item.patientPhone && (
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Phone className="h-3.5 w-3.5 text-emerald-600" />
                        <a href={`tel:${item.patientPhone}`} className="hover:underline">
                          {item.patientPhone}
                        </a>
                      </span>
                    )}
                    <span>Provider: {item.providerName || "Assigned Provider"}</span>
                    <span>Service: {item.serviceName || "Consultation"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${item.patientPhone}`}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Call Patient
                  </a>

                  <button
                    onClick={() => handleConfirm(item.id)}
                    disabled={actionLoadingId === item.id}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Mark Confirmed</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
