import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  href?: string;
  external?: boolean;
  children: React.ReactNode;
}

/**
 * Renders an interactive button or navigational link styled with the clinic's signature pill shape.
 * It supports multiple visual styles (primary, secondary, outline, ghost) and handles loading states.
 */
export const Button = React.forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      href,
      external,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    // Pill shape is an intentional editorial design choice for Marlow Dental
    const baseStyles =
      "inline-flex items-center justify-center font-medium tracking-wide transition-all duration-200 select-none cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variantStyles = {
      primary:
        "bg-primary text-white border border-transparent shadow-subtle hover:brightness-105 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 active:scale-[0.98] focus-visible:ring-primary",
      secondary:
        "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-subtle active:translate-y-0 active:scale-[0.98] focus-visible:ring-primary",
      outline:
        "bg-transparent text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:border-primary hover:text-primary dark:hover:border-primary dark:hover:text-primary hover:-translate-y-0.5 hover:shadow-subtle active:translate-y-0 active:scale-[0.98] focus-visible:ring-primary",
      ghost:
        "bg-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.98] focus-visible:ring-primary",
    };

    const sizeStyles = {
      sm: "px-4 py-1.5 text-xs gap-1.5",
      md: "px-5 py-2.5 text-sm gap-2",
      lg: "px-7 py-3.5 text-[14.5px] gap-2.5",
    };

    const combinedClassName = cn(
      baseStyles,
      variantStyles[variant],
      sizeStyles[size],
      className
    );

    const content = (
      <>
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </>
    );

    if (href) {
      if (external) {
        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={combinedClassName}
            ref={ref as React.Ref<HTMLAnchorElement>}
          >
            {content}
          </a>
        );
      }
      return (
        <Link
          href={href}
          className={combinedClassName}
          ref={ref as React.Ref<HTMLAnchorElement>}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={combinedClassName}
        disabled={disabled || isLoading}
        {...props}
      >
        {content}
      </button>
    );
  }
);

Button.displayName = "Button";
export default Button;
