import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ClinicalAlertBanner } from "@/components/doctor/clinical-alert-banner";
import * as api from "@/lib/api";

// Mock the Auth provider
vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({
    accessToken: "mock-token",
    user: { id: "doc-1", role: "doctor", name: "Dr. Farooq" },
  }),
}));

// Mock the API calls
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof api>("@/lib/api");
  return {
    ...actual,
    getPatientAlertsSummary: vi.fn(),
    reviewPatientAlertsAtVisit: vi.fn(),
    confirmDoctorAlert: vi.fn(),
    dismissDoctorAlert: vi.fn(),
    updateMedicalHistoryStatus: vi.fn(),
    recordDoctorAlert: vi.fn(),
  };
});

describe("ClinicalAlertBanner Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders confirmed alerts and shows Needs Visit Review badge when not reviewed", async () => {
    vi.mocked(api.getPatientAlertsSummary).mockResolvedValueOnce({
      patientId: "patient-123",
      medicalHistoryStatus: "recorded",
      lastReviewedAt: null,
      confirmedAlerts: [
        {
          id: "alert-1",
          patientId: "patient-123",
          type: "allergy",
          description: "Severe Penicillin Allergy (Anaphylaxis)",
          severity: "life_threatening",
          recordedAt: "2026-10-10T00:00:00Z",
          isActive: true,
          isConfirmed: true,
          createdAt: "2026-10-10T00:00:00Z",
          updatedAt: "2026-10-10T00:00:00Z",
        },
      ],
      pendingAlerts: [],
    });

    render(<ClinicalAlertBanner patientId="patient-123" />);

    // Wait for the banner to load
    await waitFor(() => {
      expect(screen.getByText(/Medical & Allergy Alerts/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Severe Penicillin Allergy \(Anaphylaxis\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Needs Visit Review/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review at this visit/i })).toBeInTheDocument();
  });

  it("renders reviewed status with formatted date when alerts have been reviewed", async () => {
    vi.mocked(api.getPatientAlertsSummary).mockResolvedValueOnce({
      patientId: "patient-123",
      medicalHistoryStatus: "recorded",
      lastReviewedAt: "2026-10-12T10:00:00Z",
      confirmedAlerts: [
        {
          id: "alert-2",
          patientId: "patient-123",
          type: "condition",
          description: "Type 2 Diabetes Mellitus",
          severity: "moderate",
          recordedAt: "2026-10-12T10:00:00Z",
          isActive: true,
          isConfirmed: true,
          createdAt: "2026-10-12T10:00:00Z",
          updatedAt: "2026-10-12T10:00:00Z",
        },
      ],
      pendingAlerts: [],
    });

    render(<ClinicalAlertBanner patientId="patient-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Type 2 Diabetes Mellitus/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Reviewed/i)).toBeInTheDocument();
  });

  it("renders No Known Medical Alerts banner when status is none_known", async () => {
    vi.mocked(api.getPatientAlertsSummary).mockResolvedValueOnce({
      patientId: "patient-456",
      medicalHistoryStatus: "none_known",
      lastReviewedAt: "2026-10-12T09:00:00Z",
      confirmedAlerts: [],
      pendingAlerts: [],
    });

    render(<ClinicalAlertBanner patientId="patient-456" />);

    await waitFor(() => {
      expect(
        screen.getByText(/No known allergies or medical conditions recorded/i)
      ).toBeInTheDocument();
    });
  });
});
