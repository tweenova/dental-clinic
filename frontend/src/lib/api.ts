/**
 * API Service Abstraction Layer: Marlow Dental
 *
 * This file is the single boundary where HTTP fetch calls to the
 * FastAPI and PostgreSQL backend live.
 */

export interface ServiceItem {
  id: string;
  category: "preventive" | "restorative" | "cosmetic" | "emergency";
  title: string;
  shortDesc: string;
  fullDesc: string;
  duration: string;
  cashPrice: string;
  insuranceNote: string;
  code?: string;
  recommendedInterval?: string;
  highlight?: boolean;
  isActive?: boolean;
  displayOrder?: number;
  bookableOnline?: boolean;
  bufferMinutes?: number;
  providerIds?: string[];
}

export interface DoctorProfile {
  name: string;
  credentials: string;
  title: string;
  licenseNumber: string;
  licenseState: string;
  experienceYears: number;
  almaMater: string;
  undergrad: string;
  memberships: string[];
  certifications: string[];
  philosophy: string[];
}

export interface TeamMember {
  id: string;
  organizationId: string;
  locationId?: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  professionalTitle: string;
  role: string;
  specialties: string[];
  biography?: string | null;
  photoUrl?: string | null;
  education?: string | null;
  credentials?: string | null;
  licenseNumber?: string | null;
  licenseState?: string | null;
  servicesOffered?: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FaqItem {
  id: string;
  category: "insurance" | "pricing" | "comfort" | "scheduling";
  question: string;
  answer: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface BookingPayload {
  serviceId: string;
  preferredDate: string;
  preferredTime: string;
  fullName: string;
  phone: string;
  email: string;
  notes?: string;
  utmSource?: string;
  utmCampaign?: string;
}

export interface BookingResponse {
  success: boolean;
  confirmationId: string;
  message: string;
  estimatedCallbackWindow: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  clinicId?: string | null;
  teamMemberId?: string | null;
  organizationId?: string | null;
  requiresPasswordChange?: boolean;
  inactivityEnabled?: boolean;
  inactivityTimeoutMinutes?: number;
  inactivityWarningSeconds?: number;
}

export interface SiteContent {
  general: {
    practiceName: string;
    tagline: string;
    logoUrl?: string | null;
    faviconUrl?: string | null;
    phone: string;
    email: string;
    address: string;
    emergencyPhone?: string | null;
  };
  homepage: {
    heroEyebrow: string;
    heroHeading: string;
    heroDescription: string;
    heroCtaText: string;
    heroCtaLink: string;
    heroSecondaryCtaText: string;
    heroSecondaryCtaLink: string;
    heroImageUrl?: string | null;
  };
  about: {
    eyebrow: string;
    title: string;
    storyParagraphs: string[];
    imageUrl?: string | null;
    licensureText: string;
  };
  contact: {
    phone: string;
    email: string;
    addressLine1: string;
    addressLine2: string;
    transitNote: string;
    hoursSummary: string;
    emergencyNote: string;
  };
  footer: {
    tagline: string;
    copyrightNotice: string;
    cancellationPolicy: string;
  };
  seo: {
    siteTitle: string;
    metaDescription: string;
    ogImageUrl?: string | null;
  };
}

export interface LocationItem {
  id: string;
  organizationId: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  hoursInfo?: string | null;
  isPrimary: boolean;
  isActive: boolean;
  displayOrder: number;
}

import { formatPrice } from "./currency";

export interface Organization {
  id: string;
  name: string;
  displayName: string;
  tagline?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  primaryFont?: string | null;
  secondaryFont?: string | null;
  currencyCode?: string;
  currencySymbol?: string;
  timezone?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Announcement {
  id: string;
  content: string;
  isActive: boolean;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PublicBookingStatus {
  mode: "open" | "paused" | "closed";
  message?: string | null;
  phone?: string | null;
  resumeOn?: string | null;
}

export interface WorkingHoursItem {
  id: string;
  dayOfWeek: number;
  dayName: string;
  openTime?: string | null;
  closeTime?: string | null;
  isClosed: boolean;
}

export interface ClinicClosureItem {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  message?: string | null;
  clinicId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BookingScheduleData {
  status: PublicBookingStatus;
  workingHours: WorkingHoursItem[];
  closures: ClinicClosureItem[];
  advanceBookingDays: number;
  closedDays: number[];
}

export interface AdminBookingSettings {
  id: string;
  bookingMode: "open" | "paused" | "closed";
  pauseMessage?: string | null;
  pauseStartedAt?: string | null;
  pauseStartedByUserId?: string | null;
  resumeOn?: string | null;
  advanceBookingDays: number;
  minLeadTimeHours?: number;
  slotIntervalMinutes: number;
  reminderTemplate?: string | null;
  fileNumberPrefix?: string | null;
  paymentsEnabled?: boolean;
  isResumePassed: boolean;
}

export interface ProviderAvailabilityItem {
  id: string;
  teamMemberId: string;
  dayOfWeek: number;
  dayName: string;
  startTime: string;
  endTime: string;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
  isActive: boolean;
}

export interface ProviderTimeOffItem {
  id: string;
  teamMemberId: string;
  startDate: string;
  endDate: string;
  reason: string;
  isApproved: boolean;
}

export interface PublicAvailabilityData {
  date: string;
  serviceId?: string | null;
  teamMemberId?: string | null;
  timezone: string;
  slots: string[];
}

export interface AffectedBookingItem {
  id: string;
  confirmationId: string;
  preferredDate: string;
  preferredTime: string;
  patientFullName: string;
  patientPhone: string;
  patientEmail?: string | null;
  status: string;
}

export type ClinicItem = LocationItem;

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* -------------------------------------------------------------
 * PUBLIC API METHODS
 * ------------------------------------------------------------- */

/**
 * Returns the list of active dental procedures from the database.
 */
export async function getServices(): Promise<ServiceItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/services`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch public services");
    const data = (await res.json()) as Array<{
      slug: string;
      category: string;
      title: string;
      shortDesc: string;
      fullDesc?: string;
      duration: string;
      cashPrice: number | string;
      insuranceNote?: string;
      code?: string;
      recommendedInterval?: string;
      isHighlighted: boolean;
      isActive: boolean;
      displayOrder: number;
    }>;
    return data.map((s) => {
      const validCategories: Array<"preventive" | "restorative" | "cosmetic" | "emergency"> = [
        "preventive",
        "restorative",
        "cosmetic",
        "emergency",
      ];
      const category = validCategories.includes(s.category as "preventive" | "restorative" | "cosmetic" | "emergency")
        ? (s.category as "preventive" | "restorative" | "cosmetic" | "emergency")
        : "preventive";

      return {
        id: s.slug,
        category,
        title: s.title,
        shortDesc: s.shortDesc,
        fullDesc: s.fullDesc || s.shortDesc,
        duration: s.duration,
        cashPrice: formatPrice(s.cashPrice),
        insuranceNote: s.insuranceNote || "",
        code: s.code || "",
        recommendedInterval: s.recommendedInterval || "",
        highlight: s.isHighlighted,
        isActive: s.isActive,
        displayOrder: s.displayOrder,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Returns dynamic team members from the database.
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/team`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch team members");
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Returns dynamic database-backed website content for public pages.
 */
export async function getSiteContent(): Promise<SiteContent | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/content`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch site content");
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Returns active FAQ items from the database.
 */
export async function getPublicFaqs(): Promise<FaqItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/faq`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch FAQs");
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Returns active clinic locations from the database.
 */
export async function getLocations(): Promise<LocationItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/locations`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch locations");
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Transmits a patient's appointment booking request across the network to the backend server.
 */
export async function submitBookingRequest(
  payload: BookingPayload
): Promise<BookingResponse> {
  const response = await fetch(`${API_BASE}/api/v1/appointments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = "Failed to submit appointment request.";
    try {
      const errJson = await response.json();
      if (typeof errJson.detail === "string") {
        errorDetail = errJson.detail;
      } else if (Array.isArray(errJson.detail)) {
        errorDetail = errJson.detail
          .map((item: { msg?: string }) => item.msg || JSON.stringify(item))
          .join(". ");
      } else if (errJson.message) {
        errorDetail = errJson.message;
      }
    } catch {
      // Ignore parse failure; retain fallback
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

/* -------------------------------------------------------------
 * AUTHENTICATION & SINGLE-FLIGHT FIFO REQUEST QUEUE
 * ------------------------------------------------------------- */

let inMemoryAccessToken: string | null = null;
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

export function setMemoryAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getMemoryAccessToken(): string | null {
  return inMemoryAccessToken;
}

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Centralized authenticated request layer.
 * Enforces single-flight refresh lock and FIFO replay queue upon 401 token expiration.
 */
export async function authorizedFetch(
  endpoint: string,
  options: RequestInit = {},
  explicitToken?: string | null
): Promise<Response> {
  const token = explicitToken || inMemoryAccessToken;
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const reqOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include", // Transmit HttpOnly refresh cookie
  };

  const fullUrl = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(fullUrl, reqOptions);

  // If token expired (401) and not an auth negotiation endpoint, queue and refresh
  if (
    response.status === 401 &&
    !endpoint.includes("/auth/login") &&
    !endpoint.includes("/auth/refresh")
  ) {
    if (isRefreshing) {
      // 1. Refresh already in progress: queue request in FIFO order
      return new Promise<Response>((resolve, reject) => {
        failedQueue.push({
          resolve: async (newToken: string) => {
            try {
              const retryHeaders = new Headers(options.headers || {});
              retryHeaders.set("Authorization", `Bearer ${newToken}`);
              if (!retryHeaders.has("Content-Type") && !(options.body instanceof FormData)) {
                retryHeaders.set("Content-Type", "application/json");
              }
              const retryRes = await fetch(fullUrl, {
                ...options,
                headers: retryHeaders,
                credentials: "include",
              });
              resolve(retryRes);
            } catch (err) {
              reject(err);
            }
          },
          reject: (err) => {
            reject(err);
          },
        });
      });
    }

    // 2. Start single-flight refresh
    isRefreshing = true;
    try {
      const refreshData = await refreshAuthToken();
      setMemoryAccessToken(refreshData.accessToken);

      // Replay all queued pending requests in original FIFO order
      processQueue(null, refreshData.accessToken);

      // Replay the triggering request
      const retryHeaders = new Headers(options.headers || {});
      retryHeaders.set("Authorization", `Bearer ${refreshData.accessToken}`);
      if (!retryHeaders.has("Content-Type") && !(options.body instanceof FormData)) {
        retryHeaders.set("Content-Type", "application/json");
      }
      return await fetch(fullUrl, {
        ...options,
        headers: retryHeaders,
        credentials: "include",
      });
    } catch (refreshErr) {
      // Refresh failed: reject all queued requests, clear memory, notify auth context
      processQueue(refreshErr, null);
      setMemoryAccessToken(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("marlow:auth:logout"));
      }
      throw refreshErr;
    } finally {
      isRefreshing = false;
    }
  }

  return response;
}

export async function login(payload: { email: string; password: string }): Promise<{
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: User;
}> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Send & store HttpOnly cookie
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let msg = "Invalid email or password.";
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch {}
    throw new Error(msg);
  }

  const data = await res.json();
  setMemoryAccessToken(data.accessToken);
  return data;
}

export async function refreshAuthToken(): Promise<{
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
}> {
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include", // Receives & sends HttpOnly cookie
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error("Session expired or refresh token invalid.");
  }

  const data = await res.json();
  setMemoryAccessToken(data.accessToken);
  return data;
}

export async function logout(): Promise<void> {
  setMemoryAccessToken(null);
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {}
}

export async function getMe(accessToken?: string): Promise<User> {
  const res = await authorizedFetch("/api/v1/auth/me", {}, accessToken);
  if (!res.ok) {
    throw new Error("Unable to retrieve user profile.");
  }
  return res.json();
}

/** Changes the authenticated user's own password. Satisfies requiresPasswordChange. */
export async function changePassword(
  payload: { oldPassword: string; newPassword: string },
  token?: string
): Promise<{ success: boolean; message: string }> {
  const res = await authorizedFetch(
    "/api/v1/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to change password.");
  }
  return res.json();
}

export async function updateInactivitySettings(
  payload: {
    inactivityEnabled: boolean;
    inactivityTimeoutMinutes: number;
    inactivityWarningSeconds: number;
  },
  token?: string
): Promise<User> {
  const res = await authorizedFetch(
    "/api/v1/auth/inactivity-settings",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update inactivity settings.");
  }
  return res.json();
}

/* -------------------------------------------------------------
 * ADMIN CMS & MANAGEMENT API METHODS (ROUTED THROUGH FIFO QUEUE)
 * ------------------------------------------------------------- */

