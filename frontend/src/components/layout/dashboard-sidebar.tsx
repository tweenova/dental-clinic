"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  LogOut,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

export interface SidebarLink {
  title?: string;
  label?: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: string | number;
}

export interface DashboardSidebarProps {
  links: SidebarLink[];
  basePath?: string;
  roleLabel?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

/**
 * Shared staff-portal sidebar. Every workspace (Admin, Reception, Doctor)
 * renders this exact floating pill component with rounded-[2.5rem] aesthetic.
 */
export function DashboardSidebar({
  links,
  basePath = "/admin",
  roleLabel = "Organization CMS",
  mobileOpen = false,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "m-4 h-[calc(100vh-2rem)] rounded-[2.5rem] shadow-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 ease-in-out overflow-hidden shrink-0 fixed md:sticky top-0 z-50 md:z-30",
        mobileOpen ? "left-0" : "-left-96 md:left-0",
        isCollapsed ? "w-24" : "w-64"
      )}
    >
      {/* Top: Brand + Collapse control */}
      <div
        className={cn(
          "p-4 border-b border-gray-200 dark:border-gray-800 flex items-center",
          isCollapsed ? "justify-center" : "justify-between"
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-11 w-11 shrink-0 rounded-2xl bg-primary text-white flex items-center justify-center font-display font-bold text-lg shadow-md transition-all hover:scale-105 relative group cursor-pointer"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span
              className={cn(
                "transition-opacity duration-200",
                isCollapsed ? "opacity-0" : "group-hover:opacity-0"
              )}
            >
              M
            </span>
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
                isCollapsed ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
            >
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5" />
              ) : (
                <ChevronLeft className="h-5 w-5" />
              )}
            </div>
          </button>
          <Link
            href={basePath}
            className={cn(
              "truncate transition-opacity duration-300",
              isCollapsed ? "hidden opacity-0" : "opacity-100 flex flex-col"
            )}
          >
            <span className="font-display text-sm font-bold text-gray-900 dark:text-gray-100 block leading-tight tracking-tight hover:text-primary transition-colors">
              Marlow Dental
            </span>
            <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
              {roleLabel}
            </span>
          </Link>
        </div>

        {/* Close button on mobile */}
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Center: Navigation Links */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none",
          isCollapsed ? "flex flex-col items-center" : ""
        )}
      >
        {links.map((item) => {
          const itemText = item.title || item.label || "";
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(`${item.href}/`));
          const Icon = item.icon;

          return (
            <Link
              key={`${item.href}-${itemText}`}
              href={item.href}
              title={itemText}
              className={cn(
                "flex items-center rounded-full text-xs font-medium transition-all duration-200 ease-in-out",
                isCollapsed
                  ? "h-12 w-12 justify-center p-0"
                  : "gap-3.5 px-4 py-3 w-full justify-between",
                isActive
                  ? "bg-primary text-white shadow-md font-semibold"
                  : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    isActive ? "text-white" : "text-primary"
                  )}
                />
                <span
                  className={cn(
                    "truncate transition-opacity duration-300",
                    isCollapsed ? "hidden opacity-0" : "opacity-100 flex"
                  )}
                >
                  {itemText}
                </span>
              </div>
              {!isCollapsed && item.badge !== undefined && (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-mono font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: User info & controls */}
      <div className="p-3.5 border-t border-gray-200 dark:border-gray-800 space-y-2 bg-gray-50/60 dark:bg-gray-900/60 rounded-b-[2.5rem]">
        {user && (
          <div
            title={`${user.fullName} (${user.role})`}
            className={cn(
              "flex items-center rounded-2xl bg-white dark:bg-gray-950 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 shadow-xs",
              isCollapsed ? "p-1.5 justify-center" : "gap-2.5 p-2.5"
            )}
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold font-mono">
              {user.fullName ? user.fullName.slice(0, 2).toUpperCase() : "MD"}
            </div>
            <div
              className={cn(
                "truncate flex-1 min-w-0 transition-opacity duration-300",
                isCollapsed ? "hidden opacity-0" : "opacity-100 flex flex-col"
              )}
            >
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">
                {user.fullName}
              </p>
              <p className="text-[10px] text-primary truncate uppercase font-mono tracking-wider font-semibold">
                {user.role}
              </p>
            </div>
          </div>
        )}

        <div
          className={cn(
            "flex items-center",
            isCollapsed ? "flex-col gap-2 pt-1" : "justify-between pt-1"
          )}
        >
          <Link
            href="/"
            target="_blank"
            title="View live website"
            className={cn(
              "transition-opacity duration-300",
              isCollapsed
                ? "hidden opacity-0"
                : "opacity-100 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-white dark:hover:bg-gray-800 shadow-xs transition-colors"
            )}
          >
            <span>Live Site</span>
            <ExternalLink className="h-3 w-3" />
          </Link>

          <button
            onClick={() => logout()}
            title="Sign out"
            className="p-2 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 shadow-xs transition-colors cursor-pointer"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default DashboardSidebar;
