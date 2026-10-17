"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle,
  Clock,
  FileCheck,
  Filter,
  Inbox,
  MoreHorizontal,
  Plus,
  Search,
  User,
} from "lucide-react";

import {
  getReceptionBookings,
  ReceptionBooking,
  updateReceptionBookingConfirmation,
  updateReceptionBookingStatus,
} from "@/lib/api";
import { WaitlistOfferModal } from "@/components/reception/waitlist-offer-modal";
import { RecordPaymentModal } from "@/components/reception/record-payment-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";
import {
  isExpected,
  isWaiting,
  isInProgress,
  isCompleted,
  isCancelled,
  APPOINTMENT_STATUS,
} from "@/lib/statuses";

export default function ReceptionAppointmentsPage() {
  const { accessToken } = useAuth();
  const directory = useDirectory();

  const [activeTab, setActiveTab] = useState<"all" | "today" | "upcoming" | "completed" | "cancelled">("all");
  const [bookings, setBookings] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [waitlistModalBookingId, setWaitlistModalBookingId] = useState<string | null>(null);
  const [selectedPaymentBooking, setSelectedPaymentBooking] = useState<{ id: string; patientName: string } | null>(null);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const params: { date?: string; status?: string; search?: string } = {};

      if (activeTab === "today") {
        params.date = todayStr;
      } else if (activeTab === "completed") {
        params.status = "completed";
      } else if (activeTab === "cancelled") {
        params.status = "cancelled";
      }

      if (search) {
        params.search = search;
      }

      const data = await getReceptionBookings(params, accessToken);
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadBookings();
    });
  }, [activeTab, accessToken]);

  const handleStatusChange = async (bookingId: string, status: string) => {
    try {
      let cancellationReason: string | undefined;
      if (status === "cancelled") {
        const reason = window.prompt("Please provide a reason for cancellation:");
        if (!reason || !reason.trim()) {
          return;
        }
        cancellationReason = reason.trim();
      }
      await updateReceptionBookingStatus(bookingId, status, undefined, accessToken, cancellationReason);
      await loadBookings();
      if (status === "cancelled") {
        setWaitlistModalBookingId(bookingId);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update appointment.");
    }
  };

  const handleConfirm = async (bookingId: string) => {
    try {
      await updateReceptionBookingConfirmation(bookingId, "confirmed", accessToken);
      await loadBookings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to confirm.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Submodule Links */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Appointments Management
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Canonical relational bookings, status transitions, and front-desk appointment queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/reception/appointments/requests"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs"
          >
            <Inbox className="h-3.5 w-3.5 text-amber-500" />
            <span>Intake Requests</span>
          </Link>

          <Link
            href="/reception/appointments/confirmations"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs"
          >
            <FileCheck className="h-3.5 w-3.5 text-primary" />
            <span>Confirmations</span>
          </Link>

          <Link
            href="/reception/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Booking</span>
          </Link>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="p-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {(["all", "today", "completed", "cancelled"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium capitalize transition-all cursor-pointer ${
                activeTab === tab
                  ? "bg-primary text-white font-semibold shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadBookings()}
            className="pl-9 pr-3 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white w-48 focus:w-60 transition-all focus:border-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-gray-500 font-mono">
            Loading appointments queue...
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Clock className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No appointments found for this filter
            </p>
            <p className="text-xs text-gray-500">Try adjusting the tab filter or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Date & Time</th>
                  <th className="px-5 py-3.5">Patient</th>
                  <th className="px-5 py-3.5">Provider</th>
                  <th className="px-5 py-3.5">Service</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Confirmation</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-5 py-4 font-mono">
                      <span className="font-semibold text-gray-900 dark:text-white">{b.bookingDate}</span>{" "}
                      <span className="text-gray-500">{b.bookingTime}</span>
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/reception/patients/${b.patientId}`}
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <User className="h-3 w-3" />
                        <span>{b.patientName || "Patient"}</span>
                      </Link>
                      {b.patientPhone && (
                        <span className="text-[11px] text-gray-400 block">{b.patientPhone}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-gray-300">
                      {directory.providerName(b.providerId) || "Assigned Provider"}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {directory.serviceName(b.serviceId) || "Consultation"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`
                          px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase
                          ${
                            isExpected(b.status)
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : isWaiting(b.status)
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : isInProgress(b.status)
                              ? "bg-clay/10 text-clay"
                              : isCompleted(b.status)
                              ? "bg-primary/10 text-primary font-bold"
                              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }
                        `}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`
                          px-2.5 py-0.5 rounded-full text-[10px] font-mono
                          ${
                            b.confirmationStatus === "confirmed"
                              ? "bg-primary/10 text-primary font-medium"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }
                        `}
                      >
                        {b.confirmationStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {b.confirmationStatus === "unconfirmed" && (
                          <button
                            onClick={() => handleConfirm(b.id)}
                            className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                          >
                            Confirm
                          </button>
                        )}

                        {isExpected(b.status) && (
                          <button
                            onClick={() => handleStatusChange(b.id, APPOINTMENT_STATUS.ARRIVED)}
                            className="px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                          >
                            Check In
                          </button>
                        )}

                        {isWaiting(b.status) && (
                          <button
                            onClick={() => handleStatusChange(b.id, APPOINTMENT_STATUS.IN_PROGRESS)}
                            className="px-3 py-1 rounded-full bg-clay text-white text-[11px] font-medium hover:bg-clay/90 transition-colors cursor-pointer"
                          >
                            With Doctor
                          </button>
                        )}

                        {isInProgress(b.status) && (
                          <button
                            onClick={() => handleStatusChange(b.id, APPOINTMENT_STATUS.COMPLETED)}
                            className="px-3 py-1 rounded-full bg-primary text-white text-[11px] font-medium hover:bg-primary/90 transition-colors cursor-pointer"
                          >
                            Complete
                          </button>
                        )}

                        {!isCancelled(b.status) && (
                          <button
                            onClick={() => {
                              setSelectedPaymentBooking({ id: b.id, patientName: b.patientName });
                            }}
                            className="px-3 py-1 rounded-full border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                          >
                            Payment
                          </button>
                        )}

                        {!isCancelled(b.status) && !isCompleted(b.status) && b.status !== APPOINTMENT_STATUS.WAITLIST && (
                          <button
                            onClick={() => handleStatusChange(b.id, APPOINTMENT_STATUS.WAITLIST)}
                            className="px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-[11px] font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                          >
                            Move to waitlist
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <WaitlistOfferModal
        bookingId={waitlistModalBookingId}
        isOpen={Boolean(waitlistModalBookingId)}
        onClose={() => setWaitlistModalBookingId(null)}
      />

      <RecordPaymentModal
        bookingId={selectedPaymentBooking?.id ?? null}
        patientName={selectedPaymentBooking?.patientName}
        isOpen={Boolean(selectedPaymentBooking)}
        onClose={() => setSelectedPaymentBooking(null)}
      />
    </div>
  );
}
