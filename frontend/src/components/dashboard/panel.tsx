"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface PanelProps {
  title?: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Remove body padding when the panel wraps a table or list with its own rows. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
}

/**
 * Standard content panel: bordered card with an optional compact header row.
 * Keeps consistent 12/16px internal padding across every workspace page.
 */
export function Panel({
  title,
  description,
  action,
  children,
  flush = false,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <Card surface="bone" shadow="subtle" className={cn("overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold text-ink leading-snug">{title}</h2>
            )}
            {description && (
              <p className="text-[11px] text-ink-soft mt-0.5">{description}</p>
            )}
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn(flush ? "" : "p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

export default Panel;
