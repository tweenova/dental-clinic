"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { ArrowRight, Phone, CheckCircle2 } from "lucide-react";
import { usePublicContent } from "@/components/providers/public-content-provider";

/**
 * Renders the introductory hero section of the home page.
 * It introduces the practice's human-centered philosophy, key credentials, office direct line, and primary booking buttons.
 */
export function Hero() {
  const { content, primaryLocation } = usePublicContent();

  const practiceName = content.general?.practiceName || "Marlow Dental";
  const phone = content.general?.phone || primaryLocation?.phone || "(312) 555-0147";
  const cleanPhone = phone.replace(/[^0-9+]/g, "");

  return (
    <section className="relative overflow-hidden pt-8 pb-16 md:pt-14 md:pb-24 lg:pt-20 lg:pb-28 bg-white dark:bg-gray-950">
      <div className="container-x">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-14 items-center">
          {/* Main Hero Copy - 7 cols */}
          <div className="lg:col-span-7 space-y-6">
            {/* Practice Badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 px-3.5 py-1 text-xs text-gray-600 dark:text-gray-300 backdrop-blur-sm"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="font-semibold text-primary uppercase tracking-wider text-[10.5px]">
                {content.homepage?.heroEyebrow || "Private Dental Facility"}
              </span>
              <span className="text-gray-400">·</span>
              <span>{practiceName}</span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              className="fluid-h1 tracking-[-0.03em] text-gray-900 dark:text-white font-normal leading-[1.05]"
            >
              {content.homepage?.heroHeading || "Modern, unhurried dental care for Chicago."}
            </motion.h1>

            {/* Sub-headline description */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="max-w-xl text-base sm:text-lg leading-relaxed text-gray-600 dark:text-gray-400 font-normal"
            >
              {content.homepage?.heroDescription ||
                "Comprehensive checkups, gentle restorations, and transparent fee schedules from a dedicated clinical team."}
            </motion.p>

            {/* Primary Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24 }}
              className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5"
            >
              <Button href={content.homepage?.heroCtaLink || "/book"} variant="primary" size="lg">
                <span>{content.homepage?.heroCtaText || "Request an appointment"}</span>
                <ArrowRight className="h-4 w-4 ml-0.5" />
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  href={`tel:${cleanPhone}`}
                  variant="outline"
                  size="lg"
                  className="flex-1 sm:flex-initial"
                >
                  <Phone className="h-4 w-4 text-primary" />
                  <span>Call {phone}</span>
                </Button>
                <CopyButton text={phone} label="Copy" className="h-11 px-3" />
              </div>
            </motion.div>

            {/* Verified Clinical Commitments */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.32 }}
              className="pt-6 border-t border-gray-200 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600 dark:text-gray-400"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>Dedicated clinician care</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>Written estimates first</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>Same-week openings</span>
              </div>
            </motion.div>
          </div>

          {/* Spatial Layered Composition - 5 cols */}
          <div className="lg:col-span-5 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="relative mx-auto aspect-[4/5] max-w-md overflow-hidden rounded-[var(--radius-card)] border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 shadow-card"
            >
              <img
                src={
                  content.homepage?.heroImageUrl ||
                  "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=1200&auto=format&fit=crop"
                }
                alt={`Operatory suite at ${practiceName}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-950/70 via-transparent to-transparent pointer-events-none" />

              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-200">
                  {primaryLocation?.name || practiceName}
                </p>
                <p className="text-sm font-medium mt-0.5">
                  Natural daylight, quiet single-chair suites, unhurried care
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
