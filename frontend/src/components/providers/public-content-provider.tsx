"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Announcement,
  fetchPublicAnnouncements,
  fetchPublicOrganization,
  fetchPublicWorkingHours,
  getLocations,
  getSiteContent,
  getTeamMembers,
  LocationItem,
  Organization,
  SiteContent,
  TeamMember,
  WorkingHoursItem,
} from "@/lib/api";
import { DEFAULT_CURRENCY } from "@/lib/currency";

const EMPTY_SITE_CONTENT: SiteContent = {
  general: {
    practiceName: "Marlow Dental",
    tagline: "",
    logoUrl: null,
    faviconUrl: null,
    phone: "",
    email: "",
    address: "",
    emergencyPhone: null,
  },
  homepage: {
    heroEyebrow: "Private Dental Practice",
    heroHeading: "Modern, unhurried dental care.",
    heroDescription: "Comprehensive exams, gentle restorations, and transparent fee schedules from a dedicated clinical team.",
    heroCtaText: "Request an appointment",
    heroCtaLink: "/book",
    heroSecondaryCtaText: "View treatment fees",
    heroSecondaryCtaLink: "#services",
    heroImageUrl: null,
  },
  about: {
    eyebrow: "Clinical Care",
    title: "Dedicated, unhurried conservative care.",
    storyParagraphs: [],
    imageUrl: null,
    licensureText: "",
  },
  contact: {
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    transitNote: "",
    hoursSummary: "",
    emergencyNote: "",
  },
  footer: {
    tagline: "",
    copyrightNotice: "",
    cancellationPolicy: "",
  },
  seo: {
    siteTitle: "Marlow Dental",
    metaDescription: "",
    ogImageUrl: null,
  },
};

interface PublicContentContextType {
  content: SiteContent;
  organization: Organization | null;
  announcements: Announcement[];
  locations: LocationItem[];
  clinics: LocationItem[];
  primaryLocation: LocationItem | null;
  workingHours: WorkingHoursItem[];
  team: TeamMember[];
  director: TeamMember | null;
  currency: { code: string; symbol: string; timezone: string };
  isLoading: boolean;
  refreshPublicContent: () => Promise<void>;
}

const PublicContentContext = createContext<PublicContentContextType | undefined>(undefined);

export function PublicContentProvider({ children }: { children: React.ReactNode }) {
  const [content, setContent] = useState<SiteContent>(EMPTY_SITE_CONTENT);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHoursItem[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    try {
      const [contentData, orgData, announcementsData, locationsData, teamData, hoursData] = await Promise.all([
        getSiteContent().catch(() => null),
        fetchPublicOrganization().catch(() => null),
        fetchPublicAnnouncements().catch(() => []),
        getLocations().catch(() => []),
        getTeamMembers().catch(() => []),
        fetchPublicWorkingHours().catch(() => []),
      ]);

      if (contentData) setContent(contentData);
      if (orgData) setOrganization(orgData);
      if (announcementsData) setAnnouncements(announcementsData);
      if (locationsData) setLocations(locationsData);
      if (teamData) setTeam(teamData);
      if (hoursData) setWorkingHours(hoursData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Dynamically inject CSS variables from database Organization theming settings safely
  useEffect(() => {
    if (typeof document !== "undefined") {
      const org = organization;
      const primary = org?.primaryColor;
      const secondary = org?.secondaryColor;
      const bg = org?.backgroundColor;
      const pFont = org?.primaryFont;
      const sFont = org?.secondaryFont;

      let styleTag = document.getElementById("org-brand-theme") as HTMLStyleElement | null;
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "org-brand-theme";
        document.head.appendChild(styleTag);
      }

      let css = "";
      if (primary || secondary || bg || pFont || sFont) {
        // In Light Mode: apply custom brand palette
        css += `:root:not(.dark) {`;
        if (primary) css += `--color-primary: ${primary}; --color-forest: ${primary};`;
        if (secondary) css += `--color-secondary: ${secondary}; --color-gold: ${secondary};`;
        if (bg) css += `--color-bg-base: ${bg};`;
        if (pFont) css += `--font-primary: '${pFont}', Georgia, serif;`;
        if (sFont) css += `--font-secondary: '${sFont}', system-ui, sans-serif;`;
        css += `}\n`;

        // In Dark Mode: keep brand accents, but preserve dark mode background & surface tokens
        css += `.dark {`;
        if (primary) css += `--color-primary: ${primary};`;
        if (secondary) css += `--color-secondary: ${secondary};`;
        if (pFont) css += `--font-primary: '${pFont}', Georgia, serif;`;
        if (sFont) css += `--font-secondary: '${sFont}', system-ui, sans-serif;`;
        css += `}\n`;
      }
      styleTag.textContent = css;
    }
  }, [organization]);

  const primaryLocation =
    locations.find((l) => l.isPrimary && l.isActive) ||
    locations.find((l) => l.isActive) ||
    null;

  const director =
    team.find((m) => m.role === "Director" && m.isActive) ||
    team.find((m) => m.isActive) ||
    null;

  const currency = {
    code: organization?.currencyCode || DEFAULT_CURRENCY.code,
    symbol: organization?.currencySymbol || DEFAULT_CURRENCY.symbol,
    timezone: organization?.timezone || DEFAULT_CURRENCY.timezone,
  };

  return (
    <PublicContentContext.Provider
      value={{
        content,
        organization,
        announcements,
        locations,
        clinics: locations,
        primaryLocation,
        workingHours,
        team,
        director,
        currency,
        isLoading,
        refreshPublicContent: loadData,
      }}
    >
      {children}
    </PublicContentContext.Provider>
  );
}

export function usePublicContent() {
  const context = useContext(PublicContentContext);
  if (!context) {
    throw new Error("usePublicContent must be used within a PublicContentProvider");
  }
  return context;
}
