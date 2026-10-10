"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Phone,
  Plus,
  User,
  Zap,
} from "lucide-react";

import { getReceptionWaitlist, ReceptionBooking } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";

export default function ReceptionWaitlistPage() {
  const { accessToken } = useAuth();
  const directory = useDirectory();

  const [waitlist, setWaitlist] = useState<ReceptionBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWaitlist = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionWaitlist(accessToken);
      setWaitlist(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWaitlist();
  }, [accessToken]);

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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-white text-xs font-semibold hover:bg-primary/90 shadow-xs transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Patient to ASAP List</span>
        </Link>
      </div>

      {/* Waitlist Queue */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading ASAP waitlist...
          </div>
        ) : waitlist.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Zap className="h-8 w-8 text-gray-400 mx-auto" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No patients on the ASAP waitlist
            </p>
            <p className="text-xs text-gray-500">
              When patients request earlier openings, add them from the schedule to fill cancellations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {waitlist.map((item) => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors text-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    {item.patientId ? (
                      <Link
                        href={`/reception/patients/${item.patientId}`}
                        className="font-semibold text-sm text-primary hover:underline flex items-center gap-1.5"
                      >
                        <User className="h-4 w-4" />
                        <span>{item.patientName}</span>
                      </Link>
                    ) : (
                      <span className="font-semibold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                        <User className="h-4 w-4 text-primary" />
                        {item.patientName}
                      </span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-clay/15 text-clay">
                      {item.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <a href={`tel:${item.patientPhone}`} className="hover:underline">
                        {item.patientPhone}
                      </a>
                    </span>
                    <span>Requested: {item.bookingDate} at {item.bookingTime}</span>
                    <span>Service: {directory.serviceName(item.serviceId) || "Any Appointment"}</span>
                    <span>Provider: {directory.providerName(item.providerId) || "Any Provider"}</span>
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
                    className="px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                  >
                    Call Patient
                  </a>

                  <Link
                    href="/reception/schedule"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 shadow-xs transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Schedule</span>
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
