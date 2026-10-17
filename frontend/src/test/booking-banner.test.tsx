import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookingPausedBanner } from "@/components/booking/booking-paused-banner";

describe("BookingPausedBanner Component", () => {
  it("renders nothing when booking status is open", () => {
    const { container } = render(
      <BookingPausedBanner
        status={{
          mode: "open",
          message: null,
          phone: null,
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders emergency paused banner with custom message and phone when mode is paused", () => {
    render(
      <BookingPausedBanner
        status={{
          mode: "paused",
          message: "Our power is undergoing emergency maintenance. Please call us directly.",
          phone: "+92 42 3578 1234",
        }}
      />
    );

    const banner = screen.getByTestId("booking-paused-banner");
    expect(banner).toBeInTheDocument();
    expect(
      screen.getByText(/Online Scheduling Is Currently Paused/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Our power is undergoing emergency maintenance/i)
    ).toBeInTheDocument();
    expect(screen.getByText("+92 42 3578 1234")).toBeInTheDocument();

    const telLink = screen.getByRole("link", { name: /\+92 42 3578 1234/i });
    expect(telLink).toHaveAttribute("href", "tel:+924235781234");
  });

  it("renders closed banner with fallback phone when mode is closed and phone is null", () => {
    render(
      <BookingPausedBanner
        status={{
          mode: "closed",
          message: "Clinic is closed for the Eid public holiday.",
          phone: null,
        }}
        fallbackPhone="(042) 3571-0000"
      />
    );

    expect(
      screen.getByText(/Online Scheduling Is Currently Closed/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Clinic is closed for the Eid public holiday/i)
    ).toBeInTheDocument();
    expect(screen.getByText("(042) 3571-0000")).toBeInTheDocument();
  });
});
