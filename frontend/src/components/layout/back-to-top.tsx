"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * Renders a floating button that appears after the visitor scrolls down 400 pixels.
 * When clicked, it smoothly scrolls the window back to the top of the page.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <button
      onClick={scrollToTop}
      className={`fixed bottom-20 right-6 z-40 grid h-10 w-10 place-items-center rounded-full border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-300 backdrop-blur-md shadow-md transition-all duration-300 hover:text-primary dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 sm:bottom-6 sm:right-6 cursor-pointer ${
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      aria-label="Back to top of page"
      title="Back to top"
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
