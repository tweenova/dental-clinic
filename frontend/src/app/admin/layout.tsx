"use client";

import React from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Calendar,
  Clock,
  FileText,
  Globe,
  Home,
  Layers,
  MapPin,
  MessageSquare,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

import {
  SharedDashboardLayout,
  SidebarLink,
} from "@/components/layout/shared-dashboard-layout";

const ADMIN_LINKS: SidebarLink[] = [
  { href: "/admin", title: "Overview", icon: Home, exact: true },
  { href: "/admin/appointments", title: "Appointments", icon: Calendar },
  { href: "/admin/reports", title: "Reports & Analytics", icon: BarChart3 },
  { href: "/admin/audit", title: "Audit Trail", icon: Activity },
  { href: "/admin/booking", title: "Booking & Closures", icon: Clock },
  { href: "/admin/messaging", title: "Messaging & Reminders", icon: MessageSquare },
  { href: "/admin/note-templates", title: "Note Templates", icon: FileText },
  { href: "/admin/locations", title: "Clinics & Branches", icon: MapPin },
  { href: "/admin/services", title: "Services & Fees", icon: Layers },
  { href: "/admin/team", title: "Team Members", icon: Users },
  { href: "/admin/users", title: "Staff Accounts", icon: User },
  { href: "/admin/announcements", title: "Announcements", icon: Bell },
  { href: "/admin/website", title: "Website CMS", icon: Globe },
  { href: "/admin/settings", title: "Settings", icon: Settings },
  { href: "/admin/account", title: "Account", icon: User },
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
