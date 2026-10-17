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
  ListTodo,
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
  createReceptionTask,
  getReceptionPatient,
  ReceptionPatientDetail,
  recordReceptionPendingAlert,
  sendReceptionMessage,
  updateReceptionPatient,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";
import { PatientAttachmentsTab } from "@/components/clinical/patient-attachments-tab";
import { PatientBillingSection } from "@/components/reception/patient-billing-section";

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
  const [fileNumber, setFileNumber] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<"sms" | "whatsapp" | "none">("sms");
  const [isSaving, setIsSaving] = useState(false);

  // Quick Message Modal
  const [isMessageOpen, setIsMessageOpen] = useState(false);
  const [messageChannel, setMessageChannel] = useState<"sms" | "email" | "portal" | "whatsapp">("sms");
  const [messageBody, setMessageBody] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Quick Task Modal
  const [isTaskOpen, setIsTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  // Pending Alert Modal (Reception Capture)
  const [isPendingAlertOpen, setIsPendingAlertOpen] = useState(false);
  const [alertType, setAlertType] = useState<"allergy" | "condition" | "medication" | "other">("allergy");
  const [alertDescription, setAlertDescription] = useState("");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [isAlertSubmitting, setIsAlertSubmitting] = useState(false);

  const loadPatient = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getReceptionPatient(patientId, accessToken);
      setPatient(data);
      setPhone(data.phone);
      setEmail(data.email || "");
      setNotes(data.notes || "");
      setFileNumber(data.fileNumber || "");
      setGuardianName(data.guardianName || "");
      setGuardianPhone(data.guardianPhone || "");
      setGuardianRelationship(data.guardianRelationship || "");
      setEmergencyContactName(data.emergencyContactName || "");
      setEmergencyContactPhone(data.emergencyContactPhone || "");
      setEmergencyContactRelationship(data.emergencyContactRelationship || "");
      setPreferredChannel(((data.preferredChannel as "sms" | "whatsapp" | "none") || "sms"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load patient chart.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (active && patientId) {
        loadPatient();
      }
    };
    void load();
    return () => {
      active = false;
    };
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
          preferredChannel,
          fileNumber: fileNumber.trim() || undefined,
          guardianName: guardianName.trim() || undefined,
          guardianPhone: guardianPhone.trim() || undefined,
          guardianRelationship: guardianRelationship.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: emergencyContactPhone.trim() || undefined,
          emergencyContactRelationship: emergencyContactRelationship.trim() || undefined,
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
          patientId: patient.id,
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

  const handleCreatePatientTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !patient) return;

    try {
      await createReceptionTask(
        {
          title: taskTitle,
          description: taskDescription || undefined,
          priority: taskPriority,
          patientId: patient.id,
          status: "pending",
        },
        accessToken
      );
      setIsTaskOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      await loadPatient();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create task.");
    }
  };

  const handleRecordPendingAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertDescription.trim() || !patient) return;
    setIsAlertSubmitting(true);
    try {
      await recordReceptionPendingAlert(
        patient.id,
        {
          type: alertType,
          description: alertDescription.trim(),
        },
        accessToken
      );
      setAlertDescription("");
      setAlertSuccess("Pending alert logged. The attending clinician will be prompted to confirm or dismiss it.");
      setTimeout(() => {
        setIsPendingAlertOpen(false);
        setAlertSuccess(null);
      }, 2000);
      await loadPatient();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to record pending alert.");
    } finally {
      setIsAlertSubmitting(false);
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
            {patient.fileNumber && (
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {patient.fileNumber}
              </span>
            )}
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 uppercase">
              Channel: {patient.preferredChannel || "sms"}
            </span>
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

          <button
            onClick={() => setIsTaskOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs cursor-pointer transition-colors"
          >
            <ListTodo className="h-3.5 w-3.5 text-primary" />
            <span>Create Task</span>
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
              {patient.fileNumber && (
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-gray-500">File Number:</span>
                  <span className="font-mono font-bold text-primary">{patient.fileNumber}</span>
                </div>
              )}
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

              {(patient.guardianName || patient.guardianPhone) && (
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-900 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-sky-800 dark:text-sky-300 block">Parent / Guardian</span>
                  <p className="font-semibold text-gray-900 dark:text-white">{patient.guardianName} ({patient.guardianRelationship || "Guardian"})</p>
                  <p className="font-mono text-sky-700 dark:text-sky-400">{patient.guardianPhone}</p>
                </div>
              )}

              {(patient.emergencyContactName || patient.emergencyContactPhone) && (
                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-1">
                  <span className="text-[10px] font-mono uppercase font-bold text-gray-500 block">Emergency Contact</span>
                  <p className="font-semibold text-gray-900 dark:text-white">{patient.emergencyContactName} ({patient.emergencyContactRelationship || "Contact"})</p>
                  <p className="font-mono text-gray-600 dark:text-gray-400">{patient.emergencyContactPhone}</p>
                </div>
              )}

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

          {/* Medical Alerts (Front Desk View & Capture) */}
          <div className="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Medical Alerts
              </h2>
              {patient.hasAlerts ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  Alerts on file
                </span>
              ) : (
                <span className="text-[11px] text-gray-400 font-mono">None on file</span>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Clinical details are restricted to clinicians. Front desk staff record unconfirmed alerts for doctor review.
            </p>
            <button
              type="button"
              onClick={() => setIsPendingAlertOpen(true)}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-xs font-medium hover:bg-amber-100/50 dark:hover:bg-amber-900/40 transition-colors cursor-pointer"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Report Allergy / Condition</span>
            </button>
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

      <PatientBillingSection
        patientId={patient.id}
        patientName={patient.fullName}
        bookings={[...patient.upcomingBookings, ...patient.pastBookings]}
      />

      {/* Patient Consent & Document Attachments (Reception-Scoped: consent & other) */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
        <PatientAttachmentsTab
          patientId={patient.id}
          role="receptionist"
          patientName={patient.fullName}
        />
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
                  <label className="font-medium text-gray-700 dark:text-gray-300">File Number</label>
                  <input
                    type="text"
                    value={fileNumber}
                    onChange={(e) => setFileNumber(e.target.value)}
                    placeholder="e.g. MD-0001"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono focus:border-primary"
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Preferred Channel</label>
                  <select
                    value={preferredChannel}
                    onChange={(e) => setPreferredChannel(e.target.value as "sms" | "whatsapp" | "none")}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary text-xs"
                  >
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="none">None (Opt-Out)</option>
                  </select>
                </div>
              </div>

              {/* Parent / Guardian */}
              <div className="p-3 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 space-y-2">
                <span className="font-semibold text-sky-900 dark:text-sky-300 block text-[11px]">Parent / Guardian Information</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-mono">Name</label>
                    <input
                      type="text"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      placeholder="Guardian name"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-mono">Phone</label>
                    <input
                      type="tel"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-mono">Relationship</label>
                    <input
                      type="text"
                      value={guardianRelationship}
                      onChange={(e) => setGuardianRelationship(e.target.value)}
                      placeholder="Mother, Father..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/20 space-y-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300 block text-[11px]">Emergency Contact</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-mono">Name</label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="Contact name"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-mono">Phone</label>
                    <input
                      type="tel"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="Phone"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-mono">Relationship</label>
                    <input
                      type="text"
                      value={emergencyContactRelationship}
                      onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                      placeholder="Spouse, Sibling..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs"
                    />
                  </div>
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

      {/* Create Task Modal */}
      {isTaskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-display font-semibold text-gray-900 dark:text-white">
                Create Patient Task
              </h2>
              <button
                onClick={() => setIsTaskOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatientTask} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule 6-month cleaning recall"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as "low" | "medium" | "high" | "urgent")}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Description</label>
                <textarea
                  rows={2}
                  placeholder="Additional context or notes..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTaskOpen(false)}
                  className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Pending Medical Alert Modal (Front Desk Capture) */}
      {isPendingAlertOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-display font-semibold text-gray-900 dark:text-white">
                  Report Patient Allergy / Condition
                </h2>
              </div>
              <button
                onClick={() => {
                  setIsPendingAlertOpen(false);
                  setAlertSuccess(null);
                }}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-0.5">Front Desk Medical Alert Capture Policy</p>
              <p>
                Reception cannot confirm clinical alerts. This record will be submitted as an <strong>unconfirmed pending alert</strong>. The attending clinician will be prompted to review and confirm it prior to treatment.
              </p>
            </div>

            {alertSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300">
                {alertSuccess}
              </div>
            )}

            <form onSubmit={handleRecordPendingAlert} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Category *</label>
                <select
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value as "allergy" | "condition" | "medication" | "other")}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary text-xs"
                >
                  <option value="allergy">Allergy (e.g. Penicillin, Latex, Local Anesthetic)</option>
                  <option value="condition">Medical Condition (e.g. Asthma, Diabetes, Hypertension, Bleeding Disorder)</option>
                  <option value="medication">Current Medication (e.g. Anticoagulants, Bisphosphonates)</option>
                  <option value="other">Other Clinical Risk / Concern</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">
                  Patient-Reported Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Severe hives from penicillin; diagnosed 5 years ago..."
                  value={alertDescription}
                  onChange={(e) => setAlertDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPendingAlertOpen(false);
                    setAlertSuccess(null);
                  }}
                  className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAlertSubmitting || !alertDescription.trim()}
                  className="px-4 py-2 rounded-full bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isAlertSubmitting ? "Logging..." : "Log Pending Alert"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
