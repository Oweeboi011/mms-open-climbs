/**
 * Tests for LoadingSpinner and Footer components.
 */
import { describe, it, expect } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoadingSpinner from "@/components/LoadingSpinner";
import Footer from "@/components/Footer";

// Footer links to the privacy notice, so it needs a router.
function render(ui) {
  return rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("LoadingSpinner", () => {
  it("renders with 'Loading' text by default", () => {
    render(<LoadingSpinner />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("renders a full-page wrapper when fullPage is true", () => {
    const { container } = render(<LoadingSpinner fullPage />);
    expect(container.querySelector(".loader-fullpage")).toBeInTheDocument();
  });

  it("does not render full-page wrapper when fullPage is false", () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector(".loader-fullpage")).not.toBeInTheDocument();
  });
});

describe("Footer", () => {
  it("renders MMS organisation name", () => {
    render(<Footer />);
    expect(
      screen.getByText(/Metropolitan Mountaineering Society/i),
    ).toBeInTheDocument();
  });

  it("renders the programme name", () => {
    render(<Footer />);
    expect(screen.getAllByText(/Open Climbs/i).length).toBeGreaterThan(0);
  });
});

describe("Footer privacy link", () => {
  it("links to the privacy notice", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Privacy Notice" })).toHaveAttribute("href", "/privacy");
  });
});
