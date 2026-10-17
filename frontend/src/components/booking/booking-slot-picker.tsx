"use client";

import React from "react";
import { Clock } from "lucide-react";

export interface BookingSlotPickerProps {
  loading: boolean;
  slots: string[];
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
  error?: string | null;
}

export function BookingSlotPicker({
  loading,
  slots,
  selectedSlot,
  onSelectSlot,
  error,
}: BookingSlotPickerProps) {
  if (loading) {
    return (
      <div
        data-testid="booking-slots-loading"
        className="flex items-center justify-center p-8 rounded-[var(--radius-card)] border border-line bg-cream/40"
      >
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-forest border-t-transparent mr-2" />
        <span className="text-xs text-ink-soft">Checking clinic availability...</span>
      </div>
    );
  }

  if (slots.length > 0) {
    return (
      <div
        data-testid="booking-slots-grid"
        className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1"
      >
        {slots.map((slot) => {
          const isSelected = selectedSlot === slot;
          return (
            <button
              key={slot}
              type="button"
              data-testid={`slot-button-${slot.replace(/\s+/g, "-")}`}
              onClick={() => onSelectSlot(slot)}
              className={`rounded-[var(--radius-card)] border py-2.5 text-xs font-mono font-medium transition-all cursor-pointer ${
                isSelected
                  ? "border-forest bg-forest text-[#FAF7F2]"
                  : "border-line bg-cream hover:border-forest/40 text-ink"
              }`}
            >
              {slot}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      data-testid="booking-slots-empty"
      className="rounded-xl border border-line bg-cream/60 p-5 text-center"
    >
      <Clock className="h-5 w-5 text-ink-soft mx-auto mb-1.5 opacity-60" />
      <p className="text-xs font-medium text-ink">No appointment slots available</p>
      <p className="text-[11px] text-ink-soft mt-0.5">
        {error || "All slots are reserved for this date. Please select another day."}
      </p>
    </div>
  );
}
