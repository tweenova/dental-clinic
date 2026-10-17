"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Globe,
  HelpCircle,
  Info,
  Layers,
  MessageSquare,
  Phone,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminCreateFaq,
  adminGetCmsSection,
  adminGetFaqs,
  adminReorderFaqs,
  adminToggleFaqStatus,
  adminUpdateCmsSection,
  adminUpdateFaq,
  FaqItem,
} from "@/lib/api";

type SectionTab = "general" | "homepage" | "about" | "contact" | "faq" | "seo";

export default function AdminWebsitePage() {
  const { accessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<SectionTab>("general");

  // Form states per section
  const [generalData, setGeneralData] = useState<any>({
    practiceName: "",
    tagline: "",
    phone: "",
    email: "",
    address: "",
    emergencyPhone: "",
  });

  const [homepageData, setHomepageData] = useState<any>({
    heroEyebrow: "",
    heroHeading: "",
    heroDescription: "",
    heroCtaText: "",
    heroCtaLink: "",
    heroSecondaryCtaText: "",
    heroSecondaryCtaLink: "",
  });

  const [aboutData, setAboutData] = useState<any>({
    eyebrow: "",
    title: "",
    storyParagraphs: [],
    licensureText: "",
  });

  const [contactData, setContactData] = useState<any>({
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    transitNote: "",
    hoursSummary: "",
    emergencyNote: "",
  });

  const [seoData, setSeoData] = useState<any>({
    siteTitle: "",
    metaDescription: "",
  });

  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [newFaq, setNewFaq] = useState({ category: "pricing", question: "", answer: "" });
  const [showAddFaq, setShowAddFaq] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load section content on mount and tab switch
  useEffect(() => {
    async function loadData() {
      if (!accessToken) return;
      setIsLoading(true);
      try {
        if (activeTab === "faq") {
          const faqList = await adminGetFaqs(accessToken);
          setFaqs(faqList);
        } else {
          const data = await adminGetCmsSection(activeTab, accessToken);
          if (activeTab === "general") setGeneralData(data);
          else if (activeTab === "homepage") setHomepageData(data);
          else if (activeTab === "about") setAboutData(data);
          else if (activeTab === "contact") setContactData(data);
          else if (activeTab === "seo") setSeoData(data);
        }
      } catch (err: any) {
        setSaveError(err.message || "Failed to load section data.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [activeTab, accessToken]);

  const handleSaveSection = async (sectionKey: string, payload: any) => {
    if (!accessToken) return;
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      await adminUpdateCmsSection(sectionKey, payload, accessToken);
      setSaveSuccess(`Website ${sectionKey} section updated successfully.`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setSaveError(err.message || `Failed to update ${sectionKey} section.`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !newFaq.question.trim() || !newFaq.answer.trim()) return;

    try {
      await adminCreateFaq(
        {
          category: newFaq.category,
          question: newFaq.question.trim(),
          answer: newFaq.answer.trim(),
          displayOrder: faqs.length,
          isActive: true,
        },
        accessToken
      );
      setNewFaq({ category: "pricing", question: "", answer: "" });
      setShowAddFaq(false);
      const updated = await adminGetFaqs(accessToken);
      setFaqs(updated);
      setSaveSuccess("New FAQ item created successfully.");
    } catch (err: any) {
      setSaveError(err.message || "Failed to create FAQ.");
    }
  };

  const handleToggleFaq = async (faqId: string, currentStatus: boolean) => {
    if (!accessToken) return;
    try {
      await adminToggleFaqStatus(faqId, !currentStatus, accessToken);
      const updated = await adminGetFaqs(accessToken);
      setFaqs(updated);
      setSaveSuccess(`FAQ item ${currentStatus ? "deactivated" : "reactivated"}.`);
    } catch (err: any) {
      setSaveError(err.message || "Failed to toggle FAQ status.");
    }
  };

  const handleMoveFaq = async (index: number, direction: -1 | 1) => {
    if (!accessToken) return;
    const target = index + direction;
    if (target < 0 || target >= faqs.length) return;
    const ordered = [...faqs];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(target, 0, moved);
    try {
      await adminReorderFaqs(ordered.map((f) => f.id), accessToken);
      setFaqs(ordered);
      setSaveSuccess("FAQ display order saved.");
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to reorder FAQs.");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Title */}
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Content Management System</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
            Website Content Editor
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Manage public messaging, hero content, clinic contact details, and FAQs.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/40 p-4 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center gap-2"
        >
          <Check className="h-4 w-4" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 p-4 text-xs font-medium text-red-800 dark:text-red-300"
        >
          {saveError}
        </div>
      )}

      {/* Section Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-line pb-3" role="tablist">
        {[
          { id: "general", label: "General & Branding", icon: Globe },
          { id: "homepage", label: "Homepage Hero", icon: Layers },
          { id: "about", label: "About Story", icon: Info },
          { id: "contact", label: "Contact & Hours", icon: Phone },
          { id: "faq", label: "FAQ Items", icon: HelpCircle },
          { id: "seo", label: "Search & SEO", icon: MessageSquare },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id as SectionTab)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? "bg-forest text-[#FAF7F2] shadow-subtle"
                  : "bg-cream text-ink-soft hover:text-ink hover:bg-sand/60 border border-line/60"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest border-t-transparent" />
        </div>
      ) : (
        <>
          {/* 1. GENERAL SECTION */}
          {activeTab === "general" && (
            <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-display text-ink">General Clinic Branding</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  id="practice-name"
                  label="Practice Name"
                  value={generalData.practiceName || ""}
                  onChange={(e) => setGeneralData({ ...generalData, practiceName: e.target.value })}
                  placeholder="Marlow Dental"
                />
                <TextField
                  id="general-tagline"
                  label="Tagline"
                  value={generalData.tagline || ""}
                  onChange={(e) => setGeneralData({ ...generalData, tagline: e.target.value })}
                  placeholder="Comprehensive, unhurried dental care..."
                />
                <TextField
                  id="general-phone"
                  label="Clinic Telephone"
                  value={generalData.phone || ""}
                  onChange={(e) => setGeneralData({ ...generalData, phone: e.target.value })}
                  placeholder="(312) 555-0147"
                />
                <TextField
                  id="general-emergency-phone"
                  label="Emergency Telephone"
                  value={generalData.emergencyPhone || ""}
                  onChange={(e) => setGeneralData({ ...generalData, emergencyPhone: e.target.value })}
                  placeholder="(312) 555-0199"
                />
                <TextField
                  id="general-email"
                  label="Contact Email"
                  value={generalData.email || ""}
                  onChange={(e) => setGeneralData({ ...generalData, email: e.target.value })}
                  placeholder="care@marlowdental.com"
                />
                <TextField
                  id="general-address"
                  label="Physical Address"
                  value={generalData.address || ""}
                  onChange={(e) => setGeneralData({ ...generalData, address: e.target.value })}
                  placeholder="e.g. Clinic Address"
                />
              </div>

              <div className="pt-4 border-t border-line/60 flex justify-end">
                <Button
                  onClick={() => handleSaveSection("general", generalData)}
                  disabled={isSaving}
                  variant="primary"
                  size="sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  <span>{isSaving ? "Saving..." : "Save General Settings"}</span>
                </Button>
              </div>
            </Card>
          )}

          {/* 2. HOMEPAGE SECTION */}
          {activeTab === "homepage" && (
            <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-display text-ink">Homepage Hero &amp; Messaging</h2>
              <div className="space-y-4">
                <TextField
                  id="hero-eyebrow"
                  label="Eyebrow Tagline"
                  value={homepageData.heroEyebrow || ""}
                  onChange={(e) => setHomepageData({ ...homepageData, heroEyebrow: e.target.value })}
                />
                <TextField
                  id="hero-heading"
                  label="Main Hero Heading"
                  value={homepageData.heroHeading || ""}
                  onChange={(e) => setHomepageData({ ...homepageData, heroHeading: e.target.value })}
                />
                <div>
                  <label htmlFor="hero-desc" className="block text-xs font-medium text-ink mb-1.5">
                    Hero Description Paragraph
                  </label>
                  <textarea
                    id="hero-desc"
                    rows={3}
                    value={homepageData.heroDescription || ""}
                    onChange={(e) => setHomepageData({ ...homepageData, heroDescription: e.target.value })}
                    className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <TextField
                    id="hero-cta-text"
                    label="Primary CTA Button Text"
                    value={homepageData.heroCtaText || ""}
                    onChange={(e) => setHomepageData({ ...homepageData, heroCtaText: e.target.value })}
                  />
                  <TextField
                    id="hero-cta-link"
                    label="Primary CTA Button URL"
                    value={homepageData.heroCtaLink || ""}
                    onChange={(e) => setHomepageData({ ...homepageData, heroCtaLink: e.target.value })}
                  />
                  <TextField
                    id="hero-sec-text"
                    label="Secondary CTA Button Text"
                    value={homepageData.heroSecondaryCtaText || ""}
                    onChange={(e) => setHomepageData({ ...homepageData, heroSecondaryCtaText: e.target.value })}
                  />
                  <TextField
                    id="hero-sec-link"
                    label="Secondary CTA Button URL"
                    value={homepageData.heroSecondaryCtaLink || ""}
                    onChange={(e) => setHomepageData({ ...homepageData, heroSecondaryCtaLink: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-line/60 flex justify-end">
                <Button
                  onClick={() => handleSaveSection("homepage", homepageData)}
                  disabled={isSaving}
                  variant="primary"
                  size="sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  <span>{isSaving ? "Saving..." : "Save Homepage Content"}</span>
                </Button>
              </div>
            </Card>
          )}

          {/* 3. ABOUT SECTION */}
          {activeTab === "about" && (
            <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-display text-ink">About Practice &amp; Story</h2>
              <div className="space-y-4">
                <TextField
                  id="about-eyebrow"
                  label="Section Eyebrow"
                  value={aboutData.eyebrow || ""}
                  onChange={(e) => setAboutData({ ...aboutData, eyebrow: e.target.value })}
                />
                <TextField
                  id="about-title"
                  label="Story Title"
                  value={aboutData.title || ""}
                  onChange={(e) => setAboutData({ ...aboutData, title: e.target.value })}
                />
                <div>
                  <label htmlFor="about-story" className="block text-xs font-medium text-ink mb-1.5">
                    Story Paragraphs (one per line)
                  </label>
                  <textarea
                    id="about-story"
                    rows={6}
                    value={Array.isArray(aboutData.storyParagraphs) ? aboutData.storyParagraphs.join("\n\n") : ""}
                    onChange={(e) =>
                      setAboutData({
                        ...aboutData,
                        storyParagraphs: e.target.value.split("\n\n").filter(Boolean),
                      })
                    }
                    className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
                <TextField
                  id="about-licensure"
                  label="Licensure Standing Text"
                  value={aboutData.licensureText || ""}
                  onChange={(e) => setAboutData({ ...aboutData, licensureText: e.target.value })}
                />
              </div>

              <div className="pt-4 border-t border-line/60 flex justify-end">
                <Button
                  onClick={() => handleSaveSection("about", aboutData)}
                  disabled={isSaving}
                  variant="primary"
                  size="sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  <span>{isSaving ? "Saving..." : "Save About Content"}</span>
                </Button>
              </div>
            </Card>
          )}

          {/* 4. CONTACT SECTION */}
          {activeTab === "contact" && (
            <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-display text-ink">Contact Details &amp; Operating Hours</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TextField
                  id="contact-phone"
                  label="Office Phone"
                  value={contactData.phone || ""}
                  onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                />
                <TextField
                  id="contact-email"
                  label="Office Email"
                  value={contactData.email || ""}
                  onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                />
                <TextField
                  id="contact-addr1"
                  label="Address Line 1"
                  value={contactData.addressLine1 || ""}
                  onChange={(e) => setContactData({ ...contactData, addressLine1: e.target.value })}
                />
                <TextField
                  id="contact-addr2"
                  label="Address Line 2 (City, State, Zip)"
                  value={contactData.addressLine2 || ""}
                  onChange={(e) => setContactData({ ...contactData, addressLine2: e.target.value })}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="contact-hours" className="block text-xs font-medium text-ink">
                      Operating Hours Summary (Legacy Fallback)
                    </label>
                    <a
                      href="/admin/booking"
                      className="text-[11px] text-forest hover:underline font-medium"
                    >
                      Edit single-source hours in Booking Settings →
                    </a>
                  </div>
                  <textarea
                    id="contact-hours"
                    rows={3}
                    value={contactData.hoursSummary || ""}
                    onChange={(e) => setContactData({ ...contactData, hoursSummary: e.target.value })}
                    className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                  <p className="text-[11px] text-ink-soft/70 mt-1">
                    Standard clinic hours and closures are managed in <a href="/admin/booking" className="underline text-forest font-medium">Booking Settings</a> as the single source of truth. This field is preserved only as a fallback.
                  </p>
                </div>
                <TextField
                  id="contact-transit"
                  label="Transit &amp; Parking Instructions"
                  value={contactData.transitNote || ""}
                  onChange={(e) => setContactData({ ...contactData, transitNote: e.target.value })}
                />
                <TextField
                  id="contact-emergency"
                  label="Emergency Triage Note"
                  value={contactData.emergencyNote || ""}
                  onChange={(e) => setContactData({ ...contactData, emergencyNote: e.target.value })}
                />
              </div>

              <div className="pt-4 border-t border-line/60 flex justify-end">
                <Button
                  onClick={() => handleSaveSection("contact", contactData)}
                  disabled={isSaving}
                  variant="primary"
                  size="sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  <span>{isSaving ? "Saving..." : "Save Contact Info"}</span>
                </Button>
              </div>
            </Card>
          )}

          {/* 5. FAQ SECTION */}
          {activeTab === "faq" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-display text-ink">Manage Patient FAQs</h2>
                <Button
                  onClick={() => setShowAddFaq(!showAddFaq)}
                  variant="primary"
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>{showAddFaq ? "Cancel" : "Add FAQ Item"}</span>
                </Button>
              </div>

              {/* Add FAQ Form */}
              {showAddFaq && (
                <Card surface="cream" shadow="card" className="p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-ink">Add New FAQ Question</h3>
                  <form onSubmit={handleAddFaq} className="space-y-4">
                    <div>
                      <label htmlFor="faq-cat" className="block text-xs font-medium text-ink mb-1.5">
                        Category
                      </label>
                      <select
                        id="faq-cat"
                        value={newFaq.category}
                        onChange={(e) => setNewFaq({ ...newFaq, category: e.target.value })}
                        className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2 text-xs text-ink"
                      >
                        <option value="pricing">Pricing &amp; Estimates</option>
                        <option value="general">General Information</option>
                        <option value="comfort">Anxiety &amp; Comfort</option>
                        <option value="scheduling">Appointments &amp; Scheduling</option>
                      </select>
                    </div>

                    <TextField
                      id="faq-q"
                      label="Question"
                      value={newFaq.question}
                      onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                      required
                    />

                    <div>
                      <label htmlFor="faq-a" className="block text-xs font-medium text-ink mb-1.5">
                        Answer
                      </label>
                      <textarea
                        id="faq-a"
                        rows={3}
                        value={newFaq.answer}
                        onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                        required
                        className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => setShowAddFaq(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" variant="primary" size="sm">
                        Save FAQ Item
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              {/* FAQ List */}
              <div className="space-y-3">
                {faqs.map((faq) => (
                  <Card
                    key={faq.id}
                    surface={faq.isActive === false ? "sand" : "cream"}
                    shadow="subtle"
                    className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest uppercase">
                          {faq.category}
                        </span>
                        {faq.isActive === false ? (
                          <span className="rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                            Inactive / Draft
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                            Public
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-sm text-ink">{faq.question}</h4>
                      <p className="text-xs text-ink-soft leading-relaxed">{faq.answer}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5 mr-1" role="group" aria-label="Reorder FAQ">
                        <button
                          type="button"
                          onClick={() => handleMoveFaq(faqs.indexOf(faq), -1)}
                          disabled={faqs.indexOf(faq) === 0}
                          aria-label={`Move FAQ up`}
                          className="h-5 w-6 rounded border border-line text-ink-soft hover:text-ink hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveFaq(faqs.indexOf(faq), 1)}
                          disabled={faqs.indexOf(faq) === faqs.length - 1}
                          aria-label={`Move FAQ down`}
                          className="h-5 w-6 rounded border border-line text-ink-soft hover:text-ink hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-none"
                        >
                          ▼
                        </button>
                      </div>

                      <Button
                        onClick={() => handleToggleFaq(faq.id, faq.isActive !== false)}
                        variant="secondary"
                        size="sm"
                      >
                        {faq.isActive === false ? "Reactivate" : "Deactivate"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* 6. SEO SECTION */}
          {activeTab === "seo" && (
            <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
              <h2 className="text-lg font-display text-ink">Metadata &amp; Search Engine Optimization</h2>
              <div className="space-y-4">
                <TextField
                  id="seo-title"
                  label="Global Site Title (<title>)"
                  value={seoData.siteTitle || ""}
                  onChange={(e) => setSeoData({ ...seoData, siteTitle: e.target.value })}
                />
                <div>
                  <label htmlFor="seo-desc" className="block text-xs font-medium text-ink mb-1.5">
                    Meta Description (&lt;meta name=&quot;description&quot;&gt;)
                  </label>
                  <textarea
                    id="seo-desc"
                    rows={3}
                    value={seoData.metaDescription || ""}
                    onChange={(e) => setSeoData({ ...seoData, metaDescription: e.target.value })}
                    className="w-full rounded-[var(--radius-card)] border border-line bg-bone px-3.5 py-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-line/60 flex justify-end">
                <Button
                  onClick={() => handleSaveSection("seo", seoData)}
                  disabled={isSaving}
                  variant="primary"
                  size="sm"
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  <span>{isSaving ? "Saving..." : "Save SEO Settings"}</span>
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