export async function adminGetCmsSection(section: string, token?: string) {
  const res = await authorizedFetch(`/api/v1/admin/cms/${section}`, {}, token);
  if (!res.ok) throw new Error(`Failed to load ${section} section.`);
  return res.json();
}

export async function adminUpdateCmsSection(section: string, data: Record<string, unknown>, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/cms/${section}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) throw new Error(`Failed to update ${section} section.`);
  return res.json();
}

// Services
export async function adminGetServices(token?: string) {
  const res = await authorizedFetch(`/api/v1/admin/services`, {}, token);
  if (!res.ok) throw new Error("Failed to load services.");
  return res.json();
}

export async function adminCreateService(data: Record<string, unknown>, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/services`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create service.");
  }
  return res.json();
}

export async function adminUpdateService(id: string, data: Record<string, unknown>, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/services/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update service.");
  }
  return res.json();
}

export async function adminToggleServiceStatus(id: string, isActive: boolean, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/services/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
    token
  );
  if (!res.ok) throw new Error("Failed to update service status.");
  return res.json();
}

/** Persists the display order of services from an ordered list of IDs. */
export async function adminReorderServices(orderedIds: string[], token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/services/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({ orderedIds }),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reorder services.");
  }
  return res.json();
}

/** Persists the display order of team members from an ordered list of IDs. */
export async function adminReorderTeam(orderedIds: string[], token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/team/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({ orderedIds }),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reorder team members.");
  }
  return res.json();
}

/** Persists the display order of FAQ items from an ordered list of IDs. */
export async function adminReorderFaqs(orderedIds: string[], token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/faq/reorder`,
    {
      method: "PATCH",
      body: JSON.stringify({ orderedIds }),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reorder FAQs.");
  }
  return res.json();
}

// Team
export async function adminGetTeam(token?: string): Promise<TeamMember[]> {
  const res = await authorizedFetch(`/api/v1/admin/team`, {}, token);
  if (!res.ok) throw new Error("Failed to load team members.");
  return res.json();
}

export async function adminCreateTeamMember(data: Record<string, unknown>, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/team`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create team member.");
  }
  return res.json();
}

export async function adminUpdateTeamMember(id: string, data: Record<string, unknown>, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/team/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update team member.");
  }
  return res.json();
}

export async function adminToggleTeamMemberStatus(id: string, isActive: boolean, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/team/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
    token
  );
  if (!res.ok) throw new Error("Failed to update team member status.");
  return res.json();
}

// FAQs
export async function adminGetFaqs(token?: string): Promise<FaqItem[]> {
  const res = await authorizedFetch(`/api/v1/admin/faq`, {}, token);
  if (!res.ok) throw new Error("Failed to load FAQs.");
  return res.json();
}

export async function adminCreateFaq(data: Record<string, unknown>, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/faq`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) throw new Error("Failed to create FAQ item.");
  return res.json();
}

export async function adminUpdateFaq(id: string, data: Record<string, unknown>, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/faq/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) throw new Error("Failed to update FAQ item.");
  return res.json();
}

export async function adminToggleFaqStatus(id: string, isActive: boolean, token?: string) {
  const res = await authorizedFetch(
    `/api/v1/admin/faq/${id}/status?is_active=${isActive}`,
    {
      method: "PATCH",
    },
    token
  );
  if (!res.ok) throw new Error("Failed to update FAQ status.");
  return res.json();
}

// Media upload
export async function adminUploadMedia(file: File, token?: string): Promise<{ url: string; filename: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await authorizedFetch(
    `/api/v1/admin/media/upload`,
    {
      method: "POST",
      body: formData,
    },
    token
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to upload file.");
  }

  return res.json();
}

// Public Organization & Theming
export async function fetchPublicOrganization(): Promise<Organization | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/organization`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Public Announcements (Marquee ticker)
export async function fetchPublicAnnouncements(): Promise<Announcement[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/announcements`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Public Clinics / Locations
export async function fetchPublicClinics(): Promise<ClinicItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/clinics`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Public Booking Availability Status
export async function fetchPublicBookingStatus(): Promise<PublicBookingStatus> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/booking-status`, {
      cache: "no-store",
    });
    if (!res.ok) return { mode: "open" };
    return await res.json();
  } catch {
    return { mode: "open" };
  }
}

// Public Single Source of Truth Working Hours
export async function fetchPublicWorkingHours(): Promise<WorkingHoursItem[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/working-hours`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Public Booking Consolidated Schedule (Hours, Closures, Window)
export async function fetchPublicBookingSchedule(): Promise<BookingScheduleData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/public/booking-schedule`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Admin Organization
export async function adminGetOrganization(token?: string | null): Promise<Organization> {
  const res = await authorizedFetch(`/api/v1/admin/organization`, {}, token);
  if (!res.ok) throw new Error("Failed to load organization settings.");
  return res.json();
}

export async function adminUpdateOrganization(data: Partial<Organization>, token?: string | null): Promise<Organization> {
  const res = await authorizedFetch(
    `/api/v1/admin/organization`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update organization settings.");
  }
  return res.json();
}

// Admin Locations
export async function adminGetLocations(token?: string | null): Promise<LocationItem[]> {
  const res = await authorizedFetch(`/api/v1/admin/locations`, {}, token);
  if (!res.ok) throw new Error("Failed to load locations.");
  return res.json();
}

export async function adminCreateLocation(data: {
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  phone?: string | null;
  email?: string | null;
  hoursInfo?: string | null;
  isPrimary?: boolean;
  displayOrder?: number;
}, token?: string | null): Promise<LocationItem> {
  const res = await authorizedFetch(
    `/api/v1/admin/locations`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create location.");
  }
  return res.json();
}

export async function adminUpdateLocation(id: string, data: {
  name?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string | null;
  email?: string | null;
  hoursInfo?: string | null;
  isPrimary?: boolean;
  displayOrder?: number;
}, token?: string | null): Promise<LocationItem> {
  const res = await authorizedFetch(
    `/api/v1/admin/locations/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update location.");
  }
  return res.json();
}

export async function adminToggleLocationStatus(id: string, isActive: boolean, token?: string | null): Promise<LocationItem> {
  const res = await authorizedFetch(
    `/api/v1/admin/locations/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
    token
  );
  if (!res.ok) throw new Error("Failed to update location status.");
  return res.json();
}

// Admin Announcements
export async function adminGetAnnouncements(token?: string | null): Promise<Announcement[]> {
  const res = await authorizedFetch(`/api/v1/admin/announcements`, {}, token);
  if (!res.ok) throw new Error("Failed to load announcements.");
  return res.json();
}

export async function adminCreateAnnouncement(data: { content: string; isActive?: boolean; displayOrder?: number }, token?: string | null): Promise<Announcement> {
  const res = await authorizedFetch(
    `/api/v1/admin/announcements`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create announcement.");
  }
  return res.json();
}

export async function adminUpdateAnnouncement(id: string, data: { content?: string; isActive?: boolean; displayOrder?: number }, token?: string | null): Promise<Announcement> {
  const res = await authorizedFetch(
    `/api/v1/admin/announcements/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update announcement.");
  }
  return res.json();
}

export async function adminDeleteAnnouncement(id: string, token?: string | null): Promise<void> {
  const res = await authorizedFetch(
    `/api/v1/admin/announcements/${id}`,
    {
      method: "DELETE",
    },
    token
  );
  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete announcement.");
  }
}

// -------------------------------------------------------------
// Admin Booking Operations, Emergency Pause & Calendar Closures
// -------------------------------------------------------------

export async function adminGetBookingSettings(token?: string | null): Promise<AdminBookingSettings> {
  const res = await authorizedFetch(`/api/v1/admin/booking/settings`, {}, token);
  if (!res.ok) throw new Error("Failed to load booking settings.");
  return res.json();
}

export async function adminUpdateBookingMode(
  data: { mode: "open" | "paused" | "closed"; message?: string; resumeOn?: string },
  token?: string | null
): Promise<{ settings: AdminBookingSettings; affectedBookings: AffectedBookingItem[] }> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/mode`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update booking mode.");
  }
  return res.json();
}

export async function adminGetAffectedBookings(
  startDate: string,
  endDate?: string,
  token?: string | null
): Promise<AffectedBookingItem[]> {
  const q = new URLSearchParams({ startDate });
  if (endDate) q.append("endDate", endDate);
  const res = await authorizedFetch(`/api/v1/admin/booking/affected-bookings?${q.toString()}`, {}, token);
  if (!res.ok) throw new Error("Failed to load affected bookings.");
  return res.json();
}

export async function adminCreateRescheduleTasks(
  bookingIds: string[],
  token?: string | null
): Promise<{ tasksCreated: number; taskIds: string[] }> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/reschedule-tasks`,
    {
      method: "POST",
      body: JSON.stringify({ bookingIds }),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create reschedule tasks.");
  }
  return res.json();
}

export async function adminGetClosures(token?: string | null): Promise<ClinicClosureItem[]> {
  const res = await authorizedFetch(`/api/v1/admin/booking/closures`, {}, token);
  if (!res.ok) throw new Error("Failed to load planned closures.");
  return res.json();
}

export async function adminCreateClosure(
  data: { startDate: string; endDate: string; reason: string; message?: string },
  token?: string | null
): Promise<{ closure: ClinicClosureItem; affectedBookings: AffectedBookingItem[] }> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/closures`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create calendar closure.");
  }
  return res.json();
}

export async function adminUpdateClosure(
  id: string,
  data: { startDate: string; endDate: string; reason: string; message?: string },
  token?: string | null
): Promise<ClinicClosureItem> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/closures/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update calendar closure.");
  }
  return res.json();
}

export async function adminDeleteClosure(id: string, token?: string | null): Promise<void> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/closures/${id}`,
    {
      method: "DELETE",
    },
    token
  );
  if (!res.ok && res.status !== 204) {
    throw new Error("Failed to delete calendar closure.");
  }
}

export async function adminGetWorkingHours(token?: string | null): Promise<WorkingHoursItem[]> {
  const res = await authorizedFetch(`/api/v1/admin/booking/working-hours`, {}, token);
  if (!res.ok) throw new Error("Failed to load clinic working hours.");
  return res.json();
}

export async function adminUpdateWorkingHours(
  updates: Array<{ dayOfWeek: number; openTime?: string | null; closeTime?: string | null; isClosed: boolean }>,
  token?: string | null
): Promise<WorkingHoursItem[]> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/working-hours`,
    {
      method: "PUT",
      body: JSON.stringify(updates),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update working hours.");
  }
  return res.json();
}

export async function getPublicAvailability(params: {
  date?: string;
  serviceId?: string;
  teamMemberId?: string;
}): Promise<PublicAvailabilityData> {
  const q = new URLSearchParams();
  if (params.date) q.append("date", params.date);
  if (params.serviceId) q.append("serviceId", params.serviceId);
  if (params.teamMemberId) q.append("teamMemberId", params.teamMemberId);
  const res = await fetch(`${API_BASE}/api/v1/public/availability?${q.toString()}`);
  if (!res.ok) throw new Error("Failed to load appointment availability.");
  return res.json();
}

export async function adminUpdateOnlineBookingRules(
  data: {
    slotIntervalMinutes: number;
    minLeadTimeHours: number;
    advanceBookingDays: number;
    reminderTemplate?: string;
    waitingThresholdMinutes?: number;
    fileNumberPrefix?: string;
    paymentsEnabled?: boolean;
  },
  token?: string | null
): Promise<AdminBookingSettings> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/rules`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update online booking rules.");
  }
  return res.json();
}

export async function adminUpdateReminderTemplate(
  template: string,
  token?: string | null
): Promise<AdminBookingSettings> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/reminder-template`,
    {
      method: "PUT",
      body: JSON.stringify({ template }),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update reminder template.");
  }
  return res.json();
}

export async function adminGetProviderAvailabilities(
  teamMemberId?: string,
  token?: string | null
): Promise<ProviderAvailabilityItem[]> {
  const q = teamMemberId ? `?teamMemberId=${teamMemberId}` : "";
  const res = await authorizedFetch(`/api/v1/admin/booking/provider-availability${q}`, {}, token);
  if (!res.ok) throw new Error("Failed to load clinician shifts.");
  return res.json();
}

export async function adminSaveProviderAvailability(
  data: {
    teamMemberId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    breakStartTime?: string | null;
    breakEndTime?: string | null;
    isActive?: boolean;
  },
  token?: string | null
): Promise<{ availability: ProviderAvailabilityItem; affectedBookings: AffectedBookingItem[] }> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/provider-availability`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save clinician schedule.");
  }
  return res.json();
}

export async function adminDeleteProviderAvailability(
  availId: string,
  token?: string | null
): Promise<void> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/provider-availability/${availId}`,
    { method: "DELETE" },
    token
  );
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete clinician schedule.");
}

