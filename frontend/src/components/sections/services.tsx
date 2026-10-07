"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Clock,
  Tag,
  ShieldCheck,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getServices, ServiceItem } from "@/lib/api";

type CategoryFilter = "all" | "preventive" | "restorative" | "cosmetic" | "emergency";

const TABS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All Treatments" },
  { id: "preventive", label: "Preventive Care" },
  { id: "restorative", label: "Restorative" },
  { id: "cosmetic", label: "Cosmetic" },
  { id: "emergency", label: "Emergency Triage" },
];

export function Services() {
  const [activeTab, setActiveTab] = useState<CategoryFilter>("all");
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (offset: number) => {
    scrollRef.current?.scrollBy({ left: offset, behavior: "smooth" });
  };

  useEffect(() => {
    let isMounted = true;

    getServices()
      .then((data) => {
        if (isMounted) {
          if (data && data.length > 0) {
            setServices(data.filter((s) => s.isActive !== false));
          } else {
            setServices([]);
          }
        }
      })
      .catch(() => {
        if (isMounted) setServices([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered =
    activeTab === "all"
      ? services
      : services.filter((s) => s.category === activeTab);

  return (
    <section id="services" className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-20 md:py-28 overflow-hidden">
      <div className="container-x space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Treatments &amp; Fee Transparency"
            title={
              <>
                A Clear Lineup of Care,
                <br />
                Priced with Honest Clarity.
              </>
            }
          />
          <div className="max-w-md space-y-2">
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Every procedure is itemized before we begin. No unexpected billing surprises, no pressure for unnecessary cosmetic upselling, and upfront insurance verification.
            </p>
            <div className="flex items-center gap-2 text-xs text-primary dark:text-emerald-400 font-medium">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>Written pre-treatment cost estimate provided chairside</span>
            </div>
          </div>
        </div>

        {/* Category Pill Tabs */}
        <div
          className="border-b border-gray-200 dark:border-gray-800 pb-4 flex items-center gap-2 overflow-x-auto scrollbar-none"
          role="tablist"
        >
          {TABS.map((tab) => {
            const count =
              tab.id === "all"
                ? services.length
                : services.filter((s) => s.category === tab.id).length;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                  isActive
                    ? "bg-primary text-white shadow-subtle font-semibold"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] rounded-full px-2 py-0.2 ${
                    isActive ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading State Skeleton */}
        {isLoading ? (
          <div className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-4 py-4 hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="min-w-[280px] max-w-[300px] h-72 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 animate-pulse p-5 shrink-0"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State */
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center space-y-3">
            <Sparkles className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto" />
            <h3 className="font-display text-lg text-gray-900 dark:text-white font-semibold">
              No dental treatments found in this category
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Our clinical service catalogue updates in real time from the database. Please select another treatment category or contact our desk.
            </p>
            {activeTab !== "all" && (
              <Button onClick={() => setActiveTab("all")} variant="outline" size="sm">
                View All Treatments
              </Button>
            )}
          </div>
        ) : (
          /* Slim & Horizontal Scrollable Row with Navigation Controls */
          <div className="relative w-full group">
            {/* Left Navigation Arrow */}
            <button
              onClick={() => scroll(-300)}
              aria-label="Previous treatments"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hidden md:flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Right Navigation Arrow */}
            <button
              onClick={() => scroll(300)}
              aria-label="Next treatments"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hidden md:flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div
              ref={scrollRef}
              className="flex flex-row overflow-x-auto snap-x snap-mandatory gap-4 py-4 hide-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filtered.map((service) => {
                return (
                  <div
                    key={service.id}
                    className="min-w-[280px] max-w-[300px] snap-center shrink-0 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5 flex flex-col justify-between space-y-4 hover:border-primary/40 transition-all"
                  >
                    <div className="space-y-3">
                      {/* Category Pill & Highlight Indicator */}
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2.5 text-xs">
                        <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-[10.5px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          {service.category}
                        </span>
                        {service.highlight && (
                          <span className="text-[10.5px] font-semibold text-primary uppercase tracking-wide">
                            Popular
                          </span>
                        )}
                      </div>

                      <h4 className="font-display text-lg text-gray-900 dark:text-white font-normal leading-snug">
                        {service.title}
                      </h4>

                      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 line-clamp-3">
                        {service.shortDesc}
                      </p>

                      {/* Duration & Cash Price */}
                      <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span>{service.duration}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                          <Tag className="h-3.5 w-3.5 text-primary dark:text-emerald-400" />
                          <span>{service.cashPrice}</span>
                        </div>
                      </div>

                      {service.insuranceNote && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 italic line-clamp-1">
                          {service.insuranceNote}
                        </p>
                      )}
                    </div>

                    {/* Booking Action */}
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        href={`/book?service=${service.id}`}
                        variant="secondary"
                        size="sm"
                        className="w-full justify-between"
                      >
                        <span className="flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          <span>Schedule</span>
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Services;
