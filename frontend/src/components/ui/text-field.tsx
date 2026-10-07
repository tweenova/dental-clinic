import React, { useId } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

export interface TextFieldProps
  extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label: string;
  error?: string;
  helpText?: string;
  multiline?: boolean;
  rows?: number;
}

/**
 * Renders an accessible form input or multi-line textarea with linked label and validation error alerts.
 * It automatically announces errors to assistive technology and connects labels to inputs via unique IDs.
 */
export const TextField = React.forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  TextFieldProps
>(
  (
    {
      id: customId,
      label,
      error,
      helpText,
      multiline = false,
      rows = 3,
      className,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId || generatedId;
    const errorId = `${inputId}-error`;
    const helpId = `${inputId}-help`;

    const commonClasses = cn(
      "w-full rounded-2xl border bg-white dark:bg-gray-900 px-4 py-3 text-[14px] text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-colors",
      "focus:border-primary focus:ring-2 focus:ring-primary/20",
      error
        ? "border-red-600 focus:border-red-600 focus:ring-red-600/20"
        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
      className
    );

    return (
      <div className="w-full space-y-1.5">
        <label
          htmlFor={inputId}
          className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="ml-1 text-primary">*</span>}
        </label>

        {multiline ? (
          <textarea
            id={inputId}
            ref={ref as React.Ref<HTMLTextAreaElement>}
            rows={rows}
            className={cn(commonClasses, "resize-none")}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helpText ? helpId : undefined}
            required={required}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            ref={ref as React.Ref<HTMLInputElement>}
            className={commonClasses}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helpText ? helpId : undefined}
            required={required}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}

        {helpText && !error && (
          <p id={helpId} className="text-[12px] text-gray-500 dark:text-gray-400">
            {helpText}
          </p>
        )}

        {error && (
          <p
            id={errorId}
            role="alert"
            aria-live="polite"
            className="flex items-center gap-1.5 text-[12px] text-red-600 dark:text-red-400 font-medium pt-0.5"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

TextField.displayName = "TextField";
export default TextField;
