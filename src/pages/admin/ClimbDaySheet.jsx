import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/firebase/config";
import LoadingSpinner from "@/components/LoadingSpinner";
import { formatPeso } from "@/utils/feeSummary";
import { buildClimbDaySheet } from "@/utils/climbDaySheet";
import { readClimbPrivate } from "@/utils/registrationFees";

// Printable roster for climb day. Loaded once (not live) so what's printed
// matches what's on screen. Contains medical and emergency details — admins
// only (AdminRoute), and the print says so.
export default function ClimbDaySheet() {
  const { id } = useParams();
  const [climb, setClimb] = useState(null);
  const [regs, setRegs] = useState([]);
  const [serviceGroups, setServiceGroups] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const sheet = useMemo(
    () => (climb ? buildClimbDaySheet(regs, climb, serviceGroups) : null),
    [regs, climb, serviceGroups],
  );

  if (loading) return <LoadingSpinner fullPage />;
  if (error || !climb) {
    return (
      <div className="daysheet-page">
        <p className="alert alert-error">{error || "Climb not found."}</p>
        <Link to="/admin/climbs">Back to climbs</Link>
      </div>
    );
  }

  const { rows, totals } = sheet;
  const printedAt = new Date().toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="daysheet-page">
      <div className="daysheet-toolbar no-print">
        <Link to={`/admin/climbs/${id}`} className="btn btn-outline btn-sm">
          &larr; Back to climb
        </Link>
        <button className="btn btn-gold btn-sm" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <header className="daysheet-header">
        <h1>{climb.title}</h1>
        <p>
          {[climb.dateLabel, climb.location].filter(Boolean).join(" · ")}
        </p>
        <p className="daysheet-confidential">
          Confidential — contains participants&rsquo; medical and emergency
          details. Printed {printedAt}. Destroy after the climb.
        </p>
      </header>

      {climb.officers?.length > 0 && (
        <section className="daysheet-officers">
          <h2>Officers</h2>
          <ul>
            {climb.officers.map((o, i) => (
              <li key={`${o.name}-${i}`}>
                <strong>{o.name}</strong>
                {o.role && ` — ${o.role}`}
                {o.contact && ` · ${o.contact}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="daysheet-summary">
        <span>
          <strong>{totals.confirmed}</strong> confirmed
          {totals.pending > 0 && `, ${totals.pending} pending`}
        </span>
        <span>
          <strong>{totals.withMedical}</strong> with medical notes
        </span>
        {totals.unsignedWaivers > 0 && (
          <span>
            <strong>{totals.unsignedWaivers}</strong> waiver
            {totals.unsignedWaivers === 1 ? "" : "s"} unsigned
          </span>
        )}
        {totals.owing > 0 && (
          <span>
            <strong>{formatPeso(totals.balanceDue)}</strong> still owed by{" "}
            {totals.owing}
          </span>
        )}
        {(totals.cashOnTheDay > 0 || totals.itemDonors > 0) && (
          <span>
            Donations to collect: <strong>{formatPeso(totals.cashOnTheDay)}</strong>
            {totals.itemDonors > 0 && ` + items from ${totals.itemDonors}`}
          </span>
        )}
      </section>

      {rows.length === 0 ? (
        <p>No confirmed or pending participants.</p>
      ) : (
        <table className="daysheet-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Present</th>
              <th>Participant</th>
              <th>Emergency contact</th>
              <th>Medical</th>
              <th>Waiver / docs</th>
              <th>Balance</th>
              <th>Donation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td className="daysheet-check" aria-label="Present">
                  &#9744;
                </td>
                <td>
                  <strong>{r.name}</strong>
                  {r.pending && <span className="daysheet-flag"> PENDING</span>}
                  <div>{r.mobile}</div>
                  <div className="daysheet-muted">{r.memberType}</div>
                </td>
                <td>
                  {r.emergency ? (
                    <>
                      {r.emergency.name}
                      {r.emergency.relationship && ` (${r.emergency.relationship})`}
                      <div>{r.emergency.mobile}</div>
                    </>
                  ) : (
                    <span className="daysheet-flag">MISSING</span>
                  )}
                </td>
                <td className={r.medical && !/^none\.?$/i.test(r.medical) ? "daysheet-medical" : ""}>
                  {r.medical || "—"}
                </td>
                <td>
                  {r.waiverSigned ? "Signed" : <span className="daysheet-flag">NOT SIGNED</span>}
                  {r.missingDocs.length > 0 && (
                    <div className="daysheet-muted">Missing: {r.missingDocs.join(", ")}</div>
                  )}
                </td>
                <td>
                  {r.balanceDue > 0 ? (
                    <span className="daysheet-flag">{formatPeso(r.balanceDue)}</span>
                  ) : (
                    "Paid"
                  )}
                </td>
                <td>
                  {r.cashOnTheDay > 0 && <div>{formatPeso(r.cashOnTheDay)} cash</div>}
                  {r.items && <div className="daysheet-muted">{r.items}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
