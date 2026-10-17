"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Phone,
  Plus,
  User,
  X,
  Zap,
} from "lucide-react";

import {
  getReceptionWaitlist,
  ReceptionBooking,
  searchReceptionPatients,
  createReceptionBooking,
  getServices,
  ServiceItem,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";
import { APPOINTMENT_STATUS } from "@/lib/statuses";

export default function ReceptionWaitlistPage() {
  const { accessToken } = useAuth();
  const directory = useDirectory();

  const [waitlist, setWaitlist] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Patient to ASAP Waitlist Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<
    Array<{ id: string; fullName: string; phone: string; email?: string }>
  >([]);
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    fullName: string;
    phone: string;
    email?: string;
  } | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [preferredDays, setPreferredDays] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWaitlist = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionWaitlist(accessToken);
      setWaitlist(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadWaitlist();
    });
  }, [accessToken]);

  useEffect(() => {
    getServices().then((res) => setServices(res)).catch(console.error);
  }, []);

  const handlePatientSearch = async (query: string) => {
    setPatientSearch(query);
    if (query.trim().length < 2) {
      setPatientResults([]);
      return;
    }
    try {
      const res = await searchReceptionPatients({ search: query, limit: 5 }, accessToken);
      setPatientResults(
        res.items.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          phone: p.phone,
          email: p.email || undefined,
        }))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      alert("Please search and select a patient first.");
      return;
    }

    setIsSubmitting(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const combinedNotes = [
        preferredDays ? `Preferred days: ${preferredDays}` : "",
        notes ? `Note: ${notes}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      await createReceptionBooking(
        {
          patientId: selectedPatient.id,
          patientFullName: selectedPatient.fullName,
          patientPhone: selectedPatient.phone,
          patientEmail: selectedPatient.email,
          bookingDate: todayStr,
          bookingTime: "09:00 AM",
          serviceId: selectedServiceId || undefined,
          notes: combinedNotes || undefined,
          status: APPOINTMENT_STATUS.WAITLIST,
        },
        accessToken
      );

      setIsModalOpen(false);
      setSelectedPatient(null);
      setPatientSearch("");
      setSelectedServiceId("");
      setPreferredDays("");
      setNotes("");
      await loadWaitlist();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add patient to waitlist.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Waitlist / ASAP Queue
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Patients waiting for short-notice cancellations or earlier openings to fill schedule gaps.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>Add Patient to ASAP List</span>
        </button>
      </div>

      {/* Waitlist Queue */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading ASAP waitlist...
          </div>
        ) : waitlist.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Zap className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No patients on the ASAP waitlist
            </p>
            <p className="text-xs text-gray-500">
              When patients request earlier openings, add them from the schedule or using the button above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {waitlist.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    {item.patientId ? (
                      <Link
                        href={`/reception/patients/${item.patientId}`}
                        className="font-semibold text-sm text-primary hover:underline flex items-center gap-1.5"
                      >
                        <User className="h-4 w-4" />
                        <span>{item.patientName}</span>
                      </Link>
                    ) : (
                      <span className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                        <User className="h-4 w-4 text-primary" />
                        {item.patientName}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-clay/15 text-clay">
                      {item.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <a href={`tel:${item.patientPhone}`} className="hover:underline">
                        {item.patientPhone}
                      </a>
                    </span>
                    <span>Service: {directory.serviceName(item.serviceId) || "Any Appointment"}</span>
                    <span>Provider: {directory.providerName(item.providerId) || "Any Provider"}</span>
                  </div>

                  {item.notes && (
                    <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${item.patientPhone}`}
                    className="px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                  >
                    Call Patient
                  </a>

                  <Link
                    href={`/reception/schedule?date=${encodeURIComponent(item.bookingDate)}`}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 shadow-xs transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Schedule Slot</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add to ASAP Waitlist Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-primary font-semibold">
                  ASAP Priority Queue
                </p>
                <h2 className="text-base font-display text-gray-900 dark:text-white font-semibold">
                  Add Patient to Waitlist
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddToWaitlist} className="space-y-4">
              {/* Patient Search */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Patient *
                </label>
                <input
                  type="text"
                  placeholder="Search patient by name or phone..."
                  value={patientSearch}
                  onChange={(e) => handlePatientSearch(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:border-primary focus:outline-hidden"
                />
                {patientResults.length > 0 && (
                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-md p-1 max-h-36 overflow-y-auto space-y-1">
                    {patientResults.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatientSearch(`${p.fullName} (${p.phone})`);
                          setPatientResults([]);
                        }}
                        className={`w-full text-left px-3.5 py-2 rounded-xl text-xs flex justify-between hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          selectedPatient?.id === p.id
                            ? "bg-primary/10 font-bold text-primary"
                            : "text-gray-900 dark:text-white"
                        }`}
                      >
                        <span>{p.fullName}</span>
                        <span className="font-mono text-gray-500">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatient && (
                  <p className="text-[11px] text-primary font-medium">
                    ✓ Selected: {selectedPatient.fullName} ({selectedPatient.phone})
                  </p>
                )}
              </div>

              {/* Service Requested */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Preferred Service / Reason
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                >
                  <option value="">Any Consultation / Urgent Visit</option>
                  {services.map((svc) => (
                    <option key={svc.id} value={svc.id}>
                      {svc.title} ({svc.duration})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preferred Days */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Preferred Days / Times
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tuesdays & Thursdays, Mornings only"
                  value={preferredDays}
                  onChange={(e) => setPreferredDays(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Additional Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Short notice OK, call at least 1 hour ahead"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedPatient}
                  className="px-4 py-2 rounded-full bg-primary text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? "Adding..." : "Add to Waitlist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
