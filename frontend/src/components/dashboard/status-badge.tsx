"use client";

import React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "warning" | "info" | "danger" | "accent";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/**
 * Maps a known status string onto a compact pill badge. Unknown statuses
 * render neutrally instead of guessing a color, so badges never misrepresent
 * backend state.
 */
const STATUS_TONES: Record<string, { label: string; tone: Tone }> = {
  // Appointments / bookings
  scheduled: { label: "Scheduled", tone: "info" },
  pending: { label: "Pending", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "positive" },
  arrived: { label: "Arrived", tone: "warning" },
  checked_in: { label: "Checked in", tone: "warning" },
  waiting: { label: "Waiting", tone: "warning" },
  in_progress: { label: "In treatment", tone: "accent" },
  completed: { label: "Completed", tone: "positive" },
  cancelled: { label: "Cancelled", tone: "danger" },
  no_show: { label: "No show", tone: "danger" },
  waitlist: { label: "Waitlist", tone: "neutral" },
  // Confirmation
  unconfirmed: { label: "Unconfirmed", tone: "warning" },
  // Tasks
  open: { label: "Open", tone: "info" },
  overdue: { label: "Overdue", tone: "danger" },
  high: { label: "High", tone: "danger" },
  urgent: { label: "Urgent", tone: "danger" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "neutral" },
  // Leads
  new: { label: "New", tone: "info" },
  contacted: { label: "Contacted", tone: "warning" },
  qualified: { label: "Qualified", tone: "accent" },
  converted: { label: "Converted", tone: "positive" },
  lost: { label: "Lost", tone: "danger" },
  // Recalls
  due: { label: "Due", tone: "warning" },
};

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-sand text-ink-soft border-line",
  positive: "bg-primary/10 text-primary dark:text-emerald-400 border-primary/20",
  warning: "bg-amber-100/80 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/70 dark:border-amber-900/60",
  info: "bg-blue-100/80 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200/70 dark:border-blue-900/60",
  danger: "bg-red-100/80 text-red-800 dark:bg-red-950/60 dark:text-red-300 border-red-200/70 dark:border-red-900/60",
  accent: "bg-clay/10 text-clay border-clay/25",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = (status || "").trim().toLowerCase();
  const entry = STATUS_TONES[normalized];
  const label = entry ? entry.label : normalized.replace(/_/g, " ");
  const tone = entry?.tone ?? "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wide whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
