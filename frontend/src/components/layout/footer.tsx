"use client";

import Link from "next/link";
import { Phone, Mail, MapPin, ShieldCheck } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { usePublicContent } from "@/components/providers/public-content-provider";

/**
 * Renders the site-wide footer with clinic contact information, office hours, links, and legal policies.
 * Dynamically populated from CMS, multi-location records, and clinical leadership data.
 */
export function Footer() {
  const { content, primaryLocation, director } = usePublicContent();
  const currentYear = new Date().getFullYear();

  const practiceName = content.general?.practiceName || "Marlow Dental";
  const nameParts = practiceName.split(" ");
  const firstNamePart = nameParts[0] || "Marlow";
  const restNameParts = nameParts.slice(1).join(" ") || "Dental";

  const phone = content.general?.phone || primaryLocation?.phone || "(312) 555-0147";
  const cleanPhone = phone.replace(/[^0-9+]/g, "");
  const email = content.general?.email || primaryLocation?.email || "care@marlowdental.com";

  const addressLine1 = primaryLocation?.addressLine1 || "214 Alder Street, Suite 3";
  const addressLine2 = primaryLocation?.city && primaryLocation?.state
    ? `${primaryLocation.city}, ${primaryLocation.state} ${primaryLocation.postalCode || ""}`
    : "Chicago, IL 60614";

  const tagline =
    content.footer?.tagline ||
    content.general?.tagline ||
    "Comprehensive, ethical dental care from our dedicated clinical team.";

  const licenseText = director?.licenseNumber
    ? `${director.displayName} · ${director.licenseState || "IL"} License ${director.licenseNumber}`
    : "";

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      <div className="container-x py-10 md:py-12">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-10">
          {/* Clinic Brand & Summary */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-white">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 4c-2.5 0-3.2 1.2-4.6 1.2C6 5.2 4.5 6.6 4.5 9.2c0 3.4 1.7 6 2.6 8.6.6 1.7 1 3 2.1 3 1.2 0 1.3-1.6 1.5-3.3.15-1.4.5-2.5 1.3-2.5s1.15 1.1 1.3 2.5c.2 1.7.3 3.3 1.5 3.3 1.1 0 1.5-1.3 2.1-3 .9-2.6 2.6-5.2 2.6-8.6 0-2.6-1.5-4-2.9-4C15.2 5.2 14.5 4 12 4Z" />
                </svg>
              </span>
              <span className="font-display text-[17px] tracking-tight text-gray-900 dark:text-white">
                {firstNamePart} <span className="text-primary">{restNameParts}</span>
              </span>
            </div>

            <p className="max-w-sm text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">
              {tagline}
            </p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
                <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href={`tel:${cleanPhone}`} className="hover:text-primary dark:hover:text-white transition-colors">
                  {phone}
                </a>
                <CopyButton text={phone} label="Copy" className="border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700" />
              </div>
              <div className="flex items-center gap-2 text-[13px] text-gray-600 dark:text-gray-400">
                <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                <a href={`mailto:${email}`} className="hover:text-primary dark:hover:text-white transition-colors">
                  {email}
                </a>
                <CopyButton text={email} label="Copy" className="border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700" />
              </div>
            </div>
          </div>

          {/* Quick Navigation */}
          <div className="lg:col-span-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400 font-semibold">
              Practice
            </p>
            <ul className="mt-3 space-y-2 text-[13px] text-gray-600 dark:text-gray-400">
              <li>
                <Link href="/#services" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Treatments &amp; Fees
                </Link>
              </li>
              <li>
                <Link href="/#commitments" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Clinical Standards
                </Link>
              </li>
              <li>
                <Link href="/#team" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Clinical Team
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Insurance &amp; Billing
                </Link>
              </li>
              <li>
                <Link href="/book" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                  Schedule a Visit
                </Link>
              </li>
            </ul>
          </div>

          {/* Office Location */}
          <div className="lg:col-span-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400 font-semibold">
              Primary Location
            </p>
            <address className="mt-3 not-italic space-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p>{addressLine1}</p>
                  <p>{addressLine2}</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                    Ground floor · Wheelchair accessible
                  </p>
                </div>
              </div>
            </address>
          </div>

          {/* Practice Hours */}
          <div className="lg:col-span-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400 font-semibold">
              Office Hours
            </p>
            <div className="mt-3 space-y-1.5 text-[13px] text-gray-600 dark:text-gray-400">
              <div className="flex justify-between border-b border-gray-200 dark:border-gray-800 pb-1">
                <span>Mon – Thu</span>
                <span className="font-mono text-gray-900 dark:text-white text-[12px]">8 AM – 6 PM</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-gray-800 pb-1">
                <span>Friday</span>
                <span className="font-mono text-gray-900 dark:text-white text-[12px]">8 AM – 2 PM</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 dark:border-gray-800 pb-1">
                <span>Saturday</span>
                <span className="font-mono text-gray-900 dark:text-white text-[12px]">9 AM – 1 PM</span>
              </div>
              <div className="flex justify-between text-gray-400 dark:text-gray-500">
                <span>Sunday</span>
                <span>Closed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Strip */}
        <div className="mt-10 border-t border-gray-200 dark:border-gray-800 pt-6 text-[11.5px] text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-center sm:text-left">
            <ShieldCheck className="h-3.5 w-3.5 text-primary/60 shrink-0" />
            <span>
              &copy; {currentYear} {practiceName}. All rights reserved.
              {licenseText && <span className="ml-1">· {licenseText}</span>}
            </span>
          </div>

          <div className="flex items-center gap-4 text-center">
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/hipaa" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              HIPAA
            </Link>
            <Link href="/accessibility" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Accessibility
            </Link>
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
