"use client";

import React from "react";
import { AlertTriangle, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface StateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Consistent loading placeholder for lists, tables and dashboards. */
export function LoadingState({ title = "Loading", description, className }: StateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-ink-soft/70" />
      <p className="mt-3 text-[11px] font-mono uppercase tracking-wider text-ink-soft">
        {title}
      </p>
      {description && <p className="mt-1 text-xs text-ink-soft/80">{description}</p>}
    </div>
  );
}

/** Meaningful empty state instead of fabricated placeholder records. */
export function EmptyState({ title, description, icon, action, className }: StateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center px-4", className)}>
      <div className="grid h-10 w-10 place-items-center rounded-full bg-sand border border-line text-ink-soft/70">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-xs text-ink-soft max-w-sm">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Error state with optional retry, for failed API requests. */
export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: StateProps & { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center py-10 text-center px-4",
        className
      )}
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200/70 dark:border-red-900/60 text-red-600 dark:text-red-400">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 text-xs text-ink-soft max-w-sm">{description}</p>}
      {onRetry && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try again</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export { StatusBadge } from "./status-badge";