export async function adminGetProviderTimeOff(
  teamMemberId?: string,
  futureOnly: boolean = false,
  token?: string | null
): Promise<ProviderTimeOffItem[]> {
  const q = new URLSearchParams();
  if (teamMemberId) q.append("teamMemberId", teamMemberId);
  if (futureOnly) q.append("futureOnly", "true");
  const res = await authorizedFetch(`/api/v1/admin/booking/provider-time-off?${q.toString()}`, {}, token);
  if (!res.ok) throw new Error("Failed to load clinician time off.");
  return res.json();
}

export async function adminSaveProviderTimeOff(
  data: {
    teamMemberId: string;
    startDate: string;
    endDate: string;
    reason: string;
    isApproved?: boolean;
  },
  token?: string | null
): Promise<{ timeOff: ProviderTimeOffItem; affectedBookings: AffectedBookingItem[] }> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/provider-time-off`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save clinician time off.");
  }
  return res.json();
}

export async function adminDeleteProviderTimeOff(
  timeOffId: string,
  token?: string | null
): Promise<void> {
  const res = await authorizedFetch(
    `/api/v1/admin/booking/provider-time-off/${timeOffId}`,
    { method: "DELETE" },
    token
  );
  if (!res.ok && res.status !== 204) throw new Error("Failed to delete clinician time off.");
}


// Admin Permissions Matrix
export interface PermissionMatrixItem {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string;
}

export interface PermissionsMatrixData {
  roles: string[];
  permissions: PermissionMatrixItem[];
  matrix: Record<string, string[]>;
}

export async function adminGetPermissions(token?: string | null): Promise<PermissionsMatrixData> {
  const res = await authorizedFetch(`/api/v1/admin/permissions`, {}, token);
  if (!res.ok) throw new Error("Failed to load permissions matrix.");
  return res.json();
}

export async function adminUpdatePermissions(
  matrix: Record<string, string[]>,
  token?: string | null
): Promise<PermissionsMatrixData> {
  const res = await authorizedFetch(
    `/api/v1/admin/permissions`,
    {
      method: "PUT",
      body: JSON.stringify({ matrix }),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update permissions matrix.");
  }
  return res.json();
}


// ==========================================
// Receptionist & Doctor Operations API Layer
// ==========================================
// Contract notes (verified against backend/app/api/v1/endpoints):
//  - Real routes: /reception/dashboard, /schedule, /appointments,
//    /patients, /tasks, /messages, /leads, /recalls, /waitlist and
//    /doctor/schedule, /doctor/appointments/{id}/notes.
//    There is NO /reception/huddle, /requests, /confirmations or
//    /bookings route; those UI concepts map onto /appointments queries.
//  - Request and response bodies are camelCase (Pydantic DTOs).
//  - Booking lifecycle statuses (single vocabulary, shared by the UI):
//    requested, confirmed, arrived, checked_in, waiting, in_progress,
//    completed, cancelled, no_show, waitlist.
//  - The mapping functions below translate backend DTOs into the shapes
//    the pages consume, so pages never touch raw response shapes.

/* --- Raw backend DTOs (response shapes as returned by FastAPI) --- */

interface RawBooking {
  id: string;
  confirmationId: string;
  preferredDate: string;
  preferredTime: string;
  patientFullName: string;
  patientPhone: string;
  patientEmail: string;
  status: string;
  clinicId?: string | null;
  patientId?: string | null;
  serviceId?: string | null;
  teamMemberId?: string | null;
  slotId?: string | null;
  notes?: string | null;
  staffNotes?: string | null;
  arrivedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancellationReason?: string | null;
  cancelledByUserId?: string | null;
  remindedAt?: string | null;
  remindedByUserId?: string | null;
  remindedByName?: string | null;
  clinicianName?: string | null;
  serviceName?: string | null;
  hasAlerts?: boolean;
  paymentStatus?: "paid" | "unpaid" | "partial" | null;
  createdAt: string;
  updatedAt: string;
}

interface RawAttentionItem {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  actionRoute: string;
  severity: string;
  targetId?: string;
  bookingId?: string | null;
  taskId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  availableActions?: ("confirm" | "check_in" | "snooze" | "create_task")[];
}

interface RawDashboardSummary {
  todayAppointments: number;
  confirmedCount: number;
  unconfirmedCount: number;
  checkedInCount: number;
  waitingCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  pendingRequestsCount: number;
  unconfirmedTomorrowCount?: number;
  waitingDelayedCount?: number;
  overdueTasksCount?: number;
  pastUnresolvedCount?: number;
  urgentTasksCount: number;
  newLeadsCount: number;
  recallsDueCount: number;
  needsAttentionCount: number;
  todayFlow: RawBooking[];
  needsAttentionItems: RawAttentionItem[];
  needsActionQueue?: RawAttentionItem[];
}

interface RawPatient {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email?: string | null;
  clinicId?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
  isActive: boolean;
  hasAlerts?: boolean;
  medicalHistoryStatus?: string;
  fileNumber?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  messagingOptOut?: boolean;
  preferredChannel?: string;
  createdAt: string;
  updatedAt: string;
}

interface RawPatientProfile {
  patient: RawPatient;
  upcomingAppointments: RawBooking[];
  pastAppointments: RawBooking[];
  tasks: unknown[];
  messages: unknown[];
}

interface RawTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  clinicId?: string | null;
  assignedToUserId?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RawMessage {
  id: string;
  content: string;
  senderId?: string | null;
  recipientId?: string | null;
  phone?: string | null;
  email?: string | null;
  channel: string;
  status: string;
  createdAt: string;
}

interface RawLead {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  clinicId?: string | null;
  patientId?: string | null;
  leadSourceId?: string | null;
  status: string;
  notes?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* --- Frontend-facing shapes (consumed by pages) --- */

export interface ReceptionDashboardStats {
  todayAppointments: number;
  confirmedCount: number;
  unconfirmedCount: number;
  checkedInCount: number;
  waitingCount: number;
  inProgressCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  pendingRequestsCount: number;
  unconfirmedTomorrowCount: number;
  waitingDelayedCount: number;
  overdueTasksCount: number;
  pastUnresolvedCount: number;
  urgentTasksCount: number;
  newLeadsCount: number;
  recallsDueCount: number;
  needsAttentionCount: number;
  todayFlow: ReceptionTodayFlowItem[];
  needsAttention: ReceptionAttentionItem[];
}

export interface ReceptionTodayFlowItem {
  id: string;
  bookingNumber: string;
  appointmentTime: string;
  patientId?: string | null;
  patientName: string;
  patientPhone: string;
  providerId?: string | null;
  serviceId?: string | null;
  clinicId?: string | null;
  status: string;
  confirmationStatus: "confirmed" | "unconfirmed";
}

export interface ReceptionAttentionItem {
  id: string;
  type: string;
  title: string;
  description: string;
  link: string;
  priority: string;
  severity?: string;
  targetId?: string;
  bookingId?: string | null;
  taskId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  availableActions?: ("confirm" | "check_in" | "snooze" | "create_task")[];
}

export interface ReceptionBooking {
  id: string;
  bookingNumber: string;
  patientId?: string | null;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  clinicId?: string | null;
  providerId?: string | null;
  serviceId?: string | null;
  bookingDate: string;
  bookingTime: string;
  status: string;
  confirmationStatus: "confirmed" | "unconfirmed";
  notes?: string | null;
  staffNotes?: string | null;
  arrivedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancellationReason?: string | null;
  cancelledByUserId?: string | null;
  remindedAt?: string | null;
  remindedByUserId?: string | null;
  remindedByName?: string | null;
  clinicianName?: string | null;
  serviceName?: string | null;
  hasAlerts?: boolean;
  paymentStatus?: "paid" | "unpaid" | "partial" | null;
  createdAt: string;
  updatedAt: string;
}


export interface ReceptionPatient {
  id: string;
  clinicId?: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
  isActive: boolean;
  hasAlerts?: boolean;
  medicalHistoryStatus?: string;
  fileNumber?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  messagingOptOut?: boolean;
  preferredChannel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionPatientDetail extends ReceptionPatient {
  upcomingBookings: ReceptionBooking[];
  pastBookings: ReceptionBooking[];
  /** Backend returns [] for tasks/messages on a patient profile today. */
  taskCount: number;
  messageCount: number;
}

export interface ReceptionTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: string | null;
  assignedToUserId?: string | null;
  clinicId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionMessage {
  id: string;
  content: string;
  channel: string;
  status: string;
  recipient?: string | null;
  senderId?: string | null;
  createdAt: string;
}

export interface ReceptionLead {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  status: string;
  notes?: string | null;
  clinicId?: string | null;
  convertedPatientId?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionRequestItem {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  preferredDate: string;
  preferredTime: string;
  serviceId?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
}

export interface ReceptionRecall {
  patientId: string;
  patientName: string;
  phone: string;
  email?: string | null;
  lastVisitDate: string;
  serviceId?: string | null;
  serviceName?: string | null;
  recallIntervalDays?: number;
  dueDate: string;
  status: string;
  clinicId?: string | null;
  hasOpenTask?: boolean;
  taskId?: string | null;
}

export interface WaitlistOfferCandidate {
  waitlistBookingId: string;
  confirmationId: string;
  patientId?: string | null;
  patientName: string;
  patientPhone: string;
  patientEmail?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  notes?: string | null;
  hasOpenOfferTask: boolean;
  taskId?: string | null;
}

export interface VisitPayment {
  id: string;
  clinicId?: string | null;
  bookingId?: string | null;
  patientId?: string | null;
  amountCents: number;
  amountFormatted: string;
  amountChargedCents?: number;
  amountChargedFormatted?: string | null;
  currency: string;
  method: "cash" | "card" | "bank_transfer" | string;
  notes?: string | null;
  isVoided?: boolean;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedByUserId?: string | null;
  voidedByName?: string | null;
  recordedByUserId?: string | null;
  recordedByName?: string | null;
  createdAt: string;
}

export interface EndOfDayPaymentsSummary {
  targetDate: string;
  totalCents: number;
  cashCents: number;
  cardCents: number;
  transferCents: number;
  paymentCount: number;
  payments: VisitPayment[];
}


/* --- Mappers: backend DTO -> frontend shape --- */

function mapBooking(raw: RawBooking): ReceptionBooking {
  return {
    id: raw.id,
    bookingNumber: raw.confirmationId,
    patientId: raw.patientId,
    patientName: raw.patientFullName,
    patientPhone: raw.patientPhone,
    patientEmail: raw.patientEmail,
    clinicId: raw.clinicId,
    providerId: raw.teamMemberId,
    serviceId: raw.serviceId,
    bookingDate: raw.preferredDate,
    bookingTime: raw.preferredTime,
    status: raw.status,
    // Derived from the real lifecycle status; "requested" means the patient
    // booking has not been confirmed by the clinic yet.
    confirmationStatus: raw.status === "requested" ? "unconfirmed" : "confirmed",
    notes: raw.notes,
    staffNotes: raw.staffNotes,
    arrivedAt: raw.arrivedAt,
    startedAt: raw.startedAt,
    completedAt: raw.completedAt,
    cancellationReason: raw.cancellationReason,
    cancelledByUserId: raw.cancelledByUserId,
    remindedAt: raw.remindedAt,
    remindedByUserId: raw.remindedByUserId,
    remindedByName: raw.remindedByName,
    clinicianName: raw.clinicianName,
    serviceName: raw.serviceName,
    hasAlerts: raw.hasAlerts ?? false,
    paymentStatus: raw.paymentStatus ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function mapPatient(raw: RawPatient): ReceptionPatient {
  return { ...raw };
}

function mapTask(raw: RawTask): ReceptionTask {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    priority: raw.priority,
    dueDate: raw.dueDate,
    assignedToUserId: raw.assignedToUserId,
    clinicId: raw.clinicId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function mapMessage(raw: RawMessage): ReceptionMessage {
  return {
    id: raw.id,
    content: raw.content,
    channel: raw.channel,
    status: raw.status,
    recipient: raw.phone || raw.email || null,
    senderId: raw.senderId,
    createdAt: raw.createdAt,
  };
}

function mapLead(raw: RawLead): ReceptionLead {
  return {
    id: raw.id,
    fullName: raw.fullName,
    phone: raw.phone,
    email: raw.email,
    status: raw.status,
    notes: raw.notes,
    clinicId: raw.clinicId,
    convertedPatientId: raw.patientId,
    utmSource: raw.utmSource,
    utmCampaign: raw.utmCampaign,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

/** Parses a backend error payload into a user-facing message. */
async function apiError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const detail =
    typeof err.detail === "string"
      ? err.detail
      : Array.isArray(err.detail)
      ? err.detail
          .map((d: { msg?: string; loc?: string[] }) => `${d.loc?.join(".")}: ${d.msg}`)
          .join("; ")
      : fallback;
  throw new Error(detail || fallback);
}


/* --- Dashboard --- */

export async function getReceptionDashboard(
  token?: string | null
): Promise<ReceptionDashboardStats> {
  const res = await authorizedFetch(`/api/v1/reception/dashboard`, {}, token);
  if (!res.ok) throw new Error("Failed to fetch reception dashboard data.");
  const raw: RawDashboardSummary = await res.json();
  return {
    todayAppointments: raw.todayAppointments,
    confirmedCount: raw.confirmedCount,
    unconfirmedCount: raw.unconfirmedCount,
    checkedInCount: raw.checkedInCount,
    waitingCount: raw.waitingCount,
    inProgressCount: raw.inProgressCount,
    completedCount: raw.completedCount,
    cancelledCount: raw.cancelledCount,
    noShowCount: raw.noShowCount,
    pendingRequestsCount: raw.pendingRequestsCount,
    unconfirmedTomorrowCount: raw.unconfirmedTomorrowCount || 0,
    waitingDelayedCount: raw.waitingDelayedCount || 0,
    overdueTasksCount: raw.overdueTasksCount || 0,
    pastUnresolvedCount: raw.pastUnresolvedCount || 0,
    urgentTasksCount: raw.urgentTasksCount,
    newLeadsCount: raw.newLeadsCount,
    recallsDueCount: raw.recallsDueCount,
    needsAttentionCount: raw.needsAttentionCount,
    todayFlow: (raw.todayFlow || []).map((b) => ({
      id: b.id,
      bookingNumber: b.confirmationId,
      appointmentTime: b.preferredTime,
      patientId: b.patientId,
      patientName: b.patientFullName,
      patientPhone: b.patientPhone,
      providerId: b.teamMemberId,
      serviceId: b.serviceId,
      clinicId: b.clinicId,
      status: b.status,
      confirmationStatus: b.status === "requested" ? "unconfirmed" : "confirmed",
    })),
    needsAttention: (raw.needsAttentionItems || []).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.subtitle,
      link: item.actionRoute,
      priority: item.severity,
      severity: item.severity,
      targetId: item.targetId,
      bookingId: item.bookingId,
      taskId: item.taskId,
      patientId: item.patientId,
      patientName: item.patientName,
      patientPhone: item.patientPhone,
      availableActions: item.availableActions,
    })),
  };
}

export async function snoozeReceptionQueueItem(
  itemType: "booking" | "task",
  itemId: string,
  durationHours = 24,
  token?: string | null
): Promise<{ success: boolean; itemId: string; snoozedUntil: string }> {
  const res = await authorizedFetch(
    `/api/v1/reception/dashboard/snooze`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType, itemId, durationHours }),
    },
    token
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to snooze queue item.");
  }
  return res.json();
}

/* --- Schedule & appointments (backend: /reception/schedule, /appointments) --- */

export async function getReceptionBookings(
  params?: { date?: string; provider_id?: string; clinic_id?: string; status?: string; search?: string },
  token?: string | null
): Promise<ReceptionBooking[]> {
  const query = new URLSearchParams();
  if (params?.date) {
    query.set("date_from", params.date);
    query.set("date_to", params.date);
  }
  if (params?.provider_id) query.set("team_member_id", params.provider_id);
  if (params?.clinic_id) query.set("clinic_id", params.clinic_id);
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);

  const res = await authorizedFetch(`/api/v1/reception/schedule?${query.toString()}`, {}, token);
  if (!res.ok) throw new Error("Failed to fetch reception bookings.");
  const raw: RawBooking[] = await res.json();
  return raw.map(mapBooking);
}


export async function createReceptionBooking(
  data: {
    patientId?: string;
    patientFullName?: string;
    patientPhone?: string;
    patientEmail?: string;
    teamMemberId?: string | null;
    serviceId?: string | null;
    clinicId?: string | null;
    bookingDate: string;
    bookingTime: string;
    notes?: string;
    status?: string;
  },
  token?: string | null
): Promise<ReceptionBooking> {
  // Backend requires patient contact fields; resolve them from the patient
  // chart when only an id was supplied by the caller.
  let fullName = data.patientFullName;
  let phone = data.patientPhone;
  let email = data.patientEmail;
  if (data.patientId && (!fullName || !phone)) {
    const profile = await getReceptionPatient(data.patientId, token);
    fullName = fullName || profile.fullName;
    phone = phone || profile.phone;
    email = email || profile.email || undefined;
  }
  if (!email && phone) {
    email = `${phone.replace(/\D/g, "") || "patient"}@marlow.internal`;
  }
  if (!fullName || !phone || !email) {
    throw new Error("Patient name, phone and email are required to book an appointment.");
  }

  const res = await authorizedFetch(
    `/api/v1/reception/appointments`,
    {
      method: "POST",
      body: JSON.stringify({
        patientFullName: fullName,
        patientPhone: phone,
        patientEmail: email,
        preferredDate: data.bookingDate,
        preferredTime: data.bookingTime,
        patientId: data.patientId ?? null,
        teamMemberId: data.teamMemberId ?? null,
        serviceId: data.serviceId ?? null,
        clinicId: data.clinicId ?? null,
        notes: data.notes ?? null,
        status: data.status || "confirmed",
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create booking.");
  return mapBooking(await res.json());
}

export async function updateReceptionBookingStatus(
  bookingId: string,
  status: string,
  staffNotes?: string,
  token?: string | null,
  cancellationReason?: string
): Promise<ReceptionBooking> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
        staffNotes: staffNotes ?? null,
        cancellationReason: cancellationReason ?? null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update booking status.");
  return mapBooking(await res.json());
}

/**
 * Confirms an unconfirmed (requested) appointment. The backend models
 * confirmation as a booking lifecycle status transition to "confirmed".
 */
export async function updateReceptionBookingConfirmation(
  bookingId: string,
  confirmationStatus: string,
  token?: string | null
): Promise<ReceptionBooking> {
  const target = confirmationStatus === "confirmed" ? "confirmed" : "requested";
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: target }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update confirmation status.");
  return mapBooking(await res.json());
}

export async function rescheduleReceptionBooking(
  bookingId: string,
  data: {
    bookingDate: string;
    bookingTime: string;
    teamMemberId?: string | null;
    serviceId?: string | null;
    staffNotes?: string | null;
    overrideDoubleBooking?: boolean;
    overrideReason?: string | null;
  },
  token?: string | null
): Promise<ReceptionBooking> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/reschedule`,
    {
      method: "PATCH",
      body: JSON.stringify({
        preferredDate: data.bookingDate,
        preferredTime: data.bookingTime,
        teamMemberId: data.teamMemberId ?? null,
        serviceId: data.serviceId ?? null,
        staffNotes: data.staffNotes ?? null,
        overrideDoubleBooking: data.overrideDoubleBooking ?? false,
        overrideReason: data.overrideReason ?? null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to reschedule booking.");
  return mapBooking(await res.json());
}

export async function cancelReceptionBooking(
  bookingId: string,
  reason: string,
  staffNotes?: string,
  token?: string | null
): Promise<ReceptionBooking> {
  return updateReceptionBookingStatus(bookingId, "cancelled", staffNotes, token, reason);
}

export async function markNoShowReceptionBooking(
  bookingId: string,
  staffNotes?: string,
  token?: string | null
): Promise<ReceptionBooking> {
  return updateReceptionBookingStatus(bookingId, "no_show", staffNotes, token);
}

/* --- Reminders Worklist --- */

export function normalizePakistanPhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0092")) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    digits = "92" + digits.slice(1);
  } else if (digits.startsWith("3") && digits.length === 10) {
    digits = "92" + digits;
  } else if (!digits.startsWith("92") && digits.length >= 7) {
    digits = "92" + digits;
  }
  return digits;
}

