"use client";

import React from "react";
import {
  Activity,
  Bell,
  Globe,
  Home,
  Layers,
  MapPin,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  SharedDashboardLayout,
  SidebarLink,
} from "@/components/layout/shared-dashboard-layout";

const ADMIN_LINKS: SidebarLink[] = [
  { href: "/admin", title: "Overview", icon: Home, exact: true },
  { href: "/admin/locations", title: "Clinics & Branches", icon: MapPin },
  { href: "/admin/services", title: "Services & Fees", icon: Layers },
  { href: "/admin/team", title: "Team Members", icon: Users },
  { href: "/admin/announcements", title: "Announcements", icon: Bell },
  { href: "/admin/website", title: "Website CMS", icon: Globe },
  { href: "/admin/permissions", title: "Role Permissions", icon: ShieldCheck },
  { href: "/admin/settings", title: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SharedDashboardLayout
      links={ADMIN_LINKS}
      roleTitle="Organization CMS"
      portalTitle="Organization Management Portal"
      badgeLabel="Admin"
      basePath="/admin"
    >
      {children}
    </SharedDashboardLayout>
  );
}
