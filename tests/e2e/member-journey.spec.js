import { test, expect } from "@playwright/test";
import { E2E_CLIMB } from "./seed.js";

// The member path end to end: sign up, register for a climb, find it in My
// Climbs. Goes through AuthContext, the services layer and the security
// rules on the emulators — the parts unit tests mock away.

// The register form's labels aren't tied to their inputs, so find each
// control through its form group.
const field = (page, label) =>
  page
    .locator(".form-group", { has: page.locator("label", { hasText: label }) })
    .locator("input, textarea")
    .first();

test("a new member signs up, registers and sees the climb in My Climbs", async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Full Name").fill("Eve Tester");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-42");
  await page.getByLabel("Confirm Password").fill("correct-horse-42");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).not.toHaveURL(/\/signup/);

  await page.goto(`/register/${E2E_CLIMB.id}`);
  await field(page, "Mobile Number").fill("09171234567");
  await field(page, "Contact Name").fill("Pat Tester");
  await field(page, "Contact Mobile").fill("09179876543");
  await field(page, "Relationship").fill("Sibling");
  await page.locator('input[type="checkbox"]').nth(0).check();
  await page.locator('input[type="checkbox"]').nth(1).check();
  await page.getByPlaceholder("Type your complete legal name").fill("Eve Tester");
  await page.getByRole("button", { name: "Submit Registration" }).click();
  await page.getByRole("button", { name: /Confirm & Submit/ }).click();
  await expect(page.getByText("Registration Submitted!")).toBeVisible();

  await page.goto("/my-registrations");
  await expect(page.getByRole("heading", { name: "My Climbs" })).toBeVisible();
  await expect(page.getByText(E2E_CLIMB.title).first()).toBeVisible();
});
