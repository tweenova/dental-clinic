"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Edit,
  GraduationCap,
  Plus,
  ShieldCheck,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminCreateTeamMember,
  adminGetLocations,
  adminGetTeam,
  adminToggleTeamMemberStatus,
  adminUpdateTeamMember,
  adminUploadMedia,
  LocationItem,
  TeamMember,
} from "@/lib/api";

const ROLES = [
  "Director",
  "Dentist",
  "Orthodontist",
  "Endodontist",
  "Oral Surgeon",
  "Pediatric Dentist",
  "Hygienist",
  "Dental Assistant",
  "Practice Manager",
];

export default function AdminTeamPage() {
  const { accessToken } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    firstName: string;
    lastName: string;
    displayName: string;
    professionalTitle: string;
    role: string;
    specialties: string;
    biography: string;
    education: string;
    credentials: string;
    licenseNumber: string;
    licenseState: string;
    photoUrl: string;
    locationId: string | null;
    displayOrder: number;
  }>({
    firstName: "",
    lastName: "",
    displayName: "",
    professionalTitle: "",
    role: "Dentist",
    specialties: "",
    biography: "",
    education: "",
    credentials: "",
    licenseNumber: "",
    licenseState: "Illinois",
    photoUrl: "",
    locationId: null,
    displayOrder: 0,
  });

  const [isUploading, setIsUploading] = useState(false);

  const loadData = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const [teamData, locData] = await Promise.all([
        adminGetTeam(accessToken),
        adminGetLocations(accessToken).catch(() => []),
      ]);
      setTeam(teamData);
      setLocations(locData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load team data.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      firstName: "",
      lastName: "",
      displayName: "",
      professionalTitle: "",
      role: "Dentist",
      specialties: "",
      biography: "",
      education: "",
      credentials: "",
      licenseNumber: "",
      licenseState: "Illinois",
      photoUrl: "",
      locationId: locations[0]?.id || null,
      displayOrder: team.length,
    });
    setShowModal(true);
  };

  const openEditModal = (member: TeamMember) => {
    setEditingId(member.id);
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      displayName: member.displayName,
      professionalTitle: member.professionalTitle,
      role: member.role,
      specialties: member.specialties.join(", "),
      biography: member.biography || "",
      education: member.education || "",
      credentials: member.credentials || "",
      licenseNumber: member.licenseNumber || "",
      licenseState: member.licenseState || "Illinois",
      photoUrl: member.photoUrl || "",
      locationId: member.locationId || null,
      displayOrder: member.displayOrder,
    });
    setShowModal(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      const res = await adminUploadMedia(file, accessToken);
      setForm((prev) => ({ ...prev, photoUrl: res.url }));
      setSuccessMessage("Photo uploaded successfully.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload photo.";
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setErrorMessage(null);

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      displayName: form.displayName.trim() || `${form.firstName} ${form.lastName}`.trim(),
      professionalTitle: form.professionalTitle.trim(),
      role: form.role,
      specialties: form.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      biography: form.biography.trim() || null,
      education: form.education.trim() || null,
      credentials: form.credentials.trim() || null,
      licenseNumber: form.licenseNumber.trim() || null,
      licenseState: form.licenseState.trim() || null,
      photoUrl: form.photoUrl.trim() || null,
      locationId: form.locationId || null,
      displayOrder: Number(form.displayOrder) || 0,
      isActive: true,
    };

    try {
      if (editingId) {
        await adminUpdateTeamMember(editingId, payload, accessToken);
        setSuccessMessage("Team member updated successfully.");
      } else {
        await adminCreateTeamMember(payload, accessToken);
        setSuccessMessage("New team member added successfully.");
      }
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save team member.";
      setErrorMessage(msg);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!accessToken) return;
    try {
      await adminToggleTeamMemberStatus(id, !currentStatus, accessToken);
      setSuccessMessage(`Team member ${currentStatus ? "deactivated" : "reactivated"}.`);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to toggle status.";
      setErrorMessage(msg);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Bar */}
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Clinical Operations</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Team &amp; Clinicians
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Manage clinical directors, dentists, dental hygienists, and support staff.
          </p>
        </div>

        <Button onClick={openAddModal} variant="primary" size="sm">
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          <span>Add Team Member</span>
        </Button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 p-4 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
        >
          <Check className="h-4 w-4" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-4 text-xs font-medium text-red-800 dark:text-red-300"
        >
          {errorMessage}
        </div>
      )}

      {/* Team Members List */}
      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {team.map((member) => (
            <Card
              key={member.id}
              surface={member.isActive ? "cream" : "bone"}
              shadow="subtle"
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-4">
                {/* Photo Thumbnail */}
                <div className="h-16 w-16 rounded-full overflow-hidden border border-line bg-sand/40 shrink-0">
                  {member.photoUrl ? (
                    <img
                      src={member.photoUrl}
                      alt={member.displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-ink-soft">
                      <Users className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display text-base text-ink font-semibold">
                      {member.displayName}
                    </h3>
                    <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-[10.5px] font-semibold text-forest uppercase">
                      {member.role}
                    </span>
                    {member.isActive ? (
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                        Deactivated / Inactive
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-ink-soft font-medium">
                    {member.professionalTitle}
                  </p>

                  {member.licenseNumber && (
                    <p className="text-[11px] text-ink-soft/80 font-mono">
                      License: {member.licenseNumber} ({member.licenseState || "IL"})
                    </p>
                  )}

                  {member.locationId && (
                    <p className="text-[11px] text-forest dark:text-emerald-400 font-medium">
                      Location: {locations.find((l) => l.id === member.locationId)?.name || "Assigned Facility"}
                    </p>
                  )}

                  {member.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {member.specialties.map((spec, i) => (
                        <span
                          key={i}
                          className="rounded bg-sand/60 px-1.5 py-0.5 text-[10px] text-clay font-medium"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button onClick={() => openEditModal(member)} variant="secondary" size="sm">
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  <span>Edit</span>
                </Button>

                <Button
                  onClick={() => handleToggleStatus(member.id, member.isActive)}
                  variant="secondary"
                  size="sm"
                >
                  <span>{member.isActive ? "Deactivate" : "Reactivate"}</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Dialog for Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl my-8">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-line dark:border-gray-800 pb-3">
                <h3 className="font-display text-xl text-ink dark:text-white font-semibold">
                  {editingId ? "Edit Team Member" : "Add Team Member"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="rounded-full p-1.5 text-xs text-ink-soft hover:text-ink hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="member-first"
                    label="First Name"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                    required
                  />
                  <TextField
                    id="member-last"
                    label="Last Name"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="member-display"
                    label="Display Name (e.g. Dr. Sarah Marlow, DDS)"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    placeholder="Dr. Sarah Marlow, DDS"
                    required
                  />
                  <TextField
                    id="member-title"
                    label="Professional Title"
                    value={form.professionalTitle}
                    onChange={(e) => setForm({ ...form, professionalTitle: e.target.value })}
                    placeholder="Founder & Lead Dentist"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="member-role" className="block text-xs font-medium text-ink dark:text-gray-300 mb-1.5">
                      Role Category
                    </label>
                    <select
                      id="member-role"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full rounded-2xl border border-line dark:border-gray-700 bg-cream/70 dark:bg-gray-800/80 px-4 py-3 text-xs text-ink dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <TextField
                    id="member-credentials"
                    label="Credentials (e.g. DDS, DMD, RDH)"
                    value={form.credentials}
                    onChange={(e) => setForm({ ...form, credentials: e.target.value })}
                    placeholder="DDS"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="member-specialties"
                    label="Specialties (comma-separated)"
                    value={form.specialties}
                    onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                    placeholder="General Dentistry, Invisalign, Restorative Care"
                  />

                  <div>
                    <label htmlFor="member-location" className="block text-xs font-medium text-ink dark:text-gray-300 mb-1.5">
                      Assigned Facility / Clinic
                    </label>
                    <select
                      id="member-location"
                      value={form.locationId || ""}
                      onChange={(e) => setForm({ ...form, locationId: e.target.value || null })}
                      className="w-full rounded-2xl border border-line dark:border-gray-700 bg-cream/70 dark:bg-gray-800/80 px-4 py-3 text-xs text-ink dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Practice-wide / All Facilities</option>
                      {locations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} ({loc.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="member-bio" className="block text-xs font-medium text-ink dark:text-gray-300 mb-1.5">
                    Biography
                  </label>
                  <textarea
                    id="member-bio"
                    rows={4}
                    value={form.biography}
                    onChange={(e) => setForm({ ...form, biography: e.target.value })}
                    className="w-full rounded-2xl border border-line dark:border-gray-700 bg-cream/70 dark:bg-gray-800/80 px-4 py-3 text-xs text-ink dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="member-education"
                    label="Education / Alma Mater"
                    value={form.education}
                    onChange={(e) => setForm({ ...form, education: e.target.value })}
                    placeholder="University of Michigan School of Dentistry"
                  />
                  <TextField
                    id="member-license"
                    label="License Number"
                    value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                    placeholder="#019.029811"
                  />
                </div>

                {/* Photo & Upload */}
                <div className="space-y-2">
                  <TextField
                    id="member-photo"
                    label="Photo URL"
                    value={form.photoUrl}
                    onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                    placeholder="https://... or upload local image below"
                  />

                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 rounded-full border border-line dark:border-gray-700 bg-sand/60 dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-ink dark:text-gray-200 cursor-pointer hover:bg-sand dark:hover:bg-gray-700 transition-colors">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isUploading ? "Uploading..." : "Upload photo file"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                        disabled={isUploading}
                      />
                    </label>
                    {form.photoUrl && (
                      <span className="text-[11px] text-forest font-mono truncate max-w-[200px]">
                        Attached: {form.photoUrl}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-line dark:border-gray-800 flex justify-end gap-2.5">
                  <Button type="button" variant="secondary" size="sm" className="rounded-full px-5" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" className="rounded-full px-5">
                    {editingId ? "Update Member" : "Save Team Member"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
