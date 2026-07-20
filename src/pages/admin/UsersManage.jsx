import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingSpinner from "@/components/LoadingSpinner";

const createUserFn = httpsCallable(functions, "createUser");
const updateUserProfileFn = httpsCallable(functions, "updateUserProfile");
const deleteUserAccountFn = httpsCallable(functions, "deleteUserAccount");

const CREATE_USER_ERROR_INFO = {
  "already-exists": {
    title: "Account Already Exists",
    message: "An account with this email address already exists in the system.",
    nextStep:
      "Check the Users list to see if this person is already registered. If they can't log in, ask them to use \"Forgot Password\" on the login page instead of creating a new account.",
  },
  "permission-denied": {
    title: "Not Authorized",
    message: "Only admin accounts are allowed to create new users.",
    nextStep:
      "Confirm your account has the admin role. If you believe this is a mistake, ask another admin to check your role under Users management.",
  },
  "invalid-argument": {
    title: "Missing Information",
    message: "Email address and full name are both required to create an account.",
    nextStep: "Fill in both fields and try submitting again.",
  },
  unauthenticated: {
    title: "Session Expired",
    message: "You are no longer signed in.",
    nextStep: "Log out and log back in, then try creating the account again.",
  },
  unavailable: {
    title: "Connection Problem",
    message: "Couldn't reach the server to create this account.",
    nextStep: "Check your internet connection and try again in a moment.",
  },
  "deadline-exceeded": {
    title: "Request Timed Out",
    message: "The server took too long to respond.",
    nextStep: "Try again. If it keeps timing out, contact tech support.",
  },
  internal: {
    title: "Server Error",
    message: "Something went wrong on the server while creating this account.",
    nextStep:
      "Wait a moment and try again. If the problem continues, contact tech support and mention the email address you were trying to add.",
  },
};

function describeCreateUserError(err) {
  const code = (err?.code || "").replace(/^functions\//, "");
  const known = CREATE_USER_ERROR_INFO[code];
  if (known) return { ...known, raw: err?.message };
  return {
    title: "Something Went Wrong",
    message: err?.message || "An unexpected error occurred.",
    nextStep:
      "Try again. If this keeps happening, contact tech support with a description of what you were doing.",
    raw: err?.message,
  };
}

const ROLE_STYLE = {
  admin: {
    background: "#fef3c7",
    color: "#92400e",
    border: "1px solid #fcd34d",
  },
  member: {
    background: "#e8f5e9",
    color: "#1a6b2c",
    border: "1px solid #a7d7b2",
  },
};

function RoleBadge({ role }) {
  const s = ROLE_STYLE[role] || ROLE_STYLE.member;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 12px",
        borderRadius: 99,
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: 0.5,
        ...s,
      }}
    >
      {role}
    </span>
  );
}

