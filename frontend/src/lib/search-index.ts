export interface SearchResult {
  id: string;
  title: string;
  category: "Service" | "Pricing" | "Doctor" | "Location" | "FAQ" | "Legal";
  snippet: string;
  href: string;
}

const BASE_LEGAL_DOCUMENTS: SearchResult[] = [
  {
    id: "leg-privacy",
    title: "Privacy Policy",
    category: "Legal",
    snippet: "Patient health data privacy, electronic health records protection, and confidentiality commitments.",
    href: "/privacy",
  },
  {
    id: "leg-hipaa",
    title: "HIPAA Notice of Privacy Practices",
    category: "Legal",
    snippet: "Formal disclosures and procedures under the federal Health Insurance Portability and Accountability Act.",
    href: "/hipaa",
  },
  {
    id: "leg-accessibility",
    title: "Accessibility Statement",
    category: "Legal",
    snippet: "Physical ground-floor suite accommodations and digital WCAG 2.1 AA accessibility features.",
    href: "/accessibility",
  },
  {
    id: "leg-terms",
    title: "Terms of Service & Cancellation Policy",
    category: "Legal",
    snippet: "Office scheduling guidelines, 48-hour appointment cancellation notice, and financial agreement terms.",
    href: "/terms",
  },
];

/**
 * Builds dynamic search index entries transformed from live CMS/database records.
 */
export function buildDynamicSearchIndex(params?: {
  services?: Array<{ id: string; title: string; category?: string; shortDesc?: string; cashPrice?: string }>;
  team?: Array<{ id: string; displayName: string; role?: string; professionalTitle?: string; specialties?: string[] }>;
  locations?: Array<{ id: string; name: string; addressLine1: string; city: string; state: string }>;
  faqs?: Array<{ id: string; question: string; answer: string }>;
}): SearchResult[] {
  const docs: SearchResult[] = [];

  if (params) {
    // 1. Dynamic Services
    if (params.services && params.services.length > 0) {
      params.services.forEach((s) => {
        docs.push({
          id: `srv-${s.id}`,
          title: s.title,
          category: "Service",
          snippet: `${s.shortDesc || s.title}${s.cashPrice ? ` · Cash fee ${s.cashPrice}` : ""}`,
          href: "/#services",
        });
      });
    }

    // 2. Dynamic Team Members
    if (params.team && params.team.length > 0) {
      params.team.forEach((m) => {
        docs.push({
          id: `team-${m.id}`,
          title: `${m.displayName} (${m.role || "Practitioner"})`,
          category: "Doctor",
          snippet: `${m.professionalTitle || m.role}${m.specialties?.length ? ` · Specialties: ${m.specialties.join(", ")}` : ""}`,
          href: "/#team",
        });
      });
    }

    // 3. Dynamic Locations
    if (params.locations && params.locations.length > 0) {
      params.locations.forEach((loc) => {
        docs.push({
          id: `loc-${loc.id}`,
          title: `${loc.name} Office Facility`,
          category: "Location",
          snippet: `${loc.addressLine1}, ${loc.city}, ${loc.state}. Accessible clinical suite.`,
          href: "/#visit",
        });
      });
    }

    // 4. Dynamic FAQs
    if (params.faqs && params.faqs.length > 0) {
      params.faqs.forEach((faq) => {
        docs.push({
          id: `faq-${faq.id}`,
          title: faq.question,
          category: "FAQ",
          snippet: faq.answer.slice(0, 160) + "...",
          href: "/#faq",
        });
      });
    }
  }

  return [...docs, ...BASE_LEGAL_DOCUMENTS];
}

/**
 * Searches through the website's index of dental services, pricing, and policies.
 * It matches words entered into the search dialog against service titles, descriptions, and categories.
 */
export function searchSite(query: string, customDocuments?: SearchResult[]): SearchResult[] {
  const clean = query.trim().toLowerCase();
  const pool = customDocuments && customDocuments.length > 0 ? customDocuments : BASE_LEGAL_DOCUMENTS;

  if (!clean) return pool.slice(0, 8);

  const terms = clean.split(/\s+/).filter(Boolean);

  return pool.filter((doc) => {
    const haystack = `${doc.title} ${doc.category} ${doc.snippet}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}
