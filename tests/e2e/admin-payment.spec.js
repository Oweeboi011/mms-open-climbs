import { test, expect } from "@playwright/test";
import { E2E_CLIMB, createAdmin, putDoc } from "./seed.js";

// The admin path end to end: sign in as an admin, open a climb, verify a
// member's submitted payment, and see the verdict survive a reload — which
// proves the write got past the security rules, not just the local state.
// Desktop only: the registrant table is a desktop admin tool.

test("an admin verifies a submitted payment", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "admin registrant table is desktop-only");

  const run = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const email = `admin-${run}@example.com`;
  const password = "correct-horse-42";
  const member = `Pay Tester ${run}`;
  await createAdmin(email, password);
  await putDoc(`registrations/e2e-reg-${run}`, {
    climbId: E2E_CLIMB.id,
    climbTitle: E2E_CLIMB.title,
    userId: `member-${run}`,
    email: `member-${run}@example.com`,
    name: member,
    status: "pending",
    payments: [{ amount: 1500, proofs: [], submittedAt: new Date(), status: "submitted" }],
    paymentStatus: "submitted",
    amountPaid: 1500,
    createdAt: new Date(),
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).not.toHaveURL(/\/login/);

  const verify = page.getByRole("button", { name: /Verify Payment/ });
  // Expand the row through the name: other cells stop propagation so their
  // own controls work.
  const nameCell = page.locator("table.admin-table").getByText(member, { exact: true });
  await page.goto(`/admin/climbs/${E2E_CLIMB.id}`);
  await nameCell.click();
  await expect(verify).toBeEnabled();
  await verify.click();
  await expect(verify).toBeDisabled();

  await page.reload();
  await nameCell.click();
  await expect(verify).toBeDisabled();
});
