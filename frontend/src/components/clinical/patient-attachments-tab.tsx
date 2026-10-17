"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileCheck,
  FileText,
  Filter,
  Image as ImageIcon,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import {
  PatientAttachmentItem,
  PatientConsentItem,
  downloadPatientAttachmentBlob,
  getPatientAttachments,
  getPatientConsents,
  recordPatientConsent,
  uploadPatientAttachment,
  voidPatientAttachment,
  voidPatientConsent,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface PatientAttachmentsTabProps {
  patientId: string;
  role: "doctor" | "receptionist" | "admin";
  patientName?: string;
}

/** Formats a byte count into a human-readable size label for display. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function PatientAttachmentsTab({
  patientId,
  role,
  patientName,
}: PatientAttachmentsTabProps) {
  const { accessToken } = useAuth();

  const [activeSection, setActiveSection] = useState<"files" | "consents">("files");
  const [attachments, setAttachments] = useState<PatientAttachmentItem[]>([]);
  const [consents, setConsents] = useState<PatientConsentItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>(
    role === "receptionist" ? "consent" : "xray"
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Void Modal State
  const [voidTarget, setVoidTarget] = useState<{ type: "file" | "consent"; id: string; name: string } | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);

  // Record Consent Modal State
  const [isConsentOpen, setIsConsentOpen] = useState(false);
  const [consentType, setConsentType] = useState("treatment");
  const [consentMethod, setConsentMethod] = useState<"typed" | "scanned">("typed");
  const [consentSignedName, setConsentSignedName] = useState("");
  const [consentTextVersion, setConsentTextVersion] = useState("1.0");
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string>("");
  const [isRecordingConsent, setIsRecordingConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const isReception = role === "receptionist";

  // Allowed categories based on role
  const availableCategories = isReception
    ? [
        { id: "consent", label: "Consent Forms" },
        { id: "other", label: "Other Documents" },
      ]
    : [
        { id: "xray", label: "Radiographs / X-rays" },
        { id: "photo", label: "Clinical Photos" },
        { id: "consent", label: "Consent Forms" },
        { id: "referral", label: "Referral Documents" },
        { id: "other", label: "Other Attachments" },
      ];

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getPatientAttachments(patientId, undefined, accessToken),
      getPatientConsents(patientId, accessToken),
    ])
      .then(([attData, conData]) => {
        if (isMounted) {
          setAttachments(attData || []);
          setConsents(conData || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load attachments or consents:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [patientId, accessToken]);

  const handleDownload = async (att: PatientAttachmentItem) => {
    try {
      const blob = await downloadPatientAttachmentBlob(att.id, accessToken);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.originalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to download attachment.");
    }
  };

  const handlePreview = async (att: PatientAttachmentItem) => {
    try {
      const blob = await downloadPatientAttachmentBlob(att.id, accessToken);
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to view attachment.");
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please select a file to upload.");
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setUploadError("File size exceeds maximum permitted limit of 15 MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("patientId", patientId);
      formData.append("category", uploadCategory);

      const uploaded = await uploadPatientAttachment(formData, accessToken);
      setAttachments((prev) => [uploaded, ...prev]);
      setIsUploadOpen(false);
      setSelectedFile(null);
      setActionMessage(`File "${uploaded.originalFilename}" uploaded securely.`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleVoidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTarget || !voidReason.trim()) {
      setVoidError("A clinical or administrative reason is required to void this record.");
      return;
    }

    setIsVoiding(true);
    setVoidError(null);
    try {
      if (voidTarget.type === "file") {
        await voidPatientAttachment(voidTarget.id, voidReason.trim(), accessToken);
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === voidTarget.id
              ? { ...a, voided: true, voidReason: voidReason.trim(), voidedAt: new Date().toISOString() }
              : a
          )
        );
        setActionMessage(`Attachment "${voidTarget.name}" has been voided.`);
      } else {
        await voidPatientConsent(voidTarget.id, voidReason.trim(), accessToken);
        setConsents((prev) =>
          prev.map((c) =>
            c.id === voidTarget.id
              ? { ...c, voided: true, voidReason: voidReason.trim(), voidedAt: new Date().toISOString() }
              : c
          )
        );
        setActionMessage(`Consent record "${voidTarget.name}" has been voided.`);
      }
      setVoidTarget(null);
      setVoidReason("");
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: unknown) {
      setVoidError(err instanceof Error ? err.message : "Failed to void record.");
    } finally {
      setIsVoiding(false);
    }
  };

  const handleConsentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentSignedName.trim()) {
      setConsentError("Signer name is required.");
      return;
    }

    setIsRecordingConsent(true);
    setConsentError(null);
    try {
      const recorded = await recordPatientConsent(
        {
          patientId,
          consentType,
          method: selectedAttachmentId ? "scanned" : consentMethod,
          signedName: consentSignedName.trim(),
          attachmentId: selectedAttachmentId || undefined,
          consentTextVersion: consentTextVersion.trim() || "1.0",
        },
        accessToken
      );
      setConsents((prev) => [recorded, ...prev]);
      setIsConsentOpen(false);
      setConsentSignedName("");
      setSelectedAttachmentId("");
      setConsentTextVersion("1.0");
      setActionMessage(`Informed consent signed by "${recorded.signedName}" successfully recorded.`);
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: unknown) {
      setConsentError(err instanceof Error ? err.message : "Failed to record consent.");
    } finally {
      setIsRecordingConsent(false);
    }
  };

  const filteredAttachments = attachments.filter((a) => {
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and Section Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-display font-medium text-ink">
              Clinical Documents & Consents
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-ink-soft border border-line flex items-center gap-1">
              <Lock className="h-3 w-3" /> Secure Storage
            </span>
          </div>
          <p className="text-xs text-ink-soft mt-0.5">
            Encrypted private storage outside web root{patientName ? ` for ${patientName}` : ""}. All downloads are authenticated and audit-logged.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeSection === "files" ? (
            <Button
              onClick={() => {
                setUploadError(null);
                setSelectedFile(null);
                setIsUploadOpen(true);
              }}
              size="sm"
              className="gap-1.5 bg-primary text-white hover:bg-primary-dark text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload Attachment
            </Button>
          ) : (
            <Button
              onClick={() => {
                setConsentError(null);
                setIsConsentOpen(true);
              }}
              size="sm"
              className="gap-1.5 bg-primary text-white hover:bg-primary-dark text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Record Patient Consent
            </Button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Subsections: Files vs Consents */}
      <div className="flex items-center justify-between border-b border-line pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSection("files")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSection === "files"
                ? "bg-primary text-white"
                : "text-ink-soft hover:text-ink hover:bg-muted"
            }`}
          >
            File Attachments ({attachments.length})
          </button>
          <button
            onClick={() => setActiveSection("consents")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeSection === "consents"
                ? "bg-primary text-white"
                : "text-ink-soft hover:text-ink hover:bg-muted"
            }`}
          >
            Patient Consents ({consents.length})
          </button>
        </div>

        {activeSection === "files" && (
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-ink-soft" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-surface border border-line rounded px-2 py-1 text-ink focus:outline-none"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* SECTION 1: FILES & ATTACHMENTS */}
      {activeSection === "files" && (
        <>
          {isLoading ? (
            <div className="p-12 text-center text-xs text-ink-soft">Loading attachments...</div>
          ) : filteredAttachments.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="h-10 w-10 text-ink-soft mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-ink">No attachments found</p>
              <p className="text-xs text-ink-soft mt-1">
                {isReception
                  ? "No consent forms or external documents uploaded yet."
                  : "Upload radiographs, clinical photos, or referral letters for this patient."}
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAttachments.map((att) => (
                <Card
                  key={att.id}
                  className={`p-4 space-y-3 border transition-all ${
                    att.voided
                      ? "opacity-60 bg-muted/40 border-dashed"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        {att.category === "xray" || att.category === "photo" ? (
                          <ImageIcon className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink truncate" title={att.originalFilename}>
                          {att.originalFilename}
                        </p>
                        <p className="text-[11px] text-ink-soft font-mono">
                          {formatBytes(att.size)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
                        att.voided
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                          : "bg-muted text-ink-soft border-line"
                      }`}
                    >
                      {att.voided ? "Voided" : att.category}
                    </span>
                  </div>

                  {att.voided && att.voidReason && (
                    <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded text-[11px] text-rose-700 dark:text-rose-300">
                      <strong>Void Reason:</strong> {att.voidReason}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-ink-soft">
                    <span>{new Date(att.uploadedAt).toLocaleDateString()}</span>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePreview(att)}
                        className="h-7 px-2 text-xs text-primary hover:text-primary-dark"
                        title="View / Preview file"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(att)}
                        className="h-7 px-2 text-xs text-ink-soft hover:text-ink"
                        title="Download file"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {!att.voided && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setVoidError(null);
                            setVoidReason("");
                            setVoidTarget({ type: "file", id: att.id, name: att.originalFilename });
                          }}
                          className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title="Void this document (soft delete with recorded reason)"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* SECTION 2: CONSENTS */}
      {activeSection === "consents" && (
        <>
          {isLoading ? (
            <div className="p-12 text-center text-xs text-ink-soft">Loading consents...</div>
          ) : consents.length === 0 ? (
            <Card className="p-12 text-center">
              <FileCheck className="h-10 w-10 text-ink-soft mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-ink">No consent records found</p>
              <p className="text-xs text-ink-soft mt-1">
                Record signed procedural or anaesthesia consents for clinical and legal protection.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3">
              {consents.map((con) => (
                <Card
                  key={con.id}
                  className={`p-4 border transition-all ${
                    con.voided ? "opacity-60 bg-muted/40 border-dashed" : "hover:border-primary/40"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border ${
                            con.voided
                              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
                          }`}
                        >
                          {con.voided ? "Voided Consent" : "Signed & Valid"}
                        </span>
                        <span className="text-[10px] font-mono uppercase bg-muted text-ink-soft px-2 py-0.5 rounded border border-line">
                          {con.consentType}
                        </span>
                        <span className="text-[10px] font-mono uppercase bg-muted text-ink-soft px-2 py-0.5 rounded border border-line">
                          {con.method}
                        </span>
                      </div>

                      <h3 className={`text-sm font-semibold ${con.voided ? "line-through text-ink-soft" : "text-ink"}`}>
                        Signed by: {con.signedName}
                      </h3>

                      <p className="text-[11px] text-ink-soft">Text version {con.consentTextVersion}</p>

                      {con.voided && con.voidReason && (
                        <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded text-xs text-rose-700 dark:text-rose-300">
                          <strong>Void Reason:</strong> {con.voidReason}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-ink-soft pt-1">
                        <span>Recorded: {new Date(con.recordedAt).toLocaleDateString()}</span>
                        {con.attachmentId && (
                          <span className="text-primary font-medium">Linked to file scan</span>
                        )}
                      </div>
                    </div>

                    {!con.voided && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVoidError(null);
                          setVoidReason("");
                          setVoidTarget({ type: "consent", id: con.id, name: con.signedName });
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:border-rose-300 shrink-0"
                      >
                        Void Consent
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Upload File Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base font-display font-medium text-ink">
                Upload Private Patient Attachment
              </h2>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-ink-soft hover:text-ink transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Document Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                >
                  {availableCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Select File <span className="text-rose-500">*</span>
                </label>
                <input
                  type="file"
                  required
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full text-xs p-2 bg-muted rounded-md border border-line focus:outline-none text-ink file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary file:text-white"
                />
                <p className="text-[11px] text-ink-soft mt-1">
                  Permitted formats: JPG, PNG, PDF (Validated via magic bytes up to 15 MB).
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsUploadOpen(false)}
                  disabled={isUploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUploading}
                  className="bg-primary text-white hover:bg-primary-dark"
                >
                  {isUploading ? "Uploading..." : "Upload File"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Consent Modal */}
      {isConsentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base font-display font-medium text-ink">
                Record Patient Informed Consent
              </h2>
              <button
                onClick={() => setIsConsentOpen(false)}
                className="text-ink-soft hover:text-ink transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {consentError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{consentError}</span>
              </div>
            )}

            <form onSubmit={handleConsentSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Consent Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={consentType}
                    onChange={(e) => setConsentType(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                  >
                    <option value="treatment">Treatment / Procedure</option>
                    <option value="anaesthesia">Local Anaesthesia</option>
                    <option value="sedation">Conscious Sedation</option>
                    <option value="financial">Financial Estimate</option>
                    <option value="general">General Consent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1">
                    Link Scanned Attachment
                  </label>
                  <select
                    value={selectedAttachmentId}
                    onChange={(e) => setSelectedAttachmentId(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                  >
                    <option value="">None (Typed consent)</option>
                    {attachments
                      .filter((a) => !a.voided)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.originalFilename}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Signer Name (Patient or Guardian) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={consentSignedName}
                  onChange={(e) => setConsentSignedName(e.target.value)}
                  placeholder="Full legal name of the person providing consent"
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Consent Text Version
                </label>
                <input
                  type="text"
                  value={consentTextVersion}
                  onChange={(e) => setConsentTextVersion(e.target.value)}
                  placeholder="e.g. 1.0"
                  className="w-full text-xs px-3 py-2 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-primary text-ink"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsConsentOpen(false)}
                  disabled={isRecordingConsent}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isRecordingConsent}
                  className="bg-primary text-white hover:bg-primary-dark"
                >
                  {isRecordingConsent ? "Recording..." : "Record & Lock Consent"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Modal (Mandatory reason, no hard delete) */}
      {voidTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-md border border-line p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="text-base font-display font-medium text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Void Clinical Record
              </h2>
              <button
                onClick={() => setVoidTarget(null)}
                className="text-ink-soft hover:text-ink transition-colors p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-ink-soft">
              Hard deletes are prohibited to preserve legal audit integrity. Voiding retains the record
              and file while marking it invalid.
            </p>

            {voidError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-md text-xs">
                {voidError}
              </div>
            )}

            <form onSubmit={handleVoidSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Reason for Voiding <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Uploaded to incorrect patient chart, Patient revoked consent prior to treatment..."
                  className="w-full text-xs p-2.5 bg-surface rounded-md border border-line focus:outline-none focus:ring-1 focus:ring-rose-500 text-ink resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVoidTarget(null)}
                  disabled={isVoiding}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isVoiding}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isVoiding ? "Voiding..." : "Confirm Void"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
