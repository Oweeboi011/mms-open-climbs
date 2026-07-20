/**
 * Tests for the Admin Users Manage page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders, makeAdminAuth } from "@tests/helpers";
import AdminUsersManage from "@/pages/admin/UsersManage";
import { onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { makeQuerySnapshot } from "@tests/setup";

// UsersManage.jsx creates its three callables in this fixed order at module
// load — grab handles to the actual mock fn instances so tests can control
// resolved/rejected values per call.
const updateUserProfileMock = httpsCallable.mock.results[1].value;
const deleteUserAccountMock = httpsCallable.mock.results[2].value;

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

  it("opens the user detail modal pre-filled with the current name and email", async () => {
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Juan Cruz"));
    await waitFor(() =>
      expect(screen.getByText("Edit Profile")).toBeInTheDocument(),
    );
    expect(screen.getByDisplayValue("Juan Cruz")).toBeInTheDocument();
    expect(screen.getByDisplayValue("climber@example.com")).toBeInTheDocument();
  });

  it("saves a corrected name and email via updateUserProfile", async () => {
    updateUserProfileMock.mockResolvedValueOnce({ data: { success: true } });
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Juan Cruz"));
    await waitFor(() =>
      expect(screen.getByDisplayValue("Juan Cruz")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByDisplayValue("Juan Cruz"), {
      target: { value: "Juan Dela Cruz" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Profile/i }));

    await waitFor(() =>
      expect(updateUserProfileMock).toHaveBeenCalledWith({
        uid: "user-1",
        displayName: "Juan Dela Cruz",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Profile updated/i)).toBeInTheDocument(),
    );
  });

  it("shows an error if updateUserProfile fails", async () => {
    updateUserProfileMock.mockRejectedValueOnce(
      new Error("Another account already uses this email address."),
    );
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Juan Cruz"));
    await waitFor(() =>
      expect(screen.getByDisplayValue("climber@example.com")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByDisplayValue("climber@example.com"), {
      target: { value: "dupe@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Profile/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/already uses this email address/i),
      ).toBeInTheDocument(),
    );
  });

  it("deletes a user's account after confirmation", async () => {
    window.confirm = vi.fn(() => true);
    deleteUserAccountMock.mockResolvedValueOnce({ data: { success: true } });
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Juan Cruz"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Delete Account/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Delete Account/i }));

    await waitFor(() =>
      expect(deleteUserAccountMock).toHaveBeenCalledWith({ uid: "user-1" }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Edit Profile")).not.toBeInTheDocument(),
    );
  });

  it("does not delete when the confirmation dialog is dismissed", async () => {
    window.confirm = vi.fn(() => false);
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getByText("Juan Cruz")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Juan Cruz"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Delete Account/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole("button", { name: /Delete Account/i }));
    expect(deleteUserAccountMock).not.toHaveBeenCalled();
  });

  it("prevents an admin from deleting their own account", async () => {
    onSnapshot.mockImplementation((_q, cb) => {
      cb(
        makeQuerySnapshot([
          userDoc,
          {
            id: "admin-1",
            data: {
              displayName: "Admin User",
              email: "admin@mms.ph",
              role: "admin",
              createdAt: null,
            },
          },
        ]),
      );
      return vi.fn();
    });
    renderWithProviders(<AdminUsersManage />, makeAdminAuth());
    await waitFor(() =>
      expect(screen.getAllByText(/Admin User/).length).toBeGreaterThan(0),
    );
    const rowNameEl = screen
      .getAllByText(/Admin User/)
      .find((el) => el.closest("tr"));
    fireEvent.click(rowNameEl);
    await waitFor(() =>
      expect(screen.getByText(/cannot delete your own account/i)).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /Delete Account/i }),
    ).not.toBeInTheDocument();
  });
});
