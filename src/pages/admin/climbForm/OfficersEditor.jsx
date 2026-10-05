import DonationDriveFields from "@/components/admin/DonationDriveFields";
import RegistrationPolicyFields from "@/components/admin/RegistrationPolicyFields";
import ReorderButtons from "@/components/admin/ReorderButtons";
import { OFFICER_ROLES } from "@/pages/admin/climbForm/climbFormShared";

export default function OfficersEditor({
  addListItem,
  form,
  moveListItem,
  removeListItem,
  setForm,
  updateListItem,
  users,
}) {
  return (
    <>
      {/* ── Officers ── */}
      <div className="admin-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div className="admin-card-title" style={{ marginBottom: 0 }}>
            Climb Officers
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              addListItem("officers", {
                name: "",
                role: "",
                contact: "",
                email: "",
              })
            }
          >
            + Add Officer
          </button>
        </div>
        {form.officers.length === 0 && (
          <p className="tbd-note">No officers assigned yet.</p>
        )}
        {form.officers.map((o, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <select
              className="form-select"
              value={o.userId || ""}
              onChange={(e) => {
                const uid = e.target.value;
                if (!uid) {
                  updateListItem("officers", i, { ...o, userId: "" });
                  return;
                }
                const user = users.find((u) => u.uid === uid);
                if (user) {
                  updateListItem("officers", i, {
                    ...o,
                    userId: uid,
                    name: user.displayName || o.name,
                    email: user.email || o.email,
                    contact: user.phone || user.contact || o.contact,
                  });
                }
              }}
              style={{ flex: "2 1 180px" }}
            >
              <option value="">— Link account (optional) —</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName || u.email}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="form-input"
              placeholder="Full Name"
              value={o.name}
              onChange={(e) =>
                updateListItem("officers", i, {
                  ...o,
                  name: e.target.value,
                })
              }
              style={{ flex: "2 1 160px" }}
            />
            <select
              className="form-select"
              value={
                OFFICER_ROLES.includes(o.role)
                  ? o.role
                  : o.role
                    ? "Other"
                    : ""
              }
              onChange={(e) =>
                updateListItem("officers", i, {
                  ...o,
                  role: e.target.value === "Other" ? "Other" : e.target.value,
                })
              }
              style={{ flex: "2 1 160px" }}
            >
              <option value="">— Select role —</option>
              {OFFICER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
            {!OFFICER_ROLES.includes(o.role) && o.role !== "" && (
              <input
                type="text"
                className="form-input"
                placeholder="Custom role"
                value={o.role === "Other" ? "" : o.role}
                onChange={(e) =>
                  updateListItem("officers", i, {
                    ...o,
                    role: e.target.value,
                  })
                }
                style={{ flex: "2 1 140px" }}
              />
            )}
            <input
              type="text"
              className="form-input"
              placeholder="Contact (phone/social)"
              value={o.contact}
              onChange={(e) =>
                updateListItem("officers", i, {
                  ...o,
                  contact: e.target.value,
                })
              }
              style={{ flex: "2 1 140px" }}
            />
            <input
              type="email"
              className={`form-input${o.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email) ? " input-error" : ""}`}
              placeholder="Email address"
              value={o.email || ""}
              onChange={(e) =>
                updateListItem("officers", i, {
                  ...o,
                  email: e.target.value.trim(),
                })
              }
              style={{ flex: "2 1 160px" }}
            />
            <ReorderButtons
              index={i}
              count={form.officers.length}
              onMove={(from, to) => moveListItem("officers", from, to)}
              label="officer"
            />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => removeListItem("officers", i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <RegistrationPolicyFields form={form} setForm={setForm} />
      <DonationDriveFields form={form} setForm={setForm} />
    </>
  );
}
