"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Palette,
  Shield,
  Sparkles,
  Timer,
  Type,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/components/providers/auth-provider";
import {
  adminGetOrganization,
  adminUpdateOrganization,
  Organization,
} from "@/lib/api";

const PRESET_FONTS = [
  "Playfair Display",
  "Plus Jakarta Sans",
  "Inter",
  "Cabinet Grotesk",
  "Outfit",
  "Geist Sans",
  "Georgia",
  "serif",
  "sans-serif",
];

const PRESET_PALETTES = [
  { name: "Forest Classic", primary: "#1B3B2B", secondary: "#C59B27", bg: "#FAF7F2" },
  { name: "Deep Teal", primary: "#0F766E", secondary: "#14B8A6", bg: "#F8FAFC" },
  { name: "Royal Navy", primary: "#1E293B", secondary: "#3B82F6", bg: "#F8FAFC" },
  { name: "Nordic Minimal", primary: "#27272A", secondary: "#71717A", bg: "#FFFFFF" },
  { name: "Warm Terracotta", primary: "#881337", secondary: "#F43F5E", bg: "#FFF1F2" },
];

export default function AdminSettingsPage() {
  const { user, accessToken, updateInactivity } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "appearance">("account");

  // Inactivity State
  const [inactivityEnabled, setInactivityEnabled] = useState(true);
  const [timeoutMinutes, setTimeoutMinutes] = useState(15);
  const [warningSeconds, setWarningSeconds] = useState(60);
  const [isSavingInactivity, setIsSavingInactivity] = useState(false);
  const [inactivitySuccess, setInactivitySuccess] = useState(false);
  const [inactivityError, setInactivityError] = useState("");

  // Appearance State
  const [org, setOrg] = useState<Organization | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#1B3B2B");
  const [secondaryColor, setSecondaryColor] = useState("#C59B27");
  const [backgroundColor, setBackgroundColor] = useState("#FAF7F2");
  const [primaryFont, setPrimaryFont] = useState("Playfair Display");
  const [secondaryFont, setSecondaryFont] = useState("Plus Jakarta Sans");
  const [isSavingTheming, setIsSavingTheming] = useState(false);
  const [themingSuccess, setThemingSuccess] = useState(false);
  const [themingError, setThemingError] = useState("");

  useEffect(() => {
    if (user) {
      setInactivityEnabled(user.inactivityEnabled !== false);
      setTimeoutMinutes(user.inactivityTimeoutMinutes ?? 15);
      setWarningSeconds(user.inactivityWarningSeconds ?? 60);
    }
  }, [user]);

  useEffect(() => {
    adminGetOrganization(accessToken)
      .then((data) => {
        setOrg(data);
        if (data.primaryColor) setPrimaryColor(data.primaryColor);
        if (data.secondaryColor) setSecondaryColor(data.secondaryColor);
        if (data.backgroundColor) setBackgroundColor(data.backgroundColor);
        if (data.primaryFont) setPrimaryFont(data.primaryFont);
        if (data.secondaryFont) setSecondaryFont(data.secondaryFont);
      })
      .catch((err) => {
        console.error("Failed to load organization theming settings:", err);
      });
  }, [accessToken]);

  const handleSaveInactivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingInactivity(true);
    setInactivitySuccess(false);
    setInactivityError("");

    try {
      await updateInactivity({
        inactivityEnabled,
        inactivityTimeoutMinutes: Number(timeoutMinutes),
        inactivityWarningSeconds: Number(warningSeconds),
      });
      setInactivitySuccess(true);
      setTimeout(() => setInactivitySuccess(false), 3000);
    } catch (err: any) {
      setInactivityError(err.message || "Failed to save inactivity settings.");
    } finally {
      setIsSavingInactivity(false);
    }
  };

  const handleSaveTheming = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTheming(true);
    setThemingSuccess(false);
    setThemingError("");

    try {
      const updated = await adminUpdateOrganization(
        {
          primaryColor: primaryColor.trim(),
          secondaryColor: secondaryColor.trim(),
          backgroundColor: backgroundColor.trim(),
          primaryFont: primaryFont.trim(),
          secondaryFont: secondaryFont.trim(),
        },
        accessToken
      );
      setOrg(updated);
      if (typeof document !== "undefined") {
        let styleTag = document.getElementById("org-brand-theme") as HTMLStyleElement | null;
        if (!styleTag) {
          styleTag = document.createElement("style");
          styleTag.id = "org-brand-theme";
          document.head.appendChild(styleTag);
        }
        let css = "";
        const p = primaryColor.trim();
        const s = secondaryColor.trim();
        const bg = backgroundColor.trim();
        const pf = primaryFont.trim();
        const sf = secondaryFont.trim();

        if (p || s || bg || pf || sf) {
          css += `:root:not(.dark) {`;
          if (p) css += `--color-primary: ${p}; --color-forest: ${p};`;
          if (s) css += `--color-secondary: ${s}; --color-gold: ${s};`;
          if (bg) css += `--color-bg-base: ${bg};`;
          if (pf) css += `--font-primary: '${pf}', Georgia, serif;`;
          if (sf) css += `--font-secondary: '${sf}', system-ui, sans-serif;`;
          css += `}\n`;

          css += `.dark {`;
          if (p) css += `--color-primary: ${p};`;
          if (s) css += `--color-secondary: ${s};`;
          if (pf) css += `--font-primary: '${pf}', Georgia, serif;`;
          if (sf) css += `--font-secondary: '${sf}', system-ui, sans-serif;`;
          css += `}\n`;
        }
        styleTag.textContent = css;
      }
      setThemingSuccess(true);
      setTimeout(() => setThemingSuccess(false), 3000);
    } catch (err: any) {
      setThemingError(err.message || "Failed to update appearance settings.");
    } finally {
      setIsSavingTheming(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="eyebrow mb-1">Administrative Center</p>
          <h1 className="text-2xl sm:text-3xl font-display text-ink font-semibold">
            System &amp; Workspace Settings
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-soft">
            Manage authenticated staff credentials, security timeouts, and dynamic organization theming.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="bg-gray-100 p-1 rounded-full inline-flex border border-gray-200/80 gap-1 w-fit shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("account")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              activeTab === "account"
                ? "bg-white shadow-md text-primary font-semibold"
                : "text-gray-600 hover:text-gray-900 font-medium"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Account &amp; Security</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("appearance")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm transition-all duration-200 cursor-pointer ${
              activeTab === "appearance"
                ? "bg-white shadow-md text-primary font-semibold"
                : "text-gray-600 hover:text-gray-900 font-medium"
            }`}
          >
            <Palette className="h-4 w-4" />
            <span>Appearance &amp; Theming</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ACCOUNT & INACTIVITY SETTINGS */}
      {activeTab === "account" && (
        <div className="space-y-6">
          <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-forest text-[#FAF7F2] grid place-items-center text-xl font-display font-bold shadow-subtle">
                {user?.fullName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <h2 className="text-lg font-display font-bold text-ink">{user?.fullName}</h2>
                <p className="text-xs text-ink-soft">{user?.email}</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest uppercase font-mono">
                    {user?.role}
                  </span>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                    Active Session
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-line/60 text-xs text-ink-soft">
              <div className="flex justify-between py-1 border-b border-line/40">
                <span>Account ID:</span>
                <span className="font-mono text-ink">{user?.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span>Authentication Model:</span>
                <span className="font-medium text-ink">
                  Strict Single Active Session (One PC at a time) + 7-Day In-Memory JWT
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-line/40">
                <span>Silent Rotation Threshold:</span>
                <span className="text-ink">35 minutes with concurrency grace period &amp; FIFO request queue</span>
              </div>
            </div>
          </Card>

          {/* Inactivity Form */}
          <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-line/60 pb-3">
              <Clock className="h-5 w-5 text-forest" />
              <div>
                <h3 className="text-base font-display font-semibold text-ink">
                  Inactivity Logout Policy
                </h3>
                <p className="text-xs text-ink-soft">
                  Automatically secures unattended workstations after a configured period of idle time.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveInactivity} className="space-y-5">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={inactivityEnabled}
                  onChange={(e) => setInactivityEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-forest focus:ring-forest"
                />
                <div>
                  <span className="text-sm font-semibold text-ink block">
                    Enable automatic idle workstation logout
                  </span>
                  <span className="text-xs text-ink-soft block">
                    When enabled, an interactive warning dialog will appear before terminating the session.
                  </span>
                </div>
              </label>

              {inactivityEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <TextField
                    id="timeout-minutes"
                    label="Idle Timeout (Minutes)"
                    type="number"
                    min={1}
                    max={240}
                    value={timeoutMinutes}
                    onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                    helpText="Default: 15 minutes before warning."
                  />
                  <TextField
                    id="warning-seconds"
                    label="Warning Window (Seconds)"
                    type="number"
                    min={10}
                    max={300}
                    value={warningSeconds}
                    onChange={(e) => setWarningSeconds(Number(e.target.value))}
                    helpText="Duration countdown modal is visible before hard logout."
                  />
                </div>
              )}

              {inactivityError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">
                  {inactivityError}
                </div>
              )}

              {inactivitySuccess && (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Inactivity policies updated successfully.</span>
                </div>
              )}

              <Button type="submit" variant="primary" size="md" disabled={isSavingInactivity}>
                {isSavingInactivity ? "Saving..." : "Save Inactivity Policy"}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 2: APPEARANCE & THEMING */}
      {activeTab === "appearance" && (
        <div className="space-y-6">
          <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-display font-bold text-ink">
                Global Organization Theming
              </h2>
              <p className="mt-1 text-xs text-ink-soft">
                Customise the visual identity across the public website and multi-branch booking flow.
                Values are stored in the database and applied dynamically via CSS variables.
              </p>
            </div>

            {/* Color Palette Quick Presets */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2 font-mono">
                Preset Palettes
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESET_PALETTES.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setPrimaryColor(preset.primary);
                      setSecondaryColor(preset.secondary);
                      setBackgroundColor(preset.bg);
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line bg-white/70 dark:bg-black/30 hover:border-forest text-xs font-medium transition-all"
                  >
                    <div className="flex items-center -space-x-1">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white"
                        style={{ backgroundColor: preset.secondary }}
                      />
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-line"
                        style={{ backgroundColor: preset.bg }}
                      />
                    </div>
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveTheming} className="space-y-6">
              {/* Colors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-ink block mb-1">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-9 w-10 rounded border border-line cursor-pointer p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#1B3B2B"
                      className="flex-1 rounded-lg border border-line bg-white/80 dark:bg-black/20 px-3 py-2 text-xs font-mono text-ink"
                    />
                  </div>
                  <span className="text-[10px] text-ink-soft mt-1 block">
                    Buttons, highlights, brand accents
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink block mb-1">
                    Secondary Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-9 w-10 rounded border border-line cursor-pointer p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#C59B27"
                      className="flex-1 rounded-lg border border-line bg-white/80 dark:bg-black/20 px-3 py-2 text-xs font-mono text-ink"
                    />
                  </div>
                  <span className="text-[10px] text-ink-soft mt-1 block">
                    Badges, sub-headings, stars, icons
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink block mb-1">
                    Background Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="h-9 w-10 rounded border border-line cursor-pointer p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="#FAF7F2"
                      className="flex-1 rounded-lg border border-line bg-white/80 dark:bg-black/20 px-3 py-2 text-xs font-mono text-ink"
                    />
                  </div>
                  <span className="text-[10px] text-ink-soft mt-1 block">
                    Main surface wash &amp; section backgrounds
                  </span>
                </div>
              </div>

              {/* Fonts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-ink block mb-1">
                    Primary Heading Font
                  </label>
                  <select
                    value={primaryFont}
                    onChange={(e) => setPrimaryFont(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white/80 dark:bg-black/20 px-3 py-2 text-xs text-ink"
                  >
                    {PRESET_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-ink-soft mt-1 block">
                    Used for titles, hero statements, and editorial display headings.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-ink block mb-1">
                    Secondary Body Font
                  </label>
                  <select
                    value={secondaryFont}
                    onChange={(e) => setSecondaryFont(e.target.value)}
                    className="w-full rounded-lg border border-line bg-white/80 dark:bg-black/20 px-3 py-2 text-xs text-ink"
                  >
                    {PRESET_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-ink-soft mt-1 block">
                    Used for body copy, fee amounts, and clinical details.
                  </span>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="rounded-2xl border border-line p-5 space-y-3" style={{ backgroundColor }}>
                <p className="text-[10px] uppercase font-mono tracking-wider font-semibold" style={{ color: secondaryColor }}>
                  Live Preview Preview
                </p>
                <h4 className="text-xl font-bold" style={{ fontFamily: primaryFont, color: primaryColor }}>
                  {org?.displayName || "Marlow Dental Complex"}
                </h4>
                <p className="text-xs" style={{ fontFamily: secondaryFont, color: "#374151" }}>
                  Comprehensive, unhurried dental care with direct doctor continuity and transparent fees.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Book Examination
                  </button>
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    Our Branches
                  </button>
                </div>
              </div>

              {themingError && (
                <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs">
                  {themingError}
                </div>
              )}

              {themingSuccess && (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600" />
                  <span>Theming settings saved to database and active.</span>
                </div>
              )}

              <Button type="submit" variant="primary" size="md" disabled={isSavingTheming}>
                {isSavingTheming ? "Saving Theming..." : "Save Theming Settings"}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
