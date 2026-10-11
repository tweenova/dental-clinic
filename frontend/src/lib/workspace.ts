/**
 * Workspace (role-based routing) resolution: Marlow Dental staff portal.
 *
 * Single source of truth for mapping an authenticated user's backend role to
 * the staff workspace they are allowed to reach. Mirrors the backend
 * authorization rules in `backend/app/api/deps.py`:
 *
 *   require_admin        = admin | Platform Owner | Super Admin
 *   require_receptionist = receptionist | Receptionist | admin | Admin |
 *                          Super Admin | Clinic Branch Manager
 *   require_doctor       = doctor | Doctor | admin | Admin | Super Admin
 *
 * Backend role comparison is case-insensitive, so this module normalizes the
 * same way (trim + lowercase) before matching. Never hardcode role checks in
 * components: always go through this file.
 */

export type WorkspaceKey = "admin" | "reception" | "doctor";

export interface WorkspaceMeta {
  /** Route segment prefix, e.g. "/admin". */
  basePath: string;
  /** Short badge shown in the header / sidebar. */
  badge: string;
  /** Role label shown in the sidebar footer. */
  roleLabel: string;
  /** Descriptor shown in the desktop header. */
  portalTitle: string;
  /** Loading copy while the session is being verified. */
  verifyingCopy: string;
}

export const WORKSPACES: Record<WorkspaceKey, WorkspaceMeta> = {
  admin: {
    basePath: "/admin",
    badge: "Admin",
    roleLabel: "Administration",
    portalTitle: "Practice Administration",
    verifyingCopy: "Verifying administrator session...",
  },
  reception: {
    basePath: "/reception",
    badge: "Front Office",
    roleLabel: "Front Office",
    portalTitle: "Front-Office Operations",
    verifyingCopy: "Verifying front-office session...",
  },
  doctor: {
    basePath: "/doctor",
    badge: "Doctor",
    roleLabel: "Practitioner",
    portalTitle: "Clinical Workspace",
    verifyingCopy: "Verifying practitioner session...",
  },
};

/**
 * Maps a raw backend role value onto its workspace, case-insensitively.
 * Returns null when the account has no staff workspace (e.g. "patient").
 */
export function workspaceForRole(role: string | null | undefined): WorkspaceKey | null {
  if (!role) return null;
  const normalized = role.trim().toLowerCase();

  switch (normalized) {
    case "admin":
    case "super admin":
    case "platform owner":
      return "admin";
    case "receptionist":
    case "clinic branch manager":
      return "reception";
    case "doctor":
      return "doctor";
    default:
      return null;
  }
}

/** Workspace the signed-in user should land on after login (or null if none). */
export function homePathForRole(role: string | null | undefined): string | null {
  const workspace = workspaceForRole(role);
  return workspace ? WORKSPACES[workspace].basePath : null;
}

/**
 * Which workspaces a role may open. Matches backend `require_*` dependencies
 * exactly, so a user can never reach a workspace the API would reject.
 */
export function canAccessWorkspace(role: string | null | undefined, workspace: WorkspaceKey): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase();
  const isAdminLevel = normalized === "admin" || normalized === "super admin" || normalized === "platform owner";

  switch (workspace) {
    case "admin":
      return isAdminLevel;
    case "reception":
      return isAdminLevel || normalized === "receptionist" || normalized === "clinic branch manager";
    case "doctor":
      return isAdminLevel || normalized === "doctor";
    default:
      return false;
  }
}
