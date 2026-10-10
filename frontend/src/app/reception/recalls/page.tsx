"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";

import { getReceptionRecalls, ReceptionRecall } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionRecallsPage() {
  const { accessToken } = useAuth();

  const [recalls, setRecalls] = useState<ReceptionRecall[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecalls = async () => {
    setIsLoading(true);
    try {
      const data = await getReceptionRecalls(accessToken);
      setRecalls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecalls();
  }, [accessToken]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
            Preventive Recalls
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Patients whose last completed visit was more than six months ago and who have no upcoming appointment.
          </p>
        </div>

        <button
          onClick={loadRecalls}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-xs cursor-pointer transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Recall Queue */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-mono text-gray-500">
            Loading recall queue...
          </div>
        ) : recalls.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              No recalls due
            </p>
            <p className="text-xs text-gray-500">Every patient with a visit on record has been seen recently.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recalls.map((r) => (
              <div
                key={`${r.patientId}-${r.lastVisitDate}`}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/reception/patients/${r.patientId}`}
                      className="font-semibold text-sm text-primary hover:underline flex items-center gap-1.5"
                    >
                      <User className="h-4 w-4" />
                      <span>{r.patientName}</span>
                    </Link>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {r.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400 text-xs">
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-mono hover:underline">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      {r.phone}
                    </a>
                    {r.email && (
                      <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:underline">
                        <Mail className="h-3.5 w-3.5 text-primary" />
                        {r.email}
                      </a>
                    )}
                    {r.lastVisitDate && (
                      <span>Last Visit: <strong className="font-mono">{r.lastVisitDate}</strong></span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${r.phone}`}
                    className="px-3.5 py-1.5 rounded-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                  >
                    Call
                  </a>

                  <Link
                    href="/reception/schedule"
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 shadow-xs transition-colors"
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Book Visit</span>
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
