"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Check, ShieldCheck, Phone, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { Card } from "@/components/ui/card";
import SiteHeader from "@/components/layout/site-header";
import Footer from "@/components/layout/footer";
import { getStoredUtmParams } from "@/lib/utm";
import { submitBookingRequest, BookingPayload, getServices } from "@/lib/api";
import { usePublicContent } from "@/components/providers/public-content-provider";

const TIME_SLOTS = ["8:30 AM", "10:00 AM", "11:30 AM", "1:30 PM", "3:00 PM", "4:30 PM"];

type WizardStep = 0 | 1 | 2 | 3;

/**
 * Interactive four-step wizard guiding patients through scheduling an appointment.
 *
 * Step 0: Select dental service / reason for visit.
 * Step 1: Choose requested date and time slot.
 * Step 2: Enter contact details, phone, email, and insurance information.
 * Step 3: Review summary, clinic policies, and transmit booking request to the backend.
 *
 * It syncs the current step to the URL search parameters so browser back/forward buttons work naturally.
 */
function BookingWizard() {
  const { content, primaryLocation } = usePublicContent();
  const phone = content.general?.phone || primaryLocation?.phone || "(312) 555-0147";
  const cleanPhone = phone.replace(/[^0-9+]/g, "");
  const locationName = primaryLocation?.name || "clinic desk";
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read step from URL (?step=0|1|2|3) to support browser history and refresh
  const urlStepParam = searchParams.get("step");
  const initialStep = urlStepParam ? (Math.min(3, Math.max(0, parseInt(urlStepParam, 10))) as WizardStep) : 0;
  const preselectedService = searchParams.get("service");

  const [servicesOptions, setServicesOptions] = useState<Array<{ id: string; label: string; meta: string }>>([]);
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [service, setService] = useState<string>(preselectedService || "cleanings-exams");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("10:00 AM");

  useEffect(() => {
    getServices()
      .then((svcs) => {
        if (svcs && svcs.length > 0) {
          const active = svcs.filter((s) => s.isActive !== false);
          if (active.length > 0) {
            setServicesOptions(
              active.map((s) => ({
                id: s.id,
                label: s.title,
                meta: `${s.duration} · cash ${s.cashPrice}`,
              }))
            );
          }
        }
      })
      .catch(() => {
        setServicesOptions([]);
      });
  }, []);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  // Track touched state for onBlur validation
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedData, setSubmittedData] = useState<{
    confirmationId: string;
    callbackWindow: string;
  } | null>(null);

  // Sync state if URL changes (e.g. user clicks browser back/forward)
  useEffect(() => {
    if (urlStepParam !== null) {
      const parsed = Math.min(3, Math.max(0, parseInt(urlStepParam, 10))) as WizardStep;
      setStep(parsed);
    }
  }, [urlStepParam]);

  useEffect(() => {
    if (preselectedService) {
      setService(preselectedService);
    }

    // Default appointment date to tomorrow (or Monday if tomorrow is Sunday)
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1);
    if (nextDate.getDay() === 0) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    setDate(nextDate.toISOString().split("T")[0]);
  }, [preselectedService]);

  /** Updates the active wizard step and records it in the URL query parameters so navigation history works. */
  const updateStep = (nextStep: WizardStep) => {
    setStep(nextStep);
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", nextStep.toString());
    if (service) params.set("service", service);
    router.push(`/book?${params.toString()}`);
  };

  /** Validates a single form field (name, phone, or email) and sets an error message if invalid. */
  const validateField = (field: string, value: string) => {
    let err = "";
    if (field === "name" && !value.trim()) {
      err = "Please enter your full legal name.";
    }
    if (field === "phone") {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10) {
        err = "Please enter a valid 10-digit telephone number.";
      }
    }
    if (field === "email") {
      if (!value.includes("@") || !value.includes(".")) {
        err = "Please enter a valid email address.";
      }
    }
    setErrors((prev) => ({ ...prev, [field]: err }));
    return !err;
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, value);
  };

  /** Validates all contact fields before allowing the patient to proceed to the review step. */
  const validateAllDetails = () => {
    const isNameValid = validateField("name", form.name);
    const isPhoneValid = validateField("phone", form.phone);
    const isEmailValid = validateField("email", form.email);
    setTouched({ name: true, phone: true, email: true });
    return isNameValid && isPhoneValid && isEmailValid;
  };

  const handleNext = () => {
    if (step === 2) {
      if (!validateAllDetails()) return;
    }
    updateStep(Math.min(3, step + 1) as WizardStep);
  };

  const handleBack = () => {
    updateStep(Math.max(0, step - 1) as WizardStep);
  };

  /**
   * Final appointment request submission handler.
   * NOTE FOR BACKEND INTEGRATION:
   * When the FastAPI backend endpoint `POST /api/appointments` is live,
   * `submitBookingRequest` in src/lib/api.ts will transmit this payload directly.
   */
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    const utms = getStoredUtmParams();

    const payload: BookingPayload = {
      serviceId: service,
      preferredDate: date,
      preferredTime: time,
      fullName: form.name,
      phone: form.phone,
      email: form.email,
      notes: form.notes,
      utmSource: utms.utm_source,
      utmCampaign: utms.utm_campaign,
    };

    try {
      const response = await submitBookingRequest(payload);
      setSubmittedData({
        confirmationId: response.confirmationId,
        callbackWindow: response.estimatedCallbackWindow,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to submit your appointment request. Please check your connection or contact our clinic directly.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedServiceObj = servicesOptions.find((s) => s.id === service);
  const todayIso = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col justify-between">
      {/* Reused SiteHeader with minimal variant */}
      <SiteHeader variant="minimal" />

      <main id="main-content" className="container-x py-12 sm:py-16 flex-1">
        {submittedData ? (
          /* Confirmation Screen */
          <div className="mx-auto max-w-xl text-center space-y-6">
            <Card surface="cream" shadow="card" className="p-8 sm:p-10">
              {/* Restrained stroke checkmark */}
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-forest text-[#FAF7F2] mb-5">
                <svg
                  className="h-7 w-7 text-[#FAF7F2]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    d="M20 6L9 17l-5-5"
                  />
                </svg>
              </div>

              <p className="eyebrow mb-2">Request Transmitted</p>
              <h1 className="text-[30px] sm:text-[38px] leading-tight text-ink font-normal">
                We will call you to confirm.
              </h1>

              <p className="mt-4 text-sm sm:text-base leading-relaxed text-ink-soft">
                Thank you, <strong className="text-ink">{form.name.split(" ")[0]}</strong>. We have received your request for{" "}
                <strong className="text-ink">{selectedServiceObj?.label}</strong> on{" "}
                <strong className="text-ink">{date} at {time}</strong>.
              </p>

              <div className="my-6 rounded-[var(--radius-card)] border border-line bg-bone p-4 text-left text-xs space-y-1.5 font-mono">
                <p>
                  <span className="text-ink-soft">Request ID:</span>{" "}
                  <strong className="text-ink">{submittedData.confirmationId}</strong>
                </p>
                <p>
                  <span className="text-ink-soft">Verification Phone:</span>{" "}
                  <strong className="text-ink">{form.phone}</strong>
                </p>
                <p>
                  <span className="text-ink-soft">Expected Contact:</span>{" "}
                  <span className="text-forest font-medium">{submittedData.callbackWindow}</span>
                </p>
              </div>

              <p className="text-xs text-ink-soft">
                Have an acute toothache right now? Please call our {locationName} directly at{" "}
                <a href={`tel:${cleanPhone}`} className="text-forest font-semibold underline">
                  {phone}
                </a>.
              </p>

              <div className="mt-8">
                <Button href="/" variant="secondary">
                  Return to Homepage
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          /* Step-by-Step Scheduling Wizard */
          <div className="mx-auto max-w-2xl">
            {/* Stepper Progress Header */}
            <div className="mb-10">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-ink-soft/70">
                <span className={step >= 0 ? "text-forest dark:text-emerald-400 font-bold" : ""}>
                  1. Service
                </span>
                <span className="h-px flex-1 bg-line mx-3" />
                <span className={step >= 1 ? "text-forest dark:text-emerald-400 font-bold" : ""}>
                  2. Date &amp; Time
                </span>
                <span className="h-px flex-1 bg-line mx-3" />
                <span className={step >= 2 ? "text-forest dark:text-emerald-400 font-bold" : ""}>
                  3. Details
                </span>
                <span className="h-px flex-1 bg-line mx-3" />
                <span className={step >= 3 ? "text-forest dark:text-emerald-400 font-bold" : ""}>
                  4. Review
                </span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {/* Step 0: Service Selection */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-[28px] sm:text-[34px] leading-tight text-ink font-normal">
                      What can we help you with?
                    </h1>
                    <p className="mt-2 text-sm text-ink-soft">
                      Pick the closest procedure. Dr. Marlow will confirm specifics during your visit.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {servicesOptions.map((opt) => {
                      const isSelected = service === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setService(opt.id)}
                          className={`w-full rounded-[var(--radius-card)] border p-4 text-left transition-all cursor-pointer ${
                            isSelected
                              ? "border-forest bg-forest text-[#FAF7F2] shadow-subtle"
                              : "border-line bg-cream/70 hover:border-forest/40 hover:bg-cream text-ink"
                          }`}
                        >
                          <p className="font-display text-[17px] font-medium leading-tight">
                            {opt.label}
                          </p>
                          <p
                            className={`mt-1 text-xs ${
                              isSelected ? "text-[#FAF7F2]/80" : "text-ink-soft"
                            }`}
                          >
                            {opt.meta}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button variant="primary" onClick={handleNext}>
                      <span>Continue to Date &amp; Time</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Date & Time Picker */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-[28px] sm:text-[34px] leading-tight text-ink font-normal">
                      Pick a day and time.
                    </h1>
                    <p className="mt-2 text-sm text-ink-soft">
                      We reserve dedicated unhurried time for every patient.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Date Input with past date floor */}
                    <div>
                      <label
                        htmlFor="booking-date-input"
                        className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/80 mb-2"
                      >
                        Preferred Date
                      </label>
                      <input
                        id="booking-date-input"
                        type="date"
                        value={date}
                        min={todayIso}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full rounded-[var(--radius-card)] border border-line bg-cream/70 px-4 py-3 text-sm text-ink outline-none focus:border-forest"
                      />
                      <p className="mt-1.5 text-[11.5px] text-ink-soft">
                        Mon to Thu 8 to 6, Fri 8 to 2, Sat 9 to 1.
                      </p>
                    </div>

                    {/* Time Slots */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft/80 mb-2">
                        Preferred Time Slot
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {TIME_SLOTS.map((slot) => {
                          const isSelected = time === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setTime(slot)}
                              className={`rounded-[var(--radius-card)] border py-2.5 text-xs font-mono font-medium transition-all cursor-pointer ${
                                isSelected
                                  ? "border-forest bg-forest text-[#FAF7F2]"
                                  : "border-line bg-cream hover:border-forest/40 text-ink"
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <Button variant="secondary" onClick={handleBack}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      <span>Back</span>
                    </Button>
                    <Button variant="primary" onClick={handleNext}>
                      <span>Continue to Details</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 2: Patient Details with Real-time Validation */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-[28px] sm:text-[34px] leading-tight text-ink font-normal">
                      A few details.
                    </h1>
                    <p className="mt-2 text-sm text-ink-soft">
                      So Dr. Marlow and the front desk know whom to look for.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <TextField
                      id="patient-name"
                      label="Full Legal Name"
                      value={form.name}
                      placeholder="e.g. Jane Alvarez"
                      required
                      error={touched.name ? errors.name : undefined}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      onBlur={(e) => handleBlur("name", e.target.value)}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <TextField
                        id="patient-phone"
                        label="Telephone Number"
                        type="tel"
                        value={form.phone}
                        placeholder="(312) 555-0100"
                        required
                        error={touched.phone ? errors.phone : undefined}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        onBlur={(e) => handleBlur("phone", e.target.value)}
                      />

                      <TextField
                        id="patient-email"
                        label="Email Address"
                        type="email"
                        value={form.email}
                        placeholder="jane@example.com"
                        required
                        error={touched.email ? errors.email : undefined}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        onBlur={(e) => handleBlur("email", e.target.value)}
                      />
                    </div>


                    {/* Clinical Notes */}
                    <TextField
                      id="patient-notes"
                      label="Anything we should know? (Optional)"
                      multiline
                      rows={3}
                      value={form.notes}
                      placeholder="e.g. Sensitive to cold on lower molar; feeling nervous about dental tools."
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <Button variant="secondary" onClick={handleBack}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      <span>Back</span>
                    </Button>
                    <Button variant="primary" onClick={handleNext}>
                      <span>Review &amp; Confirm</span>
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Review and Confirm */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div>
                    <h1 className="text-[28px] sm:text-[34px] leading-tight text-ink font-normal">
                      Look right?
                    </h1>
                    <p className="mt-2 text-sm text-ink-soft">
                      We will call to confirm within one business hour.
                    </p>
                  </div>

                  <Card surface="cream" shadow="subtle" className="p-6 space-y-4">
                    <div className="flex justify-between border-b border-line/60 pb-3 text-sm">
                      <span className="text-ink-soft">Selected Procedure:</span>
                      <strong className="text-ink font-display">{selectedServiceObj?.label}</strong>
                    </div>
                    <div className="flex justify-between border-b border-line/60 pb-3 text-sm">
                      <span className="text-ink-soft">Date &amp; Slot:</span>
                      <strong className="text-ink font-mono">{date} at {time}</strong>
                    </div>
                    <div className="flex justify-between border-b border-line/60 pb-3 text-sm">
                      <span className="text-ink-soft">Patient Name:</span>
                      <strong className="text-ink">{form.name}</strong>
                    </div>
                    <div className="flex justify-between border-b border-line/60 pb-3 text-sm">
                      <span className="text-ink-soft">Telephone:</span>
                      <strong className="text-ink">{form.phone}</strong>
                    </div>
                    <div className="flex justify-between border-b border-line/60 pb-3 text-sm">
                      <span className="text-ink-soft">Email:</span>
                      <strong className="text-ink">{form.email}</strong>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-soft">Payment / Billing:</span>
                      <strong className="text-ink">Transparent Fee Schedule</strong>
                    </div>
                    {form.notes && (
                      <div className="pt-3 border-t border-line/60 text-xs">
                        <span className="text-ink-soft font-semibold uppercase">Notes:</span>
                        <p className="mt-1 text-ink">{form.notes}</p>
                      </div>
                    )}
                  </Card>

                  {submitError && (
                    <div
                      role="alert"
                      aria-live="polite"
                      className="rounded-[var(--radius-card)] border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-800 dark:text-rose-200 space-y-1.5"
                    >
                      <p className="font-semibold text-rose-900 dark:text-rose-100">
                        Could not transmit appointment request
                      </p>
                      <p>{submitError}</p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-300">
                        Please try again, or call our {locationName} directly at{" "}
                        <a href={`tel:${cleanPhone}`} className="underline font-semibold">
                          {phone}
                        </a>.
                      </p>
                    </div>
                  )}

                  <div className="rounded-[var(--radius-card)] border border-line bg-bone p-4 text-xs text-ink-soft flex items-start gap-2.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      No payment required to book. We will confirm your appointment by telephone within one business hour.
                    </span>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      <span>Back</span>
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleFinalSubmit}
                      isLoading={isSubmitting}
                    >
                      <span>Request appointment</span>
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

/**
 * Main appointment scheduling page wrapped in React Suspense to handle client search parameters safely.
 */
export default function BookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bone flex items-center justify-center text-sm text-ink-soft">Loading appointment scheduler...</div>}>
      <BookingWizard />
    </Suspense>
  );
}