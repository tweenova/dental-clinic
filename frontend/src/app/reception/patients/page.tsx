"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Plus,
  Search,
  User,
  Users,
  X,
} from "lucide-react";

import {
  createReceptionPatient,
  ReceptionPatient,
  searchReceptionPatients,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionPatientsPage() {
  const { accessToken } = useAuth();

  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<ReceptionPatient[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Create Patient Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [fileNumber, setFileNumber] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("");
  const [notes, setNotes] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<"sms" | "whatsapp" | "none">("sms");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null;
    try {
      const [y, m, d] = birthDate.split("-").map(Number);
      const today = new Date();
      let age = today.getFullYear() - y;
      const mDiff = today.getMonth() - (m - 1);
      if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) {
        age--;
      }
      return age;
    } catch {
      return null;
    }
  };

  const patientAge = calculateAge(dob);
  const isMinor = patientAge !== null && patientAge < 18;

  const loadPatients = async (query = search) => {
    setIsLoading(true);
    try {
      const data = await searchReceptionPatients({ search: query, limit: 20 }, accessToken);
      setPatients(data.items);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      await Promise.resolve();
      if (active) {
        loadPatients();
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const handleCreatePatient = async (bypass = false) => {
    setIsSubmitting(true);
    setDuplicateWarning(null);
    try {
      await createReceptionPatient(
        {
          firstName,
          lastName,
          phone,
          email: email || undefined,
          dateOfBirth: dob || undefined,
          notes: notes || undefined,
          preferredChannel,
          fileNumber: fileNumber.trim() || undefined,
          guardianName: guardianName.trim() || undefined,
          guardianPhone: guardianPhone.trim() || undefined,
          guardianRelationship: guardianRelationship.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: emergencyContactPhone.trim() || undefined,
          emergencyContactRelationship: emergencyContactRelationship.trim() || undefined,
          bypassDuplicateCheck: bypass,
        },
        accessToken
      );
      setIsModalOpen(false);
      resetForm();
      await loadPatients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create patient.";
      if (msg.includes("already exists") || msg.includes("Duplicate")) {
        setDuplicateWarning(msg);
      } else {
        alert(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setDob("");
    setFileNumber("");
    setGuardianName("");
    setGuardianPhone("");
    setGuardianRelationship("");
    setEmergencyContactName("");
    setEmergencyContactPhone("");
    setEmergencyContactRelationship("");
    setNotes("");
    setPreferredChannel("sms");
    setDuplicateWarning(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Patient Directory
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Search patient records, verify contact info, and create new patient charts with duplicate safeguards.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>New Patient</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by patient name, phone, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              loadPatients(e.target.value);
            }}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white focus:border-primary"
          />
        </div>
        <span className="text-xs font-mono text-gray-400 shrink-0 px-2">
          {total} record{total === 1 ? "" : "s"}
        </span>
      </div>

      {/* Patients Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Searching patient database...
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No patients found
            </p>
            <p className="text-xs text-gray-500">Try searching with a different term or register a new patient.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">File #</th>
                  <th className="px-5 py-3.5">Patient Name</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Date of Birth</th>
                  <th className="px-5 py-3.5 text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-4 font-mono font-semibold text-primary">
                      {p.fileNumber || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/reception/patients/${p.id}`}
                          className="font-semibold text-primary hover:underline flex items-center gap-1.5"
                        >
                          <User className="h-3.5 w-3.5" />
                          <span>{p.fullName}</span>
                        </Link>
                        {p.hasAlerts && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Alerts on file
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-gray-700 dark:text-gray-300">
                      {p.phone}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {p.email || "—"}
                    </td>
                    <td className="px-5 py-4 font-mono text-gray-500">
                      {p.dateOfBirth || "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/reception/patients/${p.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <span>Open Chart</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Patient Modal with Duplicate Detection Safeguard */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-base font-display font-semibold text-gray-900 dark:text-white">
                Register New Patient
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {duplicateWarning && (
              <div className="p-3.5 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-xs space-y-2">
                <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-semibold">Potential Duplicate Match Detected</strong>
                    <p>{duplicateWarning}</p>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCreatePatient(true)}
                    className="px-3.5 py-1.5 rounded-full bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors cursor-pointer"
                  >
                    Bypass & Create Anyway
                  </button>
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreatePatient(false);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    File Number <span className="text-[10px] text-gray-400 font-normal">(Auto-generated if blank)</span>
                  </label>
                  <input
                    type="text"
                    value={fileNumber}
                    onChange={(e) => setFileNumber(e.target.value)}
                    placeholder="e.g. MD-0001"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-mono text-gray-900 dark:text-white focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-mono text-gray-900 dark:text-white focus:border-primary"
                  />
                </div>
              </div>

              {/* Minor / Guardian Information */}
              {isMinor && (
                <div className="p-3.5 rounded-2xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-xs space-y-3">
                  <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="font-semibold">Minor Patient ({patientAge} years old) — Parent / Guardian Information Required</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] uppercase font-mono font-medium text-sky-900 dark:text-sky-200">Guardian Name *</label>
                      <input
                        type="text"
                        required={isMinor}
                        value={guardianName}
                        onChange={(e) => setGuardianName(e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono font-medium text-sky-900 dark:text-sky-200">Guardian Phone *</label>
                      <input
                        type="tel"
                        required={isMinor}
                        value={guardianPhone}
                        onChange={(e) => setGuardianPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-900 text-xs font-mono text-gray-900 dark:text-white focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono font-medium text-sky-900 dark:text-sky-200">Relationship *</label>
                      <input
                        type="text"
                        required={isMinor}
                        value={guardianRelationship}
                        onChange={(e) => setGuardianRelationship(e.target.value)}
                        placeholder="Mother, Father, etc."
                        className="w-full px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-800 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:border-primary"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +92 300 1234567"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-mono text-gray-900 dark:text-white focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="patient@example.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white focus:border-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Preferred Channel
                  </label>
                  <select
                    value={preferredChannel}
                    onChange={(e) => setPreferredChannel(e.target.value as "sms" | "whatsapp" | "none")}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white focus:border-primary"
                  >
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="none">None (Opt-out)</option>
                  </select>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 text-xs space-y-3">
                <span className="font-semibold text-gray-700 dark:text-gray-300 block">Emergency Contact (Optional)</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] uppercase font-mono font-medium text-gray-500">Contact Name</label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="Full name"
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-mono font-medium text-gray-500">Contact Phone</label>
                    <input
                      type="tel"
                      value={emergencyContactPhone}
                      onChange={(e) => setEmergencyContactPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-mono text-gray-900 dark:text-white focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-mono font-medium text-gray-500">Relationship</label>
                    <input
                      type="text"
                      value={emergencyContactRelationship}
                      onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                      placeholder="Spouse, Sibling, etc."
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white focus:border-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Administrative Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Pre-med requirements, preferred appointment times, etc."
                  className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs text-gray-900 dark:text-white focus:border-primary"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  {isSubmitting ? "Creating..." : "Save Patient Chart"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
