import { describe, it, expect, afterEach } from "vitest";
import { screen, within, fireEvent } from "@testing-library/react";
import { renderWithProviders, makeGuestAuth, makeMemberAuth, makeAdminAuth } from "@tests/helpers";
import Help from "@/pages/Help";
import { HELP_GUIDES, HELP_TABS } from "@/data/helpGuides";

const guidesIn = (group) => HELP_GUIDES.filter((g) => g.group === group);
const tab = (name) => screen.getByRole("tab", { name });

afterEach(() => window.history.replaceState(null, "", "/"));

describe("Help page", () => {
  it("opens on the Everyone tab, listing its guides with a link to each", () => {
    renderWithProviders(<Help />, makeGuestAuth());
    expect(tab("Everyone")).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    guidesIn("Everyone").forEach((guide) => {
      expect(within(panel).getByRole("heading", { name: guide.title })).toBeInTheDocument();
      expect(within(panel).getByRole("link", { name: guide.title })).toHaveAttribute("href", `#${guide.id}`);
    });
    expect(within(panel).queryByRole("heading", { name: "Paying with GCash" })).not.toBeInTheDocument();
  });

  it("switches tabs, showing only that tab's guides", () => {
    renderWithProviders(<Help />, makeMemberAuth());
    fireEvent.click(tab("Members"));
    expect(tab("Members")).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    guidesIn("Members").forEach((guide) => {
      expect(within(panel).getByRole("heading", { name: guide.title })).toBeInTheDocument();
    });
    expect(within(panel).getAllByText("View OR", { selector: "strong" }).length).toBeGreaterThan(0);
    expect(within(panel).queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it("moves between tabs with the arrow keys", () => {
    renderWithProviders(<Help />, makeGuestAuth());
    fireEvent.keyDown(tab("Everyone"), { key: "ArrowRight" });
    expect(tab("Members")).toHaveAttribute("aria-selected", "true");
    expect(tab("Members")).toHaveFocus();
    fireEvent.keyDown(tab("Members"), { key: "ArrowLeft" });
    expect(tab("Everyone")).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the Admins tab from members", () => {
    renderWithProviders(<Help />, makeMemberAuth());
    expect(screen.queryByRole("tab", { name: "Admins" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(HELP_TABS.filter((t) => !t.adminOnly).length);
  });

  it("gives admins every admin activity, and opens it from /help#admins", () => {
    window.history.replaceState(null, "", "/help#admins");
    renderWithProviders(<Help />, makeAdminAuth());
    expect(tab("Admins")).toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel");
    guidesIn("Admins").forEach((guide) => {
      expect(within(panel).getByRole("heading", { name: guide.title })).toBeInTheDocument();
    });
    expect(guidesIn("Admins").length).toBeGreaterThanOrEqual(15);
  });

  it("opens the tab holding a guide linked directly, like /help#paying", () => {
    window.history.replaceState(null, "", "/help#paying");
    renderWithProviders(<Help />, makeGuestAuth());
    expect(tab("Members")).toHaveAttribute("aria-selected", "true");
  });

  it("searches every tab at once, and says when nothing matches", () => {
    renderWithProviders(<Help />, makeAdminAuth());
    const search = screen.getByLabelText("Search the guides");
    fireEvent.change(search, { target: { value: "offline" } });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Signing and printing your waiver" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chasing waivers, details and documents" })).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzqqxx" } });
    expect(screen.getByRole("status")).toHaveTextContent("No guides mention");
  });

  it("gives every guide a unique id and a tab", () => {
    const ids = HELP_GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    const groups = new Set(HELP_TABS.map((t) => t.group));
    HELP_GUIDES.forEach((g) => expect(groups.has(g.group)).toBe(true));
  });
});
