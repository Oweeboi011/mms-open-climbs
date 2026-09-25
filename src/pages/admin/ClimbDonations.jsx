import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import { useAuth } from "@/contexts/AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatPeso } from "@/utils/feeSummary";
import { buildDonationCollection, itemQtyMap } from "@/utils/donations";
import { readClimbPrivate } from "@/utils/registrationFees";
import {
  makePaidWithFees,
  publishDonationTotals,
  recordDonationReceived,
} from "@/utils/donationRecords";

const itemsText = (list = []) =>
  list.map((i) => `${i.qty} ${i.name}`).join(", ");

// A climb's donation drive as its own process: what the drive needs and how
// far along it is (per item and in cash), and a collection list of who
// brings what and how much cash to collect on the day, where leads record
// what each person actually handed over. Printable for the trail.
export default function ClimbDonations() {
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [climb, setClimb] = useState(null);
  const [regs, setRegs] = useState([]);
  const [serviceGroups, setServiceGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // regId
  const [form, setForm] = useState({ cash: "", items: "", itemQty: {} });
  const [saving, setSaving] = useState(false);
  const [addId, setAddId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [climbSnap, privSnap, regSnap] = await Promise.all([
          getDoc(doc(db, "climbs", id)),
          getDoc(doc(db, "climbPrivate", id)),
          getDocs(query(collection(db, "registrations"), where("climbId", "==", id))),
        ]);
        setClimb(climbSnap.exists() ? { id, ...climbSnap.data() } : null);
        if (privSnap.exists()) {
          setServiceGroups(readClimbPrivate(privSnap.data()).serviceGroups || {});
        }
        setRegs(regSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setError(err?.message || "Could not load the climb.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const data = useMemo(
    () =>
      climb ? buildDonationCollection(regs, climb, makePaidWithFees(climb, serviceGroups)) : null,
    [regs, climb, serviceGroups],
  );

  if (loading) return <LoadingSpinner fullPage />;
  if (error || !climb) {
    return (
      <main className="daysheet-page">
        <p className="alert alert-error">{error || "Climb not found."}</p>
        <Link to="/admin/climbs">Back to climbs</Link>
      </main>
    );
  }
  const drive = climb.donationDrive || {};
  if (!drive.enabled) {
    return (
      <div className="daysheet-page">
        <p>This climb has no donation drive. Switch one on in the climb settings.</p>
        <Link to={`/admin/climbs/${id}/edit`}>Edit climb</Link>
      </div>
    );
  }

  const { items, cash, people } = data;
  const listedIds = new Set(people.map((p) => p.reg.id));
  const others = regs.filter((r) => r.status !== "cancelled" && !listedIds.has(r.id));

  function startEdit(reg) {
    const pledge = reg.donation;
    const got = reg.donationReceived;
    setEditing(reg.id);
    setForm({
      cash: got?.cash ?? (pledge && !pledge.payWithFees ? pledge.cashPledge || "" : ""),
      items: got?.items ?? pledge?.inKind ?? "",
      itemQty: itemQtyMap(got?.itemQuantities || pledge?.itemPledges),
    });
  }

  async function save(reg) {
    setSaving(true);
    try {
      const next = await recordDonationReceived({
        reg,
        received: form,
        regs,
        climb,
        serviceGroups,
        currentUser,
      });
      setRegs(next);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  const editRow = (reg) => (
    <tr key={`${reg.id}-edit`} className="no-print">
      <td colSpan={5}>
        <div className="donation-record-form">
          <strong>Received from {reg.name}</strong>
          {drive.acceptsCash && (
            <label>
              Cash (₱)
              <input
                type="number"
                min="0"
                className="form-input"
                value={form.cash}
                onChange={(e) => setForm((f) => ({ ...f, cash: e.target.value }))}
              />
            </label>
          )}
          {data.needed.map((i) => (
            <label key={i.name}>
              {i.name}
              {i.unit && ` (${i.unit})`}
              <input
                type="number"
                min="0"
                className="form-input"
                aria-label={`${i.name} received`}
                value={form.itemQty[i.name] ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, itemQty: { ...f.itemQty, [i.name]: e.target.value } }))
                }
              />
            </label>
          ))}
          <label className="donation-record-other">
            Other items
            <input
              className="form-input"
              maxLength={500}
              value={form.items}
              onChange={(e) => setForm((f) => ({ ...f, items: e.target.value }))}
            />
          </label>
          <div className="donation-record-actions">
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => save(reg)}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="daysheet-page">
      <div className="daysheet-toolbar no-print">
        <Link to={`/admin/climbs/${id}`} className="btn btn-outline btn-sm">
          &larr; Back to climb
        </Link>
        <span className="donation-toolbar-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => publishDonationTotals(climb, regs, serviceGroups)}
            title="Refresh the totals shown on the public event page"
          >
            Update public totals
          </button>
          <button className="btn btn-gold btn-sm" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </span>
      </div>

      <header className="daysheet-header">
        <h1>Donations — {climb.title}</h1>
        <p>
          For <strong>{drive.beneficiary}</strong>
          {climb.dateLabel && ` · ${climb.dateLabel}`}
        </p>
        {drive.description && <p className="daysheet-muted">{drive.description}</p>}
      </header>

      <section className="donation-summary">
        {items.length > 0 && (
          <table className="daysheet-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Target</th>
                <th>Pledged</th>
                <th>Received</th>
                <th>Still needed</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.name}>
                  <td>
                    {i.name}
                    {i.unit && <span className="daysheet-muted"> ({i.unit})</span>}
                  </td>
                  <td>{i.target || "—"}</td>
                  <td>{i.pledged}</td>
                  <td>{i.received}</td>
                  <td className={i.stillNeeded > 0 ? "daysheet-flag" : undefined}>
                    {i.stillNeeded === null ? "—" : i.stillNeeded || "Done ✓"}
                    {i.unpledged > 0 && (
                      <div className="daysheet-muted">{i.unpledged} not yet pledged</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {drive.acceptsCash && (
          <table className="daysheet-table donation-cash">
            <tbody>
              {cash.goal > 0 && (
                <tr>
                  <th>Cash goal</th>
                  <td>{formatPeso(cash.goal)}</td>
                </tr>
              )}
              <tr>
                <th>Pledged</th>
                <td>
                  {formatPeso(cash.pledgedWithFees + cash.pledgedOnDay)}
                  <span className="daysheet-muted">
                    {" "}
                    ({formatPeso(cash.pledgedWithFees)} with GCash payments,{" "}
                    {formatPeso(cash.pledgedOnDay)} on the day)
                  </span>
                </td>
              </tr>
              <tr>
                <th>Received</th>
                <td>
                  <strong>{formatPeso(cash.received)}</strong>
                  <span className="daysheet-muted">
                    {" "}
                    ({formatPeso(cash.receivedViaGcash)} via GCash, {formatPeso(cash.receivedOnDay)}{" "}
                    handed to leads)
                  </span>
                </td>
              </tr>
              <tr>
                <th>To collect on the day</th>
                <td className={cash.toCollectOnDay > 0 ? "daysheet-flag" : undefined}>
                  {formatPeso(cash.toCollectOnDay)}
                </td>
              </tr>
              {cash.stillNeeded !== null && (
                <tr>
                  <th>Still needed for the goal</th>
                  <td>{cash.stillNeeded > 0 ? formatPeso(cash.stillNeeded) : "Reached ✓"}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <h2 className="donation-list-title">Collection list</h2>
      {people.length === 0 ? (
        <p className="form-hint">No pledges yet.</p>
      ) : (
        <table className="daysheet-table">
          <thead>
            <tr>
              <th>Participant</th>
              <th>Cash to collect</th>
              <th>Items to collect</th>
              <th>Received</th>
              <th className="no-print" />
            </tr>
          </thead>
          <tbody>
            {people.flatMap((p) => {
              const row = (
                <tr key={p.reg.id} className={p.collected ? "donation-row-done" : undefined}>
                  <td>
                    <strong>{p.reg.name}</strong>
                    {p.reg.status !== "confirmed" && (
                      <span className={`daysheet-status daysheet-status-${p.reg.status}`}>
                        {p.reg.status.toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td>
                    {p.cashOnDay > 0 ? formatPeso(p.cashOnDay) : "—"}
                    {p.cashWithFees > 0 && (
                      <div className="daysheet-muted">
                        {formatPeso(p.cashWithFees)} with GCash
                        {p.viaGcash > 0 && ` (${formatPeso(p.viaGcash)} paid)`}
                      </div>
                    )}
                  </td>
                  <td>
                    {itemsText(p.itemPledges) || (p.other ? "" : "—")}
                    {p.other && <div className="daysheet-muted">{p.other}</div>}
                  </td>
                  <td>
                    {p.received ? (
                      <>
                        {p.received.cash > 0 && <div>{formatPeso(p.received.cash)}</div>}
                        {itemsText(p.received.itemQuantities) && (
                          <div>{itemsText(p.received.itemQuantities)}</div>
                        )}
                        {p.received.items && <div className="daysheet-muted">{p.received.items}</div>}
                        <div className="daysheet-muted">by {p.received.receivedBy}</div>
                      </>
                    ) : (
                      <span className="daysheet-check-empty">&#9744;</span>
                    )}
                  </td>
                  <td className="no-print">
                    <button className="btn btn-outline btn-sm" onClick={() => startEdit(p.reg)}>
                      {p.received ? "Edit" : "Record received"}
                    </button>
                  </td>
                </tr>
              );
              return editing === p.reg.id ? [row, editRow(p.reg)] : [row];
            })}
            {editing && !listedIds.has(editing) && (() => {
              const reg = regs.find((r) => r.id === editing);
              return reg ? editRow(reg) : null;
            })()}
          </tbody>
        </table>
      )}

      {others.length > 0 && !editing && (
        <div className="donations-add no-print">
          <select
            className="form-select"
            aria-label="Record a donation from someone who didn't pledge"
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
          >
            <option value="">Donation from someone who didn&rsquo;t pledge…</option>
            {others.map((r) => (
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
