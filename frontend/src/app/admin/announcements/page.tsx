"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  Edit2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminGetAnnouncements,
  adminUpdateAnnouncement,
  Announcement,
} from "@/lib/api";

export default function AdminAnnouncementsPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);

  // Form fields
  const [content, setContent] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const loadAnnouncements = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminGetAnnouncements(accessToken);
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      loadAnnouncements();
    });
  }, [accessToken]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setContent("");
    setIsActive(true);
    setDisplayOrder(items.length > 0 ? Math.max(...items.map((i) => i.displayOrder)) + 1 : 1);
    setFormError("");
    setModalOpen(true);
  };

  const handleOpenEdit = (item: Announcement) => {
    setEditingItem(item);
    setContent(item.content);
    setIsActive(item.isActive);
    setDisplayOrder(item.displayOrder);
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setFormError("Announcement content is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      if (editingItem) {
        await adminUpdateAnnouncement(
          editingItem.id,
          {
            content: content.trim(),
            isActive,
            displayOrder: Number(displayOrder),
          },
          accessToken
        );
      } else {
        await adminCreateAnnouncement(
          {
            content: content.trim(),
            isActive,
            displayOrder: Number(displayOrder),
          },
          accessToken
        );
      }
      setModalOpen(false);
      await loadAnnouncements();
    } catch (err: any) {
      setFormError(err.message || "Failed to save announcement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: Announcement) => {
    try {
      await adminUpdateAnnouncement(
        item.id,
        { isActive: !item.isActive },
        accessToken
      );
      await loadAnnouncements();
    } catch (err: any) {
      alert("Failed to toggle status: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this announcement?")) {
      return;
    }

    try {
      await adminDeleteAnnouncement(id, accessToken);
      await loadAnnouncements();
    } catch (err: any) {
      alert("Failed to delete announcement: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Marquee Ticker Banner</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-semibold">
            Announcements Manager
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Manage top-header ticker messages, announcements, clinic open days, and emergency updates.
          </p>
        </div>

        <Button variant="primary" size="md" onClick={handleOpenAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>New Announcement</span>
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">
          {error}
        </div>
      )}

      {/* Announcements List */}
      <Card surface="cream" shadow="card" className="p-0 overflow-hidden border border-line">
        {loading ? (
          <div className="p-8 text-center text-xs text-ink-soft font-mono">
            Loading announcements...
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-forest/10 grid place-items-center text-forest">
              <Bell className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-display font-semibold text-ink">No announcements yet</h3>
            <p className="text-xs text-ink-soft max-w-sm mx-auto">
              Create your first marquee ticker announcement to display at the top of the public website.
            </p>
            <Button variant="outline" size="sm" onClick={handleOpenAdd}>
              Create Announcement
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-line/60">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-sand/30 transition-colors"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        item.isActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                      }`}
                    >
                      {item.isActive ? "Active Marquee" : "Draft / Inactive"}
                    </span>
                    <span className="text-[11px] font-mono text-ink-soft">
                      Order: #{item.displayOrder}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-ink break-words">
                    {item.content}
                  </p>
                  {item.createdAt && (
                    <span className="text-[10px] text-ink-soft block font-mono">
                      Added: {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className="px-2.5 py-1 rounded-lg border border-line bg-white/70 dark:bg-black/30 text-xs text-ink hover:bg-sand/60 transition-colors"
                  >
                    {item.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg border border-line text-ink-soft hover:text-ink hover:bg-sand/60 transition-colors"
                    title="Edit announcement"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg border border-line text-ink-soft hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Delete announcement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-cream border border-line p-6 sm:p-8 shadow-card space-y-5">
            <div className="flex items-center justify-between border-b border-line/60 pb-3">
              <h3 className="text-lg font-display font-bold text-ink">
                {editingItem ? "Edit Announcement" : "Create New Announcement"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-ink-soft hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-ink block mb-1">
                  Ticker Message Content
                </label>
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="e.g. Grand Opening: West Loop clinic is now taking appointments! Emergency walk-ins welcome."
                  className="w-full rounded-xl border border-line bg-white/80 dark:bg-black/20 p-3 text-xs text-ink placeholder:text-ink-soft/50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  id="display-order"
                  label="Display Order"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  helpText="Lower numbers display first."
                />

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-ink block">Status</label>
                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-line text-forest focus:ring-forest"
                    />
                    <span className="text-xs text-ink">Active on Marquee</span>
                  </label>
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-line/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : editingItem ? "Update Announcement" : "Create Announcement"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
