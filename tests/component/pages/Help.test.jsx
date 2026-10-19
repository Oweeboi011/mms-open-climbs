import { describe, it, expect } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeGuestAuth, makeMemberAuth, makeAdminAuth } from "@tests/helpers";
import Help from "@/pages/Help";
import { HELP_GUIDES } from "@/data/helpGuides";

const memberGuides = HELP_GUIDES.filter((g) => !g.adminOnly);
const adminGuides = HELP_GUIDES.filter((g) => g.adminOnly);

describe("Help page", () => {
  it("shows every member guide, with a contents link to each", () => {
    renderWithProviders(<Help />, makeGuestAuth());
    const toc = screen.getByRole("navigation", { name: "Guides" });
    memberGuides.forEach((guide) => {
      expect(screen.getByRole("heading", { name: guide.title })).toBeInTheDocument();
      expect(within(toc).getByRole("link", { name: guide.title })).toHaveAttribute("href", `#${guide.id}`);
    });
  });

  it("keeps the admin guides from members", () => {
    renderWithProviders(<Help />, makeMemberAuth());
    adminGuides.forEach((guide) => {
      expect(screen.queryByRole("heading", { name: guide.title })).not.toBeInTheDocument();
    });
  });

  it("shows admins their guides", () => {
    renderWithProviders(<Help />, makeAdminAuth());
    adminGuides.forEach((guide) => {
      expect(screen.getByRole("heading", { name: guide.title })).toBeInTheDocument();
    });
    expect(screen.getAllByText("Mark received offline", { selector: "strong" }).length).toBeGreaterThan(0);
  });

  it("renders button names in bold and sub-steps as a list", () => {
    renderWithProviders(<Help />, makeGuestAuth());
    expect(screen.getAllByText("Register Now", { selector: "strong" }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
    const myClimbs = screen.getByRole("heading", { name: "Using My Climbs" }).closest("section");
    expect(within(myClimbs).getByText("View OR", { selector: "strong" })).toBeInTheDocument();
  });

  it("narrows the guides to a search, and says when nothing matches", () => {
    renderWithProviders(<Help />, makeGuestAuth());
    const search = screen.getByLabelText("Search the guides");
    fireEvent.change(search, { target: { value: "gcash" } });
    expect(screen.getByRole("heading", { name: "Paying with GCash" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Glossary" })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzqqxx" } });
    expect(screen.getByText(/No guides mention/)).toBeInTheDocument();
  });

  it("gives every guide a unique id and a group", () => {
    const ids = HELP_GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    HELP_GUIDES.forEach((g) => expect(g.group).toBeTruthy());
  });
});
