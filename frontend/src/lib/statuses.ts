/**
 * Canonical appointment and task status constants: Marlow Dental.
 *
 * Single source of truth for all status comparisons across the frontend.
 * Never use literal string comparisons for statuses in components.
 */

export const APPOINTMENT_STATUS = {
  REQUESTED: "requested",
  CONFIRMED: "confirmed",
  ARRIVED: "arrived",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
  WAITLIST: "waitlist",
} as const;

export type AppointmentStatus =
  (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS];

/** Helper predicates for appointment status filtering */
export function isExpected(status: string | null | undefined): boolean {
  return status === APPOINTMENT_STATUS.CONFIRMED || status === "scheduled";
}

export function isWaiting(status: string | null | undefined): boolean {
  return (
    status === APPOINTMENT_STATUS.ARRIVED ||
    status === "checked_in" ||
    status === "waiting"
  );
}

export function isInProgress(status: string | null | undefined): boolean {
  return status === APPOINTMENT_STATUS.IN_PROGRESS;
}

export function isCompleted(status: string | null | undefined): boolean {
  return status === APPOINTMENT_STATUS.COMPLETED;
}

export function isCancelled(status: string | null | undefined): boolean {
  return status === APPOINTMENT_STATUS.CANCELLED;
}

export function isRequested(status: string | null | undefined): boolean {
  return status === APPOINTMENT_STATUS.REQUESTED;
}

export function isNoShow(status: string | null | undefined): boolean {
  return status === APPOINTMENT_STATUS.NO_SHOW;
}

export function isWaitlist(status: string | null | undefined): boolean {
  return status === APPOINTMENT_STATUS.WAITLIST;
}

/** Task statuses */
export const TASK_STATUS = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  CANCELLED: "cancelled",
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

export function isTaskActive(status: string | null | undefined): boolean {
  return status === TASK_STATUS.PENDING || status === TASK_STATUS.IN_PROGRESS;
}

export function isTaskDone(status: string | null | undefined): boolean {
  return status === TASK_STATUS.DONE || status === "completed";
}

/** Waiting time thresholds in minutes (Task 0.6) */
export const WAITING_TIME_THRESHOLDS = {
  ON_TIME_MAX_MINUTES: 5,
  EXTENDED_WAIT_MAX_MINUTES: 15,
} as const;

export type WaitingCategory = "on_time" | "extended" | "critical";

export function getWaitingTimeCategory(minutes: number): WaitingCategory {
  if (minutes <= WAITING_TIME_THRESHOLDS.ON_TIME_MAX_MINUTES) {
    return "on_time";
  }
  if (minutes <= WAITING_TIME_THRESHOLDS.EXTENDED_WAIT_MAX_MINUTES) {
    return "extended";
  }
  return "critical";
}

