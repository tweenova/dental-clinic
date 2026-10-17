/**
 * IMPORTANT NOTE: This Accessibility Statement outlines Marlow Dental's physical
 * and digital accessibility accommodations. It requires periodic review against
 * actual physical facility updates and WCAG 2.1 AA digital guidelines.
 */

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Phone, Mail, MapPin } from "lucide-react";
import SiteHeader from "@/components/layout/site-header";
import Footer from "@/components/layout/footer";
import { LegalContactBox } from "@/components/layout/legal-contact-box";

export const metadata = {
  title: "Accessibility Statement | Marlow Dental",
  description:
    "Physical and digital accessibility policies, wheelchair access, and accommodations at Marlow Dental.",
};

/**
 * Renders the Accessibility Statement page.
 * It details physical clinic accommodations (ground-floor entry, parking) and digital compliance with WCAG 2.1 AA standards.
 */
export default function AccessibilityPage() {
  return (
    <>
      <SiteHeader variant="minimal" />
      <main id="main-content" className="py-14 sm:py-20">
        <div className="container-x max-w-4xl space-y-10">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft hover:text-forest transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Home</span>
          </Link>

          <div>
            <p className="eyebrow mb-2">Equal Access Commitment</p>
            <h1 className="text-[32px] sm:text-[42px] leading-tight text-ink font-normal">
              Accessibility Statement
            </h1>
            <p className="mt-2 text-xs text-ink-soft">
              Marlow Dental · Patient Accessibility
            </p>
          </div>

          <div className="space-y-8 text-sm sm:text-[15px] leading-[1.75] text-ink-soft">
            <section className="space-y-3">
              <h2 className="font-display text-xl sm:text-2xl text-ink font-medium">
                1. Physical Clinic Accommodations
              </h2>
              <p>
                We believe healthcare should be easily accessible to all members of our community:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm pt-1">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-forest dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Ground-Floor Suite:</strong> Our office suite is on the ground level with zero stairs or steps required from the main entrance.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-forest dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Accessible Parking:</strong> Two designated accessible parking spaces are located immediately adjacent to the building entrance, plus four reserved patient stalls in our rear lot.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-forest dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Wide Doorways and Corridors:</strong> Hallways, restroom facilities, and clinical operatories accommodate standard wheelchairs and mobility devices.
                  </span>
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-xl sm:text-2xl text-ink font-medium">
                2. Digital Website Accessibility
              </h2>
              <p>
                We strive to conform with the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. Key features include:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-xs sm:text-sm">
                <li>Keyboard navigation support across all pages, forms, and dialogs.</li>
                <li>Visible focus indicators on all interactive links, buttons, and form inputs.</li>
                <li>Semantic HTML heading structures and ARIA landmarks.</li>
                <li>Accessible color contrast ratios in both light and dark display modes.</li>
                <li>Full respect for the <code>prefers-reduced-motion</code> operating system setting.</li>
              </ul>
            </section>

            <section className="space-y-3 border-t border-line/60 pt-6">
              <h2 className="font-display text-xl sm:text-2xl text-ink font-medium">
                3. Feedback and Accommodations Assistance
              </h2>
              <p>
                If you encounter any difficulty navigating our website, or if you require specific accommodations during your clinical visit, please contact our front desk team:
              </p>
              <LegalContactBox officerTitle="Accessibility Coordinator" />
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
