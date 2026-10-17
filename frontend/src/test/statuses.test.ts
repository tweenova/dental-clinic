import { describe, it, expect } from "vitest";
import {
  APPOINTMENT_STATUS,
  TASK_STATUS,
  WAITING_TIME_THRESHOLDS,
  getWaitingTimeCategory,
  isCancelled,
  isCompleted,
  isExpected,
  isInProgress,
  isNoShow,
  isRequested,
  isTaskActive,
  isTaskDone,
  isWaiting,
  isWaitlist,
} from "@/lib/statuses";

describe("Status Constants and Predicates", () => {
  it("defines standard canonical appointment statuses", () => {
    expect(APPOINTMENT_STATUS.REQUESTED).toBe("requested");
    expect(APPOINTMENT_STATUS.CONFIRMED).toBe("confirmed");
    expect(APPOINTMENT_STATUS.ARRIVED).toBe("arrived");
    expect(APPOINTMENT_STATUS.IN_PROGRESS).toBe("in_progress");
    expect(APPOINTMENT_STATUS.COMPLETED).toBe("completed");
    expect(APPOINTMENT_STATUS.CANCELLED).toBe("cancelled");
    expect(APPOINTMENT_STATUS.NO_SHOW).toBe("no_show");
    expect(APPOINTMENT_STATUS.WAITLIST).toBe("waitlist");
  });

  it("evaluates appointment status predicates correctly", () => {
    expect(isExpected("confirmed")).toBe(true);
    expect(isExpected("scheduled")).toBe(true);
    expect(isExpected("cancelled")).toBe(false);

    expect(isWaiting("arrived")).toBe(true);
    expect(isWaiting("checked_in")).toBe(true);
    expect(isWaiting("waiting")).toBe(true);
    expect(isWaiting("completed")).toBe(false);

    expect(isInProgress("in_progress")).toBe(true);
    expect(isInProgress("confirmed")).toBe(false);

    expect(isCompleted("completed")).toBe(true);
    expect(isCompleted("in_progress")).toBe(false);

    expect(isCancelled("cancelled")).toBe(true);
    expect(isCancelled("confirmed")).toBe(false);

    expect(isRequested("requested")).toBe(true);
    expect(isRequested("completed")).toBe(false);

    expect(isNoShow("no_show")).toBe(true);
    expect(isNoShow("cancelled")).toBe(false);

    expect(isWaitlist("waitlist")).toBe(true);
    expect(isWaitlist("confirmed")).toBe(false);
  });

  it("defines and evaluates task statuses and predicates", () => {
    expect(TASK_STATUS.PENDING).toBe("pending");
    expect(TASK_STATUS.IN_PROGRESS).toBe("in_progress");
    expect(TASK_STATUS.DONE).toBe("done");
    expect(TASK_STATUS.CANCELLED).toBe("cancelled");

    expect(isTaskActive("pending")).toBe(true);
    expect(isTaskActive("in_progress")).toBe(true);
    expect(isTaskActive("done")).toBe(false);

    expect(isTaskDone("done")).toBe(true);
    expect(isTaskDone("completed")).toBe(true);
    expect(isTaskDone("pending")).toBe(false);
  });

  it("calculates waiting time categories using calibrated clinical thresholds", () => {
    expect(WAITING_TIME_THRESHOLDS.ON_TIME_MAX_MINUTES).toBe(5);
    expect(WAITING_TIME_THRESHOLDS.EXTENDED_WAIT_MAX_MINUTES).toBe(15);

    expect(getWaitingTimeCategory(0)).toBe("on_time");
    expect(getWaitingTimeCategory(5)).toBe("on_time");
    expect(getWaitingTimeCategory(6)).toBe("extended");
    expect(getWaitingTimeCategory(15)).toBe("extended");
    expect(getWaitingTimeCategory(16)).toBe("critical");
    expect(getWaitingTimeCategory(45)).toBe("critical");
  });
});
