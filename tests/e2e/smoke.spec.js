import { test, expect } from "@playwright/test";
import { E2E_CLIMB } from "./seed.js";

// The paths a visitor takes before signing in, end to end through the real
// router, services and Firestore (emulated).

test("the schedule lists open climbs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(E2E_CLIMB.title).first()).toBeVisible();
});

test("an event page shows the climb and asks visitors to sign in", async ({ page }) => {
  await page.goto(`/event/${E2E_CLIMB.id}`);
  await expect(page.getByRole("heading", { name: new RegExp(E2E_CLIMB.title) })).toBeVisible();
  await expect(page.getByText(/Sign in to access full event details/i)).toBeVisible();
});

test("members-only pages send visitors to sign in", async ({ page }) => {
  await page.goto("/my-registrations");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("an unknown route shows the not-found page", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByText(/not found|404/i).first()).toBeVisible();
});
