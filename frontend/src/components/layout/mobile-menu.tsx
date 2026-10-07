"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X, Phone, Calendar, MapPin, Clock, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { usePublicContent } from "@/components/providers/public-content-provider";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
}

const navItems = [
  { label: "Treatments & Fees", href: "/#services" },
  { label: "Clinical Philosophy", href: "/#commitments" },
  { label: "Clinical Team", href: "/#team" },
  { label: "Office & Location", href: "/#visit" },
  { label: "Frequently Asked", href: "/#faq" },
];

/**
 * Renders an accessible slide-over navigation drawer for mobile devices and smaller screens.
 * It locks background scrolling while open and provides quick links to all sections, contact actions, and theme settings.
 */
export function MobileMenu({ isOpen, onClose, onOpenSearch }: MobileMenuProps) {
  const { content, primaryLocation } = usePublicContent();
  const containerRef = useRef<HTMLDivElement>(null);

  const practiceName = content.general?.practiceName || "Marlow Dental";
  const phone = content.general?.phone || primaryLocation?.phone || "(312) 555-0147";
  const cleanPhone = phone.replace(/[^0-9+]/g, "");
  const addressText = primaryLocation?.addressLine1 || "214 Alder St, Suite 3";
  const cityState =
    primaryLocation?.city && primaryLocation?.state
      ? `${primaryLocation.city}, ${primaryLocation.state}`
      : "Lincoln Park";
  const hoursText = primaryLocation?.hoursInfo || "Mon–Thu 8–6 · Fri 8–2 · Sat 9–1";

  const nameParts = practiceName.split(" ");
  const firstNamePart = nameParts[0] || "Marlow";
  const restNameParts = nameParts.slice(1).join(" ") || "Dental";

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile Navigation Menu"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        ref={containerRef}
        className="fixed inset-y-0 right-0 flex w-full max-w-sm flex-col justify-between border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6 shadow-2xl"
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-4">
            <span className="font-display text-lg tracking-tight text-gray-900 dark:text-white">
              {firstNamePart}{" "}
              <span className="text-primary">{restNameParts}</span>
            </span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Search trigger */}
          <button
            onClick={() => {
              onClose();
              onOpenSearch();
            }}
            className="mt-5 flex w-full items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:border-primary/40 hover:text-gray-900 dark:hover:text-white cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              <span>Search procedures &amp; fees...</span>
            </span>
            <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] uppercase font-semibold">
              Find
            </span>
          </button>

          {/* Navigation links */}
          <nav className="mt-6 flex flex-col space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-900 hover:text-primary dark:hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Footer info & CTA */}
        <div className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-4">
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                {addressText}, {cityState}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{hoursText}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
              <a href={`tel:${cleanPhone}`} className="hover:text-primary font-medium">
                {phone}
              </a>
            </div>
          </div>

          <Button
            href="/book"
            variant="primary"
            size="md"
            className="w-full justify-center"
            onClick={onClose}
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            <span>Book an Appointment</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default MobileMenu;
