import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  shadow?: "flat" | "subtle" | "card" | "elevated" | "modal";
  surface?: "bone" | "cream" | "sand";
  hoverLift?: boolean;
  children: React.ReactNode;
}

/**
 * Renders a styled surface container with rounded corners, subtle warm shadows, and optional hover lift.
 * It is used across sections to group related clinical information and pricing cards.
 */
export function Card({
  shadow = "subtle",
  surface = "bone",
  hoverLift = false,
  className,
  children,
  ...props
}: CardProps) {
  const surfaceStyles = {
    bone: "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white",
    cream: "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white",
    sand: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white",
  };

  const shadowStyles = {
    flat: "",
    subtle: "shadow-subtle",
    card: "shadow-card",
    elevated: "shadow-elevated",
    modal: "shadow-modal",
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border transition-all duration-200",
        surfaceStyles[surface],
        shadowStyles[shadow],
        hoverLift && "hover:-translate-y-1 hover:shadow-card hover:border-primary/40",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
export default Card;
