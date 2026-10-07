"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { Sun, Moon } from "lucide-react";

/**
 * Renders an accessible button that toggles the website between light and dark color themes.
 * It displays a sun icon when dark mode is active and a moon icon when light mode is active.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`relative grid h-9 w-9 place-items-center rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 transition-all duration-200 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 cursor-pointer ${className}`}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 rotate-0 scale-100" />
      ) : (
        <Moon className="h-4 w-4 text-gray-700 transition-transform duration-300 rotate-0 scale-100" />
      )}
    </button>
  );
}
