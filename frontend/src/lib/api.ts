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
  organizationId?: string | null;
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
        cashPrice: typeof s.cashPrice === "number" ? `$${s.cashPrice}` : String(s.cashPrice),
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
  urgentTasksCount: number;
  newLeadsCount: number;
  recallsDueCount: number;
  needsAttentionCount: number;
  todayFlow: RawBooking[];
  needsAttentionItems: RawAttentionItem[];
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
  status: string;
  serviceId?: string | null;
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
    })),
  };
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
        status: "confirmed",
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
  token?: string | null
): Promise<ReceptionBooking> {
  const res = await authorizedFetch(
    `/api/v1/reception/appointments/${bookingId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, staffNotes: staffNotes ?? null }),
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
  data: { bookingDate: string; bookingTime: string; teamMemberId?: string },
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
      }),
    },
    token
  );
  if (!res.ok) await apiError(res, "Failed to reschedule booking.");
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
        status: "pending",
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
    status: string;
  }> = await res.json();

  return raw.map((r) => ({
    patientId: r.patientId,
    patientName: r.patientFullName,
    phone: r.phone,
    email: r.email,
    lastVisitDate: r.lastVisitDate,
    status: r.status,
    serviceId: r.serviceId,
  }));
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
