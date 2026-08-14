/**
 * Tests for download-name building — the characters Windows rejects are the
 * whole point, so they're covered directly rather than through a page.
 */
import { describe, it, expect } from "vitest";
import {
  sanitizeFileNamePart,
  slugifyFileName,
  makeDatedDownloadName,
} from "@/utils/downloadFileName";

describe("sanitizeFileNamePart", () => {
  it("keeps an already-safe name untouched", () => {
    expect(sanitizeFileNamePart("Juan Cruz")).toBe("Juan Cruz");
  });

  it("replaces every character Windows rejects", () => {
    expect(sanitizeFileNamePart('a\\b/c:d*e?f"g<h>i|j')).toBe(
      "a_b_c_d_e_f_g_h_i_j",
    );
  });

  it("collapses runs of whitespace", () => {
    expect(sanitizeFileNamePart("Mt.   Pulag   Traverse")).toBe(
      "Mt. Pulag Traverse",
    );
  });

  it("drops leading and trailing dots and spaces", () => {
    expect(sanitizeFileNamePart("  .Mt. Pulag.  ")).toBe("Mt. Pulag");
  });

  it("falls back when nothing usable is left", () => {
    expect(sanitizeFileNamePart("...", "registrant-3")).toBe("registrant-3");
    expect(sanitizeFileNamePart(null, "registrant-3")).toBe("registrant-3");
    expect(sanitizeFileNamePart(undefined)).toBe("file");
  });
});

describe("slugifyFileName", () => {
  it("hyphenates spaces and dots without doubling separators", () => {
    expect(slugifyFileName("Mt. Pulag")).toBe("Mt-Pulag");
  });

  it("slugifies a title carrying illegal characters", () => {
    expect(slugifyFileName("Mt. Apo: Kapatagan/Traverse")).toBe(
      "Mt-Apo_-Kapatagan_Traverse",
    );
  });

  it("falls back when the value slugifies to nothing", () => {
    expect(slugifyFileName("  ", "climb")).toBe("climb");
  });
});

describe("makeDatedDownloadName", () => {
  it("joins slug, suffix, local date and extension", () => {
    expect(
      makeDatedDownloadName(
        "Mt. Pulag",
        "requirement-docs",
        "zip",
        new Date(2026, 7, 14),
      ),
    ).toBe("Mt-Pulag-requirement-docs-2026-08-14.zip");
  });

  it("zero-pads single-digit months and days", () => {
    expect(
      makeDatedDownloadName("Climb", "docs", "zip", new Date(2026, 0, 5)),
    ).toBe("Climb-docs-2026-01-05.zip");
  });
});
