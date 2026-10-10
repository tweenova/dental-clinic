"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type StatTone = "neutral" | "positive" | "warning" | "info" | "danger";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: StatTone;
  href?: string;
  className?: string;
}

const TONE_STYLES: Record<StatTone, { value: string; label: string }> = {
  neutral: { value: "text-ink", label: "text-ink-soft" },
  positive: { value: "text-primary dark:text-emerald-400", label: "text-primary dark:text-emerald-400" },
  warning: { value: "text-amber-600 dark:text-amber-400", label: "text-amber-700 dark:text-amber-400" },
  info: { value: "text-blue-600 dark:text-blue-400", label: "text-blue-700 dark:text-blue-400" },
  danger: { value: "text-red-600 dark:text-red-400", label: "text-red-700 dark:text-red-400" },
};

/**
 * Compact dashboard metric card. Uses design tokens only; no hardcoded data.
 */
export function StatCard({ label, value, hint, tone = "neutral", href, className }: StatCardProps) {
  const styles = TONE_STYLES[tone];
  const body = (
    <>
      <p className={cn("text-[11px] font-medium truncate", styles.label)}>{label}</p>
      <p className={cn("text-2xl font-display font-normal leading-none mt-1.5", styles.value)}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-ink-soft truncate">{hint}</p>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "block rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs p-3.5 transition-colors hover:border-primary/40",
          className
        )}
      >
        {body}
      </Link>
    );
  }

  return (
    <Card surface="bone" shadow="subtle" className={cn("p-3.5", className)}>
      {body}
    </Card>
  );
}

export default StatCard;
