"use client";

import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, User, MapPin, Calendar, Award } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { usePublicContent } from "@/components/providers/public-content-provider";

export function Doctor() {
  const { team, locations, isLoading } = usePublicContent();
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter only active team members
  const activeTeam = team.filter((m) => m.isActive !== false);

  // Dynamically derive unique cities from active locations in the database
  const availableCities = Array.from(
    new Set(
      locations
        .filter((l) => l.isActive !== false)
        .map((l) => l.city)
        .filter(Boolean)
    )
  );

  // Map each doctor to their facility
  const doctorsWithLocations = activeTeam.map((member) => {
    const loc = member.locationId
      ? locations.find((l) => l.id === member.locationId)
      : null;
    return {
      ...member,
      locationName: loc?.name || "Practice-wide Facility",
      city: loc?.city || (availableCities[0] ?? "Chicago"),
    };
  });

  // Filter doctors based on selected city tab
  const filteredDoctors =
    selectedCity === "all"
      ? doctorsWithLocations
      : doctorsWithLocations.filter(
          (d) => d.city.toLowerCase() === selectedCity.toLowerCase()
        );

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -340, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 340, behavior: "smooth" });
    }
  };

  return (
    <section id="team" className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 py-20 md:py-28 overflow-hidden">
      <div className="container-x space-y-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <SectionHeading
              eyebrow="Clinical Specialists & Practitioners"
              title={
                <>
                  Meet Our Clinical Team
                  <br />
                  &amp; Dental Experts
                </>
              }
            />
          </div>
          <p className="max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Licensed practitioners dedicated to unhurried, conservative care with direct doctor continuity from examination to restorative completion.
          </p>
        </div>

        {/* Dynamic City Filter Tabs */}
        {availableCities.length > 0 && (
          <div className="border-b border-gray-200 dark:border-gray-800 pb-4 flex items-center gap-2 overflow-x-auto scrollbar-none" role="tablist">
            <button
              role="tab"
              aria-selected={selectedCity === "all"}
              onClick={() => setSelectedCity("all")}
              className={`rounded-full px-5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCity === "all"
                  ? "bg-primary text-white shadow-subtle font-semibold"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
              }`}
            >
              All Doctors ({activeTeam.length})
            </button>
            {availableCities.map((city) => {
              const isSelected = selectedCity.toLowerCase() === city.toLowerCase();
              const count = doctorsWithLocations.filter(
                (d) => d.city.toLowerCase() === city.toLowerCase()
              ).length;
              return (
                <button
                  key={city}
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedCity(city)}
                  className={`rounded-full px-5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary text-white shadow-subtle font-semibold"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {city} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-4 h-96 animate-pulse flex flex-col justify-between border border-gray-200 dark:border-gray-800">
                <div className="w-full aspect-[4/5] rounded-xl bg-gray-200 dark:bg-gray-800 mb-4" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredDoctors.length === 0 ? (
          /* Empty State */
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center space-y-3">
            <User className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto" />
            <h3 className="font-display text-lg text-gray-900 dark:text-white font-semibold">
              No specialists currently listed in this category
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Our clinical directory is managed in real-time. Please check another location or contact our practice desk directly.
            </p>
            {selectedCity !== "all" && (
              <Button onClick={() => setSelectedCity("all")} variant="outline" size="sm">
                View All Specialists
              </Button>
            )}
          </div>
        ) : (
          /* Cards Row with Carousel Arrows */
          <div className="relative">
            {/* Scroll Navigation Arrows */}
            {filteredDoctors.length > 2 && (
              <>
                <button
                  onClick={scrollLeft}
                  aria-label="Previous specialists"
                  className="hidden md:grid absolute -left-5 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-md text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all place-items-center cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={scrollRight}
                  aria-label="Next specialists"
                  className="hidden md:grid absolute -right-5 top-1/2 -translate-y-1/2 z-20 h-11 w-11 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-md text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all place-items-center cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}

            <div
              ref={scrollRef}
              className="flex gap-6 overflow-x-auto pb-4 pt-2 scrollbar-thin snap-x snap-mandatory px-1"
            >
              {filteredDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="w-[280px] sm:w-[300px] shrink-0 snap-start"
                >
                  <div className="h-full rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 flex flex-col justify-between hover:shadow-md transition-all">
                    <div>
                      {/* Doctor Image at Top */}
                      <div className="w-full aspect-[4/5] rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-3.5 relative shadow-xs">
                        {doc.photoUrl ? (
                          <img
                            src={doc.photoUrl}
                            alt={doc.displayName}
                            className="w-full h-full object-cover object-top"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center bg-gray-100 dark:bg-gray-800 text-gray-400">
                            <User className="h-16 w-16" />
                          </div>
                        )}
                        {doc.role === "Director" && (
                          <span className="absolute top-2.5 left-2.5 rounded-full bg-primary text-white px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider flex items-center gap-1 shadow-xs">
                            <Award className="h-3 w-3" />
                            <span>Director</span>
                          </span>
                        )}
                      </div>

                      {/* Name, Credentials, and Title Below */}
                      <div className="space-y-1">
                        <h3 className="font-display text-base sm:text-lg text-gray-900 dark:text-white font-semibold leading-snug">
                          {doc.displayName}
                        </h3>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {doc.credentials && (
                            <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
                              {doc.credentials}
                            </span>
                          )}
                          {doc.credentials && <span className="text-gray-400">·</span>}
                          <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                            {doc.professionalTitle || doc.role}
                          </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1 text-[11.5px] text-gray-600 dark:text-gray-400 pt-1">
                          <MapPin className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">{doc.locationName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Book Appointment CTA Button */}
                    <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-800">
                      <Button
                        href="/book"
                        variant="secondary"
                        size="sm"
                        className="w-full justify-center text-xs"
                      >
                        <Calendar className="h-3.5 w-3.5 mr-1 text-primary" />
                        <span>Book Appointment</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Doctor;
