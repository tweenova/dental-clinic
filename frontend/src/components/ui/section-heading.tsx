import React from "react";
import { cn } from "@/lib/utils";

export interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  theme?: "light" | "dark";
  className?: string;
}

/**
 * Renders a standardized header for page sections with an optional category eyebrow, title, and description.
 * It ensures consistent typography and spacing across the entire website.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  theme = "light",
  className,
}: SectionHeadingProps) {
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "space-y-3",
        align === "center" ? "text-center mx-auto max-w-2xl" : "max-w-2xl",
        className
      )}
    >
      {eyebrow && (
        <p className={cn("text-[11px] font-semibold uppercase tracking-wider text-primary dark:text-emerald-400", isDark && "text-primary")}>
          {eyebrow}
        </p>
      )}

      <h2
        className={cn(
          "fluid-h2 tracking-[-0.02em] font-normal text-gray-900 dark:text-white",
          isDark && "text-white"
        )}
      >
        {title}
      </h2>

      {description && (
        <div
          className={cn(
            "text-[15px] leading-relaxed pt-1 text-gray-600 dark:text-gray-400",
            isDark && "text-gray-300"
          )}
        >
          {typeof description === "string" ? <p>{description}</p> : description}
        </div>
      )}
    </div>
  );
}
export default SectionHeading;
