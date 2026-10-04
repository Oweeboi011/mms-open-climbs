/**
 * Automated WCAG checks (axe-core) on the screens most visitors and members
 * land on. Catches missing labels, names, roles and ARIA misuse; colour
 * contrast needs a real browser and is out of scope here.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { getDoc, getDocs } from "firebase/firestore";
import { renderWithProviders, renderAtRoute, makeGuestAuth, climbFixture } from "@tests/helpers";
import { makeSnapshot, makeQuerySnapshot } from "@tests/setup";
import { a11yViolations } from "./axe";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import Schedule from "@/pages/Schedule";
import Event from "@/pages/Event";
import Modal from "@/components/Modal";

describe("accessibility", () => {
  it.each([
    ["Login", Login],
    ["Signup", Signup],
    ["ForgotPassword", ForgotPassword],
  ])("%s form has no axe violations", async (_name, Page) => {
    const { container } = renderWithProviders(<Page />, makeGuestAuth());
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("the public schedule has no axe violations", async () => {
    getDocs.mockResolvedValue(makeQuerySnapshot([{ id: climbFixture.id, data: climbFixture }]));
    const { container } = renderWithProviders(<Schedule />, makeGuestAuth());
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("an event page has no axe violations", async () => {
    getDoc.mockResolvedValue(makeSnapshot(climbFixture.id, climbFixture));
    const { container } = renderAtRoute(<Event />, "/event/:climbId", `/event/${climbFixture.id}`);
    await screen.findAllByText(climbFixture.title);
    expect(await a11yViolations(container)).toEqual([]);
  });

  it("the shared modal shell has no axe violations", async () => {
    const { container } = render(
      <Modal onClose={() => {}} label="Example dialog">
        <button>Close</button>
      </Modal>,
    );
    expect(await a11yViolations(container)).toEqual([]);
  });
});
