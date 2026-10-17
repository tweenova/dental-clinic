"use client";

import { useEffect, useState } from "react";
import { Check, Clock, LogOut, ShieldCheck, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";

export default function AdminAccountPage() {
  const { user, logout, updateInactivity } = useAuth();

  const [enabled, setEnabled] = useState(true);
  const [timeoutMinutes, setTimeoutMinutes] = useState(15);
  const [warningSeconds, setWarningSeconds] = useState(60);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (user) {
      queueMicrotask(() => {
        setEnabled(user.inactivityEnabled !== false);
        setTimeoutMinutes(user.inactivityTimeoutMinutes ?? 15);
        setWarningSeconds(user.inactivityWarningSeconds ?? 60);
      });
    }
  }, [user]);

  const handleSaveInactivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      await updateInactivity({
        inactivityEnabled: enabled,
        inactivityTimeoutMinutes: Number(timeoutMinutes),
        inactivityWarningSeconds: Number(warningSeconds),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to save inactivity settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-line pb-4">
        <p className="eyebrow mb-1">Administrative Profile</p>
        <h1 className="text-2xl sm:text-3xl font-display text-ink font-normal">
          Staff Account &amp; Security
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-ink-soft">
          Current authenticated session credentials, inactivity policies, and security parameters.
        </p>
      </div>

      <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-forest text-[#FAF7F2] grid place-items-center text-xl font-display">
            {user?.fullName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-display text-ink">{user?.fullName}</h2>
            <p className="text-xs text-ink-soft">{user?.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest uppercase">
                Role: {user?.role}
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                Active Staff
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-line/60 text-xs text-ink-soft">
          <div className="flex justify-between py-1 border-b border-line/40">
            <span>Account Identifier:</span>
            <span className="font-mono text-ink">{user?.id}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-line/40">
            <span>Authorization Scope:</span>
            <span className="font-medium text-ink">Global Administrator (Full Access)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-line/40">
            <span>Authentication Mechanism:</span>
            <span className="text-ink">
              7-Day In-Memory JWT + 7-Day HttpOnly Refresh Rotation (35-min silent threshold &amp; FIFO queue)
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-line/40">
            <span>Session Invalidation:</span>
            <span className="text-ink">
              Instant server-side session revocation on logout or timeout
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-line/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-ink-soft">
            <ShieldCheck className="h-4 w-4 text-forest" />
            <span>Server-validated active session</span>
          </div>

          <Button onClick={() => logout(false)} variant="secondary" size="sm">
            <LogOut className="h-3.5 w-3.5 mr-1" />
            <span>Sign out of session</span>
          </Button>
        </div>
      </Card>

      {/* Inactivity Security Configuration */}
      <Card surface="cream" shadow="card" className="p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-forest dark:text-emerald-400">
              <Timer className="h-5 w-5" />
              <h2 className="font-display text-lg text-ink font-semibold">
                Inactivity &amp; Session Auto-Lock
              </h2>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed max-w-xl">
              Configure automatic session logout to safeguard patient health information and clinic
              data when the administrator workstation is left unattended.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveInactivity} className="space-y-5 pt-2">
          {saveSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Inactivity settings saved successfully.</span>
            </div>
          )}

          {saveError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300">
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-between p-4 rounded-xl border border-line bg-bone">
            <div>
              <p className="text-xs font-semibold text-ink">Enable Auto-Logout on Inactivity</p>
              <p className="text-[11px] text-ink-soft">
                Tracks user mouse, keyboard, and touch interactions (background API traffic is excluded).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-sand/80 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-forest"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink">
                Inactivity Timeout (minutes)
              </label>
              <select
                disabled={!enabled}
                value={timeoutMinutes}
                onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-bone px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest disabled:opacity-50"
              >
                <option value={5}>5 minutes (High Security)</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes (Standard Practice)</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes (1 hour)</option>
              </select>
              <p className="text-[10px] text-ink-soft">
                Time without user input before automatic logout triggers.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink">
                Warning Countdown (seconds)
              </label>
              <select
                disabled={!enabled}
                value={warningSeconds}
                onChange={(e) => setWarningSeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-line bg-bone px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-forest disabled:opacity-50"
              >
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds (1 minute)</option>
                <option value={120}>120 seconds (2 minutes)</option>
              </select>
              <p className="text-[10px] text-ink-soft">
                Duration of the visible countdown modal before session closes.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
              {isSaving ? "Saving Settings..." : "Save Inactivity Preferences"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