export default function AdminUsersManage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [roleChanging, setRoleChanging] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileOk, setProfileOk] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [newUser, setNewUser] = useState({
    email: "",
    displayName: "",
    role: "member",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createOk, setCreateOk] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) =>
            (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
        );
      setUsers(sorted);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function changeRole(uid, newRole, user) {
    if (uid === currentUser?.uid) {
      setRoleError("You cannot change your own role.");
      return;
    }
    if (newRole === user.role) return;
    setRoleChanging(true);
    setRoleError("");
    try {
      await updateDoc(doc(db, "users", uid), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      setSelectedUser((p) => ({ ...p, role: newRole }));
    } catch (err) {
      setRoleError("Failed to update role: " + err.message);
    } finally {
      setRoleChanging(false);
    }
  }

  function openUser(user) {
    setSelectedUser(user);
    setEditRole(user.role);
    setRoleError("");
    setEditName(user.displayName || "");
    setEditEmail(user.email || "");
    setProfileError("");
    setProfileOk("");
    setDeleteError("");
  }

  function closeUserModal() {
    setSelectedUser(null);
    setEditRole("");
    setRoleError("");
    setEditName("");
    setEditEmail("");
    setProfileError("");
    setProfileOk("");
    setDeleteError("");
  }

  async function saveRole() {
    if (!selectedUser) return;
    await changeRole(selectedUser.id, editRole, selectedUser);
  }

  async function saveProfile() {
    if (!selectedUser) return;
    const nameChanged = editName.trim() && editName.trim() !== selectedUser.displayName;
    const emailChanged = editEmail.trim() && editEmail.trim() !== selectedUser.email;
    if (!nameChanged && !emailChanged) return;

    setProfileSaving(true);
    setProfileError("");
    setProfileOk("");
    try {
      await updateUserProfileFn({
        uid: selectedUser.id,
        ...(nameChanged ? { displayName: editName.trim() } : {}),
        ...(emailChanged ? { email: editEmail.trim() } : {}),
      });
      setSelectedUser((p) => ({
        ...p,
        ...(nameChanged ? { displayName: editName.trim() } : {}),
        ...(emailChanged ? { email: editEmail.trim() } : {}),
      }));
      setProfileOk("Profile updated.");
    } catch (err) {
      setProfileError(err?.message || "Failed to update profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function deleteUser() {
    if (!selectedUser) return;
    if (
      !window.confirm(
        `Delete the account for "${selectedUser.displayName || selectedUser.email}"? This permanently removes their login and profile. This cannot be undone.`,
      )
    )
      return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteUserAccountFn({ uid: selectedUser.id });
      closeUserModal();
    } catch (err) {
      setDeleteError(err?.message || "Failed to delete user.");
      setDeleting(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreateError(null);
    setCreateOk("");
    setCreating(true);
    try {
      const result = await createUserFn(newUser);
      const emailSent = result.data?.emailSent !== false;
      setCreateOk(
        emailSent
          ? `Account created for ${newUser.email}. A welcome email with setup link has been sent.`
          : `Account created for ${newUser.email}, but the welcome email could not be sent. Ask the user to use "Forgot Password" to set their password.`,
      );
      setNewUser({ email: "", displayName: "", role: "member" });
    } catch (err) {
      setCreateError(describeCreateUserError(err));
    } finally {
      setCreating(false);
    }
  }

  const filtered = users.filter(
    (u) =>
      !search ||
      u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="admin-layout">
      <Header />
      <main className="admin-main">
        <div className="admin-breadcrumb">
          <Link to="/admin">Dashboard</Link>
          <span className="admin-breadcrumb-sep">/</span>
          <span>Users</span>
        </div>
        <div className="admin-page-header">
          <div>
            <div className="admin-page-title">Users</div>
            <div className="admin-page-subtitle">
              {users.length} registered user{users.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/admin" className="btn btn-outline btn-sm">
              &larr; Back to Admin
            </Link>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowAddModal(true);
                setCreateError(null);
                setCreateOk("");
              }}
              title="Create a new user account and send them a welcome email"
            >
              + Add User
            </button>
          </div>
        </div>

        {/* ── Add User Modal ── */}
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "var(--radius-lg)",
                padding: 32,
                width: "100%",
                maxWidth: 440,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <h2
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "1.3rem",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 20,
                  color: "var(--green-dark)",
                }}
              >
                Add New User
              </h2>
              {createOk && (
                <div className="alert alert-success">{createOk}</div>
              )}
              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label className="form-label required">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    value={newUser.displayName}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, displayName: e.target.value }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label required">Role</label>
                  <select
                    className="form-select"
                    required
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((p) => ({ ...p, role: e.target.value }))
                    }
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <div className="form-hint">
                    The user will receive an email with a link to set their
                    password.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={creating}
                    title="Create the account and send the user a password setup email"
                  >
                    {creating ? "Sending…" : "Create & Send Invite"}
                  </button>
                  <button
                    className="btn btn-outline"
                    type="button"
                    title="Close this dialog without creating a user"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Create User Error Modal ── */}
        {createError && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setCreateError(null)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "var(--radius-lg)",
                padding: 32,
                width: "100%",
                maxWidth: 420,
                boxShadow: "var(--shadow-lg)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: "1.15rem",
                  fontWeight: 900,
                  letterSpacing: 1,
                  marginBottom: 14,
                  color: "#b91c1c",
                }}
              >
                {createError.title}
              </h2>
              <p style={{ fontSize: "0.9rem", marginBottom: 14 }}>
                {createError.message}
              </p>
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "12px 14px",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 4,
                  }}
                >
                  Next Step
                </div>
                <div style={{ fontSize: "0.85rem" }}>
                  {createError.nextStep}
                </div>
              </div>
              {createError.raw && (
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--ink-soft)",
                    marginBottom: 20,
                    fontFamily: "monospace",
                    wordBreak: "break-word",
                  }}
                >
                  {createError.raw}
                </div>
              )}
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => setCreateError(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* ── User Detail Modal ── */}
        {selectedUser && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={closeUserModal}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "var(--radius-lg)",
                padding: 32,
                width: "100%",
                maxWidth: 460,
                boxShadow: "var(--shadow-lg)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: "var(--green-dark)",
                    color: "#f0c800",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: "1.3rem",
                    fontFamily: "var(--font-head)",
                  }}
                >
                  {(selectedUser.displayName ||
                    selectedUser.email ||
                    "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                    {selectedUser.displayName}
                    {selectedUser.id === currentUser?.uid && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "0.65rem",
                          background: "var(--surface-alt)",
                          border: "1px solid var(--border)",
                          borderRadius: 99,
                          padding: "2px 8px",
                          color: "var(--ink-soft)",
                          fontWeight: 700,
                          letterSpacing: 1,
                          verticalAlign: "middle",
                        }}
                      >
                        YOU
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--ink-soft)",
                      marginTop: 2,
                    }}
                  >
                    {selectedUser.email}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <RoleBadge role={selectedUser.role} />
                  </div>
                </div>
                <button
                  onClick={closeUserModal}
                  title="Close this panel"
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.2rem",
                    cursor: "pointer",
                    color: "var(--ink-soft)",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Details */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px 20px",
                  marginBottom: 22,
                  padding: "14px 16px",
                  background: "var(--surface)",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--ink-soft)",
                      marginBottom: 2,
                    }}
                  >
                    Added By
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    {selectedUser.addedBy === "self"
                      ? "Self-registered"
                      : "Admin"}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--ink-soft)",
                      marginBottom: 2,
                    }}
                  >
                    Joined
                  </div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    {selectedUser.createdAt
                      ?.toDate?.()
                      .toLocaleDateString("en-PH") || "—"}
                  </div>
                </div>
              </div>

              {/* Edit Profile */}
              <div style={{ marginBottom: 22 }}>
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 8,
                  }}
                >
                  Edit Profile
                </div>
                {profileError && (
                  <div className="alert alert-error" style={{ marginBottom: 10 }}>
                    {profileError}
                  </div>
                )}
                {profileOk && (
                  <div className="alert alert-success" style={{ marginBottom: 10 }}>
                    {profileOk}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                  <div className="form-hint">
                    Updates the login email and Firestore profile together.
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={
                    profileSaving ||
                    (editName.trim() === (selectedUser.displayName || "") &&
                      editEmail.trim() === (selectedUser.email || ""))
                  }
                  title="Save the corrected name and/or email"
                  onClick={saveProfile}
                >
                  {profileSaving ? "Saving…" : "Save Profile"}
                </button>
              </div>

              {/* Role Change */}
              {selectedUser.id === currentUser?.uid ? (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "#fef9e7",
                    border: "1px solid #fcd34d",
                    borderRadius: 8,
                    fontSize: "0.82rem",
                    color: "#92400e",
                  }}
                >
                  You cannot change your own role.
                </div>
              ) : (
                <div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      color: "var(--ink-soft)",
                      marginBottom: 8,
                    }}
                  >
                    Change Role
                  </div>
                  {roleError && (
                    <div
                      className="alert alert-error"
                      style={{ marginBottom: 10 }}
                    >
                      {roleError}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {["member", "admin"].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setEditRole(r)}
                        style={{
                          padding: "8px 20px",
                          borderRadius: 99,
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          ...(editRole === r
                            ? {
                                ...(ROLE_STYLE[r] || ROLE_STYLE.member),
                                border: `2px solid ${r === "admin" ? "#f59e0b" : "#1a6b2c"}`,
                              }
                            : {
                                background: "var(--surface)",
                                color: "var(--ink-soft)",
                                border: "2px solid var(--border)",
                              }),
                        }}
                      >
                        {r}
                      </button>
                    ))}
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={editRole === selectedUser.role || roleChanging}
                      title="Save the new role for this user"
                      onClick={saveRole}
                      style={{ marginLeft: "auto" }}
                    >
                      {roleChanging ? "Saving…" : "Save Role"}
                    </button>
                  </div>
                  {editRole !== selectedUser.role && (
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: "0.78rem",
                        color: "var(--ink-soft)",
                        fontStyle: "italic",
                      }}
                    >
                      {editRole === "admin"
                        ? "This user will gain full admin access to all climbs, registrations, payments, and users."
                        : "This user will lose admin access immediately."}
                    </div>
                  )}
                </div>
              )}

              {/* Delete Account */}
              <div
                style={{
                  marginTop: 22,
                  paddingTop: 16,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginBottom: 8,
                  }}
                >
                  Danger Zone
                </div>
                {deleteError && (
                  <div className="alert alert-error" style={{ marginBottom: 10 }}>
                    {deleteError}
                  </div>
                )}
                {selectedUser.id === currentUser?.uid ? (
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--ink-soft)",
                    }}
                  >
                    You cannot delete your own account.
                  </div>
                ) : (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={deleting}
                    title="Permanently delete this user's login and profile"
                    onClick={deleteUser}
                  >
                    {deleting ? "Deleting…" : "🗑 Delete Account"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="admin-search">
          <input
            type="search"
            className="form-input"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th style={{ width: "1%" }}>Role</th>
                  <th style={{ width: "1%" }}>Added By</th>
                  <th style={{ width: "1%" }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: "center", color: "var(--ink-soft)" }}
                    >
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((user) => {
                    const isSelf = user.id === currentUser?.uid;
                    return (
                      <tr
                        key={user.id}
                        style={{ cursor: "pointer" }}
                        onClick={() => openUser(user)}
                      >
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {user.displayName}
                            {isSelf && (
                              <span
                                style={{
                                  marginLeft: 6,
                                  fontSize: "0.65rem",
                                  background: "var(--surface-alt)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 99,
                                  padding: "1px 7px",
                                  color: "var(--ink-soft)",
                                  fontWeight: 700,
                                  letterSpacing: 1,
                                }}
                              >
                                YOU
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--ink-soft)",
                            }}
                          >
                            {user.email}
                          </div>
                        </td>
                        <td>
                          <RoleBadge role={user.role} />
                        </td>
                        <td
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--ink-soft)",
                          }}
                        >
                          {user.addedBy === "self"
                            ? "Self-registered"
                            : "Admin"}
                        </td>
                        <td
                          style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}
                        >
                          {user.createdAt
                            ?.toDate?.()
                            .toLocaleDateString("en-PH") || "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
