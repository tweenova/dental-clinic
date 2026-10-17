"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ReceiptText, RotateCcw } from "lucide-react";
import {
  ReceptionBooking,
  VisitPayment,
  getBookingPayments,
  voidBookingPayment,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { useDirectory } from "@/lib/directory";
import { usePublicContent } from "@/components/providers/public-content-provider";
import { Button } from "@/components/ui/button";
import {
  PaymentReceiptModal,
  RecordPaymentModal,
  type PaymentBookingOption,
} from "@/components/reception/record-payment-modal";

interface PatientBillingSectionProps {
  patientId: string;
  patientName: string;
  bookings: ReceptionBooking[];
}

interface PaymentRow {
  booking: ReceptionBooking;
  payment: VisitPayment;
}

function formatMoney(amountCents: number, symbol: string): string {
  const amount = (amountCents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${amount}`;
}

export function PatientBillingSection({
  patientId,
  patientName,
  bookings,
}: PatientBillingSectionProps) {
  const { accessToken } = useAuth();
  const { currency } = usePublicContent();
  const directory = useDirectory();
  const [paymentsByBooking, setPaymentsByBooking] = useState<Record<string, VisitPayment[]>>({});
  const [unavailableBookingIds, setUnavailableBookingIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState<VisitPayment | null>(null);
  const [voidingPaymentId, setVoidingPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  const uniqueBookings = useMemo(() => {
    const byId = new Map<string, ReceptionBooking>();
    for (const booking of bookings) byId.set(booking.id, booking);
    return [...byId.values()].sort((left, right) =>
      `${right.bookingDate} ${right.bookingTime}`.localeCompare(
        `${left.bookingDate} ${left.bookingTime}`
      )
    );
  }, [bookings]);

  const bookingOptions = useMemo<PaymentBookingOption[]>(
    () =>
      uniqueBookings.map((booking) => ({
        id: booking.id,
        label: `${booking.serviceName || directory.serviceName(booking.serviceId) || "Appointment"} · ${booking.bookingDate} at ${booking.bookingTime}`,
      })),
    [directory, uniqueBookings]
  );

  const refreshPayments = useCallback(async () => {
    setIsLoading(true);
    setHasLoadError(false);
    const results = await Promise.all(
      uniqueBookings.map(async (booking) => {
        try {
          return {
            bookingId: booking.id,
            payments: await getBookingPayments(booking.id, accessToken),
          };
        } catch {
          return { bookingId: booking.id, payments: null };
        }
      })
    );

    const nextPayments: Record<string, VisitPayment[]> = {};
    const failedIds: string[] = [];
    for (const result of results) {
      if (result.payments === null) {
        failedIds.push(result.bookingId);
      } else {
        nextPayments[result.bookingId] = result.payments;
      }
    }
    setPaymentsByBooking(nextPayments);
    setUnavailableBookingIds(failedIds);
    setHasLoadError(failedIds.length > 0);
    setIsLoading(false);
  }, [accessToken, uniqueBookings]);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshPayments();
    });
  }, [refreshPayments]);

  const paymentRows = useMemo<PaymentRow[]>(() => {
    const seen = new Set<string>();
    return uniqueBookings
      .flatMap((booking) =>
        (paymentsByBooking[booking.id] || []).flatMap((payment) => {
          if (seen.has(payment.id)) return [];
          seen.add(payment.id);
          return [{ booking, payment }];
        })
      )
      .sort(
        (left, right) =>
          new Date(right.payment.createdAt).getTime() -
          new Date(left.payment.createdAt).getTime()
      );
  }, [paymentsByBooking, uniqueBookings]);

  const totalReceivedCents = paymentRows.reduce(
    (total, row) => total + (row.payment.isVoided ? 0 : row.payment.amountCents),
    0
  );
  const voidedCount = paymentRows.filter((row) => row.payment.isVoided).length;

  const handleVoid = async (bookingId: string, paymentId: string) => {
    const reason = voidReason.trim();
    if (!reason || reason.length > 500) {
      setVoidError("Enter a reason between 1 and 500 characters.");
      return;
    }

    setIsVoiding(true);
    setVoidError(null);
    try {
      const updated = await voidBookingPayment(
        bookingId,
        paymentId,
        reason,
        accessToken
      );
      setPaymentsByBooking((current) => ({
        ...current,
        [bookingId]: (current[bookingId] || []).map((payment) =>
          payment.id === paymentId ? updated : payment
        ),
      }));
      setVoidingPaymentId(null);
      setVoidReason("");
    } catch (error) {
      setVoidError(error instanceof Error ? error.message : "Could not void payment.");
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <section aria-labelledby="patient-billing-heading" className="border-t border-gray-200 dark:border-gray-800 pt-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 id="patient-billing-heading" className="text-lg font-display font-semibold text-gray-900 dark:text-white">
            Billing
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total received: {formatMoney(totalReceivedCents, currency.symbol)}
            {"  |  "}{paymentRows.length} payments{"  |  "}{voidedCount} voided
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={bookingOptions.length === 0}
          onClick={() => setIsRecordModalOpen(true)}
        >
          Record Payment
        </Button>
      </div>

      {hasLoadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Could not load payments for one or more appointments.
          </span>
          <Button type="button" variant="secondary" size="sm" onClick={() => void refreshPayments()}>
            Retry
          </Button>
        </div>
      )}

      {voidError && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {voidError}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 uppercase font-mono text-[10px]">
            <tr>
              <th scope="col" className="px-4 py-3">Date</th>
              <th scope="col" className="px-4 py-3">Appointment</th>
              <th scope="col" className="px-4 py-3">Amount</th>
              <th scope="col" className="px-4 py-3">Method</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading payments...
                </td>
              </tr>
            ) : paymentRows.length === 0 && unavailableBookingIds.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No payments recorded for this patient
                </td>
              </tr>
            ) : (
              <>
                {paymentRows.map(({ booking, payment }) => (
                  <tr key={payment.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(payment.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {booking.serviceName || directory.serviceName(booking.serviceId) || "Appointment"}
                      <span className="block text-[11px] text-gray-500">
                        {booking.bookingDate} at {booking.bookingTime}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {formatMoney(payment.amountCents, currency.symbol)}
                    </td>
                    <td className="px-4 py-3 capitalize">{payment.method.replace("_", " ")}</td>
                    <td className="px-4 py-3">
                      {payment.isVoided ? "Voided" : "Paid"}
                    </td>
                    <td className="px-4 py-3">
                      {payment.isVoided ? (
                        <span className="text-gray-500">
                          Voided: {payment.voidReason || "Reason not recorded"}
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Receipt for ${booking.serviceName || "appointment"} payment ${formatMoney(payment.amountCents, currency.symbol)}`}
                            onClick={() => setReceiptPayment(payment)}
                          >
                            <ReceiptText className="h-3.5 w-3.5 mr-1" />
                            Receipt
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Void payment ${formatMoney(payment.amountCents, currency.symbol)}`}
                            onClick={() => {
                              setVoidingPaymentId(payment.id);
                              setVoidReason("");
                              setVoidError(null);
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            Void
                          </Button>
                        </div>
                      )}
                      {voidingPaymentId === payment.id && (
                        <div className="mt-3 space-y-2">
                          <label htmlFor={`void-reason-${payment.id}`} className="block font-medium">
                            Reason for voiding (required, max 500 characters)
                          </label>
                          <input
                            id={`void-reason-${payment.id}`}
                            type="text"
                            maxLength={500}
                            value={voidReason}
                            onChange={(event) => setVoidReason(event.target.value)}
                            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              disabled={!voidReason.trim() || voidReason.trim().length > 500 || isVoiding}
                              isLoading={isVoiding}
                              onClick={() => void handleVoid(booking.id, payment.id)}
                            >
                              Confirm Void
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isVoiding}
                              onClick={() => setVoidingPaymentId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {unavailableBookingIds.map((bookingId) => {
                  const booking = uniqueBookings.find((item) => item.id === bookingId);
                  if (!booking) return null;
                  return (
                    <tr key={`unavailable-${booking.id}`}>
                      <td className="px-4 py-3">{booking.bookingDate}</td>
                      <td className="px-4 py-3">
                        {booking.serviceName || directory.serviceName(booking.serviceId) || "Appointment"}
                        <span className="block text-[11px] text-gray-500">
                          {booking.bookingDate} at {booking.bookingTime}
                        </span>
                      </td>
                      <td className="px-4 py-3">—</td>
                      <td className="px-4 py-3">—</td>
                      <td className="px-4 py-3">Payments unavailable</td>
                      <td className="px-4 py-3">
                        <Button type="button" variant="ghost" size="sm" onClick={() => void refreshPayments()}>
                          Retry
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </>
            )}
          </tbody>
        </table>
      </div>

      <RecordPaymentModal
        bookingId={bookingOptions[0]?.id ?? null}
        bookingOptions={bookingOptions}
        patientId={patientId}
        patientName={patientName}
        currency={{ code: currency.code, symbol: currency.symbol }}
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onPaymentRecorded={() => void refreshPayments()}
      />
      <PaymentReceiptModal
        payment={receiptPayment}
        patientName={patientName}
        currency={{ code: currency.code, symbol: currency.symbol }}
        onClose={() => setReceiptPayment(null)}
      />
    </section>
  );
}