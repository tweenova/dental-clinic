"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Filter,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";

import {
  convertReceptionLead,
  createReceptionLead,
  getReceptionLeads,
  ReceptionLead,
  updateReceptionLeadStatus,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionLeadsPage() {
  const router = useRouter();
  const { accessToken } = useAuth();

  const [leads, setLeads] = useState<ReceptionLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // New Lead Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadLeads = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionLeads(statusFilter || undefined, accessToken);
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [statusFilter, accessToken]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !phone.trim()) return;

    setIsSubmitting(true);
    try {
      await createReceptionLead(
        {
          firstName,
          lastName,
          phone,
          email: email || undefined,
          notes: notes || undefined,
        },
        accessToken
      );
      setIsModalOpen(false);
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setNotes("");
      await loadLeads();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create lead.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvert = async (leadId: string) => {
    setActionLoadingId(leadId);
    try {
      const res = await convertReceptionLead(leadId, accessToken);
      alert(res.message || "Lead successfully converted to Patient!");
      router.push(`/reception/patients/${res.patientId}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to convert lead.");
      setActionLoadingId(null);
    }
  };

  const handleStatusChange = async (leadId: string, status: string) => {
    try {
      await updateReceptionLeadStatus(leadId, status, accessToken);
      await loadLeads();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update lead status.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Prospective Patient Leads
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Track inquiries, phone call leads, and convert prospects directly into registered patient charts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>New Lead</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-1">
          {[
            { id: "", label: "All Leads" },
            { id: "new", label: "New" },
            { id: "contacted", label: "Contacted" },
            { id: "qualified", label: "Qualified" },
            { id: "converted", label: "Converted" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                statusFilter === tab.id
                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Leads List */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <UserX className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No leads found
            </p>
            <p className="text-xs text-gray-500">Click &quot;New Lead&quot; to register an inquiry.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {leads.map((l) => (
              <div
                key={l.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      {l.fullName}
                    </span>
                    <span
                      className={`
                        px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold
                        ${
                          l.status === "new"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : l.status === "contacted"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : l.status === "qualified"
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                            : l.status === "converted"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        }
                      `}
                    >
                      {l.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      <a href={`tel:${l.phone}`} className="hover:underline">
                        {l.phone}
                      </a>
                    </span>
                    {l.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-blue-600" />
                        <span>{l.email}</span>
                      </span>
                    )}
                  </div>

                  {l.notes && (
                    <p className="text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      {l.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {l.status !== "converted" && (
                    <>
                      {l.status === "new" && (
                        <button
                          onClick={() => handleStatusChange(l.id, "contacted")}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 font-medium"
                        >
                          Mark Contacted
                        </button>
                      )}

                      <button
                        onClick={() => handleConvert(l.id)}
                        disabled={actionLoadingId === l.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-xs"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>Convert to Patient Chart</span>
                      </button>
                    </>
                  )}

                  {l.status === "converted" && l.convertedPatientId && (
                    <Link
                      href={`/reception/patients/${l.convertedPatientId}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-50"
                    >
                      <span>Open Patient Chart</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Lead Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-display font-semibold text-gray-900 dark:text-white">
                Register Inbound Lead
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Phone *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+1-555-0199"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-gray-700 dark:text-gray-300">Email</label>
                  <input
                    type="email"
                    placeholder="prospect@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-gray-700 dark:text-gray-300">Inquiry Notes</label>
                <textarea
                  rows={2}
                  placeholder="Inquiry reason, cosmetic interest, emergency pain, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold"
                >
                  {isSubmitting ? "Saving..." : "Save Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
