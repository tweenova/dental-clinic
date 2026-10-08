"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  Plus,
  RefreshCw,
  User,
  Zap,
} from "lucide-react";

import { ReceptionWaitlistItem } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionWaitlistPage() {
  const { accessToken } = useAuth();

  // Mock / state waitlist items initialized with real clinic demo entries
  const [waitlist, setWaitlist] = useState<ReceptionWaitlistItem[]>([
    {
      id: "wl-1",
      patientId: "pat-sample-1",
      patientName: "Sarah Jenkins",
      patientPhone: "+1-555-0199",
      serviceName: "Comprehensive Dental Exam & Cleaning",
      priority: "high",
      status: "waiting",
      availableDays: ["Mondays", "Wednesdays", "Fridays"],
      preferredTimeOfDay: "Mornings (9am - 12pm)",
      notes: "Can arrive within 30 minutes if there is a cancellation",
      createdAt: new Date().toISOString(),
    },
    {
      id: "wl-2",
      patientId: "pat-sample-2",
      patientName: "Michael Chang",
      patientPhone: "+1-555-0188",
      serviceName: "Crown Fitting",
      priority: "urgent",
      status: "waiting",
      availableDays: ["Any weekday"],
      preferredTimeOfDay: "Afternoons (2pm - 5pm)",
      notes: "Temporary crown in place, prefers earliest possible slot",
      createdAt: new Date().toISOString(),
    },
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Waitlist / ASAP Queue
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Patients waiting for short-notice cancellations or earlier openings to fill schedule gaps.
          </p>
        </div>

        <Link
          href="/reception/schedule"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>Add Patient to ASAP List</span>
        </Link>
      </div>

      {/* Waitlist Queue */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {waitlist.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Zap className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No patients on the ASAP waitlist
            </p>
            <p className="text-xs text-gray-500">
              When patients request earlier openings, add them here to fill cancellations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {waitlist.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                      <User className="h-4 w-4 text-emerald-600" />
                      {item.patientName}
                    </span>
                    <span
                      className={`
                        px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold
                        ${
                          item.priority === "urgent"
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : item.priority === "high"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }
                      `}
                    >
                      {item.priority} priority
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      <a href={`tel:${item.patientPhone}`} className="hover:underline">
                        {item.patientPhone}
                      </a>
                    </span>
                    <span>Service: {item.serviceName || "Any Appointment"}</span>
                    <span>Preferred: {item.preferredTimeOfDay || "Any time"}</span>
                  </div>

                  {item.notes && (
                    <p className="text-gray-500 bg-gray-50 dark:bg-gray-800/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${item.patientPhone}`}
                    className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                  >
                    Call Patient
                  </a>

                  <Link
                    href="/reception/schedule"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 shadow-xs"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Fill Slot</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
