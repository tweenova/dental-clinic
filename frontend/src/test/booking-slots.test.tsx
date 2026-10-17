import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BookingSlotPicker } from "@/components/booking/booking-slot-picker";

describe("BookingSlotPicker Component", () => {
  it("renders only the returned slots from availability engine", () => {
    const returnedSlots = ["09:00 AM", "11:30 AM", "02:15 PM"];
    const handleSelectSlot = vi.fn();

    render(
      <BookingSlotPicker
        loading={false}
        slots={returnedSlots}
        selectedSlot=""
        onSelectSlot={handleSelectSlot}
      />
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);

    // Assert that each returned slot is rendered
    expect(screen.getByRole("button", { name: "09:00 AM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "11:30 AM" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "02:15 PM" })).toBeInTheDocument();

    // Assert that unreturned slots are NOT rendered
    expect(screen.queryByRole("button", { name: "10:00 AM" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "04:00 PM" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "12:00 PM" })).not.toBeInTheDocument();
  });

  it("handles slot selection and marks the selected slot", () => {
    const returnedSlots = ["10:00 AM", "01:00 PM"];
    const handleSelectSlot = vi.fn();

    const { rerender } = render(
      <BookingSlotPicker
        loading={false}
        slots={returnedSlots}
        selectedSlot="10:00 AM"
        onSelectSlot={handleSelectSlot}
      />
    );

    const btn10 = screen.getByRole("button", { name: "10:00 AM" });
    expect(btn10).toHaveClass("bg-forest");

    const btn01 = screen.getByRole("button", { name: "01:00 PM" });
    fireEvent.click(btn01);

    expect(handleSelectSlot).toHaveBeenCalledWith("01:00 PM");

    // Re-render with new selectedSlot
    rerender(
      <BookingSlotPicker
        loading={false}
        slots={returnedSlots}
        selectedSlot="01:00 PM"
        onSelectSlot={handleSelectSlot}
      />
    );

    expect(screen.getByRole("button", { name: "01:00 PM" })).toHaveClass("bg-forest");
  });

  it("renders loading indicator when checking clinic availability", () => {
    render(
      <BookingSlotPicker
        loading={true}
        slots={[]}
        selectedSlot=""
        onSelectSlot={() => {}}
      />
    );

    expect(screen.getByTestId("booking-slots-loading")).toBeInTheDocument();
    expect(
      screen.getByText(/Checking clinic availability/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders empty state message when no slots are returned", () => {
    render(
      <BookingSlotPicker
        loading={false}
        slots={[]}
        selectedSlot=""
        onSelectSlot={() => {}}
        error="All slots booked for this public holiday."
      />
    );

    expect(screen.getByTestId("booking-slots-empty")).toBeInTheDocument();
    expect(
      screen.getByText(/No appointment slots available/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/All slots booked for this public holiday/i)
    ).toBeInTheDocument();
  });
});
