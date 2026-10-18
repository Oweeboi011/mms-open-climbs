import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers";
import WaiverStatus from "@/components/admin/WaiverStatus";

const at = (iso) => ({ toDate: () => new Date(iso) });

describe("WaiverStatus", () => {
  it("shows the typed signature for a waiver signed in the app", () => {
    renderWithProviders(
      <WaiverStatus reg={{ id: "r1", waiverSigned: true, waiverSignedName: "Leslie M.", waiverSignedAt: at("2026-10-01") }} />,
    );
    expect(screen.getByText(/Signed as/)).toHaveTextContent("Leslie M.");
    expect(screen.queryByRole("button", { name: "Mark received offline" })).not.toBeInTheDocument();
  });

  it("records a waiver received offline, with a note required", async () => {
    const onMarkOffline = vi.fn().mockResolvedValue();
    const reg = { id: "r1", waiverSigned: false };
    renderWithProviders(<WaiverStatus reg={reg} onMarkOffline={onMarkOffline} />);
    expect(screen.getByText(/Waiver not yet signed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mark received offline" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Say how the waiver was received");
    expect(onMarkOffline).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("How the waiver was received"), {
      target: { value: " Signed paper waiver at the jump-off " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onMarkOffline).toHaveBeenCalledWith(reg, "Signed paper waiver at the jump-off"));
  });

  it("shows an offline record as received, never as a signature", () => {
    renderWithProviders(
      <WaiverStatus
        reg={{
          id: "r1",
          waiverSigned: false,
          waiverReceivedOffline: { note: "Paper waiver", markedBy: "Owee", markedAt: at("2026-10-24") },
        }}
        onMarkOffline={vi.fn()}
      />,
    );
    expect(screen.getByText(/Received offline/)).toBeInTheDocument();
    expect(screen.getByText(/Marked by Owee/)).toHaveTextContent("Paper waiver");
    expect(screen.queryByText(/Signed as/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark received offline" })).not.toBeInTheDocument();
  });

  it("offers no button to someone who can't mark it", () => {
    renderWithProviders(<WaiverStatus reg={{ id: "r1", waiverSigned: false }} />);
    expect(screen.queryByRole("button", { name: "Mark received offline" })).not.toBeInTheDocument();
  });
});
