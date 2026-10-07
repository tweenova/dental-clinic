"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CornerDownLeft, ArrowUpDown } from "lucide-react";
import { searchSite, buildDynamicSearchIndex } from "@/lib/search-index";
import { usePublicContent } from "@/components/providers/public-content-provider";

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Renders a search modal dialog triggered by clicking search or pressing Command/Control + K.
 * It lets patients quickly find procedures, pricing, doctor information, and office policies with full keyboard support.
 */
export function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const { team, locations } = usePublicContent();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const dynamicDocs = useMemo(
    () => buildDynamicSearchIndex({ team, locations }),
    [team, locations]
  );

  const results = useMemo(
    () => searchSite(query, dynamicDocs),
    [query, dynamicDocs]
  );

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = "";
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          results.length === 0 ? 0 : (prev + 1) % results.length
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          results.length === 0 ? 0 : (prev - 1 + results.length) % results.length
        );
        return;
      }

      if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        handleClose();
        router.push(results[selectedIndex].href);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, router, handleClose]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedIndex(0);
  };

  const handleSelect = (href: string) => {
    handleClose();
    router.push(href);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 sm:pt-24"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl">
        {/* Search Header */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-800 px-4 py-3 sm:px-5">
          <Search className="h-5 w-5 text-gray-500 dark:text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="search"
            id="search-dialog-title"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search procedures, cash fees, insurance, or doctor info..."
            className="ml-3.5 flex-1 bg-transparent text-[15px] sm:text-[16px] text-gray-900 dark:text-white outline-none placeholder:text-gray-400"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button
              onClick={() => handleQueryChange("")}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              aria-label="Clear query"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-[11px] text-gray-500 dark:text-gray-400">
              ESC
            </kbd>
          )}
        </div>

        {/* Results Body */}
        <div className="max-h-[60vh] overflow-y-auto p-2 sm:p-3">
          {query.trim() === "" ? (
            <div className="py-8 text-center">
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-400">Quick suggestions</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {[
                  "Cash rates",
                  "Invisalign",
                  "Cleaning & exam",
                  "Root canals",
                  "Insurance",
                  "Parking",
                ].map((term) => (
                  <button
                    key={term}
                    onClick={() => handleQueryChange(term)}
                    className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:border-primary hover:text-primary cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-display text-lg text-gray-900 dark:text-white">No exact matches found</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Try searching for general terms like &ldquo;cleaning&rdquo;, &ldquo;crown&rdquo;, or &ldquo;insurance&rdquo;.
              </p>
            </div>
          ) : (
            <ul className="space-y-1" role="listbox">
              {results.map((r, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li
                    key={r.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(r.href)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex cursor-pointer items-start justify-between rounded-xl p-3 transition-colors ${
                      isSelected
                        ? "bg-primary/10 dark:bg-primary/20 border border-primary/30"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent"
                    }`}
                  >
                    <div className="pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-[15px] font-medium text-gray-900 dark:text-white">
                          {r.title}
                        </span>
                        <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                          {r.category}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400 line-clamp-2">
                        {r.snippet}
                      </p>
                    </div>
                    {isSelected && (
                      <CornerDownLeft className="mt-1 h-4 w-4 text-primary shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="hidden sm:flex items-center justify-between border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-4 py-2.5 text-[11.5px] text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" /> Navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> Select
            </span>
          </div>
          <span>Lincoln Park, Chicago · Marlow Dental</span>
        </div>
      </div>
    </div>
  );
}

export default SearchDialog;
