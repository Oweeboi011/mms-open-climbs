/**
 * Tests for the Admin Users Manage page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeAdminAuth } from "@/test/helpers";
import AdminUsersManage from "@/pages/admin/UsersManage";
import { onSnapshot } from "firebase/firestore";
import { makeQuerySnapshot } from "@/test/setup";

const userDoc = {
  id: "user-1",
  data: {
    displayName: "Juan Cruz",
    email: "climber@example.com",
    role: "member",
    createdAt: null,
  },
};
const userDoc2 = {
  id: "user-2",
  data: {
    displayName: "Maria Santos",
    email: "maria@example.com",
    role: "admin",
    createdAt: null,
  },
};

describe("Admin UsersManage", () => {
  beforeEach(() => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(makeQuerySnapshot([userDoc, userDoc2]));
      return vi.fn();
    });
  });

  it("renders the Users page heading", async () => {
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Users", { selector: ".admin-page-title" })).toBeInTheDocument(),
    );
  });

  it("lists users after data loads", async () => {
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() => {
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument();
      expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    });
  });

  it("shows role badges for each user", async () => {
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() => {
      expect(screen.getByText("member")).toBeInTheDocument();
      expect(screen.getByText("admin")).toBeInTheDocument();
    });
  });

  it("filters users by search input", async () => {
    const { container } = renderWithProviders(
      <AdminUsersManage />,
      makeAdminAuth(),
    );
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );

    const searchInput = container.querySelector("input");
    fireEvent.change(searchInput, { target: { value: "Maria" } });

    await waitFor(() => {
      expect(screen.queryByText("Juan Cruz")).not.toBeInTheDocument();
      expect(screen.getByText("Maria Santos")).toBeInTheDocument();
    });
  });

  it("opens the Add User modal when the button is clicked", async () => {
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Add User/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Create|Invite|Save/i }),
      ).toBeInTheDocument(),
    );
  });
});
