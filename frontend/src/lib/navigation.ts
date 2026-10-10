/**
 * Centralized, role-aware navigation for the staff portal.
 *
 * Every href below points to a route that actually exists in `src/app`.
 * Items are grouped per workspace so the shared sidebar renders the same
 * structure for Admin, Receptionist and Doctor while only exposing each
 * role's real capabilities.
 *
 * Admin links into the front-office routes (`/reception/*`) on purpose: the
 * backend `require_receptionist` dependency explicitly allows the admin role,
 * so clinic-wide appointment/patient/lead/task visibility is a real
 * capability, not a shortcut.
 */

import {
  Activity,
  Bell,
  Calendar,
  Clock,
  FileCheck,
  FileText,
  Globe,
  Inbox,
  Layers,
  ListTodo,
  Mail,
  MapPin,
  PhoneCall,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
  Zap,
} from "lucide-react";

import type { SidebarLink } from "@/components/layout/dashboard-sidebar";
import type { WorkspaceKey } from "@/lib/workspace";

interface NavSection {
  label?: string;
  items: SidebarLink[];
}

const ADMIN_OPERATIONS: SidebarLink[] = [
  { href: "/admin", title: "Dashboard", icon: Activity, exact: true },
  { href: "/reception/schedule", title: "Appointments", icon: Calendar },
  { href: "/reception/patients", title: "Patients", icon: Users },
  { href: "/reception/tasks", title: "Tasks", icon: ListTodo },
  { href: "/reception/messages", title: "Messages", icon: Mail },
  { href: "/reception/leads", title: "Leads", icon: UserX },
];

const ADMIN_MANAGEMENT: SidebarLink[] = [
  { href: "/admin/locations", title: "Clinics & Branches", icon: MapPin },
  { href: "/admin/services", title: "Services & Fees", icon: Layers },
  { href: "/admin/team", title: "Team Members", icon: Users },
  { href: "/admin/announcements", title: "Announcements", icon: Bell },
  { href: "/admin/website", title: "Website CMS", icon: Globe },
  { href: "/admin/permissions", title: "Role Permissions", icon: ShieldCheck },
];

const ADMIN_SYSTEM: SidebarLink[] = [
  { href: "/admin/settings", title: "Settings", icon: Settings },
  { href: "/admin/account", title: "Account", icon: ShieldCheck },
];

const RECEPTION_NAV: SidebarLink[] = [
  { href: "/reception", title: "Dashboard", icon: Activity, exact: true },
  { href: "/reception/schedule", title: "Schedule", icon: Calendar },
  { href: "/reception/appointments", title: "Appointments", icon: Clock },
  { href: "/reception/appointments/requests", title: "Requests", icon: Inbox },
  { href: "/reception/appointments/confirmations", title: "Confirmations", icon: FileCheck },
  { href: "/reception/check-in", title: "Check-In Flow", icon: UserCheck },
  { href: "/reception/patients", title: "Patients", icon: Users },
  { href: "/reception/tasks", title: "Tasks", icon: ListTodo },
  { href: "/reception/messages", title: "Messages", icon: Mail },
  { href: "/reception/recalls", title: "Recalls", icon: PhoneCall },
  { href: "/reception/waitlist", title: "Waitlist", icon: Zap },
  { href: "/reception/leads", title: "Leads", icon: UserX },
  { href: "/reception/account", title: "Account", icon: ShieldCheck },
];

const DOCTOR_NAV: SidebarLink[] = [
  { href: "/doctor", title: "Daily Schedule", icon: FileText, exact: true },
];

/** Returns the grouped navigation for a workspace. */
export function getNavSections(workspace: WorkspaceKey): NavSection[] {
  switch (workspace) {
    case "admin":
      return [
        { items: ADMIN_OPERATIONS },
        { label: "Practice Setup", items: ADMIN_MANAGEMENT },
        { label: "System", items: ADMIN_SYSTEM },
      ];
    case "reception":
      return [{ items: RECEPTION_NAV }];
    case "doctor":
      return [{ items: DOCTOR_NAV }];
    default:
      return [];
  }
}

/** Flat list of links for a workspace (used by the sidebar). */
export function getNavLinks(workspace: WorkspaceKey): SidebarLink[] {
  return getNavSections(workspace).flatMap((section) => section.items);
}
