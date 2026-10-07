"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Home,
  Layers,
  LogOut,
  MapPin,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Overview", icon: Home, exact: true },
  { href: "/admin/locations", label: "Clinics & Branches", icon: MapPin },
  { href: "/admin/services", label: "Services & Fees", icon: Layers },
  { href: "/admin/team", label: "Team Members", icon: Users },
  { href: "/admin/announcements", label: "Announcements", icon: Bell },
  { href: "/admin/website", label: "Website CMS", icon: Globe },
  { href: "/admin/permissions", label: "Role Permissions", icon: ShieldCheck },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Verifying staff credentials...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col md:flex-row">
      {/* Mobile Top App Bar */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Open navigation sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-display font-semibold text-gray-900 dark:text-gray-100 text-base tracking-tight">
            Marlow Dental
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono uppercase font-bold text-primary">
            Admin
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => logout()}
            title="Sign out"
            className="p-1.5 rounded-full border border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Floating Pill Left Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`m-4 h-[calc(100vh-2rem)] rounded-[2.5rem] shadow-2xl bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 border border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 ease-in-out overflow-hidden shrink-0 fixed md:sticky top-0 z-50 md:z-30 ${
          mobileOpen ? "left-0" : "-left-96 md:left-0"
        } ${isCollapsed ? "w-24" : "w-64"}`}
      >
        {/* Top: Brand Header */}
        <div className={`p-4 border-b border-gray-200 dark:border-gray-800 flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-11 w-11 shrink-0 rounded-2xl bg-primary text-white flex items-center justify-center font-display font-bold text-lg shadow-md transition-all hover:scale-105 relative group cursor-pointer"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <span className={`transition-opacity duration-200 ${isCollapsed ? "opacity-0" : "group-hover:opacity-0"}`}>M</span>
              <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isCollapsed ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
              </div>
            </button>
            <Link href="/admin" className={`truncate transition-opacity duration-300 ${isCollapsed ? "hidden opacity-0" : "opacity-100 flex flex-col"}`}>
              <span className="font-display text-sm font-bold text-gray-900 dark:text-gray-100 block leading-tight tracking-tight hover:text-primary transition-colors">
                Marlow Dental
              </span>
              <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
                Organization CMS
              </span>
            </Link>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Center: Navigation Links */}
        <nav className={`flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none ${isCollapsed ? "flex flex-col items-center" : ""}`}>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center rounded-full text-xs font-medium transition-all duration-300 ease-in-out ${
                  isCollapsed
                    ? "h-12 w-12 justify-center p-0"
                    : "gap-3.5 px-4 py-3 w-full"
                } ${
                  isActive
                    ? "bg-primary text-white shadow-md font-semibold"
                    : "text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 transition-colors ${isActive ? "text-white" : "text-primary"}`} />
                <span className={`truncate transition-opacity duration-300 ${isCollapsed ? "hidden opacity-0" : "opacity-100 flex"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom: User Info & Controls */}
        <div className="p-3.5 border-t border-gray-200 dark:border-gray-800 space-y-2 bg-gray-50/60 dark:bg-gray-900/60 rounded-b-[2.5rem]">
          <div
            title={`${user.fullName} (${user.role})`}
            className={`flex items-center rounded-2xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 shadow-xs ${
              isCollapsed ? "p-1.5 justify-center" : "gap-2.5 p-2.5"
            }`}
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">
              {user.fullName.slice(0, 2).toUpperCase()}
            </div>
            <div className={`truncate flex-1 min-w-0 transition-opacity duration-300 ${isCollapsed ? "hidden opacity-0" : "opacity-100 flex flex-col"}`}>
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate leading-tight">
                {user.fullName}
              </p>
              <p className="text-[10px] text-primary truncate uppercase font-mono tracking-wider font-semibold">
                {user.role}
              </p>
            </div>
          </div>

          <div className={`flex items-center ${isCollapsed ? "flex-col gap-2 pt-1" : "justify-between pt-1"}`}>
            <Link
              href="/"
              target="_blank"
              title="View live website"
              className={`transition-opacity duration-300 ${
                isCollapsed
                  ? "hidden opacity-0"
                  : "opacity-100 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-white dark:hover:bg-gray-800 shadow-xs transition-colors"
              }`}
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

      {/* Main Admin Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Sticky Header */}
        <header className="hidden md:flex sticky top-0 z-20 h-14 items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 px-8 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Organization Management Portal
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

        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
