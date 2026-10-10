"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, LogOut, Menu } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export interface DashboardHeaderProps {
  portalTitle: string;
  badgeLabel: string;
  onMobileMenuOpen: () => void;
}

/**
 * Shared staff-portal top header. Identical for Admin, Reception and
 * Doctor workspaces; only the title/badge props differ.
 */
export function DashboardHeader({
  portalTitle,
  badgeLabel,
  onMobileMenuOpen,
}: DashboardHeaderProps) {
  const { logout } = useAuth();

  return (
    <>
      {/* Mobile top app bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onMobileMenuOpen}
            className="p-1.5 rounded-xl border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Open navigation sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display font-semibold text-gray-900 dark:text-gray-100 text-base tracking-tight">
            Marlow Dental
          </span>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono uppercase font-bold text-primary">
            {badgeLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => logout()}
            title="Sign out"
            className="p-1.5 rounded-full border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop sticky header */}
      <header className="hidden md:flex sticky top-0 z-20 h-14 items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 px-8 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {portalTitle}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-gray-100/60 dark:bg-gray-800/60 px-3 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <span>View Live Website</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
          <ThemeToggle />
        </div>
      </header>
    </>
  );
}

export default DashboardHeader;
