"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  PhoneCall,
  UserCheck,
  X,
} from "lucide-react";
import {
  createWaitlistOfferTask,
  getWaitlistOffersForSlot,
  WaitlistOfferCandidate,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";

interface WaitlistOfferModalProps {
  bookingId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
}

export function WaitlistOfferModal({
  bookingId,
  isOpen,
  onClose,
  onTaskCreated,
}: WaitlistOfferModalProps) {
  const { accessToken } = useAuth();
  const [candidates, setCandidates] = useState<WaitlistOfferCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    queueMicrotask(() => {
      if (!isOpen || !bookingId) {
        setCandidates([]);
        setError(null);
        setSuccessMessage(null);
        return;
      }

      const fetchOffers = async () => {
        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);
        try {
          const data = await getWaitlistOffersForSlot(bookingId, accessToken);
          if (isMounted) {
            setCandidates(data);
          }
        } catch (err: unknown) {
          if (isMounted) {
            setError(
              err instanceof Error
                ? err.message
                : "Failed to load waitlist candidates for this opening."
            );
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      fetchOffers();
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, bookingId, accessToken]);

  const handleCreateOfferTask = async (candidate: WaitlistOfferCandidate) => {
    if (!bookingId) return;
    setActionLoadingId(candidate.waitlistBookingId);
    setError(null);
    setSuccessMessage(null);
    try {
      await createWaitlistOfferTask(
        bookingId,
        candidate.waitlistBookingId,
        accessToken
      );
      setCandidates((prev) =>
        prev.map((c) =>
          c.waitlistBookingId === candidate.waitlistBookingId
            ? { ...c, hasOpenOfferTask: true }
            : c
        )
      );
      setSuccessMessage(
        `High-priority call task created for ${candidate.patientName}. Patient remains on waitlist until confirmed.`
      );
      if (onTaskCreated) {
        onTaskCreated();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create offer call task."
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <PhoneCall className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Slot Opened: Offer to Waitlist
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              An appointment was cancelled. Review patients waiting for an
              earlier opening and offer this slot.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice */}
        <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span>
            <strong>Safety rule:</strong> Offering creates a linked
            high-priority call task for reception to call the patient. The
            patient is <em>never auto-booked</em> and their waitlist status
            remains active until confirmed by phone.
          </span>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-xs text-red-600 dark:text-red-300">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Body / Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-gray-400">
              Loading waitlist candidates for this slot...
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-400">
              No active waitlist patients found for this clinic.
            </div>
          ) : (
            candidates.map((candidate) => (
              <div
                key={candidate.waitlistBookingId}
                className="p-3.5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">
                      {candidate.patientName}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-200/70 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {candidate.confirmationId}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Phone: {candidate.patientPhone}</span>
                    <span>Service: {candidate.serviceName || "Any"}</span>
                    {candidate.preferredDate && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {candidate.preferredDate}
                      </span>
                    )}
                    {candidate.preferredTime && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {candidate.preferredTime}
                      </span>
                    )}
                  </div>
                  {candidate.notes && (
                    <p className="text-[11px] text-gray-400 italic">
                      &quot;{candidate.notes}&quot;
                    </p>
                  )}
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {candidate.hasOpenOfferTask ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-3 py-1.5 rounded-full">
                      <UserCheck className="h-3.5 w-3.5" />
                      Task Created
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      isLoading={actionLoadingId === candidate.waitlistBookingId}
                      onClick={() => handleCreateOfferTask(candidate)}
                    >
                      Offer this slot
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-gray-100 dark:border-gray-800 pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
