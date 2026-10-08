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
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionAppointmentsPage() {
  const { accessToken } = useAuth();

  const [activeTab, setActiveTab] = useState<"all" | "today" | "upcoming" | "completed" | "cancelled">("all");
  const [bookings, setBookings] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

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
    loadBookings();
  }, [activeTab, accessToken]);

  const handleStatusChange = async (bookingId: string, status: string) => {
    try {
      await updateReceptionBookingStatus(bookingId, status, undefined, accessToken);
      await loadBookings();
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
            <FileCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Confirmations</span>
          </Link>

          <Link
            href="/reception/schedule"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs"
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
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                activeTab === tab
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadBookings()}
            className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white w-48 focus:w-60 transition-all"
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
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Service</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Confirmation</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 font-mono">
                      <span className="font-semibold text-gray-900 dark:text-white">{b.bookingDate}</span>{" "}
                      <span className="text-gray-500">{b.bookingTime}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/reception/patients/${b.patientId}`}
                        className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        <User className="h-3 w-3" />
                        <span>{b.patientName || "Patient"}</span>
                      </Link>
                      {b.patientPhone && (
                        <span className="text-[11px] text-gray-400 block">{b.patientPhone}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {b.providerName || "Assigned Provider"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {b.serviceName || "Consultation"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`
                          px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase
                          ${
                            b.status === "scheduled"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : b.status === "arrived"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                              : b.status === "in_progress"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                              : b.status === "completed"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                          }
                        `}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`
                          px-2 py-0.5 rounded-full text-[10px] font-mono
                          ${
                            b.confirmationStatus === "confirmed"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-medium"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }
                        `}
                      >
                        {b.confirmationStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {b.confirmationStatus === "unconfirmed" && (
                          <button
                            onClick={() => handleConfirm(b.id)}
                            className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-medium hover:bg-emerald-100"
                          >
                            Confirm
                          </button>
                        )}

                        {b.status === "scheduled" && (
                          <button
                            onClick={() => handleStatusChange(b.id, "arrived")}
                            className="px-2 py-1 rounded bg-blue-600 text-white text-[11px] font-medium hover:bg-blue-700"
                          >
                            Check In
                          </button>
                        )}

                        {b.status === "arrived" && (
                          <button
                            onClick={() => handleStatusChange(b.id, "in_progress")}
                            className="px-2 py-1 rounded bg-teal-600 text-white text-[11px] font-medium hover:bg-teal-700"
                          >
                            With Doctor
                          </button>
                        )}

                        {b.status === "in_progress" && (
                          <button
                            onClick={() => handleStatusChange(b.id, "completed")}
                            className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-medium hover:bg-emerald-700"
                          >
                            Complete
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
    </div>
  );
}
