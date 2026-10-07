"use client";

import { useState } from "react";
import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { Button } from "@/components/ui/button";
import { usePublicContent } from "@/components/providers/public-content-provider";

export function Visit() {
  const { locations, isLoading } = usePublicContent();
  const [selectedCity, setSelectedCity] = useState<string>("all");

  const activeLocations = locations.filter((l) => l.isActive !== false);

  // Derive unique cities dynamically from database locations
  const availableCities = Array.from(
    new Set(activeLocations.map((l) => l.city).filter(Boolean))
  );

  const filteredLocations =
    selectedCity === "all"
      ? activeLocations
      : activeLocations.filter(
          (l) => l.city.toLowerCase() === selectedCity.toLowerCase()
        );

  return (
    <section id="visit" className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-20 md:py-28 overflow-hidden">
      <div className="container-x space-y-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <SectionHeading
              eyebrow="Practice Facilities &amp; Office Hours"
              title={
                <>
                  Our Practice Locations
                  <br />
                  &amp; Clinical Facilities
                </>
              }
            />
          </div>
          <p className="max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-400">
            Accessible, state-of-the-art dental suites designed for comfort, quiet continuity, and unhurried appointments.
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
              All Practice Facilities ({activeLocations.length})
            </button>
            {availableCities.map((city) => {
              const isSelected = selectedCity.toLowerCase() === city.toLowerCase();
              const count = activeLocations.filter(
                (l) => l.city.toLowerCase() === city.toLowerCase()
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
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col md:flex-row w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 gap-6 animate-pulse">
                <div className="w-full md:w-56 h-36 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0" />
                <div className="flex-1 space-y-3 py-2">
                  <div className="h-5 bg-gray-200 dark:bg-gray-800 rounded w-1/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredLocations.length === 0 ? (
          /* Empty State */
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-12 text-center space-y-3">
            <MapPin className="h-10 w-10 text-gray-400 dark:text-gray-500 mx-auto" />
            <h3 className="font-display text-lg text-gray-900 dark:text-white font-semibold">
              No practice facilities found in this city
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Please select &quot;All Practice Facilities&quot; or check back shortly as our directory updates in real-time.
            </p>
            {selectedCity !== "all" && (
              <Button onClick={() => setSelectedCity("all")} variant="outline" size="sm">
                View All Facilities
              </Button>
            )}
          </div>
        ) : (
          /* Location Cards Full-Width Horizontal Rows */
          <div className="space-y-4">
            {filteredLocations.map((loc, idx) => {
              const fullAddress = `${loc.addressLine1}${
                loc.addressLine2 ? `, ${loc.addressLine2}` : ""
              }, ${loc.city}, ${loc.state} ${loc.postalCode || ""}`;
              const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${loc.name}, ${fullAddress}`
              )}`;
              const phone = loc.phone || "(312) 555-0147";
              const cleanPhone = phone.replace(/[^0-9+]/g, "");

              // Curated facility imagery for aesthetics
              const facilityImages = [
                "https://images.unsplash.com/photo-1629909613654-28e377c37b09?q=80&w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=800&auto=format&fit=crop",
                "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?q=80&w=800&auto=format&fit=crop",
              ];
              const clinicImage = facilityImages[idx % facilityImages.length];

              return (
                <div
                  key={loc.id}
                  className="flex flex-col md:flex-row w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-4 gap-6 items-stretch md:items-center justify-between hover:border-primary/40 transition-all"
                >
                  {/* Left Side: Clinic Image */}
                  <div className="w-full md:w-56 h-40 md:h-36 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 relative">
                    <img
                      src={clinicImage}
                      alt={loc.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {loc.isPrimary && (
                      <span className="absolute top-2.5 left-2.5 rounded-full bg-primary text-white px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider shadow-xs">
                        Primary Clinic
                      </span>
                    )}
                  </div>

                  {/* Middle: Clinic Name, Map Pin Icon + Address */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg sm:text-xl text-gray-900 dark:text-white font-semibold leading-snug">
                        {loc.name}
                      </h3>
                      <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:text-gray-400">
                        {loc.city}, {loc.state}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                      <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{fullAddress}</span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                        <a href={`tel:${cleanPhone}`} className="hover:text-primary font-medium">
                          {phone}
                        </a>
                      </div>
                      {loc.hoursInfo && (
                        <div className="hidden sm:flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate max-w-xs">{loc.hoursInfo.split("\n")[0]}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Get Directions text link + Dark rounded Book Appointment button */}
                  <div className="flex items-center gap-4 shrink-0 justify-end pt-2 md:pt-0 border-t md:border-t-0 border-gray-100 dark:border-gray-800">
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      <Navigation className="h-3.5 w-3.5 text-primary" />
                      <span>Get Directions</span>
                    </a>

                    <Button
                      href="/book"
                      variant="primary"
                      size="sm"
                      className="rounded-full px-5 text-xs"
                    >
                      <span>Book Appointment</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export default Visit;
