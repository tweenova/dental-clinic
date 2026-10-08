"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";

import {
  createReceptionBooking,
  getReceptionBookings,
  ReceptionBooking,
  rescheduleReceptionBooking,
  searchReceptionPatients,
  updateReceptionBookingConfirmation,
  updateReceptionBookingStatus,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReceptionSchedulePage() {
  const { accessToken } = useAuth();

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [bookings, setBookings] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Array<{ id: string; fullName: string; phone: string }>>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [newBookingTime, setNewBookingTime] = useState("09:00");
  const [newBookingDate, setNewBookingDate] = useState(selectedDate);
  const [newBookingNotes, setNewBookingNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reschedule Modal State
  const [rescheduleBooking, setRescheduleBooking] = useState<ReceptionBooking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("10:00");

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionBookings(
        {
          date: selectedDate,
          status: statusFilter || undefined,
          search: searchQuery || undefined,
        },
        accessToken
      );
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, [selectedDate, statusFilter, accessToken]);

  const handleDateChange = (daysOffset: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + daysOffset);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const handlePatientSearch = async (query: string) => {
    setPatientSearch(query);
    if (query.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      const res = await searchReceptionPatients({ search: query, limit: 5 }, accessToken);
      setPatientResults(res.items.map((p) => ({ id: p.id, fullName: p.fullName, phone: p.phone })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      alert("Please select a patient.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createReceptionBooking(
        {
          patientId: selectedPatientId,
          bookingDate: newBookingDate,
          bookingTime: newBookingTime,
          durationMinutes: 30,
          notes: newBookingNotes,
        },
        accessToken
      );
      setIsModalOpen(false);
      setSelectedPatientId("");
      setPatientSearch("");
      setNewBookingNotes("");
      await loadBookings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking) return;

    setIsSubmitting(true);
    try {
      await rescheduleReceptionBooking(
        rescheduleBooking.id,
        {
          bookingDate: rescheduleDate,
          bookingTime: rescheduleTime,
        },
        accessToken
      );
      setRescheduleBooking(null);
      await loadBookings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reschedule booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, status: string) => {
    try {
      await updateReceptionBookingStatus(bookingId, status, undefined, accessToken);
      await loadBookings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const handleConfirmBooking = async (bookingId: string) => {
    try {
      await updateReceptionBookingConfirmation(bookingId, "confirmed", accessToken);
      await loadBookings();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to confirm.");
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow mb-1">Front-Office Calendar</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Operational Schedule
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Daily practice schedule, provider assignments, and chair availability.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setNewBookingDate(selectedDate);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span>New Appointment</span>
        </Button>
      </div>

      {/* Date Navigation Bar & Filter Controls */}
      <Card surface="bone" shadow="subtle" className="p-4 flex flex-wrap items-center justify-between gap-4">
        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDateChange(-1)}
            className="p-1.5 rounded-full border border-line hover:bg-sand text-ink-soft hover:text-ink transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 rounded-full border border-line bg-cream text-xs font-medium font-mono text-ink shadow-subtle"
          />

          <button
            onClick={() => handleDateChange(1)}
            className="p-1.5 rounded-full border border-line hover:bg-sand text-ink-soft hover:text-ink transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
          >
            Today
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-ink-soft" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-full border border-line bg-cream text-xs text-ink shadow-subtle"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="arrived">Arrived</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 text-ink-soft absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadBookings()}
              className="pl-9 pr-3 py-1.5 rounded-full border border-line bg-cream text-xs text-ink w-44 focus:w-56 transition-all shadow-subtle"
            />
          </div>
        </div>
      </Card>

      {/* Schedule Table */}
      <Card surface="bone" shadow="card" className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-ink-soft font-mono">
            Loading appointments for {selectedDate}...
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CalendarIcon className="h-8 w-8 text-ink-soft/40 mx-auto" />
            <p className="text-base font-display text-ink">
              No appointments on {selectedDate}
            </p>
            <p className="text-xs text-ink-soft">
              Click &quot;New Appointment&quot; above to schedule a patient slot.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sand/60 border-b border-line text-ink-soft uppercase font-mono text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-5 py-3.5">Patient</th>
                  <th className="px-5 py-3.5">Provider</th>
                  <th className="px-5 py-3.5">Service</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Confirmation</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-sand/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-semibold text-ink">
                      {b.bookingTime}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/reception/patients/${b.patientId}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {b.patientName || "Patient"}
                      </Link>
                      {b.patientPhone && (
                        <span className="text-[11px] text-ink-soft font-mono block mt-0.5">{b.patientPhone}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-ink">
                      {b.providerName || "Assigned Provider"}
                    </td>
                    <td className="px-5 py-4 text-ink-soft">
                      {b.serviceName || "Dental Visit"}
                    </td>
                    <td className="px-5 py-4 text-ink-soft font-mono">
                      {b.durationMinutes} min
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`
                          px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase
                          ${
                            b.status === "scheduled"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : b.status === "arrived"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : b.status === "in_progress"
                              ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                              : b.status === "completed"
                              ? "bg-primary/10 text-primary font-bold"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          }
                        `}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`
                          px-2 py-0.5 rounded-full text-[10px] font-mono
                          ${
                            b.confirmationStatus === "confirmed"
                              ? "bg-primary/10 text-primary font-semibold"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
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
                            onClick={() => handleConfirmBooking(b.id)}
                            className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium hover:bg-primary/20 transition-colors"
                          >
                            Confirm
                          </button>
                        )}

                        {b.status === "scheduled" && (
                          <button
                            onClick={() => handleStatusUpdate(b.id, "arrived")}
                            className="px-2.5 py-1 rounded-full bg-primary text-white text-[11px] font-medium hover:bg-primary/90 shadow-xs transition-colors"
                          >
                            Check In
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setRescheduleBooking(b);
                            setRescheduleDate(b.bookingDate);
                            setRescheduleTime(b.bookingTime);
                          }}
                          className="px-2.5 py-1 rounded-full border border-line text-ink-soft hover:text-ink text-[11px] hover:bg-sand transition-colors"
                        >
                          Reschedule
                        </button>

                        {b.status !== "cancelled" && b.status !== "completed" && (
                          <button
                            onClick={() => handleStatusUpdate(b.id, "cancelled")}
                            className="px-2 py-1 rounded-full text-ink-soft hover:text-red-600 text-[11px]"
                          >
                            Cancel
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
      </Card>

      {/* New Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-bone p-6 shadow-modal space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <p className="eyebrow mb-0.5">Front-Desk Appointment</p>
                <h2 className="text-base font-display text-ink font-semibold">
                  Create Operational Booking
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-ink-soft hover:text-ink hover:bg-sand"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBooking} className="space-y-4">
              {/* Patient Search */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">
                  Select Patient *
                </label>
                <input
                  type="text"
                  placeholder="Search patient by name or phone..."
                  value={patientSearch}
                  onChange={(e) => handlePatientSearch(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-line bg-cream text-xs text-ink focus:border-primary"
                />
                {patientResults.length > 0 && (
                  <div className="rounded-xl border border-line bg-bone shadow-card p-1 max-h-36 overflow-y-auto space-y-1">
                    {patientResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setSelectedPatientId(p.id);
                          setPatientSearch(`${p.fullName} (${p.phone})`);
                          setPatientResults([]);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex justify-between hover:bg-sand ${
                          selectedPatientId === p.id ? "bg-primary/10 font-bold text-primary" : "text-ink"
                        }`}
                      >
                        <span>{p.fullName}</span>
                        <span className="font-mono text-ink-soft">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatientId && (
                  <p className="text-[11px] text-primary font-medium">
                    ✓ Patient selected
                  </p>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">
                    Booking Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newBookingDate}
                    onChange={(e) => setNewBookingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-cream text-xs font-mono text-ink"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">
                    Booking Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={newBookingTime}
                    onChange={(e) => setNewBookingTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-cream text-xs font-mono text-ink"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink">
                  Notes / Reason for Visit
                </label>
                <textarea
                  rows={2}
                  value={newBookingNotes}
                  onChange={(e) => setNewBookingNotes(e.target.value)}
                  placeholder="e.g. Routine cleaning & bitewing x-rays"
                  className="w-full px-3 py-2 rounded-xl border border-line bg-cream text-xs text-ink"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Save Appointment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl border border-line bg-bone p-6 shadow-modal space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <p className="eyebrow mb-0.5">Schedule Modification</p>
                <h2 className="text-base font-display text-ink font-semibold">
                  Reschedule Booking
                </h2>
              </div>
              <button
                onClick={() => setRescheduleBooking(null)}
                className="p-1 rounded-full text-ink-soft hover:text-ink hover:bg-sand"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleReschedule} className="space-y-4">
              <p className="text-xs text-ink-soft">
                Patient: <strong className="text-ink">{rescheduleBooking.patientName}</strong>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">
                    New Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-cream text-xs font-mono text-ink"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-ink">
                    New Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-line bg-cream text-xs font-mono text-ink"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setRescheduleBooking(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Updating..." : "Confirm Reschedule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
