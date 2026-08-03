import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderMarkdownLite } from "@/utils/markdownLite";

describe("renderMarkdownLite", () => {
  it("returns plain text unchanged when there is no markup", () => {
    render(<div>{renderMarkdownLite("No formatting here.")}</div>);
    expect(screen.getByText("No formatting here.")).toBeInTheDocument();
  });

  it("renders **bold** text inside a <strong>", () => {
    render(<div>{renderMarkdownLite("Bring **extra water** tomorrow.")}</div>);
    const strong = screen.getByText("extra water");
    expect(strong.tagName).toBe("STRONG");
  });

  it("renders *italic* text inside an <em>", () => {
    render(<div>{renderMarkdownLite("Meet at *6am sharp*.")}</div>);
    const em = screen.getByText("6am sharp");
    expect(em.tagName).toBe("EM");
  });

  it("renders _italic_ text inside an <em>", () => {
    render(<div>{renderMarkdownLite("Meet at _6am sharp_.")}</div>);
    const em = screen.getByText("6am sharp");
    expect(em.tagName).toBe("EM");
  });

  it("handles multiple bold/italic segments in the same string", () => {
    render(
      <div>{renderMarkdownLite("**Departure** moved to *7am* sharp.")}</div>,
    );
    expect(screen.getByText("Departure").tagName).toBe("STRONG");
    expect(screen.getByText("7am").tagName).toBe("EM");
  });

  it("returns falsy input unchanged", () => {
    expect(renderMarkdownLite("")).toBe("");
    expect(renderMarkdownLite(undefined)).toBe(undefined);
  });
});