export interface ReceptionReminderItem {
  id: string;
  confirmationId: string;
  preferredDate: string;
  preferredTime: string;
  patientFullName: string;
  patientPhone: string;
  patientEmail: string;
  status: string;
  clinicId?: string | null;
  patientId?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  teamMemberId?: string | null;
  clinicianName?: string | null;
  remindedAt?: string | null;
  remindedByUserId?: string | null;
  remindedByName?: string | null;
  optedOut?: boolean;
  deliveryStatus?: string;
  lastMessageAt?: string | null;
}

export interface ReceptionRemindersResponse {
  targetDate: string;
  template: string;
  items: ReceptionReminderItem[];
  providerMode?: string;
  quietHoursActive?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export async function getReceptionReminders(
  date?: string,
  token?: string | null
): Promise<ReceptionRemindersResponse> {
  const q = date ? `?date=${date}` : "";
  const res = await authorizedFetch(`/api/v1/reception/reminders${q}`, {}, token);
  if (!res.ok) throw new Error("Failed to load appointment reminders.");
  return res.json();
}

export async function markAppointmentReminded(
  bookingId: string,
  token?: string | null
): Promise<ReceptionBooking> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/remind`,
    { method: "POST" },
    token
  );
  if (!res.ok) await apiError(res, "Failed to mark appointment reminded.");
  return mapBooking(await res.json());
}

export async function togglePatientMessagingOptOut(
  patientId: string,
  optOut: boolean,
  token?: string | null
): Promise<Record<string, unknown>> {
  const res = await authorizedFetch(
    `/api/v1/reception/patients/${patientId}/messaging-opt-out`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ optOut }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update patient messaging opt-out status.");
  return res.json();
}

export interface MessagingSettings {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  messagingProviderMode: string;
  reminderTemplate: string;
  reminderTemplateUrdu?: string | null;
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
}

export interface MessagingSettingsUpdate {
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  messagingProviderMode?: string;
  reminderTemplate?: string;
  reminderTemplateUrdu?: string | null;
  reminder24hEnabled?: boolean;
  reminder2hEnabled?: boolean;
}

export interface SendTestMessageResponse {
  success: boolean;
  status: string;
  channel: string;
  provider: string;
  recipient: string;
  details?: string | null;
  error?: string | null;
  providerMessageId?: string | null;
}

export interface MessageLogItem {
  id: string;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  content: string;
  channel: string;
  status: string;
  deliveryStatus: string;
  errorDetail?: string | null;
  patientId?: string | null;
  bookingId?: string | null;
  senderId?: string | null;
  createdAt: string;
}

export interface MessageLogsResponse {
  items: MessageLogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface RunSchedulerResponse {
  dispatchedCount: number;
  skippedOptOutCount: number;
  skippedQuietHours: boolean;
  message: string;
  simulated: boolean;
}

export async function getMessagingSettings(token?: string | null): Promise<MessagingSettings> {
  const res = await authorizedFetch("/api/v1/admin/messaging/settings", {}, token);
  if (!res.ok) await apiError(res, "Failed to load messaging settings.");
  return res.json();
}

export async function updateMessagingSettings(
  payload: MessagingSettingsUpdate,
  token?: string | null
): Promise<MessagingSettings> {
  const res = await authorizedFetch(
    "/api/v1/admin/messaging/settings",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update messaging settings.");
  return res.json();
}

export async function sendTestMessage(
  payload: { recipient: string; message: string; channel?: string },
  token?: string | null
): Promise<SendTestMessageResponse> {
  const res = await authorizedFetch(
    "/api/v1/admin/messaging/send-test",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to send test message.");
  return res.json();
}

export async function getMessageLogs(
  limit: number = 50,
  offset: number = 0,
  token?: string | null
): Promise<MessageLogsResponse> {
  const res = await authorizedFetch(`/api/v1/admin/messaging/logs?limit=${limit}&offset=${offset}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load message logs.");
  return res.json();
}

export async function runReminderScheduler(
  targetDate?: string,
  forceQuietHours: boolean = false,
  token?: string | null
): Promise<RunSchedulerResponse> {
  const params = new URLSearchParams();
  if (targetDate) params.append("target_date", targetDate);
  if (forceQuietHours) params.append("force_quiet_hours", "true");
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authorizedFetch(
    `/api/v1/admin/messaging/run-scheduler${q}`,
    { method: "POST" },
    token
  );
  if (!res.ok) await apiError(res, "Failed to run reminder scheduler.");
  return res.json();
}

/* --- End-of-Day Review --- */

export interface ReceptionEndOfDayItem {
  id: string;
  confirmationId: string;
  preferredDate: string;
  preferredTime: string;
  patientFullName: string;
  patientPhone: string;
  patientEmail: string;
  status: string;
  clinicId?: string | null;
  patientId?: string | null;
  serviceId?: string | null;
  serviceName?: string | null;
  teamMemberId?: string | null;
  clinicianName?: string | null;
  arrivedAt?: string | null;
  notes?: string | null;
  staffNotes?: string | null;
}

