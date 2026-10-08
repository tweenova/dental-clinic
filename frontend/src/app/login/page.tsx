"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useAuth } from "@/components/providers/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === "admin") {
        router.push("/admin");
      } else if (user.role === "receptionist") {
        router.push("/reception");
      } else if (user.role === "doctor") {
        router.push("/doctor");
      }
    }
  }, [user, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid credentials. Please verify your email and password.";
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col justify-between p-4 sm:p-6 md:p-10">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between w-full max-w-5xl mx-auto py-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Return to public website</span>
        </Link>
        <span className="font-mono text-xs uppercase tracking-wider text-primary font-semibold">
          Staff Portal
        </span>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center my-8">
        <div className="w-full max-w-md">
          <Card surface="cream" shadow="card" className="p-8 sm:p-10">
            {/* Header / Brand Icon */}
            <div className="flex flex-col items-center text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-white mb-4 shadow-subtle">
                <Lock className="h-5 w-5" />
              </div>
              <p className="eyebrow mb-1">Administrative Access</p>
              <h1 className="text-2xl sm:text-3xl font-display text-gray-900 dark:text-white font-normal leading-tight">
                Marlow Dental
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Sign in to manage practice content, team members, and services.
              </p>
            </div>

            {/* Error Announcement */}
            {errorMessage && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-6 rounded-lg border border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30 p-3.5 text-xs text-red-800 dark:text-red-300"
              >
                {errorMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <TextField
                id="login-email"
                name="email"
                type="email"
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@marlowdental.com"
                required
                autoComplete="email"
              />

              <TextField
                id="login-password"
                name="password"
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                autoComplete="current-password"
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  className="w-full justify-center"
                >
                  <span>{isSubmitting ? "Signing in..." : "Sign in to Dashboard"}</span>
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <ShieldCheck className="h-3.5 w-3.5 text-primary dark:text-emerald-400" />
              <span>Session protected with JWT and HttpOnly rotation</span>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer Notice */}
      <footer className="w-full max-w-5xl mx-auto text-center py-4 text-xs text-gray-500 dark:text-gray-400">
        Marlow Dental Administrative Management System · Authorized Staff Only
      </footer>
    </div>
  );
}
