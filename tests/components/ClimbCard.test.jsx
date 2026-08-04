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
import { renderWithProviders, climbFixture } from "@tests/helpers";

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

  it("hides the Full tag for a closed climb even with zero seats left", () => {
    render({ maxParticipants: 10, registrationCount: 10, status: "closed" });
    expect(screen.queryByText(/Full/)).not.toBeInTheDocument();
  });

  it("hides the low-seats tag for a completed climb", () => {
    render({ maxParticipants: 15, registrationCount: 12, status: "completed" });
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

  it("shows the Team Leader when officers include one", () => {
    render({
      officers: [
        { name: "Juan Dela Cruz", role: "Team Leader" },
        { name: "Maria Santos", role: "Scribe" },
      ],
    });
    expect(screen.getByText(/Team Leader/)).toBeInTheDocument();
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
  });

  it("prefers Team Leader over Senior Team Leader when both are listed", () => {
    render({
      officers: [
        { name: "Pedro Reyes", role: "Senior Team Leader" },
        { name: "Juan Dela Cruz", role: "Team Leader" },
      ],
    });
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.queryByText("Pedro Reyes")).not.toBeInTheDocument();
  });

  it("recognizes 'Asst. Team Leader' as Assistant Team Leader", () => {
    render({
      officers: [{ name: "Maria Santos", role: "Asst. Team Leader" }],
    });
    expect(screen.getByText(/Asst\. Team Leader/)).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
  });

  it("shows both Team Leader and Assistant Team Leader when both are listed", () => {
    render({
      officers: [
        { name: "Juan Dela Cruz", role: "Team Leader" },
        { name: "Maria Santos", role: "Assistant Team Leader" },
        { name: "Pedro Reyes", role: "Scribe" },
      ],
    });
    expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    expect(screen.queryByText("Pedro Reyes")).not.toBeInTheDocument();
  });

  it("shows a 'No Officers Yet' placeholder when there are no officers", () => {
    render({ officers: [] });
    expect(screen.queryByText(/Team Leader/)).not.toBeInTheDocument();
    expect(screen.getByText("No Officers Yet")).toBeInTheDocument();
  });

  it("shows a 'No Officers Yet' placeholder when officers exist but none are Team Leader/Assistant Team Leader", () => {
    render({ officers: [{ name: "Pedro Reyes", role: "Scribe" }] });
    expect(screen.getByText("No Officers Yet")).toBeInTheDocument();
    expect(screen.queryByText("Pedro Reyes")).not.toBeInTheDocument();
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

  it("shows an Announcement flag when the climb has announcements", () => {
    render({ announcements: [{ text: "Meetup moved", createdAt: 1 }] });
    expect(screen.getByText("Announcement")).toBeInTheDocument();
  });

  it("does not show an Announcement flag when there are no announcements", () => {
    render({ announcements: [] });
    expect(screen.queryByText("Announcement")).not.toBeInTheDocument();
  });

  it("shows a single required-document flag when only one is required and no one has registered yet", () => {
    render({
      requiresRegistrationForm: true,
      requiresMedicalCert: false,
      registrationCount: 0,
    });
    expect(
      screen.getByText("Registration Form Required"),
    ).toBeInTheDocument();
  });

  it("shows a combined 'Docs Required' flag when both are required and no one has registered yet", () => {
    render({
      requiresRegistrationForm: true,
      requiresMedicalCert: true,
      registrationCount: 0,
    });
    expect(screen.getByText("Docs Required")).toBeInTheDocument();
  });

  it("does not show a document flag when none are required", () => {
    render({ requiresRegistrationForm: false, requiresMedicalCert: false });
    expect(screen.queryByText(/Docs Required/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Required$/)).not.toBeInTheDocument();
  });

  it("shows a docs-submitted progress count once climbers have registered", () => {
    render({
      requiresRegistrationForm: true,
      registrationCount: 8,
      docsCompleteCount: 3,
    });
    expect(screen.getByText("3/8 Docs Submitted")).toBeInTheDocument();
  });

  it("shows 0/N when no registrants have submitted the required doc yet", () => {
    render({
      requiresMedicalCert: true,
      registrationCount: 5,
      docsCompleteCount: 0,
    });
    expect(screen.getByText("0/5 Docs Submitted")).toBeInTheDocument();
  });
});
