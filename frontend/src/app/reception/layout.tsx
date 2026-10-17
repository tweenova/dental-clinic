"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CheckSquare,
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
import { fetchPublicBookingStatus, PublicBookingStatus } from "@/lib/api";

const RECEPTION_LINKS: SidebarLink[] = [
  { href: "/reception", title: "Dashboard", icon: Activity, exact: true },
  { href: "/reception/schedule", title: "Schedule", icon: Calendar },
  { href: "/reception/appointments", title: "Appointments", icon: Clock },
  { href: "/reception/reminders", title: "Reminders", icon: Bell },
  { href: "/reception/appointments/requests", title: "Requests", icon: Inbox },
  { href: "/reception/appointments/confirmations", title: "Confirmations", icon: FileCheck },
  { href: "/reception/check-in", title: "Check-In Flow", icon: UserCheck },
  { href: "/reception/end-of-day", title: "End of Day", icon: CheckSquare },
  { href: "/reception/patients", title: "Patients", icon: Users },
  { href: "/reception/tasks", title: "Tasks", icon: ListTodo },
  { href: "/reception/messages", title: "Messages", icon: Mail },
  { href: "/reception/recalls", title: "Recalls", icon: PhoneCall },
  { href: "/reception/waitlist", title: "Waitlist", icon: Zap },
  { href: "/reception/leads", title: "Leads", icon: UserX },
  { href: "/reception/account", title: "Account", icon: ShieldCheck },
];

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const [bookingStatus, setBookingStatus] = useState<PublicBookingStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkBookingMode = async () => {
      try {
        const status = await fetchPublicBookingStatus();
        if (mounted) {
          setBookingStatus(status);
        }
      } catch {
        // Fallback: silently ignore
      }
    };
    checkBookingMode();
    // Poll every 60 seconds to detect emergency mode changes quickly
    const timer = setInterval(checkBookingMode, 60000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <SharedDashboardLayout
      links={RECEPTION_LINKS}
      roleTitle="Front Office"
      portalTitle="Front-Office Operations"
      badgeLabel="Reception"
      basePath="/reception"
    >
      {/* Prominent Reception Banner when booking_mode is paused */}
      {bookingStatus && bookingStatus.mode === "paused" && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/95 p-4 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-200/80 p-2 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Public Online Booking is Currently PAUSED
                  </h4>
                  <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                    Online Intake Paused
                  </span>
                </div>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300/90">
                  {bookingStatus.message || "Public patient scheduling via /book is temporarily suspended. Direct phone and reception desk scheduling remains active."}
                </p>
                {bookingStatus.resumeOn && (
                  <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                    Scheduled resumption: <strong>{new Date(bookingStatus.resumeOn).toLocaleString()}</strong>
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/admin/booking"
              className="inline-flex items-center gap-1.5 self-start sm:self-center text-xs font-semibold text-amber-900 underline hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100 whitespace-nowrap"
            >
              <span>Review in Admin Booking</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Prominent Reception Banner when booking_mode is closed */}
      {bookingStatus && bookingStatus.mode === "closed" && (
        <div className="mb-6 rounded-2xl border border-red-300 bg-red-50/95 p-4 shadow-sm dark:border-red-800/60 dark:bg-red-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-red-200/80 p-2 text-red-800 dark:bg-red-900/60 dark:text-red-200 shrink-0">
                <AlertOctagon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-red-900 dark:text-red-100">
                    EMERGENCY CLOSURE ACTIVE — Public Online Booking is CLOSED
                  </h4>
                  <span className="rounded-full bg-red-200/80 px-2 py-0.5 text-[11px] font-medium text-red-900 dark:bg-red-900 dark:text-red-200">
                    Emergency Closed
                  </span>
                </div>
                <p className="mt-1 text-xs text-red-800 dark:text-red-300/90">
                  {bookingStatus.message || "Clinic public intake is closed due to emergency or incident closure. Please adhere to clinic emergency triage and phone redirect protocols."}
                </p>
              </div>
            </div>
            <Link
              href="/admin/booking"
              className="inline-flex items-center gap-1.5 self-start sm:self-center text-xs font-semibold text-red-900 underline hover:text-red-700 dark:text-red-200 dark:hover:text-red-100 whitespace-nowrap"
            >
              <span>Review in Admin Booking</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {children}
    </SharedDashboardLayout>
  );
}
