import { useState } from "react";
import { formatPeso } from "@/utils/feeSummary";
import { summarizeDonations } from "@/utils/donations";

// Admin ClimbDetail card for a climb's outreach donation drive: what members
// pledged, and what the leads actually received on the day. Received cash
// passes through leads' hands off-app, so every record names who took it and
// is audit-logged (see recordDonation in ClimbDetail).
export default function DonationsCard({ climb, regs, onRecord }) {
  const [editingId, setEditingId] = useState(null);
  const [cash, setCash] = useState("");
  const [items, setItems] = useState("");
  const [saving, setSaving] = useState(false);
  const [addId, setAddId] = useState("");

  const listed = regs.filter(
    (r) => (r.donation && r.status !== "cancelled") || r.donationReceived,
  );
  const unlisted = regs.filter(
    (r) => r.status !== "cancelled" && !listed.includes(r),
  );
  const totals = summarizeDonations(regs);
  const rows =
    editingId && !listed.some((r) => r.id === editingId)
      ? [...listed, regs.find((r) => r.id === editingId)]
      : listed;

  function startEdit(reg) {
    setEditingId(reg.id);
    setCash(reg.donationReceived?.cash ?? reg.donation?.cashPledge ?? "");
    setItems(reg.donationReceived?.items ?? reg.donation?.inKind ?? "");
  }

  async function save(e) {
    e.preventDefault();
    const reg = regs.find((r) => r.id === editingId);
    if (!reg) return;
    setSaving(true);
    try {
      await onRecord(reg, { cash, items });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-card donations-card">
      <div className="admin-card-title">
        Donations — {climb.donationDrive?.beneficiary || "outreach"}
      </div>
      <div className="donations-totals">
        <span>
          Pledged: <strong>{formatPeso(totals.pledgedCash)}</strong> from{" "}
          {totals.pledgers}
        </span>
        <span>
          Received: <strong>{formatPeso(totals.receivedCash)}</strong> from{" "}
          {totals.donors}
        </span>
        <span>
          Item donations: <strong>{totals.itemDonations}</strong> of{" "}
          {totals.itemPledges} pledged
        </span>
      </div>

      {rows.length > 0 && (
        <div className="donations-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Pledged</th>
                <th>Received</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((reg) =>
                editingId === reg.id ? (
                  <tr key={reg.id}>
                    <td>{reg.name}</td>
                    <td colSpan={3}>
                      <form className="donations-edit" onSubmit={save}>
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          aria-label="Cash received"
                          placeholder="Cash received (₱)"
                          value={cash}
                          onChange={(e) => setCash(e.target.value)}
                        />
                        <input
                          className="form-input"
                          aria-label="Items received"
                          placeholder="Items received"
                          maxLength={500}
                          value={items}
                          onChange={(e) => setItems(e.target.value)}
                        />
                        <button className="btn btn-primary btn-sm" disabled={saving}>
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={reg.id}>
                    <td>{reg.name}</td>
                    <td>
                      {reg.donation?.cashPledge
                        ? formatPeso(reg.donation.cashPledge)
                        : ""}
                      {reg.donation?.inKind && (
                        <div className="donations-items">{reg.donation.inKind}</div>
                      )}
                    </td>
                    <td>
                      {reg.donationReceived ? (
                        <>
                          {reg.donationReceived.cash > 0 &&
                            formatPeso(reg.donationReceived.cash)}
                          {reg.donationReceived.items && (
                            <div className="donations-items">
                              {reg.donationReceived.items}
                            </div>
                          )}
                          <div className="donations-by">
                            by {reg.donationReceived.receivedBy}
                          </div>
                        </>
                      ) : (
                        <span className="donations-pending">Not yet received</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => startEdit(reg)}
                      >
                        {reg.donationReceived ? "Edit" : "Record received"}
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {unlisted.length > 0 && !editingId && (
        <div className="donations-add">
          <select
            className="form-select"
            aria-label="Record a donation from another participant"
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
          >
            <option value="">Donation from someone who didn&rsquo;t pledge…</option>
            {unlisted.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-outline btn-sm"
            disabled={!addId}
            onClick={() => {
              startEdit(regs.find((r) => r.id === addId));
              setAddId("");
            }}
          >
            Record
          </button>
        </div>
      )}
    </div>
  );
}
