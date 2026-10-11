"use client";

import { useState } from "react";
import {
  Clock,
  Key,
  LogOut,
  MapPin,
  Save,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";

export default function ReceptionAccountPage() {
  const { user, logout, updateInactivity } = useAuth();

  const [inactivityMinutes, setInactivityMinutes] = useState(
    user?.inactivityTimeoutMinutes ?? 15
  );
  const [warningSeconds, setWarningSeconds] = useState(
    user?.inactivityWarningSeconds ?? 60
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);
    try {
      await updateInactivity({
        inactivityEnabled: true,
        inactivityTimeoutMinutes: Number(inactivityMinutes),
        inactivityWarningSeconds: Number(warningSeconds),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update security settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold text-gray-900 dark:text-white">
          Staff Account & Session Security
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Review your front-office credentials, assigned clinic scope, and HIPAA session security settings.
        </p>
      </div>

      {/* Profile & Clinic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Front-Office Profile
              </h2>
              <span className="text-[11px] font-mono text-primary uppercase font-bold tracking-wider">
                {user?.role} Staff
              </span>
            </div>
          </div>

          <div className="space-y-2 text-xs divide-y divide-gray-100 dark:divide-gray-800">
            <div className="pt-2 flex justify-between">
              <span className="text-gray-500">Full Name</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {user?.fullName || "Front Desk Receptionist"}
              </span>
            </div>

            <div className="pt-2 flex justify-between">
              <span className="text-gray-500">Email</span>
              <span className="font-mono text-gray-900 dark:text-white">
                {user?.email}
              </span>
            </div>

            <div className="pt-2 flex justify-between">
              <span className="text-gray-500">Account Status</span>
              <span className="text-primary font-semibold">
                Active & Authorized
              </span>
            </div>
          </div>
        </div>

        {/* Clinic Scope Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Clinic Branch Scope
              </h2>
              <p className="text-[11px] text-gray-500">Assigned Practice Location</p>
            </div>
          </div>

          <div className="space-y-2 text-xs divide-y divide-gray-100 dark:divide-gray-800">
            <div className="pt-2 flex justify-between">
              <span className="text-gray-500">Practice</span>
              <span className="font-semibold text-gray-900 dark:text-white">Marlow Dental Main</span>
            </div>

            <div className="pt-2 flex justify-between">
              <span className="text-gray-500">Role Authority</span>
              <span className="text-gray-600 dark:text-gray-400">Front-Office Operations</span>
            </div>

            <div className="pt-2 flex justify-between">
              <span className="text-gray-500">Role Modification</span>
              <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                Restricted (Admin Only)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* HIPAA Inactivity & Session Preferences */}
      <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              HIPAA Session Inactivity Timeout
            </h2>
            <p className="text-[11px] text-gray-500">
              Automatic screen lock after a period of workstation inactivity to protect PHI.
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
            ✓ Security settings updated successfully.
          </div>
        )}

        <form onSubmit={handleSavePreferences} className="space-y-4 text-xs max-w-lg">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-medium text-gray-700 dark:text-gray-300">
                Inactivity Timeout (Minutes)
              </label>
              <select
                value={inactivityMinutes}
                onChange={(e) => setInactivityMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
              >
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes (Standard)</option>
                <option value={30}>30 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-gray-700 dark:text-gray-300">
                Warning Window (Seconds)
              </label>
              <select
                value={warningSeconds}
                onChange={(e) => setWarningSeconds(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:border-primary"
              >
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds (Standard)</option>
                <option value={120}>120 seconds</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white font-semibold hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? "Saving..." : "Update Preferences"}</span>
          </button>
        </form>
      </div>

      {/* Sign Out Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            End Front-Office Session
          </h2>
          <p className="text-xs text-gray-500">
            Safely invalidate access tokens and sign out of this computer.
          </p>
        </div>

        <button
          onClick={() => logout()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
