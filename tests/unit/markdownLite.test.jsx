import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderMarkdown, renderMarkdownLite } from "@/utils/markdownLite";

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

  it("renders [label](url) as a new-tab link", () => {
    render(
      <div>{renderMarkdownLite("Pay via [the portal](https://example.com/pay).")}</div>,
    );
    const link = screen.getByRole("link", { name: "the portal" });
    expect(link).toHaveAttribute("href", "https://example.com/pay");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps underscores inside link URLs instead of reading them as italics", () => {
    const url = "https://maps.example.com/?place=ChIJfRD_5GNt-TIRkM7O_9OjMjA";
    const { container } = render(
      <div>{renderMarkdownLite(`[Bulcachong](${url}) near Poblacion`)}</div>,
    );
    expect(screen.getByRole("link", { name: "Bulcachong" })).toHaveAttribute(
      "href",
      url,
    );
    expect(container.querySelector("em")).toBeNull();
  });

  it("does not italicise snake_case words", () => {
    const { container } = render(
      <div>{renderMarkdownLite("Email juan_dela_cruz@example.com")}</div>,
    );
    expect(container.querySelector("em")).toBeNull();
    expect(container).toHaveTextContent("juan_dela_cruz@example.com");
  });

  it("does not link unsafe URL schemes", () => {
    render(<div>{renderMarkdownLite("[click](javascript:alert(1))")}</div>);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders link labels without anchors when links are disabled", () => {
    render(
      <div>
        {renderMarkdownLite("See [details](https://example.com)", {
          links: false,
        })}
      </div>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("details")).toBeInTheDocument();
  });

  it("bolds text with spaces just inside the markers", () => {
    render(<div>{renderMarkdownLite("** MEALS **")}</div>);
    expect(screen.getByText("MEALS").tagName).toBe("STRONG");
  });
});

describe("renderMarkdown", () => {
  it("returns null for empty input", () => {
    expect(renderMarkdown("")).toBeNull();
  });

  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    const { container } = render(
      <div>{renderMarkdown("First line\nsecond line\n\nNew paragraph")}</div>,
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector("br")).not.toBeNull();
  });

  it("renders - and 1. lines as lists", () => {
    const { container } = render(
      <div>{renderMarkdown("- Tent\n- Stove\n\n1. Day 0\n2. Day 3")}</div>,
    );
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
  });

  it("renders # headings, bold-only lines as subheadings, and --- dividers", () => {
    const { container } = render(
      <div>{renderMarkdown("# Advisory\n\n** 🍽️ MEALS **\n\nDetails\n\n---\n\nMore")}</div>,
    );
    expect(container.querySelector("h4")).toHaveTextContent("Advisory");
    expect(container.querySelector("h5")).toHaveTextContent("🍽️ MEALS");
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("renders pipe tables with a header row", () => {
    const { container } = render(
      <div>
        {renderMarkdown(
          "| Item | Cost |\n|---|---|\n| Hike Package | Php 6,500 |\n| **TOTAL** | **Php 7,360** |",
        )}
      </div>,
    );
    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(screen.getByText("Php 7,360").tagName).toBe("STRONG");
    expect(container).not.toHaveTextContent("|");
  });

  it("does not treat a bold line starting with ** as a list item", () => {
    const { container } = render(
      <div>{renderMarkdown("**Day 2 (Sept 20)**\n- Breakfast: Eggs")}</div>,
    );
    expect(container.querySelector("h5")).toHaveTextContent("Day 2 (Sept 20)");
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });
});
