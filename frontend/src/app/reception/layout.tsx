"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
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

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardSidebar, SidebarLink } from "@/components/layout/dashboard-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";

const NAV_ITEMS: SidebarLink[] = [
  { href: "/reception", title: "Dashboard", icon: Activity, exact: true },
  { href: "/reception/schedule", title: "Schedule", icon: Calendar },
  { href: "/reception/appointments", title: "Appointments", icon: Clock },
  { href: "/reception/appointments/requests", title: "Requests", icon: Inbox },
  { href: "/reception/appointments/confirmations", title: "Confirmations", icon: FileCheck },
  { href: "/reception/check-in", title: "Check-In / Flow", icon: UserCheck },
  { href: "/reception/patients", title: "Patients", icon: Users },
  { href: "/reception/tasks", title: "Tasks", icon: ListTodo },
  { href: "/reception/messages", title: "Messages", icon: Mail },
  { href: "/reception/recalls", title: "Recalls", icon: PhoneCall },
  { href: "/reception/waitlist", title: "Waitlist / ASAP", icon: Zap },
  { href: "/reception/leads", title: "Leads", icon: UserX },
  { href: "/reception/account", title: "Account", icon: ShieldCheck },
];

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Verifying front-office credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAuthorized = user.role === "receptionist" || user.role === "admin";

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 shadow-xl text-center space-y-4">
          <div className="inline-flex p-3 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-display text-gray-900 dark:text-white font-normal">
            Access Restricted
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            Your account is assigned the <strong>{user.role}</strong> role. This workspace requires Front-Desk Receptionist privileges.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            {user.role === "doctor" && (
              <Link
                href="/doctor"
                className="px-4 py-2 rounded-full bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Doctor Workspace
              </Link>
            )}
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="px-4 py-2 rounded-full bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Go to Admin CMS
              </Link>
            )}
            <button
              onClick={() => logout()}
              className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col md:flex-row">
      <DashboardHeader
        portalTitle="Front-Office Operations Center"
        badgeLabel="Front Office"
        onMobileMenuOpen={() => setMobileOpen(true)}
      />

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Reusable Floating Pill Sidebar */}
      <DashboardSidebar
        links={NAV_ITEMS}
        basePath="/reception"
        roleLabel="Front Office"
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