export interface ReceptionEndOfDayResponse {
  targetDate: string;
  todayCount: number;
  pastCount: number;
  totalUnresolved: number;
  items: ReceptionEndOfDayItem[];
}

export async function getReceptionEndOfDayUnresolved(
  date?: string,
  token?: string | null
): Promise<ReceptionEndOfDayResponse> {
  const q = date ? `?date=${date}` : "";
  const res = await authorizedFetch(`/api/v1/reception/end-of-day/unresolved${q}`, {}, token);
  if (!res.ok) throw new Error("Failed to load unresolved end-of-day appointments.");
  return res.json();
}

export async function resolveReceptionEndOfDay(
  data: {
    bookingId: string;
    resolution: "completed" | "no_show" | "cancelled";
    reason?: string;
  },
  token?: string | null
): Promise<ReceptionBooking> {
  const res = await authorizedFetch(
    `/api/v1/reception/end-of-day/resolve`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to resolve end-of-day appointment.");
  return mapBooking(await res.json());
}


/* --- Intake requests (mapped onto /reception/appointments) --- */

/**
 * Loads appointment intake requests. The backend has no dedicated
 * "/requests" route: the intake queue is the booking table filtered by
 * lifecycle status, so "pending" maps to status "requested".
 */
export async function getReceptionRequests(
  status?: string,
  token?: string | null
): Promise<ReceptionRequestItem[]> {
  let backendStatus: string | undefined;
  if (status === "pending") backendStatus = "requested";
  else if (status) backendStatus = status;

  const query = new URLSearchParams();
  if (backendStatus) query.set("status", backendStatus);

  const res = await authorizedFetch(
    `/api/v1/reception/appointments${query.toString() ? `?${query.toString()}` : ""}`,
    {},
    token
  );
  if (!res.ok) throw new Error("Failed to fetch appointment intake requests.");
  const raw: RawBooking[] = await res.json();

  // "All requests" shows the intake lifecycle (requested/confirmed/cancelled)
  // but not visits that already completed.
  const relevant = raw.filter((b) =>
    ["requested", "confirmed", "cancelled"].includes(b.status)
  );

  return relevant.map((b) => ({
    id: b.id,
    fullName: b.patientFullName,
    phone: b.patientPhone,
    email: b.patientEmail,
    preferredDate: b.preferredDate,
    preferredTime: b.preferredTime,
    serviceId: b.serviceId,
    status: b.status === "requested" ? "pending" : b.status,
    notes: b.notes,
    createdAt: b.createdAt,
  }));
}

/**
 * Accepts or declines an intake request via a booking status transition
 * (requested -> confirmed, or requested -> cancelled).
 */
export async function triageReceptionRequest(
  appointmentId: string,
  action: "confirm" | "decline",
  notes?: string,
  token?: string | null
): Promise<ReceptionRequestItem> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${appointmentId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: action === "confirm" ? "confirmed" : "cancelled",
        staffNotes: notes ?? null,
        cancellationReason: action === "decline" ? (notes || "Declined during intake request triage") : null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to triage appointment request.");
  const b: RawBooking = await res.json();
  return {
    id: b.id,
    fullName: b.patientFullName,
    phone: b.patientPhone,
    email: b.patientEmail,
    preferredDate: b.preferredDate,
    preferredTime: b.preferredTime,
    serviceId: b.serviceId,
    status: b.status === "requested" ? "pending" : b.status,
    notes: b.notes,
    createdAt: b.createdAt,
  };
}

/**
 * Confirmation queue for a given date: bookings that are still unconfirmed
 * (status "requested"). Derived from the real appointment table.
 */
export async function getReceptionConfirmations(
  date?: string,
  token?: string | null
): Promise<ReceptionBooking[]> {
  const query = new URLSearchParams();
  if (date) {
    query.set("date_from", date);
    query.set("date_to", date);
  }
  const res = await authorizedFetch(
    `/api/v1/reception/appointments${query.toString() ? `?${query.toString()}` : ""}`,
    {},
    token
  );
  if (!res.ok) throw new Error("Failed to fetch confirmation queue.");
  const raw: RawBooking[] = await res.json();
  return raw.filter((b) => b.status === "requested").map(mapBooking);
}


/* --- Patients --- */

export async function searchReceptionPatients(
  params?: { search?: string; limit?: number; offset?: number },
  token?: string | null
): Promise<{ items: ReceptionPatient[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set("query", params.search);
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;
  query.set("page", String(Math.floor(offset / limit) + 1));
  query.set("page_size", String(limit));

  const res = await authorizedFetch(`/api/v1/reception/patients?${query.toString()}`, {}, token);
  if (!res.ok) throw new Error("Failed to search patients.");
  const data = await res.json();
  return {
    items: (data.items as RawPatient[]).map(mapPatient),
    total: data.total,
  };
}

export async function getReceptionPatient(
  patientId: string,
  token?: string | null
): Promise<ReceptionPatientDetail> {
  const res = await authorizedFetch(`/api/v1/reception/patients/${patientId}`, {}, token);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Patient chart not found.");
    throw new Error("Failed to load patient profile.");
  }
  const raw: RawPatientProfile = await res.json();
  return {
    ...mapPatient(raw.patient),
    upcomingBookings: (raw.upcomingAppointments || []).map(mapBooking),
    pastBookings: (raw.pastAppointments || []).map(mapBooking),
    taskCount: (raw.tasks || []).length,
    messageCount: (raw.messages || []).length,
  };
}

export interface CreatePatientResult {
  patient: ReceptionPatient;
  isDuplicate: boolean;
  matchedCount: number;
}

/**
 * Creates a patient chart. When the backend detects a duplicate it does not
 * create a new record: it returns the existing chart with `isDuplicate=true`.
 * Pass `bypassDuplicateCheck` to skip the duplicate check.
 */
export async function createReceptionPatient(
  data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    dateOfBirth?: string;
    notes?: string;
    fileNumber?: string;
    guardianName?: string;
    guardianPhone?: string;
    guardianRelationship?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
    preferredChannel?: string;
    bypassDuplicateCheck?: boolean;
  },
  token?: string | null
): Promise<CreatePatientResult> {
  const query = new URLSearchParams();
  query.set("check_duplicates", String(!(data.bypassDuplicateCheck ?? false)));

  const res = await authorizedFetch(
    `/api/v1/reception/patients?${query.toString()}`,
    {
      method: "POST",
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        notes: data.notes ?? null,
        preferredChannel: data.preferredChannel ?? "sms",
        fileNumber: data.fileNumber ?? null,
        guardianName: data.guardianName ?? null,
        guardianPhone: data.guardianPhone ?? null,
        guardianRelationship: data.guardianRelationship ?? null,
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
        emergencyContactRelationship: data.emergencyContactRelationship ?? null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create patient.");
  const payload = await res.json();
  return {
    patient: mapPatient(payload.patient),
    isDuplicate: Boolean(payload.isDuplicate),
    matchedCount: payload.matchedCount ?? 0,
  };
}

export async function updateReceptionPatient(
  patientId: string,
  data: Partial<{
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    dateOfBirth: string;
    notes: string;
    isActive: boolean;
    fileNumber: string;
    guardianName: string;
    guardianPhone: string;
    guardianRelationship: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelationship: string;
    preferredChannel: string;
  }>,
  token?: string | null
): Promise<ReceptionPatient> {
  const res = await authorizedFetch(
    `/api/v1/reception/patients/${patientId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        dateOfBirth: data.dateOfBirth ?? null,
        notes: data.notes ?? null,
        isActive: data.isActive ?? null,
        preferredChannel: data.preferredChannel ?? null,
        fileNumber: data.fileNumber ?? null,
        guardianName: data.guardianName ?? null,
        guardianPhone: data.guardianPhone ?? null,
        guardianRelationship: data.guardianRelationship ?? null,
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
        emergencyContactRelationship: data.emergencyContactRelationship ?? null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update patient.");
  return mapPatient(await res.json());
}


/* --- Tasks --- */

export async function getReceptionTasks(
  params?: { status?: string; priority?: string },
  token?: string | null
): Promise<ReceptionTask[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.priority) query.set("priority", params.priority);

  const res = await authorizedFetch(
    `/api/v1/reception/tasks${query.toString() ? `?${query.toString()}` : ""}`,
    {},
    token
  );
  if (!res.ok) throw new Error("Failed to load tasks.");
  const raw: RawTask[] = await res.json();
  return raw.map(mapTask);
}

export async function createReceptionTask(
  data: {
    title: string;
    description?: string;
    priority?: "low" | "medium" | "high" | "urgent";
    dueDate?: string;
    status?: string;
    patientId?: string;
    bookingId?: string;
  },
  token?: string | null
): Promise<ReceptionTask> {
  const res = await authorizedFetch(
    `/api/v1/reception/tasks`,
    {
      method: "POST",
      body: JSON.stringify({
        title: data.title,
        description: data.description ?? null,
        priority: data.priority ?? "medium",
        status: data.status ?? "pending",
        patientId: data.patientId ?? null,
        bookingId: data.bookingId ?? null,
        dueDate: data.dueDate ? `${data.dueDate}T00:00:00` : null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create task.");
  return mapTask(await res.json());
}

export async function updateReceptionTask(
  taskId: string,
  data: Partial<{
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    status: string;
    dueDate: string;
  }>,
  token?: string | null
): Promise<ReceptionTask> {
  const res = await authorizedFetch(
    `/api/v1/reception/tasks/${taskId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        title: data.title ?? null,
        description: data.description ?? null,
        priority: data.priority ?? null,
        status: data.status ?? null,
        dueDate: data.dueDate ? `${data.dueDate}T00:00:00` : null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update task.");
  return mapTask(await res.json());
}

/* --- Messages --- */

/**
 * Loads the message log. The backend has no channel filter parameter, so the
 * filter is applied client-side on the returned records.
 */
export async function getReceptionMessages(
  params?: { channel?: string },
  token?: string | null
): Promise<ReceptionMessage[]> {
  const res = await authorizedFetch(`/api/v1/reception/messages`, {}, token);
  if (!res.ok) throw new Error("Failed to load messages.");
  const raw: RawMessage[] = await res.json();
  const mapped = raw.map(mapMessage);
  if (params?.channel) {
    return mapped.filter((m) => m.channel === params.channel);
  }
  return mapped;
}

/**
 * Logs a message. Backend fields: `content` plus phone/email recipient
 * depending on channel.
 */
export async function sendReceptionMessage(
  data: {
    channel: "sms" | "email" | "portal" | "whatsapp";
    recipient?: string;
    body: string;
    patientId?: string;
  },
  token?: string | null
): Promise<ReceptionMessage> {
  const res = await authorizedFetch(
    `/api/v1/reception/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: data.body,
        channel: data.channel,
        phone: data.channel === "email" ? null : data.recipient || null,
        email: data.channel === "email" ? data.recipient || null : null,
        patientId: data.patientId || null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to log message.");
  return mapMessage(await res.json());
}


/* --- Leads --- */

export async function getReceptionLeads(
  status?: string,
  token?: string | null
): Promise<ReceptionLead[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await authorizedFetch(`/api/v1/reception/leads${query}`, {}, token);
  if (!res.ok) throw new Error("Failed to load leads.");
  const raw: RawLead[] = await res.json();
  return raw.map(mapLead);
}

export async function createReceptionLead(
  data: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    notes?: string;
  },
  token?: string | null
): Promise<ReceptionLead> {
  const fullName = `${data.firstName} ${data.lastName}`.trim();
  const res = await authorizedFetch(
    `/api/v1/reception/leads`,
    {
      method: "POST",
      body: JSON.stringify({
        fullName,
        phone: data.phone,
        email: data.email || null,
        notes: data.notes || null,
        status: "new",
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create lead.");
  return mapLead(await res.json());
}

export async function convertReceptionLead(
  leadId: string,
  token?: string | null
): Promise<{ success: boolean; message: string; patientId: string }> {
  const res = await authorizedFetch(
    `/api/v1/reception/leads/${leadId}/convert`,
    { method: "POST", body: JSON.stringify({}) },
    token
  );
  if (!res.ok) await apiError(res, "Failed to convert lead to patient.");
  const patient: RawPatient = await res.json();
  return {
    success: true,
    message: "Lead converted into a patient chart.",
    patientId: patient.id,
  };
}

export async function updateReceptionLeadStatus(
  leadId: string,
  status: string,
  token?: string | null
): Promise<ReceptionLead> {
  const res = await authorizedFetch(
    `/api/v1/reception/leads/${leadId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update lead status.");
  return mapLead(await res.json());
}

/* --- Recalls & waitlist --- */

/**
 * Derived recall queue: patients whose last completed visit is older than
 * six months (computed by the backend from real bookings).
 */
export async function getReceptionRecalls(
  token?: string | null
): Promise<ReceptionRecall[]> {
  const res = await authorizedFetch(`/api/v1/reception/recalls`, {}, token);
  if (!res.ok) throw new Error("Failed to load recall queue.");
  const raw: Array<{
    patientId: string;
    patientFullName: string;
    phone: string;
    email?: string | null;
    lastVisitDate: string;
    serviceId?: string | null;
    serviceName?: string | null;
    recallIntervalDays?: number;
    dueDate: string;
    status: string;
    clinicId?: string | null;
    hasOpenTask?: boolean;
    taskId?: string | null;
  }> = await res.json();

  return raw.map((r) => ({
    patientId: r.patientId,
    patientName: r.patientFullName,
    phone: r.phone,
    email: r.email,
    lastVisitDate: r.lastVisitDate,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
    recallIntervalDays: r.recallIntervalDays,
    dueDate: r.dueDate,
    status: r.status,
    clinicId: r.clinicId,
    hasOpenTask: r.hasOpenTask,
    taskId: r.taskId,
  }));
}

export async function createReceptionRecallTask(
  data: { patientId: string; serviceId?: string; dueDate?: string },
  token?: string | null
): Promise<ReceptionTask> {
  const res = await authorizedFetch(
    `/api/v1/reception/recalls/tasks`,
    {
      method: "POST",
      body: JSON.stringify({
        patientId: data.patientId,
        serviceId: data.serviceId || null,
        dueDate: data.dueDate || null,
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create recall task.");
  return mapTask(await res.json());
}

/**
 * ASAP waitlist: real bookings carrying the "waitlist" lifecycle status.
 */
export async function getReceptionWaitlist(
  token?: string | null
): Promise<ReceptionBooking[]> {
  const res = await authorizedFetch(`/api/v1/reception/waitlist`, {}, token);
  if (!res.ok) throw new Error("Failed to load the waitlist.");
  const raw: RawBooking[] = await res.json();
  return raw.map(mapBooking);
}

export async function getWaitlistOffersForSlot(
  bookingId: string,
  token?: string | null
): Promise<WaitlistOfferCandidate[]> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/waitlist-offers`,
    {},
    token
  );
  if (!res.ok) throw new Error("Failed to load waitlist offer candidates.");
  return res.json();
}

export async function createWaitlistOfferTask(
  bookingId: string,
  waitlistBookingId: string,
  token?: string | null
): Promise<ReceptionTask> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/waitlist-offers/create-task`,
    {
      method: "POST",
      body: JSON.stringify({ waitlistBookingId }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create waitlist offer task.");
  return mapTask(await res.json());
}

export async function getBookingPayments(
  bookingId: string,
  token?: string | null
): Promise<VisitPayment[]> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/payments`,
    {},
    token
  );
  if (!res.ok) throw new Error("Failed to load visit payments.");
  return res.json();
}

export async function recordBookingPayment(
  bookingId: string,
  data: {
    amountCents: number;
    amountChargedCents?: number;
    currency?: string;
    method?: string;
    notes?: string;
    overrideReason?: string;
    patientId?: string;
  },
  token?: string | null
): Promise<VisitPayment> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/payments`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to record payment.");
  return res.json();
}

export async function voidBookingPayment(
  bookingId: string,
  paymentId: string,
  reason: string,
  token?: string | null
): Promise<VisitPayment> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/payments/${paymentId}/void`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to void payment.");
  return res.json();
}

export async function getEndOfDayPaymentsSummary(
  date?: string,
  token?: string | null
): Promise<EndOfDayPaymentsSummary> {
  const q = date ? `?date=${encodeURIComponent(date)}` : "";
  const res = await authorizedFetch(
    `/api/v1/reception/end-of-day/payments-summary${q}`,
    {},
    token
  );
  if (!res.ok) throw new Error("Failed to load end of day payments summary.");
  return res.json();
}



/* --- Doctor workspace (backend: /doctor) --- */

export async function getDoctorSchedule(
  date?: string,
  token?: string | null
): Promise<ReceptionBooking[]> {
  const query = date ? `?target_date=${encodeURIComponent(date)}` : "";
  const res = await authorizedFetch(`/api/v1/doctor/schedule${query}`, {}, token);
  if (!res.ok) throw new Error("Failed to load doctor schedule.");
  const raw: RawBooking[] = await res.json();
  return raw.map(mapBooking);
}

export async function updateDoctorBookingNotes(
  bookingId: string,
  notes: string,
  token?: string | null
): Promise<ReceptionBooking> {
  const res = await authorizedFetch(
    `/api/v1/doctor/appointments/${bookingId}/notes`,
    {
      method: "PATCH",
      body: JSON.stringify({ staffNotes: notes }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update clinical notes.");
  return mapBooking(await res.json());
}

export async function startDoctorAppointment(
  bookingId: string,
  token?: string | null
): Promise<ReceptionBooking> {
  const res = await authorizedFetch(
    `/api/v1/doctor/appointments/${bookingId}/start`,
    {
      method: "POST",
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to start appointment.");
  return mapBooking(await res.json());
}

export interface DoctorPatientSummary {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null;
  clinicId?: string | null;
  createdAt?: string | null;
}

export interface DoctorPatientVisitHistory {
  id: string;
  bookingDate: string;
  bookingTime: string;
  serviceId?: string | null;
  teamMemberId?: string | null;
  status: string;
}

export interface DoctorPatientEncounterSummary {
  id: string;
  bookingId?: string | null;
  clinicianId: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
}

export interface DoctorPatientDetail {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email?: string | null;
  fileNumber?: string | null;
  dateOfBirth?: string | null;
  notes?: string | null;
  clinicId?: string | null;
  createdAt?: string | null;
  visits: DoctorPatientVisitHistory[];
  encounters: DoctorPatientEncounterSummary[];
}

export async function searchDoctorPatients(
  query?: string,
  token?: string | null
): Promise<DoctorPatientSummary[]> {
  const qParam = query ? `?q=${encodeURIComponent(query)}` : "";
  const res = await authorizedFetch(`/api/v1/doctor/patients${qParam}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to search patients.");
  return res.json();
}

export async function getDoctorPatientDetail(
  patientId: string,
  token?: string | null
): Promise<DoctorPatientDetail> {
  const res = await authorizedFetch(`/api/v1/doctor/patients/${patientId}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to retrieve patient clinical summary.");
  return res.json();
}


/* --- Clinical Encounter & SOAP Notes (Phase 1) --- */

export interface ClinicalEncounter {
  id: string;
  patientId: string;
  clinicianId: string;
  clinicId?: string | null;
  bookingId?: string | null;
  status: string;
  chiefComplaint?: string | null;
  reasonForVisit?: string | null;
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClinicalSOAPNote {
  id: string;
  encounterId: string;
  patientId: string;
  authorId: string;
  clinicId?: string | null;
  revisionNumber: number;
  isCurrent: boolean;
  status: "draft" | "signed" | "amended" | string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  isSigned: boolean;
  signedAt?: string | null;
  signedById?: string | null;
  amendmentReason?: string | null;
  createdAt: string;
  updatedAt: string;
  historicalStaffNotes?: string | null;
}

export async function getActiveEncounterByBooking(
  bookingId: string,
  token?: string | null
): Promise<ClinicalEncounter | null> {
  const res = await authorizedFetch(`/api/v1/doctor/encounters/by-booking/${bookingId}`, {}, token);
  if (res.status === 404) return null;
  if (!res.ok) await apiError(res, "Failed to retrieve active encounter.");
  return res.json();
}

export async function getClinicalEncounter(
  id: string,
  token?: string | null
): Promise<ClinicalEncounter> {
  const res = await authorizedFetch(`/api/v1/doctor/encounters/${id}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to retrieve clinical encounter.");
  return res.json();
}

export async function createClinicalEncounter(
  data: { patientId: string; bookingId?: string; chiefComplaint?: string; reasonForVisit?: string; status?: string },
  token?: string | null
): Promise<ClinicalEncounter> {
  const res = await authorizedFetch(
    `/api/v1/doctor/encounters`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to initiate clinical encounter.");
  return res.json();
}

export async function getEncounterClinicalNote(
  encounterId: string,
  token?: string | null
): Promise<ClinicalSOAPNote | null> {
  const res = await authorizedFetch(`/api/v1/doctor/encounters/${encounterId}/note`, {}, token);
  if (res.status === 404) return null;
  if (!res.ok) await apiError(res, "Failed to load clinical SOAP note.");
  return res.json();
}

export async function saveDraftEncounterNote(
  encounterId: string,
  data: { subjective?: string; objective?: string; assessment?: string; plan?: string },
  token?: string | null
): Promise<ClinicalSOAPNote> {
  const res = await authorizedFetch(
    `/api/v1/doctor/encounters/${encounterId}/note/draft`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to save draft SOAP note.");
  return res.json();
}

export async function signEncounterClinicalNote(
  encounterId: string,
  token?: string | null
): Promise<ClinicalSOAPNote> {
  const res = await authorizedFetch(
    `/api/v1/doctor/encounters/${encounterId}/note/sign`,
    {
      method: "POST",
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to sign clinical note.");
  return res.json();
}

export async function amendEncounterClinicalNote(
  encounterId: string,
  data: { amendmentReason: string; subjective?: string; objective?: string; assessment?: string; plan?: string },
  token?: string | null
): Promise<ClinicalSOAPNote> {
  const res = await authorizedFetch(
    `/api/v1/doctor/encounters/${encounterId}/note/amend`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to amend clinical note.");
  return res.json();
}

export async function getEncounterNoteRevisions(
  encounterId: string,
  token?: string | null
): Promise<ClinicalSOAPNote[]> {
  const res = await authorizedFetch(`/api/v1/doctor/encounters/${encounterId}/note/revisions`, {}, token);
  if (!res.ok) await apiError(res, "Failed to fetch note revisions.");
  return res.json();
}


/* --- Dental Charting (Phase 1 Stage 3) --- */

export interface ConditionCatalogItem {
  value: string;
  label: string;
  requiresSurfaces: boolean;
  toothLevelOnly: boolean;
}

export interface DentalChartFinding {
  id: string;
  patientId: string;
  encounterId: string;
  authorId: string;
  clinicId?: string | null;
  tooth: string;
  surfaces: string[];
  condition: string;
  conditionLabel: string;
  status: "active" | "resolved" | string;
  notes?: string | null;
  correctionReason?: string | null;
  correctedById?: string | null;
  correctedAt?: string | null;
  resolvedById?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DentalProcedureRecord {
  id: string;
  patientId: string;
  encounterId: string;
  recordedById: string;
  serviceId: string;
  clinicId?: string | null;
  tooth: string;
  surfaces: string[];
  status: "planned" | "in_progress" | "completed" | "cancelled" | string;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  completedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DentalChartResponse {
  patientId: string;
  findings: DentalChartFinding[];
  procedures: DentalProcedureRecord[];
  conditionCatalog: ConditionCatalogItem[];
}

export interface ChartHistoryResponse {
  patientId: string;
  findings: DentalChartFinding[];
  procedures: DentalProcedureRecord[];
}

export interface EncounterChartResponse {
  encounterId: string;
  patientId: string;
  findings: DentalChartFinding[];
  procedures: DentalProcedureRecord[];
}

export async function getPatientDentalChart(
  patientId: string,
  token?: string | null
): Promise<DentalChartResponse> {
  const res = await authorizedFetch(`/api/v1/doctor/patients/${patientId}/chart`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load patient dental chart.");
  return res.json();
}

export async function getPatientChartHistory(
  patientId: string,
  token?: string | null
): Promise<ChartHistoryResponse> {
  const res = await authorizedFetch(`/api/v1/doctor/patients/${patientId}/chart/history`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load chart history.");
  return res.json();
}

export async function getEncounterDentalChart(
  encounterId: string,
  token?: string | null
): Promise<EncounterChartResponse> {
  const res = await authorizedFetch(`/api/v1/doctor/encounters/${encounterId}/chart`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load encounter chart.");
  return res.json();
}

export async function recordDentalFinding(
  encounterId: string,
  data: { tooth: string; condition: string; surfaces?: string[]; notes?: string },
  token?: string | null
): Promise<DentalChartFinding> {
  const res = await authorizedFetch(
    `/api/v1/doctor/encounters/${encounterId}/chart/findings`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to record dental finding.");
  return res.json();
}

export async function correctDentalFinding(
  findingId: string,
  data: { reason: string; condition?: string; surfaces?: string[]; notes?: string },
  token?: string | null
): Promise<DentalChartFinding> {
  const res = await authorizedFetch(
    `/api/v1/doctor/chart/findings/${findingId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to correct dental finding.");
  return res.json();
}

export async function resolveDentalFinding(
  findingId: string,
  data?: { notes?: string },
  token?: string | null
): Promise<DentalChartFinding> {
  const res = await authorizedFetch(
    `/api/v1/doctor/chart/findings/${findingId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify(data || {}),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to resolve dental finding.");
  return res.json();
}

export async function createPlannedProcedure(
  encounterId: string,
  data: { tooth: string; serviceId: string; surfaces?: string[]; notes?: string },
  token?: string | null
): Promise<DentalProcedureRecord> {
  const res = await authorizedFetch(
    `/api/v1/doctor/encounters/${encounterId}/chart/procedures`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to add planned procedure.");
  return res.json();
}

export async function updateProcedureStatus(
  procedureId: string,
  data: { status: string; notes?: string },
  token?: string | null
): Promise<DentalProcedureRecord> {
  const res = await authorizedFetch(
    `/api/v1/doctor/chart/procedures/${procedureId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update procedure status.");
  return res.json();
}


/* --- Clinical Medical Alerts & Safety Banner (Phase 1.1) --- */

export interface MedicalAlertItem {
  id: string;
  patientId: string;
  type: "allergy" | "condition" | "medication" | "other";
  description: string;
  severity?: string | null;
  recordedByUserId?: string | null;
  recordedAt: string;
  lastReviewedAt?: string | null;
  isActive: boolean;
  isConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicalAlertsSummary {
  patientId: string;
  medicalHistoryStatus: "not_asked" | "none_known" | "recorded";
  confirmedAlerts: MedicalAlertItem[];
  pendingAlerts: MedicalAlertItem[];
  lastReviewedAt?: string | null;
}

export async function getPatientAlertsSummary(
  patientId: string,
  token?: string | null
): Promise<MedicalAlertsSummary> {
  const res = await authorizedFetch(`/api/v1/clinical/patients/${patientId}/alerts`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load patient medical alerts.");
  return res.json();
}

export async function recordDoctorAlert(
  patientId: string,
  data: { type: string; description: string; severity?: string },
  token?: string | null
): Promise<MedicalAlertItem> {
  const res = await authorizedFetch(
    `/api/v1/clinical/patients/${patientId}/alerts`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to record medical alert.");
  return res.json();
}

export async function confirmDoctorAlert(
  alertId: string,
  token?: string | null
): Promise<MedicalAlertItem> {
  const res = await authorizedFetch(
    `/api/v1/clinical/alerts/${alertId}/confirm`,
    {
      method: "POST",
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to confirm medical alert.");
  return res.json();
}

export async function dismissDoctorAlert(
  alertId: string,
  token?: string | null
): Promise<MedicalAlertItem> {
  const res = await authorizedFetch(
    `/api/v1/clinical/alerts/${alertId}/dismiss`,
    {
      method: "POST",
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to dismiss medical alert.");
  return res.json();
}

export async function reviewPatientAlertsAtVisit(
  patientId: string,
  token?: string | null
): Promise<{ patientId: string; lastReviewedAt: string; status: string }> {
  const res = await authorizedFetch(
    `/api/v1/clinical/patients/${patientId}/alerts/review`,
    {
      method: "POST",
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to record clinical review of alerts.");
  return res.json();
}

export async function updateMedicalHistoryStatus(
  patientId: string,
  status: string,
  token?: string | null
): Promise<{ patientId: string; medicalHistoryStatus: string }> {
  const res = await authorizedFetch(
    `/api/v1/clinical/patients/${patientId}/medical-history-status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update medical history status.");
  return res.json();
}

export async function recordReceptionPendingAlert(
  patientId: string,
  data: { type: string; description: string },
  token?: string | null
): Promise<MedicalAlertItem> {
  const res = await authorizedFetch(
    `/api/v1/reception/patients/${patientId}/pending-alerts`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to record pending medical alert.");
  return res.json();
}


/* --- Unsigned Notes & Visit Completion (Phase 1.2 & 1.3) --- */

export interface UnsignedNoteItem {
  encounterId: string;
  bookingId?: string | null;
  patientId: string;
  patientName: string;
  date: string;
  status: string;
  chiefComplaint?: string | null;
}

export async function getDoctorUnsignedNotes(
  token?: string | null
): Promise<UnsignedNoteItem[]> {
  const res = await authorizedFetch(`/api/v1/doctor/unsigned-notes`, {}, token);
  if (!res.ok) throw new Error("Failed to load unsigned notes.");
  return res.json();
}

export async function finishDoctorAppointment(
  bookingId: string,
  data?: { followUpDays?: number; followUpWeeks?: number; followUpNote?: string },
  token?: string | null
): Promise<ReceptionBooking> {
  const res = await authorizedFetch(
    `/api/v1/doctor/appointments/${bookingId}/finish`,
    {
      method: "POST",
      body: JSON.stringify(data || {}),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to finish visit.");
  return mapBooking(await res.json());
}

// --- Admin Staff Account Management ---

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  clinicId?: string | null;
  teamMemberId?: string | null;
  requiresPasswordChange: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function adminGetUsers(token?: string | null): Promise<AdminUser[]> {
  const res = await authorizedFetch(`/api/v1/admin/users`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load staff accounts.");
  return res.json();
}

export async function adminCreateUser(
  data: {
    fullName: string;
    email: string;
    role: string;
    password: string;
    teamMemberId?: string | null;
    clinicId?: string | null;
    requiresPasswordChange?: boolean;
  },
  token?: string | null
): Promise<AdminUser> {
  const res = await authorizedFetch(
    `/api/v1/admin/users`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create staff account.");
  return res.json();
}

export async function adminUpdateUserStatus(
  id: string,
  isActive: boolean,
  token?: string | null
): Promise<AdminUser> {
  const res = await authorizedFetch(
    `/api/v1/admin/users/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update account status.");
  return res.json();
}

export async function adminUpdateUserRole(
  id: string,
  role: string,
  teamMemberId?: string | null,
  token?: string | null
): Promise<AdminUser> {
  const res = await authorizedFetch(
    `/api/v1/admin/users/${id}/role`,
    {
      method: "PATCH",
      body: JSON.stringify({ role, teamMemberId: teamMemberId || null }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update account role.");
  return res.json();
}

export async function adminResetUserPassword(
  id: string,
  password: string,
  token?: string | null
): Promise<{ message: string }> {
  const res = await authorizedFetch(
    `/api/v1/admin/users/${id}/reset-password`,
    {
      method: "POST",
      body: JSON.stringify({ password }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to reset password.");
  return res.json();
}

/* -------------------------------------------------------------
 * PART B: CLINICAL DEPTH APIS
 * ------------------------------------------------------------- */

export interface DoctorTaskItem {
  id: string;
  title: string;
  description?: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "done";
  patientId?: string | null;
  patientName?: string | null;
  dueDate?: string | null;
  createdByUserId?: string | null;
  createdByName?: string | null;
  isCreatedByMe?: boolean;
  createdAt?: string;
  completedAt?: string | null;
}

export interface TreatmentPlanItem {
  id: string;
  patientId: string;
  toothNumber?: number | null;
  serviceId?: string | null;
  procedureName: string;
  status: "proposed" | "accepted" | "declined" | "completed";
  estimatedCostCents: number;
  estimatedCostFormatted: string;
  decisionDate?: string | null;
  notes?: string | null;
  completedProcedureId?: string | null;
  createdByUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TreatmentPlanResponse {
  patientId: string;
  items: TreatmentPlanItem[];
  groupedByTooth: Record<string, TreatmentPlanItem[]>;
  totalItems: number;
  totalEstimatedCents: number;
  totalEstimatedFormatted: string;
  acceptedEstimatedCents: number;
  acceptedEstimatedFormatted: string;
}

export interface ClinicalNoteTemplate {
  id: string;
  name: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PatientAttachmentItem {
  id: string;
  patientId: string;
  encounterId?: string | null;
  category: "xray" | "photo" | "consent" | "referral" | "other";
  originalFilename: string;
  contentType: string;
  size: number;
  uploadedAt: string;
  voided: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
}

export interface PatientConsentItem {
  id: string;
  patientId: string;
  encounterId?: string | null;
  procedureId?: string | null;
  consentType: string;
  consentTextVersion: string;
  method: "typed" | "scanned";
  signedName: string;
  attachmentId?: string | null;
  recordedAt: string;
  voided: boolean;
  voidedAt?: string | null;
  voidReason?: string | null;
}

export interface PrescriptionItem {
  id: string;
  encounterId: string;
  patientId: string;
  doctorId: string;
  items: Array<{
    drug: string;
    dose: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
  notes?: string | null;
  status: "draft" | "signed";
  signedAt?: string | null;
  createdAt: string;
}

export interface PrescriptionPrintView {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientDob?: string | null;
  status: string;
  items: Array<{
    drug: string;
    dose: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
  notes?: string | null;
  doctorName: string;
  licenceNumber: string;
  signedAt?: string | null;
  clinicHeader: string;
  watermark: string;
  legalDisclaimer: string;
}

export interface ReferralLetterItem {
  id: string;
  encounterId: string;
  patientId: string;
  recipient: string;
  reason: string;
  summary: string;
  status: "draft" | "signed";
  signedAt?: string | null;
  createdAt: string;
}

export interface ReferralLetterPrintView {
  id: string;
  encounterId: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientDob?: string | null;
  status: string;
  recipient: string;
  reason: string;
  summary: string;
  doctorName: string;
  licenceNumber: string;
  signedAt?: string | null;
  clinicHeader: string;
  watermark: string;
  legalDisclaimer: string;
}

// B1: Doctor Tasks
export async function getDoctorTasks(
  clinicId?: string,
  token?: string | null
): Promise<{ items: DoctorTaskItem[]; total: number }> {
  const q = clinicId ? `?clinicId=${clinicId}` : "";
  const res = await authorizedFetch(`/api/v1/doctor/tasks${q}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load doctor tasks.");
  return res.json();
}

export async function createDoctorTask(
  data: {
    title: string;
    patientId: string;
    description?: string;
    priority?: string;
    dueDate?: string;
  },
  token?: string | null
): Promise<DoctorTaskItem> {
  const res = await authorizedFetch(
    `/api/v1/doctor/tasks`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create task for reception.");
  return res.json();
}

export async function markDoctorTaskDone(
  taskId: string,
  token?: string | null
): Promise<DoctorTaskItem> {
  const res = await authorizedFetch(
    `/api/v1/doctor/tasks/${taskId}/done`,
    {
      method: "POST",
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to mark task done.");
  return res.json();
}

// B2: Treatment Plans
export async function getPatientTreatmentPlan(
  patientId: string,
  token?: string | null
): Promise<TreatmentPlanResponse> {
  const res = await authorizedFetch(
    `/api/v1/doctor/treatment-plans/patient/${patientId}`,
    {},
    token
  );
  if (!res.ok) await apiError(res, "Failed to load patient treatment plan.");
  return res.json();
}

export async function addTreatmentPlanItem(
  data: {
    patientId: string;
    procedureName: string;
    toothNumber?: number | null;
    serviceId?: string | null;
    estimatedCostCents?: number | null;
    notes?: string | null;
  },
  token?: string | null
): Promise<TreatmentPlanItem> {
  const res = await authorizedFetch(
    `/api/v1/doctor/treatment-plans`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to add treatment plan item.");
  return res.json();
}

export async function updateTreatmentPlanItemStatus(
  itemId: string,
  data: {
    status: string;
    decisionDate?: string | null;
    completedProcedureId?: string | null;
    notes?: string | null;
  },
  token?: string | null
): Promise<TreatmentPlanItem> {
  const res = await authorizedFetch(
    `/api/v1/doctor/treatment-plans/${itemId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update treatment plan item status.");
  return res.json();
}

// B3: Note Templates
export async function getClinicalNoteTemplates(
  activeOnly: boolean = true,
  token?: string | null
): Promise<ClinicalNoteTemplate[]> {
  const q = activeOnly ? "" : "?include_inactive=true";
  const res = await authorizedFetch(`/api/v1/clinical-note-templates${q}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load clinical note templates.");
  return res.json();
}

export async function createClinicalNoteTemplate(
  data: {
    name: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    active?: boolean;
  },
  token?: string | null
): Promise<ClinicalNoteTemplate> {
  const res = await authorizedFetch(
    `/api/v1/admin/note-templates`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create note template.");
  return res.json();
}

export async function updateClinicalNoteTemplate(
  templateId: string,
  data: {
    name?: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    active?: boolean;
  },
  token?: string | null
): Promise<ClinicalNoteTemplate> {
  const res = await authorizedFetch(
    `/api/v1/admin/note-templates/${templateId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to update note template.");
  return res.json();
}

export async function applyTemplateToDraftNote(
  noteId: string,
  data: {
    templateId: string;
    overwriteConfirmed?: boolean;
  },
  token?: string | null
): Promise<{
  noteId: string;
  templateName: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}> {
  const res = await authorizedFetch(
    `/api/v1/doctor/clinical-notes/${noteId}/apply-template`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to apply template to note.");
  return res.json();
}

// B4: Attachments & Consents
export async function getPatientAttachments(
  patientId: string,
  category?: string,
  token?: string | null
): Promise<PatientAttachmentItem[]> {
  const q = category ? `?category=${category}` : "";
  const res = await authorizedFetch(`/api/v1/attachments/patient/${patientId}${q}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load attachments.");
  return res.json();
}

export async function uploadPatientAttachment(
  formData: FormData,
  token?: string | null
): Promise<PatientAttachmentItem> {
  const res = await authorizedFetch(
    `/api/v1/attachments/upload`,
    {
      method: "POST",
      body: formData,
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to upload attachment.");
  return res.json();
}

export async function voidPatientAttachment(
  attachmentId: string,
  reason: string,
  token?: string | null
): Promise<{ voided: boolean }> {
  const res = await authorizedFetch(
    `/api/v1/attachments/${attachmentId}/void`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to void attachment.");
  return res.json();
}

export async function downloadPatientAttachmentBlob(
  attachmentId: string,
  token?: string | null
): Promise<Blob> {
  const res = await authorizedFetch(
    `/api/v1/attachments/${attachmentId}/download`,
    {},
    token
  );
  if (!res.ok) await apiError(res, "Failed to download attachment.");
  return res.blob();
}

export async function getPatientConsents(
  patientId: string,
  token?: string | null
): Promise<PatientConsentItem[]> {
  const res = await authorizedFetch(`/api/v1/consents/patient/${patientId}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load consents.");
  return res.json();
}

export async function recordPatientConsent(
  data: {
    patientId: string;
    consentType: string;
    method: "typed" | "scanned";
    signedName: string;
    encounterId?: string;
    procedureId?: string;
    attachmentId?: string;
    consentTextVersion?: string;
  },
  token?: string | null
): Promise<PatientConsentItem> {
  const res = await authorizedFetch(
    `/api/v1/consents`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to record patient consent.");
  return res.json();
}

export async function voidPatientConsent(
  consentId: string,
  reason: string,
  token?: string | null
): Promise<{ voided: boolean }> {
  const res = await authorizedFetch(
    `/api/v1/consents/${consentId}/void`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to void consent.");
  return res.json();
}

// B5: Clinical Documents (Prescriptions & Referrals)
export async function getEncounterPrescriptions(
  encounterId: string,
  token?: string | null
): Promise<PrescriptionItem[]> {
  const res = await authorizedFetch(
    `/api/v1/doctor/documents/prescriptions/encounter/${encounterId}`,
    {},
    token
  );
  if (!res.ok) await apiError(res, "Failed to load prescriptions.");
  return res.json();
}

export async function createPrescription(
  data: {
    encounterId: string;
    patientId: string;
    items: Array<{
      drug: string;
      dose: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    notes?: string;
  },
  token?: string | null
): Promise<PrescriptionItem> {
  const res = await authorizedFetch(
    `/api/v1/doctor/documents/prescriptions`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create prescription.");
  return res.json();
}

export async function signPrescription(
  id: string,
  token?: string | null
): Promise<PrescriptionItem> {
  const res = await authorizedFetch(
    `/api/v1/doctor/documents/prescriptions/${id}/sign`,
    {
      method: "POST",
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to sign prescription.");
  return res.json();
}

export async function getPrescriptionPrintView(
  id: string,
  token?: string | null
): Promise<PrescriptionPrintView> {
  const res = await authorizedFetch(
    `/api/v1/doctor/documents/prescriptions/${id}/print`,
    {},
    token
  );
  if (!res.ok) await apiError(res, "Failed to load prescription print view.");
  return res.json();
}

export async function getEncounterReferrals(
  encounterId: string,
  token?: string | null
): Promise<ReferralLetterItem[]> {
  const res = await authorizedFetch(
    `/api/v1/doctor/documents/referrals/encounter/${encounterId}`,
    {},
    token
  );
  if (!res.ok) await apiError(res, "Failed to load referrals.");
  return res.json();
}

export async function createReferralLetter(
  data: {
    encounterId: string;
    patientId: string;
    recipient: string;
    reason: string;
    summary?: string;
  },
  token?: string | null
): Promise<ReferralLetterItem> {
  const res = await authorizedFetch(
    `/api/v1/doctor/documents/referrals`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to create referral letter.");
  return res.json();
}

export async function signReferralLetter(
  id: string,
  token?: string | null
): Promise<ReferralLetterItem> {
  const res = await authorizedFetch(
    `/api/v1/doctor/documents/referrals/${id}/sign`,
    {
      method: "POST",
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to sign referral letter.");
  return res.json();
}

export async function getReferralLetterPrintView(
  id: string,
  token?: string | null
): Promise<ReferralLetterPrintView> {
  const res = await authorizedFetch(
    `/api/v1/doctor/documents/referrals/${id}/print`,
    {},
    token
  );
  if (!res.ok) await apiError(res, "Failed to load referral print view.");
  return res.json();
}

/* -------------------------------------------------------------
 * PART C: ADMIN AUDIT VIEWER & ADVANCED OPERATIONAL REPORTS
 * ------------------------------------------------------------- */

export interface ActivityLogItem {
  id: string;
  userId?: string | null;
  userEmail?: string | null;
  userFullName?: string | null;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt?: string | null;
}

export interface PaginatedActivityLogsResponse {
  items: ActivityLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogFilters {
  actor?: string;
  action?: string;
  entity?: string;
  patient?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export async function getAuditLogs(
  filters: AuditLogFilters = {},
  token?: string | null
): Promise<PaginatedActivityLogsResponse> {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.action) params.set("action", filters.action);
  if (filters.entity) params.set("entity", filters.entity);
  if (filters.patient) params.set("patient", filters.patient);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await authorizedFetch(`/api/v1/admin/audit${query}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load audit logs.");
  return res.json();
}

export async function downloadAuthorizedCsv(
  endpoint: string,
  defaultFilename: string,
  token?: string | null
): Promise<void> {
  const res = await authorizedFetch(endpoint, {}, token);
  if (!res.ok) {
    await apiError(res, "Failed to download export file.");
  }
  const blob = await res.blob();
  let filename = defaultFilename;
  const disposition = res.headers.get("Content-Disposition");
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export interface AppointmentsReportData {
  period: { dateFrom: string | null; dateTo: string | null };
  summary: {
    total: number;
    completed: number;
    cancelled: number;
    noShow: number;
    pending: number;
    confirmed: number;
    other: number;
  };
  byStatus: Array<{ status: string; count: number; percentage: number }>;
  byClinician: Array<{
    clinicianId: string;
    clinicianName: string;
    total: number;
    statuses: Record<string, number>;
  }>;
  dailyTimeline: Array<{
    date: string;
    total: number;
    completed: number;
    cancelled: number;
  }>;
}

interface AppointmentsReportResponse {
  startDate: string | null;
  endDate: string | null;
  totalAppointments: number;
  byStatus: Record<string, number>;
  byClinician: AppointmentsReportData["byClinician"];
  dailyCounts: AppointmentsReportData["dailyTimeline"];
}

export async function getAppointmentsReport(
  filters: { dateFrom?: string; dateTo?: string; clinicianId?: string; status?: string } = {},
  token?: string | null
): Promise<AppointmentsReportData> {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.clinicianId) params.set("clinicianId", filters.clinicianId);
  if (filters.status) params.set("status", filters.status);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await authorizedFetch(`/api/v1/admin/reports/appointments${query}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load appointments report.");
  const payload: unknown = await res.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("Appointments report returned an invalid response.");
  }

  const report = payload as Partial<AppointmentsReportResponse>;
  if (
    typeof report.totalAppointments !== "number" ||
    !report.byStatus ||
    typeof report.byStatus !== "object" ||
    Array.isArray(report.byStatus) ||
    !Array.isArray(report.byClinician) ||
    !Array.isArray(report.dailyCounts)
  ) {
    throw new Error("Appointments report returned an invalid response.");
  }

  const total = report.totalAppointments;
  const statusCounts = report.byStatus;
  const statuses = Object.entries(statusCounts).map(([status, count]) => {
    if (typeof count !== "number") {
      throw new Error("Appointments report returned an invalid status count.");
    }
    return {
      status,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    };
  });
  const knownStatuses = ["completed", "cancelled", "no_show", "requested", "confirmed"];
  const knownTotal = knownStatuses.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0);

  return {
    period: { dateFrom: report.startDate ?? null, dateTo: report.endDate ?? null },
    summary: {
      total,
      completed: statusCounts.completed ?? 0,
      cancelled: statusCounts.cancelled ?? 0,
      noShow: statusCounts.no_show ?? 0,
      pending: statusCounts.requested ?? statusCounts.pending ?? 0,
      confirmed: statusCounts.confirmed ?? 0,
      other: Math.max(0, total - knownTotal),
    },
    byStatus: statuses,
    byClinician: report.byClinician,
    dailyTimeline: report.dailyCounts,
  };
}

export interface CancellationsReportData {
  period: { dateFrom: string | null; dateTo: string | null };
  summary: {
    totalCancellations: number;
    totalNoShows: number;
    combinedLoss: number;
    cancellationRatePercent: number;
  };
  cancellationReasons: Array<{ reason: string; count: number; percentage: number }>;
  items: Array<{
    bookingId: string;
    appointmentDate: string;
    appointmentTime: string;
    patientName: string;
    patientPhone: string;
    clinicianName: string;
    serviceName: string;
    status: string;
    reason: string;
    cancelledAt: string | null;
    cancelledBy: string;
  }>;
}

export async function getCancellationsReport(
  filters: { dateFrom?: string; dateTo?: string; clinicianId?: string } = {},
  token?: string | null
): Promise<CancellationsReportData> {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.clinicianId) params.set("clinicianId", filters.clinicianId);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await authorizedFetch(`/api/v1/admin/reports/cancellations-no-shows${query}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load cancellations and no-shows report.");
  return res.json();
}

export interface RecallComplianceReportData {
  period: { dateFrom: string | null; dateTo: string | null };
  summary: {
    totalRecalls: number;
    completedRecalls: number;
    duePending: number;
    overdue: number;
    complianceRatePercent: number;
  };
  byReason: Array<{ reason: string; total: number; completed: number; complianceRatePercent: number }>;
  timeline: Array<{ month: string; scheduled: number; completed: number; complianceRatePercent: number }>;
  records: Array<{
    id: string;
    patientName: string;
    patientPhone: string;
    reason: string;
    intervalMonths: number;
    dueDate: string;
    status: string;
    lastVisitDate: string | null;
    completedAt: string | null;
    isOverdue: boolean;
  }>;
}

export async function getRecallComplianceReport(
  filters: { dateFrom?: string; dateTo?: string; status?: string } = {},
  token?: string | null
): Promise<RecallComplianceReportData> {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.status) params.set("status", filters.status);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await authorizedFetch(`/api/v1/admin/reports/recall-compliance${query}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load recall compliance report.");
  return res.json();
}

export interface OperationalTimingReportData {
  period: { dateFrom: string | null; dateTo: string | null };
  aggregate: {
    totalCompletedVisits: number;
    medianWaitMinutes: number | null;
    averageWaitMinutes: number | null;
    medianChairMinutes: number | null;
    averageChairMinutes: number | null;
    medianTotalCycleMinutes: number | null;
    averageTotalCycleMinutes: number | null;
  };
  waitingTimeDistribution: Array<{ bracket: string; count: number; percentage: number }>;
  chairTimeDistribution: Array<{ bracket: string; count: number; percentage: number }>;
  dailyTrends: Array<{
    date: string;
    completedEncounters: number;
    medianWaitMinutes: number | null;
    medianChairMinutes: number | null;
  }>;
}

export async function getOperationalTimingReport(
  filters: { dateFrom?: string; dateTo?: string; clinicianId?: string } = {},
  token?: string | null
): Promise<OperationalTimingReportData> {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.clinicianId) params.set("clinicianId", filters.clinicianId);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await authorizedFetch(`/api/v1/admin/reports/operational-timing${query}`, {}, token);
  if (!res.ok) await apiError(res, "Failed to load operational timing report.");
  return res.json();
}



