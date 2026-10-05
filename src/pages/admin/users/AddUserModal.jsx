import { useId, useState } from "react";
import { callFunction } from "@/services/callables";
import Modal from "@/components/Modal";
import TextField from "@/components/TextField";
import { describeCreateUserError } from "./usersModel";

const EMPTY = { email: "", displayName: "", role: "member" };

function CreateUserError({ error, onClose }) {
  const titleId = useId();
  return (
    <Modal onClose={onClose} labelledBy={titleId} layer="top">
      <h2 id={titleId} className="users-error-title">
        {error.title}
      </h2>
      <p className="users-error-message">{error.message}</p>
      <div className="users-next-step">
        <div className="users-label">Next Step</div>
        <div>{error.nextStep}</div>
      </div>
      {error.raw && <div className="users-error-raw">{error.raw}</div>}
      <button className="btn btn-primary" type="button" onClick={onClose}>
        Close
      </button>
    </Modal>
  );
}

// Create an account (the server emails a password-setup link).
export default function AddUserModal({ onClose }) {
  const titleId = useId();
  const roleId = useId();
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [ok, setOk] = useState("");
  const set = (field) => (value) => setForm((p) => ({ ...p, [field]: value }));

  async function create(e) {
    e.preventDefault();
    setError(null);
    setOk("");
    setCreating(true);
    try {
      const result = await callFunction("createUser", form);
      setOk(
        result?.emailSent !== false
          ? `Account created for ${form.email}. A welcome email with setup link has been sent.`
          : `Account created for ${form.email}, but the welcome email could not be sent. Ask the user to use "Forgot Password" to set their password.`,
      );
      setForm(EMPTY);
    } catch (err) {
      setError(describeCreateUserError(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Modal onClose={onClose} labelledBy={titleId} size="md" closeOnBackdrop={false}>
        <h2 id={titleId} className="modal-title">
          Add New User
        </h2>
        {ok && <div className="alert alert-success">{ok}</div>}
        <form onSubmit={create}>
          <TextField label="Email Address" type="email" required value={form.email} onChange={set("email")} />
          <TextField label="Full Name" required value={form.displayName} onChange={set("displayName")} />
          <div className="form-group">
            <label className="form-label required" htmlFor={roleId}>
              Role
            </label>
            <select id={roleId} className="form-select" required value={form.role} onChange={(e) => set("role")(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <div className="form-hint">The user will receive an email with a link to set their password.</div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? "Sending…" : "Create & Send Invite"}
            </button>
            <button className="btn btn-outline" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
      {error && <CreateUserError error={error} onClose={() => setError(null)} />}
    </>
  );
}
