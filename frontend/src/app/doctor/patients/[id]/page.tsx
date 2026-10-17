"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Mail,
  Phone,
  ShieldAlert,
  User,
} from "lucide-react";

import {
  DoctorPatientDetail,
  getDoctorPatientDetail,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DentalChart } from "@/components/doctor/dental-chart";
import { ClinicalAlertBanner } from "@/components/doctor/clinical-alert-banner";
import TreatmentPlanTab from "@/components/doctor/treatment-plan-tab";
import { ClinicalDocumentsTab } from "@/components/doctor/clinical-documents-tab";
import { PatientAttachmentsTab } from "@/components/clinical/patient-attachments-tab";

export default function DoctorPatientDetailPage() {
  const params = useParams();
  const patientId = params?.id as string;
  const { accessToken } = useAuth();
  const directory = useDirectory();

  const [patient, setPatient] = useState<DoctorPatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "chart" | "treatment-plan" | "documents" | "attachments" | "encounters"
  >("overview");

  const loadPatient = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getDoctorPatientDetail(patientId, accessToken);
      setPatient(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load patient details.");
    } finally {
      setIsLoading(false);
    }
  }, [patientId, accessToken]);

  useEffect(() => {
    if (!patientId) return;
    let isMounted = true;
    getDoctorPatientDetail(patientId, accessToken)
      .then((data) => {
        if (isMounted) setPatient(data);
      })
      .catch((err: unknown) => {
        if (isMounted) setError(err instanceof Error ? err.message : "Failed to load patient details.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [patientId, accessToken]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-sm text-ink-soft font-mono">
        Loading patient clinical record...
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-4">
        <Link
          href="/doctor/patients"
          className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Patients</span>
        </Link>
        <Card className="p-8 text-center space-y-3">
          <ShieldAlert className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-sm font-semibold text-ink">Failed to load patient record</p>
          <p className="text-xs text-ink-soft">{error || "Patient not found."}</p>
          <Button variant="secondary" size="sm" onClick={loadPatient}>
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Link & Header */}
      <div className="space-y-3">
        <Link
          href="/doctor/patients"
          className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Patients</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-display font-semibold text-lg">
              {patient.firstName?.[0] || <User className="h-6 w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-display text-ink font-semibold">
                  {patient.fullName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-sand text-ink-soft border border-line">
                  MRN #{patient.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                Clinical summary, odontogram charting, and encounter history.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/doctor">
              <Button variant="secondary" size="sm">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                <span>Today&apos;s Schedule</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Clinical Medical Alert & Allergy Safety Banner */}
      <ClinicalAlertBanner patientId={patient.id} onAlertsChange={loadPatient} />

      {/* Workspace Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === "overview"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-sand/60"
          }`}
        >
          Clinical Summary & Visits
        </button>
        <button
          onClick={() => setActiveTab("chart")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === "chart"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-sand/60"
          }`}
        >
          Odontogram Dental Chart
        </button>
        <button
          onClick={() => setActiveTab("treatment-plan")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === "treatment-plan"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-sand/60"
          }`}
        >
          Treatment Plan
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === "documents"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-sand/60"
          }`}
        >
          Prescriptions & Referrals
        </button>
        <button
          onClick={() => setActiveTab("attachments")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === "attachments"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-sand/60"
          }`}
        >
          Attachments & Consents
        </button>
        <button
          onClick={() => setActiveTab("encounters")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
            activeTab === "encounters"
              ? "bg-primary text-white"
              : "text-ink-soft hover:text-ink hover:bg-sand/60"
          }`}
        >
          Encounters ({patient.encounters.length})
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Demographics Card */}
          <Card className="p-5 space-y-4 md:col-span-1">
            <h2 className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">
              Patient Demographics
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-2.5 text-ink">
                <Phone className="h-4 w-4 text-ink-soft shrink-0" />
                <span className="font-mono">{patient.phone}</span>
              </div>
              <div className="flex items-center gap-2.5 text-ink">
                <Mail className="h-4 w-4 text-ink-soft shrink-0" />
                <span>{patient.email || "No email on file"}</span>
              </div>
              <div className="flex items-center gap-2.5 text-ink">
                <Calendar className="h-4 w-4 text-ink-soft shrink-0" />
                <span>DOB: {patient.dateOfBirth || "Not recorded"}</span>
              </div>
            </div>

            {patient.notes && (
              <div className="pt-3 border-t border-line">
                <p className="text-[11px] font-medium text-ink-soft mb-1 font-mono uppercase">
                  Staff Notes
                </p>
                <p className="text-xs text-ink bg-sand/30 p-2.5 rounded-lg border border-line">
                  {patient.notes}
                </p>
              </div>
            )}
          </Card>

          {/* Visit History Card */}
          <Card className="p-5 space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">
                Visit History ({patient.visits.length})
              </h2>
            </div>

            {patient.visits.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-soft font-mono">
                No past or scheduled visits recorded for this patient.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line text-ink-soft uppercase font-mono text-[10px]">
                    <tr>
                      <th className="pb-2">Date & Time</th>
                      <th className="pb-2">Service</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {patient.visits.map((v) => (
                      <tr key={v.id} className="py-2.5">
                        <td className="py-2.5 font-mono text-ink">
                          {v.bookingDate} at {v.bookingTime}
                        </td>
                        <td className="py-2.5 text-ink-soft">
                          {directory.serviceName(v.serviceId) || "Clinical Visit"}
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-sand text-ink border border-line">
                            {v.status.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Dental Chart */}
      {activeTab === "chart" && (
        <div>
          <DentalChart
            patientId={patient.id}
            patientName={patient.fullName}
            encounterId={patient.encounters[0]?.id || patient.id}
            token={accessToken}
            onUpdate={loadPatient}
          />
        </div>
      )}

      {/* Tab: Treatment Plan */}
      {activeTab === "treatment-plan" && (
        <TreatmentPlanTab
          patientId={patient.id}
          patientName={patient.fullName}
          patientFileNumber={patient.fileNumber || undefined}
          onRefreshParent={loadPatient}
        />
      )}

      {/* Tab: Prescriptions & Referrals */}
      {activeTab === "documents" && (
        <ClinicalDocumentsTab
          encounterId={patient.encounters[0]?.id || patient.id}
          patientId={patient.id}
          patientName={patient.fullName}
        />
      )}

      {/* Tab: Attachments & Consents */}
      {activeTab === "attachments" && (
        <PatientAttachmentsTab
          patientId={patient.id}
          role="doctor"
          patientName={patient.fullName}
        />
      )}

      {/* Tab: Encounters */}
      {activeTab === "encounters" && (
        <Card className="p-5 space-y-4">
          <h2 className="text-xs font-semibold text-ink uppercase tracking-wider font-mono">
            Clinical Encounters ({patient.encounters.length})
          </h2>

          {patient.encounters.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-soft font-mono">
              No clinical encounters recorded yet. Start a visit from the Daily Schedule.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line text-ink-soft uppercase font-mono text-[10px]">
                  <tr>
                    <th className="pb-2">Encounter ID</th>
                    <th className="pb-2">Started</th>
                    <th className="pb-2">Ended</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {patient.encounters.map((e) => (
                    <tr key={e.id} className="py-2.5">
                      <td className="py-2.5 font-mono text-ink">
                        {e.id.slice(0, 8)}...
                      </td>
                      <td className="py-2.5 font-mono text-ink-soft">
                        {new Date(e.startedAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 font-mono text-ink-soft">
                        {e.endedAt ? new Date(e.endedAt).toLocaleString() : "Active / Ongoing"}
                      </td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-primary/10 text-primary border border-primary/20">
                          {e.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
