/**
 * Tests for LoadingSpinner and Footer components.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingSpinner from "@/components/LoadingSpinner";
import Footer from "@/components/Footer";

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

  it("renders the year reference", () => {
    render(<Footer />);
    expect(screen.getByText(/Open Climbs 2026/i)).toBeInTheDocument();
  });
});
