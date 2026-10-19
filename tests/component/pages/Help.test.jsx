import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderWithProviders, makeGuestAuth, makeMemberAuth, makeAdminAuth } from "@tests/helpers";
import Help from "@/pages/Help";
import { HELP_GUIDES } from "@/data/helpGuides";

describe("Help page", () => {
  it("shows every member guide, with a contents link to each", () => {
    renderWithProviders(<Help />, makeGuestAuth());
    const toc = screen.getByRole("navigation", { name: "Guides" });
    HELP_GUIDES.filter((g) => !g.adminOnly).forEach((guide) => {
      expect(screen.getByRole("heading", { name: guide.title })).toBeInTheDocument();
      expect(within(toc).getByRole("link", { name: guide.title })).toHaveAttribute("href", `#${guide.id}`);
    });
  });

  it("keeps the admin guide from members", () => {
    renderWithProviders(<Help />, makeMemberAuth());
    expect(screen.queryByRole("heading", { name: "For admins" })).not.toBeInTheDocument();
  });

  it("shows admins their guide", () => {
    renderWithProviders(<Help />, makeAdminAuth());
    expect(screen.getByRole("heading", { name: "For admins" })).toBeInTheDocument();
    expect(screen.getByText("Mark received offline", { selector: "strong" })).toBeInTheDocument();
  });

  it("renders button names in bold", () => {
    renderWithProviders(<Help />, makeGuestAuth());
    expect(screen.getByText("Register Now", { selector: "strong" })).toBeInTheDocument();
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });
});
