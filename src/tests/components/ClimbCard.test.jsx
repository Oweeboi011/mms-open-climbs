/**
 * Tests for ClimbCard component.
 *
 * Scenarios:
 *  - Renders title, location, and stats
 *  - Shows "Itinerary Available" badge when itinerary is non-empty
 *  - Shows "Itinerary Coming Soon" when itinerary is empty
 *  - Shows "Full" tag when seats = 0
 *  - Shows low-seats warning when seats <= 5
 *  - Shows correct type badge (minor / major / special)
 *  - Links to /event/:id
 *  - Wide card gets card-wide class
 */
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import ClimbCard from "@/components/ClimbCard";
import { renderWithProviders, climbFixture } from "@/test/helpers";

function render(props = {}) {
  return renderWithProviders(
    <ClimbCard climb={{ ...climbFixture, ...props }} />,
  );
}

describe("ClimbCard", () => {
  it("renders the climb title and location", () => {
    render();
    expect(screen.getByText("Mt. Pulag")).toBeInTheDocument();
    expect(screen.getByText("Benguet")).toBeInTheDocument();
  });

  it("renders elevation, difficulty and distance stats", () => {
    render();
    expect(screen.getByText(/2926m/)).toBeInTheDocument();
    expect(screen.getByText(/Moderate/)).toBeInTheDocument();
    expect(screen.getByText(/12km/)).toBeInTheDocument();
  });

  it("shows Itinerary Available when itinerary has items", () => {
    render({ itinerary: ["Day 1: Arrival"] });
    expect(screen.getByText(/Itinerary Available/)).toBeInTheDocument();
  });

  it("shows Itinerary Coming Soon when itinerary is empty", () => {
    render({ itinerary: [] });
    expect(screen.getByText(/Itinerary Coming Soon/)).toBeInTheDocument();
  });

  it("shows Full tag when no seats remain", () => {
    render({ maxParticipants: 10, registrationCount: 10 });
    expect(screen.getByText(/Full/)).toBeInTheDocument();
  });

  it("shows low seats warning when <= 5 seats remain", () => {
    render({ maxParticipants: 15, registrationCount: 12 });
    expect(screen.getByText(/3 seats left/)).toBeInTheDocument();
  });

  it("shows singular 'seat left' when exactly 1 seat remains", () => {
    render({ maxParticipants: 10, registrationCount: 9 });
    expect(screen.getByText(/1 seat left/)).toBeInTheDocument();
  });

  it("does not show Full or low-seats tag when plenty of seats remain", () => {
    render({ maxParticipants: 30, registrationCount: 5 });
    expect(screen.queryByText(/Full/)).not.toBeInTheDocument();
    expect(screen.queryByText(/seats left/)).not.toBeInTheDocument();
  });

  it("renders Major badge for a major climb", () => {
    render({ type: "major" });
    expect(screen.getByText("Major")).toBeInTheDocument();
  });

  it("renders Minor badge for a minor climb", () => {
    render({ type: "minor" });
    expect(screen.getByText("Minor")).toBeInTheDocument();
  });

  it("renders Special badge for a special climb", () => {
    render({ type: "special" });
    expect(screen.getByText("Special")).toBeInTheDocument();
  });

  it("generates a link to /event/<id>", () => {
    render();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/event/climb-1");
  });

  it("adds card-wide class when isWide is true", () => {
    render({ isWide: true });
    const link = screen.getByRole("link");
    expect(link).toHaveClass("card-wide");
  });

  it("does not add card-wide class when isWide is false", () => {
    render({ isWide: false });
    const link = screen.getByRole("link");
    expect(link).not.toHaveClass("card-wide");
  });
});
