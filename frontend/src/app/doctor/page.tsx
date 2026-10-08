"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  Edit,
  FileText,
  RefreshCw,
  Save,
  Stethoscope,
  User,
  X,
} from "lucide-react";

import {
  getDoctorSchedule,
  ReceptionBooking,
  updateDoctorBookingNotes,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DoctorDashboardPage() {
  const { accessToken, user } = useAuth();

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [schedule, setSchedule] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Notes Modal
  const [selectedBooking, setSelectedBooking] = useState<ReceptionBooking | null>(null);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadSchedule = async () => {
    setIsLoading(true);
    try {
      const data = await getDoctorSchedule(date, accessToken);
      setSchedule(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [date, accessToken]);

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setIsSaving(true);
    try {
      await updateDoctorBookingNotes(selectedBooking.id, notes, accessToken);
      setSelectedBooking(null);
      await loadSchedule();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update clinical notes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow mb-1">Clinical Operations</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Welcome, {user?.fullName}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            View assigned patient procedures, treatment status, and manage clinical visit notes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3.5 py-1.5 rounded-full border border-line bg-cream text-xs font-mono text-ink shadow-subtle"
          />

          <Button variant="secondary" size="sm" onClick={loadSchedule}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Schedule Card Table */}
      <Card surface="bone" shadow="card" className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-ink-soft">
            Loading practitioner schedule...
          </div>
        ) : schedule.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Stethoscope className="h-8 w-8 text-ink-soft/40 mx-auto" />
            <p className="text-base font-display text-ink">
              No appointments on your schedule for {date}
            </p>
            <p className="text-xs text-ink-soft">
              The front desk will assign appointments as patients check in.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sand/60 border-b border-line text-ink-soft uppercase font-mono text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Time</th>
                  <th className="px-5 py-3.5">Patient</th>
                  <th className="px-5 py-3.5">Procedure</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Clinical Notes</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {schedule.map((b) => (
                  <tr key={b.id} className="hover:bg-sand/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-semibold text-ink">
                      {b.bookingTime}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-ink block">
                        {b.patientName || "Patient"}
                      </span>
                      {b.patientPhone && (
                        <span className="text-[11px] text-ink-soft font-mono">{b.patientPhone}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-ink">
                      {b.serviceName || "Clinical Examination"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`
                          px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold
                          ${
                            b.status === "in_progress"
                              ? "bg-secondary/15 text-secondary font-bold"
                              : b.status === "completed"
                              ? "bg-primary/10 text-primary font-bold"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          }
                        `}
                      >
                        {b.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-ink-soft max-w-xs truncate">
                      {b.notes || <span className="text-ink-soft/50 italic">No notes entered</span>}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedBooking(b);
                          setNotes(b.notes || "");
                        }}
                      >
                        <Edit className="h-3 w-3 mr-1.5" />
                        <span>Clinical Notes</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Clinical Notes Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-bone p-6 shadow-modal space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <p className="eyebrow mb-0.5">Patient Chart Note</p>
                <h2 className="text-base font-display text-ink font-semibold">
                  {selectedBooking.patientName}
                </h2>
                <p className="text-xs text-ink-soft font-mono">
                  {selectedBooking.bookingDate} at {selectedBooking.bookingTime}
                </p>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1 rounded-full text-ink-soft hover:text-ink hover:bg-sand"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNotes} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-ink">
                  Clinical Observations & Treatment Notes *
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="Record treatment performed, materials used, next recommended recall..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-line bg-cream text-ink font-sans leading-relaxed focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={isSaving}
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  <span>{isSaving ? "Saving..." : "Save Notes"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
