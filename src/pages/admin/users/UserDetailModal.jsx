import { useId, useState } from "react";
import { callFunction } from "@/services/callables";
import { serverTimestamp } from "@/services/firestore";
import { updateUserProfile } from "@/services/users";
import Modal from "@/components/Modal";
import TextField from "@/components/TextField";
import StatusPill from "@/components/StatusPill";
import ConfirmDialog from "@/components/ConfirmDialog";
import MemberProfile from "@/components/admin/MemberProfile";
import { ROLE_TONE, addedByLabel, initialOf, joinedLabel, profileChanges } from "./usersModel";

function Section({ title, children, className = "" }) {
  return (
    <section className={`users-section ${className}`.trim()}>
      <div className="users-label">{title}</div>
      {children}
    </section>
  );
}

function EditProfile({ user }) {
  const [name, setName] = useState(user.displayName || "");
  const [email, setEmail] = useState(user.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const changes = profileChanges(user, name, email);

  async function save() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      await callFunction("updateUserProfile", { uid: user.id, ...changes });
      setOk("Profile updated.");
    } catch (err) {
      setError(err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Edit Profile">
      {error && <div className="alert alert-error">{error}</div>}
      {ok && <div className="alert alert-success">{ok}</div>}
      <TextField label="Full Name" value={name} onChange={setName} />
      <TextField
        label="Email Address"
        type="email"
        value={email}
        onChange={setEmail}
        hint="Updates the login email and Firestore profile together."
      />
      <button className="btn btn-primary btn-sm" disabled={saving || !changes} onClick={save}>
        {saving ? "Saving…" : "Save Profile"}
      </button>
    </Section>
  );
}

function ChangeRole({ user }) {
  const [role, setRole] = useState(user.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      await updateUserProfile(user.id, { role, updatedAt: serverTimestamp() });
    } catch (err) {
      setError("Failed to update role: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Change Role">
      {error && <div className="alert alert-error">{error}</div>}
      <div className="users-role-row" role="radiogroup" aria-label="Role">
        {["member", "admin"].map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={role === r}
            className={`users-role-option users-role-option--${r} ${role === r ? "users-role-option--active" : ""}`}
            onClick={() => setRole(r)}
          >
            {r}
          </button>
        ))}
        <button className="btn btn-primary btn-sm users-role-save" disabled={role === user.role || saving} onClick={save}>
          {saving ? "Saving…" : "Save Role"}
        </button>
      </div>
      {role !== user.role && (
        <p className="users-note">
          {role === "admin"
            ? "This user will gain full admin access to all climbs, registrations, payments, and users."
            : "This user will lose admin access immediately."}
        </p>
      )}
    </Section>
  );
}

// "Can email members": sending a release note to everyone. Granted by another
// admin only — the security rules refuse a self-grant.
function EmailPermission({ user }) {
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function toggle(e) {
    setSaving(true);
    setError("");
    try {
      await updateUserProfile(user.id, { canEmailMembers: e.target.checked, updatedAt: serverTimestamp() });
    } catch (err) {
      setError("Failed to update permission: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Permissions">
      {error && <div className="alert alert-error">{error}</div>}
      <label className="users-check" htmlFor={id}>
        <input id={id} type="checkbox" checked={user.canEmailMembers === true} disabled={saving} onChange={toggle} />
        Can email every member (release-note announcements)
      </label>
    </Section>
  );
}

function DangerZone({ user, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setDeleting(true);
    setError("");
    try {
      await callFunction("deleteUserAccount", { uid: user.id });
      onDeleted();
    } catch (err) {
      setError(err?.message || "Failed to delete user.");
      setDeleting(false);
    }
  }

  return (
    <Section title="Danger Zone" className="users-danger">
      <button className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>
        🗑 Delete Account
      </button>
      {confirming && (
        <ConfirmDialog
          title="Delete this account?"
          confirmLabel="Delete account"
          danger
          busy={deleting}
          error={error}
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        >
          This permanently removes the login and profile for &ldquo;{user.displayName || user.email}&rdquo;. It cannot be
          undone.
        </ConfirmDialog>
      )}
    </Section>
  );
}

export default function UserDetailModal({ user, isSelf, onClose }) {
  const titleId = useId();
  return (
    <Modal onClose={onClose} labelledBy={titleId} size="xl">
      <header className="users-detail-head">
        <div className="users-avatar" aria-hidden="true">
          {initialOf(user)}
        </div>
        <div>
          <h2 id={titleId} className="users-detail-name">
            {user.displayName}
            {isSelf && <span className="users-you">YOU</span>}
          </h2>
          <div className="users-detail-email">{user.email}</div>
          <StatusPill tone={ROLE_TONE[user.role] || "success"}>{user.role}</StatusPill>
        </div>
      </header>

      <dl className="users-facts">
        <div>
          <dt className="users-label">Added By</dt>
          <dd>{addedByLabel(user)}</dd>
        </div>
        <div>
          <dt className="users-label">Joined</dt>
          <dd>{joinedLabel(user)}</dd>
        </div>
      </dl>

      <EditProfile key={`p-${user.id}`} user={user} />

      {isSelf ? (
        <div className="users-self-note">You cannot change your own role or permissions.</div>
      ) : (
        <>
          <ChangeRole key={`r-${user.id}-${user.role}`} user={user} />
          {user.role === "admin" && <EmailPermission user={user} />}
        </>
      )}

      {isSelf ? (
        <Section title="Danger Zone" className="users-danger">
          <div className="users-note">You cannot delete your own account.</div>
        </Section>
      ) : (
        <DangerZone user={user} onDeleted={onClose} />
      )}

      <div className="member-profile-section">
        <div className="member-profile-title">Climbs &amp; Activity</div>
        <MemberProfile key={user.id} uid={user.id} />
      </div>
    </Modal>
  );
}
