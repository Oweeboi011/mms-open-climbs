/**
 * Tests for NotificationBell component.
 */
import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import NotificationBell from "@/components/NotificationBell";
import {
  renderWithProviders,
  makeGuestAuth,
  makeMemberAuth,
} from "@tests/helpers";
import { onSnapshot, updateDoc } from "firebase/firestore";
import { makeQuerySnapshot } from "@tests/setup";

function notif(overrides = {}) {
  return {
    id: "n1",
    userId: "user-1",
    type: "payment_reminder",
    title: "Payment pending",
    message: "Please submit your GCash proof.",
    link: "/my-registrations",
    read: false,
    createdAt: { toDate: () => new Date(Date.now() - 5 * 60 * 1000) },
    ...overrides,
  };
}

describe("NotificationBell — guest", () => {
  it("renders nothing when signed out", () => {
    const { container } = renderWithProviders(
      <NotificationBell />,
      makeGuestAuth(),
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("NotificationBell — member", () => {
  it("shows the bell button with no unread badge when there are no notifications", () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([]));
      return vi.fn();
    });
    renderWithProviders(<NotificationBell />, makeMemberAuth());
    expect(
      screen.getByRole("button", { name: /notifications/i }),
    ).toBeInTheDocument();
  });

  it("shows an unread count badge", () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([{ id: "n1", data: notif() }]));
      return vi.fn();
    });
    renderWithProviders(<NotificationBell />, makeMemberAuth());
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("caps the badge at 9+", () => {
    onSnapshot.mockImplementation((_q, cb) => {
      const docs = Array.from({ length: 12 }, (_, i) => ({
        id: `n${i}`,
        data: notif({ id: `n${i}` }),
      }));
      cb(makeQuerySnapshot(docs));
      return vi.fn();
    });
    renderWithProviders(<NotificationBell />, makeMemberAuth());
    expect(screen.getByText("9+")).toBeInTheDocument();
  });

  it("opens the panel and shows the empty state", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([]));
      return vi.fn();
    });
    renderWithProviders(<NotificationBell />, makeMemberAuth());
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() =>
      expect(screen.getByText(/all caught up/i)).toBeInTheDocument(),
    );
  });

  it("lists notifications and marks one read on click, following its link", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([{ id: "n1", data: notif() }]));
      return vi.fn();
    });
    renderWithProviders(<NotificationBell />, makeMemberAuth());
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() =>
      expect(screen.getByText("Payment pending")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Payment pending"));
    await waitFor(() => expect(updateDoc).toHaveBeenCalled());
  });

  it("marks all as read via the Mark all read button", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          { id: "n1", data: notif({ id: "n1" }) },
          { id: "n2", data: notif({ id: "n2", title: "Second" }) },
        ]),
      );
      return vi.fn();
    });
    renderWithProviders(<NotificationBell />, makeMemberAuth());
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() =>
      expect(screen.getByText(/mark all read/i)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText(/mark all read/i));
    await waitFor(() => expect(updateDoc).toHaveBeenCalledTimes(2));
  });

  it("does not re-mark an already-read notification", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([{ id: "n1", data: notif({ read: true }) }]));
      return vi.fn();
    });
    renderWithProviders(<NotificationBell />, makeMemberAuth());
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() =>
      expect(screen.getByText("Payment pending")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Payment pending"));
    await waitFor(() => expect(updateDoc).not.toHaveBeenCalled());
  });

  it("closes the panel when clicking outside", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([]));
      return vi.fn();
    });
    renderWithProviders(<NotificationBell />, makeMemberAuth());
    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    await waitFor(() =>
      expect(screen.getByText(/all caught up/i)).toBeInTheDocument(),
    );
    fireEvent.mouseDown(document.body);
    await waitFor(() =>
      expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument(),
    );
  });
});
