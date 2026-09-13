import { useState } from "react";
import { getOptionalServices, isAvailing } from "@/utils/registrationFees";

// Lets an admin cluster registrants who opted into a shareable optional
// service (e.g. Porter) into groups sharing one unit of it, so the booking
// count drops from "8 opted in" to "3 porters — 2 groups + 1 solo" and the
// cost splits evenly across each group (see getFeeItems in
// registrationFees.js). Only services marked `shareable` on the climb's fee
// schedule show up here; a climb with none renders nothing.
export default function ServiceSharingCard({
  climb,
  regs,
  serviceGroups,
  onSaveGroups,
}) {
  const [selected, setSelected] = useState({}); // { [label]: Set<regId> }
  const [saving, setSaving] = useState(null); // label currently saving

  const shareableServices = getOptionalServices(climb).filter(
    (f) => f.shareable,
  );
  if (shareableServices.length === 0) return null;

  function toggleSelected(label, regId) {
    setSelected((prev) => {
      const set = new Set(prev[label] || []);
      if (set.has(regId)) set.delete(regId);
      else set.add(regId);
      return { ...prev, [label]: set };
    });
  }

  async function groupSelected(label) {
    const ids = [...(selected[label] || [])];
    if (ids.length < 2) return;
    setSaving(label);
    try {
      const groups = serviceGroups?.[label] || [];
      await onSaveGroups(label, [...groups, ids]);
      setSelected((prev) => ({ ...prev, [label]: new Set() }));
    } finally {
      setSaving(null);
    }
  }

  async function removeFromGroup(label, groupIdx, regId) {
    setSaving(label);
    try {
      const groups = serviceGroups?.[label] || [];
      const remaining = groups[groupIdx].filter((id) => id !== regId);
      const next =
        remaining.length >= 2
          ? groups.map((g, i) => (i === groupIdx ? remaining : g))
          : groups.filter((_, i) => i !== groupIdx);
      await onSaveGroups(label, next);
    } finally {
      setSaving(null);
    }
  }

  async function ungroupAll(label, groupIdx) {
    setSaving(label);
    try {
      const groups = serviceGroups?.[label] || [];
      await onSaveGroups(
        label,
        groups.filter((_, i) => i !== groupIdx),
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="admin-card" style={{ marginBottom: 28 }}>
      <div className="admin-card-title">Service Sharing</div>
      <p style={{ fontSize: "0.82rem", color: "var(--ink-soft)", margin: "0 0 16px" }}>
        Group registrants who agreed to share one unit of a service — the
        cost splits evenly between them, and only one needs to be booked per
        group.
      </p>

      {shareableServices.map((fee) => {
        const label = fee.label;
        const groups = serviceGroups?.[label] || [];
        const availingRegs = regs.filter(
          (r) => r.status !== "cancelled" && isAvailing(r, label),
        );
        const groupedIds = new Set(groups.flat());
        const soloAvailing = availingRegs.filter(
          (r) => !groupedIds.has(r.id),
        );
        const groupsInUse = groups.filter((ids) =>
          ids.some((id) => availingRegs.some((r) => r.id === id)),
        ).length;
        const unitsNeeded = groupsInUse + soloAvailing.length;
        const selectedSet = selected[label] || new Set();

        return (
          <div
            key={label}
            style={{
              marginBottom: 20,
              paddingBottom: 20,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                {label}
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>
                {availingRegs.length} availing &rarr;{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {unitsNeeded} to book
                </strong>{" "}
                ({groupsInUse} group{groupsInUse === 1 ? "" : "s"} +{" "}
                {soloAvailing.length} solo)
              </div>
            </div>

            {availingRegs.length === 0 ? (
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--ink-soft)",
                  fontStyle: "italic",
                  margin: 0,
                }}
              >
                Nobody is availing {label} yet.
              </p>
            ) : (
              <>
                {groups.map((ids, groupIdx) => {
                  const members = ids
                    .map((id) => regs.find((r) => r.id === id))
                    .filter(Boolean);
                  return (
                    <div
                      key={groupIdx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 8,
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: "var(--green-pale)",
                        border: "1px solid var(--green-light)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "var(--ink-soft)",
                        }}
                      >
                        Group {groupIdx + 1}
                      </span>
                      {members.map((m) => (
                        <span
                          key={m.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: "0.8rem",
                            background: "#fff",
                            border: "1px solid var(--border)",
                            borderRadius: 20,
                            padding: "2px 4px 2px 10px",
                          }}
                        >
                          {m.name}
                          <button
                            type="button"
                            title={`Remove ${m.name} from this group`}
                            disabled={saving === label}
                            onClick={() =>
                              removeFromGroup(label, groupIdx, m.id)
                            }
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              color: "var(--ink-soft)",
                              fontSize: "0.75rem",
                              lineHeight: 1,
                              padding: "4px 6px",
                            }}
                          >
                            &#10005;
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={saving === label}
                        onClick={() => ungroupAll(label, groupIdx)}
                      >
                        Ungroup
                      </button>
                    </div>
                  );
                })}

                {soloAvailing.length > 0 && (
                  <div style={{ marginTop: groups.length ? 12 : 0 }}>
                    <div
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        color: "var(--ink-soft)",
                        marginBottom: 6,
                      }}
                    >
                      Not yet grouped — select who's sharing
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 10,
                        marginBottom: 8,
                      }}
                    >
                      {soloAvailing.map((r) => (
                        <label
                          key={r.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: "0.82rem",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedSet.has(r.id)}
                            onChange={() => toggleSelected(label, r.id)}
                          />
                          {r.name}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="btn btn-accent btn-sm"
                      disabled={selectedSet.size < 2 || saving === label}
                      title={
                        selectedSet.size < 2
                          ? "Select at least 2 registrants to form a group"
                          : `Group these ${selectedSet.size} registrants to share one ${label}`
                      }
                      onClick={() => groupSelected(label)}
                    >
                      {saving === label
                        ? "Saving…"
                        : `Group Selected (${selectedSet.size})`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
