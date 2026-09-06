import { describe, it, expect } from "vitest";
import {
  contactHref,
  contactLabel,
  resolveContactHref,
  resolveContactLabel,
} from "@/data/orgContact";

describe("orgContact resolver", () => {
  it("builds a mailto with an encoded subject when an email is set", () => {
    expect(
      resolveContactHref({ email: "hi@example.org" }, "Question about Mt. X"),
    ).toBe("mailto:hi@example.org?subject=Question%20about%20Mt.%20X");
  });

  it("omits the subject when none is given", () => {
    expect(resolveContactHref({ email: "hi@example.org" })).toBe(
      "mailto:hi@example.org",
    );
  });

  it("falls back to a plain URL, then null", () => {
    expect(resolveContactHref({ url: "https://fb.com/mms" })).toBe(
      "https://fb.com/mms",
    );
    expect(resolveContactHref({})).toBeNull();
  });

  it("labels with whatever is configured, else the coordinator", () => {
    expect(resolveContactLabel({ email: "hi@example.org" })).toBe(
      "hi@example.org",
    );
    expect(resolveContactLabel({ url: "https://fb.com/mms" })).toBe(
      "https://fb.com/mms",
    );
    expect(resolveContactLabel({})).toBe("your MMS Open Climbs Coordinator");
  });
});

// Ships with both constants blank — the UI must degrade to plain text.
describe("orgContact (unconfigured)", () => {
  it("returns no href and the plain coordinator label", () => {
    expect(contactHref("anything")).toBeNull();
    expect(contactLabel()).toBe("your MMS Open Climbs Coordinator");
  });
});
