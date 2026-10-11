"use client";

import React from "react";
import {
  Activity,
  Calendar,
  Clock,
  FileCheck,
  Inbox,
  ListTodo,
  Mail,
  PhoneCall,
  ShieldCheck,
  UserCheck,
  Users,
  UserX,
  Zap,
} from "lucide-react";

import {
  SharedDashboardLayout,
  SidebarLink,
} from "@/components/layout/shared-dashboard-layout";

const RECEPTION_LINKS: SidebarLink[] = [
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

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return (
    <SharedDashboardLayout
      links={RECEPTION_LINKS}
      roleTitle="Front Office"
      portalTitle="Front-Office Operations"
      badgeLabel="Reception"
      basePath="/reception"
    >
      {children}
    </SharedDashboardLayout>
  );
}
