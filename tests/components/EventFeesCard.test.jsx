import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EventFeesCard from "@/components/EventFeesCard";

const climb = {
  fees: [
    { label: "Registration Fee", amount: "500", optional: false },
    { label: "Guide Fee", amount: "700", optional: false },
    { label: "Transportation Fee", amount: "300", optional: true },
    { label: "Guest Fee", amount: "450", optional: true, isGuestFee: true },
  ],
};

describe("EventFeesCard", () => {
  it("totals required fees only — optional extras don't inflate the member total", () => {
    render(<EventFeesCard climb={climb} />);
    expect(screen.getByText("Member Total")).toBeInTheDocument();
    expect(screen.getByText("₱1,200")).toBeInTheDocument();
  });

  it("lists optional fees under their own heading", () => {
    render(<EventFeesCard climb={climb} />);
    expect(screen.getByText(/Optional — only if availed/)).toBeInTheDocument();
    expect(screen.getByText("Transportation Fee")).toBeInTheDocument();
  });

  it("notes the guest fee as an addition for non-members", () => {
    render(<EventFeesCard climb={climb} />);
    expect(
      screen.getByText(/\+ ₱450 Guest Fee for non-members/),
    ).toBeInTheDocument();
  });

  it("marks the total as excluding TBA items", () => {
    render(
      <EventFeesCard
        climb={{
          fees: [
            { label: "Registration Fee", amount: "500", optional: false },
            { label: "Guide Fee", amount: "TBA", optional: false },
          ],
        }}
      />,
    );
    expect(screen.getByText(/excl. TBA items/)).toBeInTheDocument();
    expect(screen.getByText("₱500")).toBeInTheDocument();
  });

  it("falls back to placeholder rows when the climb has no fees yet", () => {
    render(<EventFeesCard climb={{}} />);
    expect(screen.getByText("Accommodation")).toBeInTheDocument();
    expect(screen.queryByText("Member Total")).not.toBeInTheDocument();
  });

  it("shows the member-vs-joiner teaser only when a handler is passed", () => {
    const { rerender } = render(<EventFeesCard climb={climb} />);
    expect(
      screen.queryByRole("button", { name: /member vs joiner/i }),
    ).not.toBeInTheDocument();

    const onOpenGuide = vi.fn();
    rerender(<EventFeesCard climb={climb} onOpenGuide={onOpenGuide} />);
    fireEvent.click(screen.getByRole("button", { name: /member vs joiner/i }));
    expect(onOpenGuide).toHaveBeenCalledTimes(1);
  });
});
