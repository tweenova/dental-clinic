"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Edit,
  Layers,
  Plus,
  Tag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminCreateService,
  adminGetServices,
  adminReorderServices,
  adminToggleServiceStatus,
  adminUpdateService,
  getTeamMembers,
  ServiceItem,
  TeamMember,
} from "@/lib/api";

const CATEGORIES = [
  { id: "preventive", label: "Preventive Care" },
  { id: "restorative", label: "Restorative" },
  { id: "cosmetic", label: "Cosmetic" },
  { id: "emergency", label: "Emergency Triage" },
];

export default function AdminServicesPage() {
  const { accessToken } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    slug: "",
    category: "preventive",
    title: "",
    shortDesc: "",
    fullDesc: "",
    cashPrice: "",
    duration: "",
    code: "",
    insuranceNote: "",
    recommendedInterval: "",
    recallIntervalDays: 180 as number | undefined,
    displayOrder: 0,
    isHighlighted: false,
    isPublic: true,
    bookableOnline: true,
    bufferMinutes: 0,
    providerIds: [] as string[],
  });

  const loadServices = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const data = await adminGetServices(accessToken);
      setServices(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load services.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadServices();
      getTeamMembers()
        .then((members) => setTeamMembers(members.filter((m) => m.isActive)))
        .catch(() => {});
    });
  }, [accessToken]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      slug: "",
      category: "preventive",
      title: "",
      shortDesc: "",
      fullDesc: "",
      cashPrice: "",
      duration: "45 min",
      code: "SRV-01",
      insuranceNote: "",
      recommendedInterval: "Every 6 months",
      recallIntervalDays: 180,
      displayOrder: services.length,
      isHighlighted: false,
      isPublic: true,
      bookableOnline: true,
      bufferMinutes: 0,
      providerIds: [],
    });
    setShowModal(true);
  };

  const openEditModal = (service: any) => {
    setEditingId(service.id);
    setForm({
      slug: service.slug,
      category: service.category,
      title: service.title,
      shortDesc: service.shortDesc,
      fullDesc: service.fullDesc || "",
      cashPrice: service.cashPrice,
      duration: service.duration,
      code: service.code || "",
      insuranceNote: service.insuranceNote || "",
      recommendedInterval: service.recommendedInterval || "",
      recallIntervalDays: service.recallIntervalDays !== undefined && service.recallIntervalDays !== null ? Number(service.recallIntervalDays) : undefined,
      displayOrder: service.displayOrder,
      isHighlighted: service.isHighlighted,
      isPublic: service.isPublic,
      bookableOnline: service.bookableOnline !== false,
      bufferMinutes: service.bufferMinutes || 0,
      providerIds: service.providerIds || [],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setErrorMessage(null);

    const payload = {
      slug: form.slug.trim().toLowerCase(),
      category: form.category,
      title: form.title.trim(),
      shortDesc: form.shortDesc.trim(),
      fullDesc: form.fullDesc.trim() || null,
      cashPrice: form.cashPrice.trim(),
      duration: form.duration.trim(),
      code: form.code.trim() || null,
      insuranceNote: form.insuranceNote.trim() || null,
      recommendedInterval: form.recommendedInterval.trim() || null,
      recallIntervalDays: form.recallIntervalDays ? Number(form.recallIntervalDays) : null,
      displayOrder: Number(form.displayOrder) || 0,
      isHighlighted: Boolean(form.isHighlighted),
      isPublic: Boolean(form.isPublic),
      bookableOnline: Boolean(form.bookableOnline),
      bufferMinutes: Number(form.bufferMinutes) || 0,
      providerIds: form.providerIds,
      isActive: true,
    };

    try {
      if (editingId) {
        await adminUpdateService(editingId, payload, accessToken);
        setSuccessMessage("Service updated successfully.");
      } else {
        await adminCreateService(payload, accessToken);
        setSuccessMessage("New service added successfully.");
      }
      setShowModal(false);
      loadServices();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save service.");
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!accessToken) return;
    try {
      await adminToggleServiceStatus(id, !currentStatus, accessToken);
      setSuccessMessage(`Service ${currentStatus ? "deactivated" : "reactivated"}.`);
      loadServices();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to toggle status.");
    }
  };

  // Simple reorder control: swaps the service with its neighbour and persists
  // the full ordered ID list to PATCH /admin/services/reorder.
  const handleMove = async (index: number, direction: -1 | 1) => {
    if (!accessToken) return;
    const target = index + direction;
    if (target < 0 || target >= services.length) return;
    const ordered = [...services];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    try {
      await adminReorderServices(ordered.map((s) => s.id), accessToken);
      setServices(ordered);
      setSuccessMessage("Service display order saved.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to reorder services.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Bar */}
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Fee Transparency &amp; Procedures</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Services &amp; Pricing Catalog
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Manage procedures, CDT billing codes, upfront cash prices, and booking availability.
          </p>
        </div>

        <Button onClick={openAddModal} variant="primary" size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" />
          <span>Add Service</span>
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

      {/* Services List */}
      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {services.map((svc) => (
            <Card
              key={svc.id}
              surface={svc.isActive ? "cream" : "bone"}
              shadow="subtle"
              className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {svc.code && (
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-forest dark:text-emerald-400 font-semibold">
                      {svc.code}
                    </span>
                  )}
                  <span className="rounded-full bg-sand/60 px-2.5 py-0.5 text-[10.5px] font-semibold text-clay uppercase">
                    {svc.category}
                  </span>
                  {svc.isActive ? (
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                      Deactivated
                    </span>
                  )}
                  {svc.isHighlighted && (
                    <span className="rounded-full bg-forest text-[#FAF7F2] px-2 py-0.5 text-[10px] font-medium">
                      Featured
                    </span>
                  )}
                  {svc.bookableOnline !== false ? (
                    <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                      Online Bookable
                    </span>
                  ) : (
                    <span className="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                      Staff Scheduling Only
                    </span>
                  )}
                  {svc.bufferMinutes > 0 && (
                    <span className="rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                      +{svc.bufferMinutes}m buffer
                    </span>
                  )}
                  {svc.recallIntervalDays && (
                    <span className="rounded-full bg-sand px-2 py-0.5 text-[10px] font-mono font-medium text-clay">
                      {svc.recallIntervalDays}d recall
                    </span>
                  )}
                  {svc.providerIds && svc.providerIds.length > 0 && (
                    <span className="rounded-full bg-purple-100 dark:bg-purple-950 px-2 py-0.5 text-[10px] font-semibold text-purple-800 dark:text-purple-300">
                      {svc.providerIds.length} Clinician{svc.providerIds.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <h3 className="font-display text-base text-ink font-semibold">
                  {svc.title}
                </h3>

                <p className="text-xs text-ink-soft leading-relaxed max-w-2xl">
                  {svc.shortDesc}
                </p>

                <div className="flex items-center gap-4 text-xs text-ink-soft pt-1 font-mono">
                  <span className="flex items-center gap-1 font-semibold text-ink">
                    <Tag className="h-3 w-3 text-forest" />
                    {svc.cashPrice}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {svc.duration}
                  </span>
                  <span>slug: {svc.slug}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {/* Reorder controls: move the service up or down in the public list */}
                <div className="flex flex-col gap-0.5 mr-1" role="group" aria-label="Reorder service">
                  <button
                    type="button"
                    onClick={() => handleMove(services.indexOf(svc), -1)}
                    disabled={services.indexOf(svc) === 0}
                    aria-label={`Move ${svc.name} up`}
                    className="h-5 w-6 rounded border border-line text-ink-soft hover:text-ink hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(services.indexOf(svc), 1)}
                    disabled={services.indexOf(svc) === services.length - 1}
                    aria-label={`Move ${svc.name} down`}
                    className="h-5 w-6 rounded border border-line text-ink-soft hover:text-ink hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                  >
                    ▼
                  </button>
                </div>

                <Button onClick={() => openEditModal(svc)} variant="secondary" size="sm">
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  <span>Edit</span>
                </Button>

                <Button
                  onClick={() => handleToggleStatus(svc.id, svc.isActive)}
                  variant="secondary"
                  size="sm"
                >
                  <span>{svc.isActive ? "Deactivate" : "Reactivate"}</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Dialog for Add / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-xl my-8">
            <Card surface="cream" shadow="elevated" className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="font-display text-lg text-ink">
                  {editingId ? "Edit Service" : "Add Service"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-xs text-ink-soft hover:text-ink font-mono cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="service-slug"
                    label="Slug (URL key / Identifier)"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    placeholder="cleanings-exams"
                    required
                  />

                  <div>
                    <label htmlFor="service-cat" className="block text-xs font-medium text-ink mb-1.5">
                      Category
                    </label>
                    <select
                      id="service-cat"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2 text-xs text-ink"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <TextField
                  id="service-title"
                  label="Service Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Cleanings & Comprehensive Exam"
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <TextField
                    id="service-price"
                    label="Cash Price"
                    value={form.cashPrice}
                    onChange={(e) => setForm({ ...form, cashPrice: e.target.value })}
                    placeholder="from Rs 1,500"
                    required
                  />
                  <TextField
                    id="service-duration"
                    label="Estimated Duration"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="45 to 60 min"
                    required
                  />
                  <TextField
                    id="service-code"
                    label="CDT Billing Code"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="CDT D0150 / D1110"
                  />
                </div>

                <div>
                  <label htmlFor="service-short" className="block text-xs font-medium text-ink mb-1.5">
                    Short Description (Card Summary)
                  </label>
                  <textarea
                    id="service-short"
                    rows={2}
                    value={form.shortDesc}
                    onChange={(e) => setForm({ ...form, shortDesc: e.target.value })}
                    required
                    className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>

                <div>
                  <label htmlFor="service-full" className="block text-xs font-medium text-ink mb-1.5">
                    Full Description (Detail Modal / Expanded View)
                  </label>
                  <textarea
                    id="service-full"
                    rows={3}
                    value={form.fullDesc}
                    onChange={(e) => setForm({ ...form, fullDesc: e.target.value })}
                    className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="service-rec"
                    label="Recommended Interval Text"
                    value={form.recommendedInterval}
                    onChange={(e) => setForm({ ...form, recommendedInterval: e.target.value })}
                    placeholder="Every 6 months"
                  />
                  <TextField
                    id="service-recall-days"
                    label="Recall Interval (Days)"
                    type="number"
                    value={form.recallIntervalDays !== undefined ? String(form.recallIntervalDays) : ""}
                    onChange={(e) => setForm({ ...form, recallIntervalDays: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="e.g. 180 (or 90 for perio)"
                  />
                </div>

                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isHighlighted}
                      onChange={(e) => setForm({ ...form, isHighlighted: e.target.checked })}
                      className="rounded border-line text-forest focus:ring-forest"
                    />
                    <span>Highlight as Featured Treatment</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isPublic}
                      onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
                      className="rounded border-line text-forest focus:ring-forest"
                    />
                    <span>Show on Public Website</span>
                  </label>
                </div>

                {/* Online Booking & Clinician Assignment */}
                <div className="rounded-xl border border-line bg-cream/40 p-4 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Online Booking &amp; Clinician Assignment
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <label className="flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.bookableOnline}
                        onChange={(e) => setForm({ ...form, bookableOnline: e.target.checked })}
                        className="rounded border-line text-forest focus:ring-forest"
                      />
                      <span>Allow Online Patient Booking</span>
                    </label>

                    <div>
                      <label htmlFor="service-buffer" className="block text-[11px] font-medium text-ink mb-1">
                        Post-Procedure Buffer Time (Minutes)
                      </label>
                      <input
                        id="service-buffer"
                        type="number"
                        min={0}
                        max={120}
                        step={5}
                        value={form.bufferMinutes}
                        onChange={(e) => setForm({ ...form, bufferMinutes: parseInt(e.target.value, 10) || 0 })}
                        className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                      />
                      <p className="text-[10px] text-ink-soft mt-0.5">Buffer for room sterilization &amp; chair prep.</p>
                    </div>
                  </div>

                  {/* Clinician Multi-Select */}
                  <div>
                    <label className="block text-[11px] font-semibold text-ink mb-1">
                      Assigned Clinicians (Multi-Select)
                    </label>
                    <p className="text-[11px] text-ink-soft mb-2">
                      Leave empty to allow all active clinic providers to perform this service.
                    </p>
                    {teamMembers.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-line rounded-lg p-2 bg-bone">
                        {teamMembers.map((tm) => {
                          const isChecked = form.providerIds.includes(tm.id);
                          return (
                            <label
                              key={tm.id}
                              className="flex items-center gap-2 text-xs text-ink p-1.5 rounded hover:bg-cream cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setForm({ ...form, providerIds: [...form.providerIds, tm.id] });
                                  } else {
                                    setForm({ ...form, providerIds: form.providerIds.filter((id) => id !== tm.id) });
                                  }
                                }}
                                className="rounded border-line text-forest focus:ring-forest"
                              />
                              <span className="truncate">{tm.displayName} ({tm.professionalTitle || tm.role})</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-ink-soft italic">No active clinicians found.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-line/60 flex justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    {editingId ? "Update Service" : "Save Service"}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
