/**
 * Tests for the auth redirect helpers.
 *
 * These carry the "I was trying to register for this climb" intent across the
 * login/signup boundary. Losing it drops the visitor on the homepage with no
 * memory of why they made an account.
 */
import { describe, it, expect } from "vitest";
import { resolveRedirect, authLinkWithRedirect } from "@/utils/authRedirect";

describe("resolveRedirect", () => {
  it("prefers an explicit ?redirect= query param", () => {
    expect(
      resolveRedirect({ search: "?redirect=/register/abc", state: null }),
    ).toBe("/register/abc");
  });

  it("falls back to state.from pushed by ProtectedRoute", () => {
    expect(
      resolveRedirect({
        search: "",
        state: { from: { pathname: "/my-registrations" } },
      }),
    ).toBe("/my-registrations");
  });

  it("prefers the query param over state.from when both are present", () => {
    expect(
      resolveRedirect({
        search: "?redirect=/register/abc",
        state: { from: { pathname: "/my-registrations" } },
      }),
    ).toBe("/register/abc");
  });

  // `?redirect=` comes off the URL, so anyone can hand a member a link to
  // our own /login pointing anywhere. Sending them off-site straight after
  // they typed real credentials is the payoff a phishing chain is after.
  it.each([
    ["//evil.com"],
    ["\\/evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
    ["  https://evil.com"],
    ["evil.com"],
  ])("refuses the off-site redirect %j", (target) => {
    expect(
      resolveRedirect({ search: `?redirect=${encodeURIComponent(target)}`, state: null }),
    ).toBe("/");
  });

  it("still honours a genuine in-app path", () => {
    expect(
      resolveRedirect({ search: "?redirect=%2Fregister%2Fabc", state: null }),
    ).toBe("/register/abc");
  });

  it("falls back to state.from when the query redirect is unsafe", () => {
    expect(
      resolveRedirect({
        search: "?redirect=%2F%2Fevil.com",
        state: { from: { pathname: "/my-registrations" } },
      }),
    ).toBe("/my-registrations");
  });

  it("defaults to / when there is no pending intent", () => {
    expect(resolveRedirect({ search: "", state: null })).toBe("/");
  });
});

describe("authLinkWithRedirect", () => {
  it("carries the pending redirect across to the other auth page", () => {
    expect(authLinkWithRedirect("/signup", "/register/abc")).toBe(
      "/signup?redirect=%2Fregister%2Fabc",
    );
  });

  it("leaves the path bare when there is nothing to carry", () => {
    expect(authLinkWithRedirect("/signup", "/")).toBe("/signup");
    expect(authLinkWithRedirect("/login", "")).toBe("/login");
  });
});
