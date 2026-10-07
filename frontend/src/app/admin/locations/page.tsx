"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Edit2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminCreateLocation,
  adminGetLocations,
  adminToggleLocationStatus,
  adminUpdateLocation,
  LocationItem,
} from "@/lib/api";

export default function AdminLocationsPage() {
  const { accessToken } = useAuth();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);

  const [form, setForm] = useState({
    name: "",
    addressLine1: "",
    addressLine2: "",
    city: "Chicago",
    state: "Illinois",
    postalCode: "60614",
    country: "US",
    phone: "(312) 555-0147",
    email: "care@marlowdental.com",
    hoursInfo: "Monday – Thursday: 8:00 AM – 6:00 PM\nFriday: 8:00 AM – 2:00 PM\nSaturday – Sunday: Closed",
    isPrimary: false,
    displayOrder: 0,
  });

  const loadLocations = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await adminGetLocations(accessToken);
      setLocations(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load locations.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (accessToken) {
      loadLocations();
    }
  }, [accessToken]);

  const handleOpenAdd = () => {
    setEditingLocation(null);
    setForm({
      name: "",
      addressLine1: "",
      addressLine2: "",
      city: "Chicago",
      state: "Illinois",
      postalCode: "60614",
      country: "US",
      phone: "(312) 555-0147",
      email: "care@marlowdental.com",
      hoursInfo: "Monday – Thursday: 8:00 AM – 6:00 PM\nFriday: 8:00 AM – 2:00 PM\nSaturday – Sunday: Closed",
      isPrimary: locations.length === 0,
      displayOrder: locations.length,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (loc: LocationItem) => {
    setEditingLocation(loc);
    setForm({
      name: loc.name,
      addressLine1: loc.addressLine1,
      addressLine2: loc.addressLine2 || "",
      city: loc.city,
      state: loc.state,
      postalCode: loc.postalCode,
      country: loc.country || "US",
      phone: loc.phone || "",
      email: loc.email || "",
      hoursInfo: loc.hoursInfo || "",
      isPrimary: loc.isPrimary,
      displayOrder: loc.displayOrder,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.addressLine1.trim() || !form.city.trim()) {
      setErrorMsg("Facility name, street address, and city are required.");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingLocation) {
        await adminUpdateLocation(
          editingLocation.id,
          {
            name: form.name.trim(),
            addressLine1: form.addressLine1.trim(),
            addressLine2: form.addressLine2.trim() || null,
            city: form.city.trim(),
            state: form.state.trim(),
            postalCode: form.postalCode.trim(),
            country: form.country.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            hoursInfo: form.hoursInfo.trim() || null,
            isPrimary: form.isPrimary,
            displayOrder: Number(form.displayOrder) || 0,
          },
          accessToken
        );
        setSuccessMsg(`Successfully updated clinic facility "${form.name}".`);
      } else {
        await adminCreateLocation(
          {
            name: form.name.trim(),
            addressLine1: form.addressLine1.trim(),
            addressLine2: form.addressLine2.trim() || null,
            city: form.city.trim(),
            state: form.state.trim(),
            postalCode: form.postalCode.trim(),
            country: form.country.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            hoursInfo: form.hoursInfo.trim() || null,
            isPrimary: form.isPrimary,
            displayOrder: Number(form.displayOrder) || 0,
          },
          accessToken
        );
        setSuccessMsg(`Successfully created new practice facility "${form.name}".`);
      }
      setModalOpen(false);
      await loadLocations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save location.";
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (loc: LocationItem) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const nextStatus = !loc.isActive;
      await adminToggleLocationStatus(loc.id, nextStatus, accessToken);
      setSuccessMsg(
        `Facility "${loc.name}" is now ${nextStatus ? "active" : "deactivated"}.`
      );
      await loadLocations();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update location status.";
      setErrorMsg(msg);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Clinic Infrastructure</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Practice Locations &amp; Facilities
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Manage multi-location physical clinic addresses, operating hours, telephone numbers, and branch routing.
          </p>
        </div>
        <Button onClick={handleOpenAdd} variant="primary" size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          <span>Add Clinic Facility</span>
        </Button>
      </div>

      {successMsg && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs sm:text-sm text-rose-800 dark:text-rose-300 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-600 hover:text-rose-800 dark:text-rose-400 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 flex flex-col justify-center items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-forest border-t-transparent" />
          <span className="text-xs text-ink-soft">Loading practice facilities...</span>
        </div>
      ) : locations.length === 0 ? (
        <Card surface="cream" shadow="card" className="p-12 text-center space-y-4">
          <MapPin className="h-10 w-10 text-ink-soft/40 mx-auto" />
          <div>
            <h3 className="font-display text-lg text-ink">No facilities configured</h3>
            <p className="text-xs sm:text-sm text-ink-soft mt-1">
              Click &quot;Add Clinic Facility&quot; above to establish your practice&apos;s physical clinic branches.
            </p>
          </div>
          <Button onClick={handleOpenAdd} variant="primary" size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            <span>Add First Facility</span>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {locations.map((loc) => (
            <Card
              key={loc.id}
              surface={loc.isActive ? "cream" : "bone"}
              shadow="card"
              className={`p-6 sm:p-8 space-y-4 transition-opacity ${
                !loc.isActive ? "opacity-60 border-dashed" : ""
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line/60 pb-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="font-display text-lg text-ink font-semibold">{loc.name}</h3>
                  {loc.isPrimary && (
                    <span className="rounded-full bg-forest text-white px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider">
                      Primary Clinic
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      loc.isActive
                        ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
                        : "bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    {loc.isActive ? "Active in Directory" : "Deactivated (Archived)"}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    onClick={() => handleOpenEdit(loc)}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    onClick={() => handleToggleStatus(loc)}
                    variant="ghost"
                    size="sm"
                    className={`text-xs ${
                      loc.isActive ? "text-amber-700 hover:text-amber-800" : "text-emerald-700 hover:text-emerald-800"
                    }`}
                  >
                    {loc.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-ink-soft pt-1">
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-forest shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink block">Physical Address</strong>
                    <span>{loc.addressLine1}</span>
                    {loc.addressLine2 && <span>, {loc.addressLine2}</span>}
                    <br />
                    <span>
                      {loc.city}, {loc.state} {loc.postalCode} ({loc.country || "US"})
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-forest" />
                    <span className="font-mono">{loc.phone || "No phone listed"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-forest" />
                    <span>{loc.email || "No email listed"}</span>
                  </div>
                </div>
              </div>

              {loc.hoursInfo && (
                <div className="pt-3 border-t border-line/50 text-xs text-ink-soft">
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-3.5 w-3.5 text-forest shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-ink block mb-0.5">Office Operating Schedule</strong>
                      <pre className="font-sans whitespace-pre-line text-xs leading-relaxed text-ink-soft">
                        {loc.hoursInfo}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}

          <Card surface="bone" shadow="subtle" className="p-6">
            <div className="flex items-center gap-2 text-ink text-sm font-medium mb-1">
              <ShieldCheck className="h-4 w-4 text-forest" />
              <span>Database-Backed Relational Persistence</span>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              All location entities are stored in PostgreSQL and exposed via FastAPI endpoints. When updated, changes propagate directly to the public website, directory filters, and booking flow without manual code modifications.
            </p>
          </Card>
        </div>
      )}

      {/* Modal Dialog for Add/Edit Facility */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-line dark:border-gray-800 pb-4 mb-6">
              <div>
                <h3 className="font-display text-xl text-ink dark:text-white font-semibold">
                  {editingLocation ? "Edit Clinic Facility" : "Add New Practice Facility"}
                </h3>
                <p className="text-xs text-ink-soft dark:text-gray-400 mt-0.5">
                  Configure location details, physical address, and hours of operation.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-full p-1.5 text-xs text-ink-soft hover:text-ink hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <TextField
                    label="Facility Name *"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Lincoln Park Practice Facility"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <TextField
                    label="Street Address *"
                    value={form.addressLine1}
                    onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                    placeholder="e.g. 214 Alder Street, Suite 3"
                    required
                  />
                </div>

                <div>
                  <TextField
                    label="Suite / Unit (Optional)"
                    value={form.addressLine2}
                    onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                    placeholder="e.g. Suite 3 / 2nd Floor"
                  />
                </div>

                <div>
                  <TextField
                    label="City *"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="e.g. Chicago"
                    required
                  />
                </div>

                <div>
                  <TextField
                    label="State / Province *"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    placeholder="e.g. Illinois"
                    required
                  />
                </div>

                <div>
                  <TextField
                    label="Postal / Zip Code *"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    placeholder="e.g. 60614"
                    required
                  />
                </div>

                <div>
                  <TextField
                    label="Telephone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g. (312) 555-0147"
                  />
                </div>

                <div>
                  <TextField
                    label="Contact Email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="e.g. care@marlowdental.com"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-ink dark:text-gray-300 mb-1.5">
                    Operating Hours Summary
                  </label>
                  <textarea
                    rows={3}
                    value={form.hoursInfo}
                    onChange={(e) => setForm({ ...form, hoursInfo: e.target.value })}
                    placeholder="Mon – Thu: 8:00 AM – 6:00 PM&#10;Fri: 8:00 AM – 2:00 PM&#10;Sat–Sun: Closed"
                    className="w-full rounded-2xl border border-line dark:border-gray-700 bg-cream/70 dark:bg-gray-800/80 px-4 py-3 text-xs text-ink dark:text-white placeholder:text-ink-soft/40 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <input
                    type="checkbox"
                    id="isPrimary"
                    checked={form.isPrimary}
                    onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                    className="h-4 w-4 rounded-md border-line text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="isPrimary" className="text-xs text-ink dark:text-gray-300 cursor-pointer font-medium">
                    Primary / Flagship Practice Location
                  </label>
                </div>

                <div>
                  <TextField
                    label="Display Order"
                    type="number"
                    value={form.displayOrder.toString()}
                    onChange={(e) =>
                      setForm({ ...form, displayOrder: parseInt(e.target.value, 10) || 0 })
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-6 border-t border-line dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full px-5"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" className="rounded-full px-5" disabled={isSaving}>
                  {isSaving ? "Saving..." : editingLocation ? "Update Facility" : "Create Facility"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
