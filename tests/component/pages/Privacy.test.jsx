import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers";
import Privacy from "@/pages/Privacy";
import { PRIVACY_NOTICE_VERSION } from "@/data/privacyNotice";

describe("Privacy page", () => {
  it("shows the notice sections and the version members consent to", () => {
    renderWithProviders(<Privacy />);
    expect(screen.getByRole("heading", { name: "Privacy Notice" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What we collect" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your rights" })).toBeInTheDocument();
    expect(screen.getByText(new RegExp(PRIVACY_NOTICE_VERSION))).toBeInTheDocument();
  });
});
