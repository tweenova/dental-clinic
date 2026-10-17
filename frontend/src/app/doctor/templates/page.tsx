"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  FileText,
  Plus,
  Power,
  PowerOff,
  X,
} from "lucide-react";

import {
  ClinicalNoteTemplate,
  createClinicalNoteTemplate,
  getClinicalNoteTemplates,
  updateClinicalNoteTemplate,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DoctorNoteTemplatesPage() {
  const { accessToken } = useAuth();

  const [templates, setTemplates] = useState<ClinicalNoteTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClinicalNoteTemplate | null>(null);
  const [name, setName] = useState("");
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");
  const [active, setActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getClinicalNoteTemplates(false, accessToken)
      .then((data) => {
        if (isMounted) setTemplates(data);
      })
      .catch((err) => {
        console.error("Failed to load note templates:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [accessToken]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName("");
    setSubjective("");
    setObjective("");
    setAssessment("");
    setPlan("");
    setActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (tmpl: ClinicalNoteTemplate) => {
    setEditingTemplate(tmpl);
    setName(tmpl.name);
    setSubjective(tmpl.subjective || "");
    setObjective(tmpl.objective || "");
    setAssessment(tmpl.assessment || "");
    setPlan(tmpl.plan || "");
    setActive(tmpl.active);
    setFormError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTemplate(null);
  };

  const handleToggleActive = async (tmpl: ClinicalNoteTemplate) => {
    try {
      const updated = await updateClinicalNoteTemplate(
        tmpl.id,
        { active: !tmpl.active },
        accessToken
      );
      setTemplates((prev) =>
        prev.map((t) => (t.id === tmpl.id ? { ...t, active: updated.active } : t))
      );
      setActionMessage(
        `Template "${tmpl.name}" marked as ${updated.active ? "active" : "inactive"}.`
      );
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to update template status.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Template name is required.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingTemplate) {
        const updated = await updateClinicalNoteTemplate(
          editingTemplate.id,
          {
            name: name.trim(),
            subjective: subjective.trim(),
            objective: objective.trim(),
            assessment: assessment.trim(),
            plan: plan.trim(),
            active,
          },
          accessToken
        );
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplate.id ? { ...t, ...updated } : t))
        );
        setActionMessage(`Template "${updated.name}" updated successfully.`);
      } else {
        const created = await createClinicalNoteTemplate(
          {
            name: name.trim(),
            subjective: subjective.trim(),
            objective: objective.trim(),
            assessment: assessment.trim(),
            plan: plan.trim(),
            active,
          },
          accessToken
        );
        setTemplates((prev) => [...prev, created]);
        setActionMessage(`Template "${created.name}" created successfully.`);
      }
      setTimeout(() => setActionMessage(null), 3000);
      closeModal();
    } catch (err: any) {
      setFormError(err.message || "Failed to save template.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Clinical Documentation</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            SOAP Clinical Note Templates
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            Standardize encounter documentation across hygiene, restorative, surgery, and emergency visits.
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="flex items-center gap-2 self-start sm:self-center"
          data-testid="create-template-btn"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Success banner */}
      {actionMessage && (
        <div
          role="status"
          className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Templates List */}
      {isLoading ? (
        <div className="p-8 text-center text-sm text-ink-soft">
          Loading clinical templates...
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <FileText className="h-10 w-10 text-ink-soft mx-auto" />
          <h3 className="font-semibold text-ink">No Note Templates Configured</h3>
          <p className="text-sm text-ink-soft max-w-md mx-auto">
            Create standard SOAP note templates to quickly prefill encounter documentation during patient consultations.
          </p>
          <Button onClick={openCreateModal} className="mt-2">
            Create First Template
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tmpl) => (
            <Card
              key={tmpl.id}
              className={`p-5 flex flex-col justify-between border transition-all ${
                tmpl.active ? "border-line" : "border-line/40 opacity-70 bg-sand/10"
              }`}
              data-testid={`template-card-${tmpl.id}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="font-semibold text-ink text-base">{tmpl.name}</h3>
                  </div>
                  <span
                    className={`text-[11px] font-mono uppercase px-2 py-0.5 rounded-full ${
                      tmpl.active
                        ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200"
                        : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {tmpl.active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {tmpl.subjective && (
                    <div>
                      <span className="font-bold text-ink uppercase tracking-wider text-[10px] block">
                        Subjective (S):
                      </span>
                      <p className="text-ink-soft line-clamp-2 bg-sand/20 dark:bg-sand/5 p-1.5 rounded border border-line/40">
                        {tmpl.subjective}
                      </p>
                    </div>
                  )}
                  {tmpl.objective && (
                    <div>
                      <span className="font-bold text-ink uppercase tracking-wider text-[10px] block">
                        Objective (O):
                      </span>
                      <p className="text-ink-soft line-clamp-2 bg-sand/20 dark:bg-sand/5 p-1.5 rounded border border-line/40">
                        {tmpl.objective}
                      </p>
                    </div>
                  )}
                  {tmpl.assessment && (
                    <div>
                      <span className="font-bold text-ink uppercase tracking-wider text-[10px] block">
                        Assessment (A):
                      </span>
                      <p className="text-ink-soft line-clamp-2 bg-sand/20 dark:bg-sand/5 p-1.5 rounded border border-line/40">
                        {tmpl.assessment}
                      </p>
                    </div>
                  )}
                  {tmpl.plan && (
                    <div>
                      <span className="font-bold text-ink uppercase tracking-wider text-[10px] block">
                        Plan (P):
                      </span>
                      <p className="text-ink-soft line-clamp-2 bg-sand/20 dark:bg-sand/5 p-1.5 rounded border border-line/40">
                        {tmpl.plan}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-line flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(tmpl)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  {tmpl.active ? (
                    <>
                      <PowerOff className="h-3 w-3 text-amber-600" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="h-3 w-3 text-emerald-600" />
                      Activate
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditModal(tmpl)}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <Edit2 className="h-3 w-3" />
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-deep/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-bone p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-lg font-display font-semibold text-ink">
                {editingTemplate ? `Edit Template: ${editingTemplate.name}` : "Create Note Template"}
              </h2>
              <button
                onClick={closeModal}
                className="text-ink-soft hover:text-ink transition-colors p-1"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800 rounded-lg text-xs"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Periodic Hygiene Recall & Exam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Subjective (S)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Chief complaint, dental history, patient reports..."
                    value={subjective}
                    onChange={(e) => setSubjective(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Objective (O)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Clinical findings, intraoral exam, hard & soft tissue..."
                    value={objective}
                    onChange={(e) => setObjective(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Assessment (A)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Diagnosis, prognosis, caries risk..."
                    value={assessment}
                    onChange={(e) => setAssessment(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1">
                    Plan (P)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Treatment delivered, scheduled follow-up, OHI..."
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="template-active-doctor"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-line text-primary focus:ring-primary"
                />
                <label htmlFor="template-active-doctor" className="text-xs text-ink font-medium">
                  Active (available for selection in encounter notes)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} data-testid="save-template-btn">
                  {isSubmitting ? "Saving..." : editingTemplate ? "Save Changes" : "Create Template"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
