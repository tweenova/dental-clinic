"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  refreshAuthToken,
  setMemoryAccessToken,
  updateInactivitySettings as apiUpdateInactivitySettings,
  User,
} from "@/lib/api";

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: (isTimeout?: boolean) => Promise<void>;
  refresh: () => Promise<string | null>;
  updateInactivity: (settings: {
    inactivityEnabled: boolean;
    inactivityTimeoutMinutes: number;
    inactivityWarningSeconds: number;
  }) => Promise<void>;
  resetActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inactivity tracking state
  const lastActivityRef = useRef<number>(0);
  const [warningSecondsLeft, setWarningSecondsLeft] = useState<number | null>(null);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setWarningSecondsLeft(null);
  }, []);

  const setAccessToken = (token: string | null) => {
    setAccessTokenState(token);
    setMemoryAccessToken(token);
  };

  // Attempt session restoration on mount via HttpOnly refresh cookie
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const data = await refreshAuthToken();
        if (!isMounted) return;
        setAccessToken(data.accessToken);

        const profile = await getMe(data.accessToken);
        if (!isMounted) return;
        setUser(profile);
        lastActivityRef.current = Date.now();
      } catch {
        // No active session or cookie expired
        if (isMounted) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for session expiry from centralized API FIFO queue
  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setAccessToken(null);
      router.push("/login?reason=session_expired");
    };
    window.addEventListener("marlow:auth:logout", handleSessionExpired);
    return () => window.removeEventListener("marlow:auth:logout", handleSessionExpired);
  }, [router]);

  // Meaningful user interaction tracking (network traffic does NOT count as activity)
  useEffect(() => {
    if (!user || user.inactivityEnabled === false) return;

    let lastThrottle = 0;
    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle event listener updates to every 3 seconds
      if (now - lastThrottle > 3000) {
        lastThrottle = now;
        lastActivityRef.current = now;
      }
    };

    const events = ["mousemove", "keydown", "pointerdown", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
    };
  }, [user]);

  const logout = useCallback(
    async (isTimeout = false) => {
      await apiLogout();
      setUser(null);
      setAccessToken(null);
      setWarningSecondsLeft(null);
      if (isTimeout) {
        router.push("/login?reason=inactivity");
      } else {
        router.push("/login");
      }
    },
    [router]
  );

  // Inactivity countdown evaluation timer (checks every second)
  useEffect(() => {
    if (!user || user.inactivityEnabled === false) {
      return;
    }

    if (lastActivityRef.current === 0) {
      lastActivityRef.current = Date.now();
    }

    const timeoutMinutes = user.inactivityTimeoutMinutes ?? 15;
    const warningSeconds = user.inactivityWarningSeconds ?? 60;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    const warningMs = warningSeconds * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remainingMs = timeoutMs - elapsed;

      if (remainingMs <= 0) {
        clearInterval(interval);
        setWarningSecondsLeft(null);
        logout(true);
      } else if (remainingMs <= warningMs) {
        setWarningSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else {
        setWarningSecondsLeft(null);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      setWarningSecondsLeft(null);
    };
  }, [user, logout]);

  const login = async (email: string, password: string) => {
    const data = await apiLogin({ email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    lastActivityRef.current = Date.now();
    if (data.user.role === "admin") {
      router.push("/admin");
    }
  };

  const refresh = async (): Promise<string | null> => {
    try {
      const data = await refreshAuthToken();
      setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      setUser(null);
      setAccessToken(null);
      return null;
    }
  };

  const updateInactivity = async (settings: {
    inactivityEnabled: boolean;
    inactivityTimeoutMinutes: number;
    inactivityWarningSeconds: number;
  }) => {
    const updated = await apiUpdateInactivitySettings(settings, accessToken || undefined);
    setUser(updated);
    resetActivity();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        logout,
        refresh,
        updateInactivity,
        resetActivity,
      }}
    >
      {children}

      {/* Accessible Inactivity Countdown Warning Modal */}
      {warningSecondsLeft !== null && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="inactivity-warning-title"
          aria-describedby="inactivity-warning-desc"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-deep/60 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-bone p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h2
                  id="inactivity-warning-title"
                  className="text-lg font-display font-semibold text-ink"
                >
                  Session Inactivity Warning
                </h2>
                <p id="inactivity-warning-desc" className="text-xs text-ink-soft leading-relaxed">
                  For clinic patient privacy and HIPAA compliance, your administrator session will
                  automatically lock due to inactivity.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
                <Clock className="h-4 w-4" />
                <span>Signing out automatically in:</span>
              </div>
              <span className="font-mono text-xl font-bold text-amber-600 dark:text-amber-400">
                {warningSecondsLeft}s
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                variant="primary"
                className="w-full justify-center"
                autoFocus
                onClick={() => {
                  resetActivity();
                  getMe(accessToken || undefined).catch(() => {});
                }}
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Stay Signed In
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-center text-ink-soft"
                onClick={() => logout(false)}
              >
                <LogOut className="h-4 w-4 mr-1.5" />
                Sign Out Now
              </Button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
