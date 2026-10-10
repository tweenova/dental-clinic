"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Standard page header for every staff-portal page: compact eyebrow,
 * one-line title, optional context sentence and a right-aligned action row.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-line pb-4",
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-xl sm:text-2xl font-display text-ink font-normal leading-tight">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs sm:text-[13px] text-ink-soft max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export default PageHeader;
