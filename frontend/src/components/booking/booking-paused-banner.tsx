"use client";

import React from "react";
import { AlertTriangle, Phone } from "lucide-react";
import { PublicBookingStatus } from "@/lib/api";

export interface BookingPausedBannerProps {
  status: PublicBookingStatus;
  fallbackPhone?: string;
}

export function BookingPausedBanner({
  status,
  fallbackPhone = "(312) 555-0147",
}: BookingPausedBannerProps) {
  if (status.mode === "open") {
    return null;
  }

  const contactPhone = status.phone || fallbackPhone;
  const cleanContactPhone = contactPhone.replace(/[^0-9+]/g, "");

  return (
    <div
      data-testid="booking-paused-banner"
      className="mx-auto max-w-2xl mb-8 rounded-2xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/60 p-6 shadow-sm space-y-3"
    >
      <div className="flex items-start gap-3.5">
        <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1.5 flex-1">
          <h2 className="text-base font-semibold text-amber-950 dark:text-amber-100">
            Online Scheduling Is Currently {status.mode === "paused" ? "Paused" : "Closed"}
          </h2>
          <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
            {status.message ||
              "Online booking submissions are temporarily disabled. Our reception team remains available by phone to schedule and assist you."}
          </p>
          <div className="pt-2 flex items-center gap-2">
            <span className="text-xs text-amber-800 dark:text-amber-300">
              Call our desk to schedule:
            </span>
            <a
              href={`tel:${cleanContactPhone}`}
              className="inline-flex items-center gap-1.5 font-bold text-amber-950 dark:text-amber-100 bg-amber-200/80 dark:bg-amber-900 px-3 py-1 rounded-full text-xs hover:underline"
            >
              <Phone className="h-3 w-3" />
              <span>{contactPhone}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
