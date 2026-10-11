"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { getNavLinks } from "@/lib/navigation";
import { canAccessWorkspace, WORKSPACES, WorkspaceKey } from "@/lib/workspace";

interface AppShellProps {
  workspace: WorkspaceKey;
  children: React.ReactNode;
}

/**
 * Staff-portal shell with unified floating pill sidebar and frosted glass header.
 */
export function AppShell({ workspace, children }: AppShellProps) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const meta = WORKSPACES[workspace];

  // Unauthenticated visitors are always sent back to the login screen.
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {meta.verifyingCopy}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isAuthorized = canAccessWorkspace(user.role, workspace);

  if (!isAuthorized) {
    const home = WORKSPACES[
      (["admin", "reception", "doctor"] as const).find((key) =>
        canAccessWorkspace(user.role, key)
      ) ?? "admin"
    ];
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl text-center space-y-4">
          <div className="inline-flex p-2.5 rounded-full bg-clay/10 text-clay">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-display text-gray-900 dark:text-white">Access restricted</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Your account is assigned the <strong className="text-gray-900 dark:text-white">{user.role}</strong> role.
            This workspace requires different permissions.
          </p>
          <div className="pt-1 flex justify-center gap-2">
            <Link
              href={home.basePath}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <span>Go to my workspace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => logout()}
              className="px-4 py-2 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 flex flex-col md:flex-row">
      <DashboardHeader
        portalTitle={meta.portalTitle}
        badgeLabel={meta.badge}
        onMobileMenuOpen={() => setMobileOpen(true)}
      />

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <DashboardSidebar
        links={getNavLinks(workspace)}
        basePath={meta.basePath}
        roleLabel={meta.roleLabel}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppShell;
