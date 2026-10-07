"use client";

import { motion } from "motion/react";
import { Clock, FileText, UserCheck } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { Card } from "@/components/ui/card";
import { usePublicContent } from "@/components/providers/public-content-provider";

/**
 * Renders the clinical commitments section highlighting foundational standards of the practice:
 * dedicated practitioner continuity, written pricing estimates before treatment, and reserved emergency appointments.
 */
export function Commitments() {
  const { director, primaryLocation, content } = usePublicContent();

  const practiceName = content.general?.practiceName || "Marlow Dental";
  const locationName = primaryLocation?.name || "practice facility";
  const phone = content.general?.phone || primaryLocation?.phone || "(312) 555-0147";

  const commitments = [
    {
      num: "01",
      icon: UserCheck,
      title: "Direct Clinician Continuity",
      subtitle: "Dedicated doctor care without handoffs",
      description: `${director?.displayName || "Our lead clinician"} and our team personally conduct your examination, explain diagnostic imaging chairside, and complete your restorative treatment. You never have to wonder which practitioner is overseeing your dental health.`,
    },
    {
      num: "02",
      icon: FileText,
      title: "Written Estimates Before We Begin",
      subtitle: "Clear pricing, zero billing surprises",
      description:
        "We explain every recommendation on screen using digital X-rays and intraoral photographs. You receive an itemized estimate showing exact procedural codes, cash rates, and estimated insurance benefits before treatment starts.",
    },
    {
      num: "03",
      icon: Clock,
      title: "Reserved Daily Emergency Slots",
      subtitle: "Same-week appointments for routine care",
      description: `We reserve dedicated triage hours every morning for sudden dental emergencies, severe pain, or broken restorations. Call our ${locationName} desk at ${phone} before 11:00 AM on weekdays for same-day evaluation.`,
    },
  ];

  return (
    <section id="commitments" className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 py-20 md:py-28">
      <div className="container-x">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
          {/* Section Introduction - 4 cols */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-4"
          >
            <SectionHeading
              eyebrow="Our Clinical Standard"
              title={
                <>
                  How private practice
                  <br />
                  should actually
                  <br />
                  feel.
                </>
              }
              description={`At ${practiceName}, we believe in honest diagnostic ethics, unhurried pacing, and transparent itemized fees before any dental procedure.`}
            />
          </motion.div>

          {/* Commitments Cards - 8 cols */}
          <div className="lg:col-span-8 space-y-4">
            {commitments.map((c, i) => {
              const Icon = c.icon;
              return (
                <motion.div
                  key={c.num}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: i * 0.08 }}
                >
                  <Card surface="bone" shadow="card" className="p-6 sm:p-7">
                    <div className="flex items-start gap-5">
                      <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {c.num}
                          </span>
                          <h3 className="font-display text-lg text-gray-900 dark:text-white font-normal">
                            {c.title}
                          </h3>
                        </div>
                        <p className="text-xs font-medium text-primary">{c.subtitle}</p>
                        <p className="text-xs sm:text-[13px] leading-relaxed text-gray-600 dark:text-gray-400 pt-1">
                          {c.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Commitments;
