"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  Edit2,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Shield,
  User,
  X,
} from "lucide-react";

import {
  createReceptionBooking,
  getReceptionPatient,
  ReceptionPatientDetail,
  sendReceptionMessage,
  updateReceptionPatient,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";

export default function ReceptionPatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const directory = useDirectory();
  const patientId = params?.id as string;

  const [patient, setPatient] = useState<ReceptionPatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Quick Message Modal
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState<"sms" | "email" | "portal" | "whatsapp">("sms");
  const [messageBody, setMessageBody] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  const loadPatient = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getReceptionPatient(patientId, accessToken);
      setPatient(data);
      setPhone(data.phone);
      setEmail(data.email || "");
      setNotes(data.notes || "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load patient chart.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) loadPatient();
  }, [patientId, accessToken]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateReceptionPatient(
        patientId,
        {
          phone,
          email: email || undefined,
          notes: notes || undefined,
        },
        accessToken
      );
      setIsEditOpen(false);
      await loadPatient();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update patient.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim() || !patient) return;

    try {
      await sendReceptionMessage(
        {
          channel: messageChannel,
          recipient:
            messageChannel === "email" ? patient.email || undefined : patient.phone,
          body: messageBody,
        },
        accessToken
      );
      setIsMessageOpen(false);
      setMessageBody("");
      await loadPatient();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to log message.");
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-gray-500">
        Loading patient chart...
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-3 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 inline-block">
          <AlertCircle className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{error || "Patient not found"}</p>
        <Link
          href="/reception/patients"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to Patient Directory</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/reception/patients"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Patient Directory</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
              {patient.fullName}
            </h1>
            <span className="text-xs font-mono px-3 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              Patient since {new Date(patient.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs cursor-pointer transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit Info</span>
          </button>

          <button
            onClick={() => setIsMessageOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs cursor-pointer transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
            <span>Log Communication</span>
          </button>

          <Link
            href="/reception/schedule"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Book Visit</span>
          </Link>
        </div>
      </div>

      {/* Grid: Patient Info & Operations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Demographic & Contact Summary */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Administrative & Contact
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Phone className="h-4 w-4 text-primary shrink-0" />
                <a href={`tel:${patient.phone}`} className="font-mono hover:underline">
                  {patient.phone}
                </a>
              </div>

              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Mail className="h-4 w-4 text-blue-600 shrink-0" />
                <span>{patient.email || "No email on file"}</span>
              </div>

              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Calendar className="h-4 w-4 text-purple-600 shrink-0" />
                <span>DOB: {patient.dateOfBirth || "Unknown"}</span>
              </div>

              {patient.notes && (
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[11px] font-semibold text-gray-500 mb-1">Admin Notes</p>
                  <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 p-2.5 rounded-xl">
                    {patient.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Visit History Summary */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Visit History
            </h2>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Upcoming visits</span>
              <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">
                {patient.upcomingBookings.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 dark:text-gray-400">Past visits</span>
              <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">
                {patient.pastBookings.length}
              </span>
            </div>
            {patient.pastBookings[0] && (
              <p className="text-xs text-gray-500">
                Last seen: <strong className="font-mono text-gray-900 dark:text-white">
                  {patient.pastBookings[0].bookingDate}
                </strong>
              </p>
            )}
          </div>
        </div>

        {/* Right 2 Columns: Appointments & Communications */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Bookings */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 shadow-xs">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Upcoming Scheduled Visits
            </h2>

            {(!patient.upcomingBookings || patient.upcomingBookings.length === 0) ? (
              <p className="text-xs text-gray-400 italic py-2">No upcoming appointments scheduled.</p>
            ) : (
              <div className="space-y-2">
                {patient.upcomingBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {b.bookingDate} at {b.bookingTime}
                      </p>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        {directory.serviceName(b.serviceId) || "Consultation"} · {directory.providerName(b.providerId) || "Assigned Provider"}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Appointment History */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 shadow-xs">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Visit History
            </h2>

            {(!patient.pastBookings || patient.pastBookings.length === 0) ? (
              <p className="text-xs text-gray-400 italic py-2">No past completed visits.</p>
            ) : (
              <div className="space-y-2">
                {patient.pastBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-gray-200">
                        {b.bookingDate} ({b.bookingTime})
                      </p>
                      <p className="text-gray-500 text-[11px] mt-0.5">
                        {directory.serviceName(b.serviceId) || "Visit"} · {directory.providerName(b.providerId) || "Provider"}
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-primary/10 text-primary font-bold">
                      {b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Front-Desk Activity Summary */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4 shadow-xs">
            <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Front-Desk Activity
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <p className="text-[11px] text-gray-500">Tasks on record</p>
                <p className="text-lg font-mono font-semibold text-gray-900 dark:text-white">
                  {patient.taskCount}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <p className="text-[11px] text-gray-500">Messages on record</p>
                <p className="text-lg font-mono font-semibold text-gray-900 dark:text-white">
                  {patient.messageCount}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400">
              The full communication log lives in the Communications Center.
            </p>
          </div>
        </div>
      </div>

      {/* Edit Demographic Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-display font-semibold text-gray-900 dark:text-white">
                Edit Patient Information
              </h2>
              <button
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Admin Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Message Modal */}
      {isMessageOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-display font-semibold text-gray-900 dark:text-white">
                Log Patient Communication
              </h2>
              <button
                onClick={() => setIsMessageOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Channel</label>
                  <select
                    value={messageChannel}
                    onChange={(e) => setMessageChannel(e.target.value as "sms" | "email" | "portal" | "whatsapp")}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                    <option value="portal">Patient Portal</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>

                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternalNote}
                      onChange={(e) => setIsInternalNote(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span>Internal Staff Note</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Message / Log Content *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Record conversation summary or outbound message text..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMessageOpen(false)}
                  className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Save to Chart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
