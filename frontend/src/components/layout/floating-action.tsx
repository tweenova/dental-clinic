"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Phone, Calendar } from "lucide-react";
import { getOfficeStatus } from "@/lib/utils";
import { usePublicContent } from "@/components/providers/public-content-provider";

/**
 * Renders a compact floating contact bar on desktop screens in the bottom-left corner.
 * It gives patients immediate access to call the office or jump to the booking page, alongside a live open/closed indicator.
 */
export function FloatingAction() {
  const { content, primaryLocation } = usePublicContent();
  const [status, setStatus] = useState({ isOpen: true, statusText: "Open Now", nextEventText: "" });

  const phone = content.general?.phone || primaryLocation?.phone || "(312) 555-0147";
  const cleanPhone = phone.replace(/[^0-9+]/g, "");

  useEffect(() => {
    setStatus(getOfficeStatus());
  }, []);

  return (
    <div
      className="fixed bottom-4 left-4 z-40 hidden md:block"
      role="complementary"
      aria-label="Direct clinic contact actions"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 p-1.5 backdrop-blur-md shadow-lg transition-all">
        <a
          href={`tel:${cleanPhone}`}
          className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-900 dark:text-white transition-colors hover:bg-primary hover:text-white dark:hover:bg-primary cursor-pointer"
          title="Direct dental line"
        >
          <span className="relative flex h-2 w-2">
            {status.isOpen && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                status.isOpen ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
          </span>
          <Phone className="h-3.5 w-3.5" />
          <span>{phone}</span>
        </a>

        <Link
          href="/book"
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white transition-colors hover:brightness-110 shadow-xs"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>Book Visit</span>
        </Link>
      </div>
    </div>
  );
}
