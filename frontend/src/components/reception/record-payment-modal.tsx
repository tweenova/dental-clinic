"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  CreditCard,
  Printer,
  Send,
  X,
} from "lucide-react";
import {
  recordBookingPayment,
  VisitPayment,
} from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { DEFAULT_CURRENCY } from "@/lib/currency";

export interface PaymentBookingOption {
  id: string;
  label: string;
  servicePriceCents?: number;
}

interface PaymentCurrency {
  code: string;
  symbol: string;
}

interface RecordPaymentModalProps {
  bookingId: string | null;
  bookingOptions?: PaymentBookingOption[];
  patientId?: string;
  patientName?: string;
  servicePriceCents?: number;
  currency?: PaymentCurrency;
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded?: () => void;
}

export function RecordPaymentModal({
  bookingId,
  bookingOptions,
  patientId,
  patientName,
  servicePriceCents,
  currency,
  isOpen,
  onClose,
  onPaymentRecorded,
}: RecordPaymentModalProps) {
  const { accessToken } = useAuth();
  const displayCurrency = currency ?? {
    code: DEFAULT_CURRENCY.code,
    symbol: DEFAULT_CURRENCY.symbol,
  };
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(bookingId);
  const [amountMajorUnits, setAmountMajorUnits] = useState<string>("");
  const [amountChargedMajorUnits, setAmountChargedMajorUnits] = useState<string>("");
  const [overrideReason, setOverrideReason] = useState<string>("");
  const [method, setMethod] = useState<"cash" | "card" | "bank_transfer">("cash");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const selectedBooking = bookingOptions?.find((booking) => booking.id === selectedBookingId);
  const selectedServicePriceCents = selectedBooking?.servicePriceCents ?? servicePriceCents;

  useEffect(() => {
    if (!isOpen) return;
    queueMicrotask(() => {
      setSelectedBookingId(bookingId ?? bookingOptions?.[0]?.id ?? null);
      setError(null);
      setSuccessMsg(null);
    });
  }, [isOpen, bookingId, bookingOptions]);

  useEffect(() => {
    queueMicrotask(() => {
      const priceStr =
        selectedServicePriceCents && selectedServicePriceCents > 0
          ? String(selectedServicePriceCents / 100)
          : "";
      setAmountChargedMajorUnits(priceStr);
      setAmountMajorUnits((prev) => (prev ? prev : priceStr));
    });
  }, [selectedBookingId, selectedServicePriceCents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId) return;

    const parsedPaid = parseFloat(amountMajorUnits.replace(/,/g, ""));
    if (isNaN(parsedPaid) || parsedPaid <= 0) {
      setError("Please enter a valid positive payment amount.");
      return;
    }

    const parsedCharged = amountChargedMajorUnits
      ? parseFloat(amountChargedMajorUnits.replace(/,/g, ""))
      : parsedPaid;

    setIsSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const amountCents = Math.round(parsedPaid * 100);
    const chargedCents = Math.round(parsedCharged * 100);

    try {
      const saved = await recordBookingPayment(
        selectedBookingId,
        {
          amountCents,
          amountChargedCents: chargedCents,
          method,
          notes: notes.trim() || undefined,
          overrideReason: overrideReason.trim() || undefined,
          currency: displayCurrency.code,
          patientId,
        },
        accessToken
      );
      setAmountMajorUnits("");
      setAmountChargedMajorUnits("");
      setOverrideReason("");
      setNotes("");
      setSuccessMsg(`Payment of ${saved.amountFormatted} recorded successfully.`);
      if (onPaymentRecorded) {
        onPaymentRecorded();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <Banknote className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Visit Payment &amp; Balance
              </h2>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {patientName ? `Patient: ${patientName}` : "Front desk visit accounting and payment record."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {bookingOptions && bookingOptions.length > 0 && (
          <div>
            <label htmlFor="payment-appointment" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Appointment
            </label>
            <select
              id="payment-appointment"
              value={selectedBookingId ?? ""}
              onChange={(event) => setSelectedBookingId(event.target.value || null)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-white"
            >
              {bookingOptions.map((booking) => (
                <option key={booking.id} value={booking.id}>{booking.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Scrollable middle container */}
        <div className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Payment Form */}
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Total Fee Charged ({displayCurrency.code})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs">
                    {displayCurrency.symbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder={
                      selectedServicePriceCents && selectedServicePriceCents > 0
                        ? String(selectedServicePriceCents / 100)
                        : "e.g. 5000"
                    }
                      value={amountChargedMajorUnits}
                      onChange={(e) => setAmountChargedMajorUnits(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 pl-10 pr-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Amount Paying Now ({displayCurrency.code}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs">
                    {displayCurrency.symbol}
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="e.g. 5000"
                    value={amountMajorUnits}
                    onChange={(e) => setAmountMajorUnits(e.target.value)}
                    required
                    className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 pl-10 pr-3 py-2 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {servicePriceCents &&
              servicePriceCents > 0 &&
              selectedServicePriceCents != null &&
              amountChargedMajorUnits !== "" &&
              parseFloat(amountChargedMajorUnits.replace(/,/g, "")) !== selectedServicePriceCents / 100 && (
                <div className="p-2.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
                  <label className="block font-semibold text-amber-800 dark:text-amber-300 text-[11px]">
                    Catalog Fee Override Reason (Catalog: {displayCurrency.symbol} {(selectedServicePriceCents / 100).toLocaleString()}) *
                  </label>
                  <input
                    type="text"
                    placeholder="Reason for price adjustment (e.g. discount, complex procedure)..."
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod("cash")}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    method === "cash"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <Banknote className="h-3.5 w-3.5" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("card")}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    method === "card"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("bank_transfer")}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    method === "bank_transfer"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold"
                      : "border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Transfer</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Tooth #16 filling, front desk receipt"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Record Payment
              </Button>
            </div>
          </form>

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

interface PaymentReceiptModalProps {
  payment: VisitPayment | null;
  patientName?: string;
  currency?: PaymentCurrency;
  onClose: () => void;
}

export function PaymentReceiptModal({
  payment,
  patientName,
  currency,
  onClose,
}: PaymentReceiptModalProps) {
  if (!payment) return null;
  const displayCurrency = currency ?? {
    code: DEFAULT_CURRENCY.code,
    symbol: DEFAULT_CURRENCY.symbol,
  };
  const formatAmount = (amountCents: number) =>
    `${displayCurrency.symbol} ${(amountCents / 100).toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div role="dialog" aria-modal="true" aria-labelledby="payment-receipt-title" className="bg-white text-gray-900 border border-gray-300 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 font-sans text-xs print:p-0 print:border-none print:shadow-none">
        <div className="border-b-2 border-dashed border-gray-300 pb-3 text-center space-y-1">
          <h3 id="payment-receipt-title" className="text-base font-bold tracking-tight uppercase">
            Marlow Dental Clinic
          </h3>
          <p className="text-[11px] text-gray-500 font-mono">Front-Desk Patient Accounts</p>
          <div className="inline-block mt-1 px-3 py-1 bg-gray-100 text-gray-800 font-bold text-[11px] rounded-md border border-gray-300">
            Payment record, not a tax invoice
          </div>
        </div>

        <div className="space-y-2 py-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500">Receipt Ref:</span>
            <span className="font-mono font-bold">REC-{payment.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date &amp; Time:</span>
            <span className="font-mono">{new Date(payment.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Patient:</span>
            <span className="font-semibold">{patientName || "Clinic Patient"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Payment Method:</span>
            <span className="font-mono uppercase font-semibold">{payment.method}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Cashier / Staff:</span>
            <span>{payment.recordedByName || "Reception Desk"}</span>
          </div>
          {payment.notes && (
            <div className="flex justify-between">
              <span className="text-gray-500">Notes:</span>
              <span className="italic">{payment.notes}</span>
            </div>
          )}
        </div>

        <div className="border-t border-b border-gray-200 py-3 space-y-1.5 font-mono text-xs">
          {payment.amountChargedCents && payment.amountChargedCents > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Visit Fee Charged:</span>
              <span>{formatAmount(payment.amountChargedCents)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm text-gray-900">
            <span>Amount Paid:</span>
            <span>{formatAmount(payment.amountCents)}</span>
          </div>
        </div>

        <p className="text-center text-[10px] text-gray-500">
          Payment record, not a tax invoice
        </p>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 print:hidden">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Close</Button>
          <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5 mr-1" />
            Print Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
