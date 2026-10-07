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


