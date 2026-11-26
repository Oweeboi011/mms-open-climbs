import { getSelfPaidItems } from "@/utils/registrationFees";
import { formatPeso, sumFeeAmounts } from "@/utils/feeSummary";

// What parties pay directly (to the venue or locals) instead of through the
// org: per fee, how many people and how much the org is NOT collecting.
export default function SelfPaidCard({ regs, climb, serviceGroups = {} }) {
  const rows = new Map();
  (regs || [])
    .filter((reg) => reg.status !== "cancelled")
    .forEach((reg) =>
      getSelfPaidItems(reg, climb, serviceGroups).forEach((item) => {
        const row = rows.get(item.label) || {
          label: item.label,
          items: [],
          names: new Set(),
        };
        row.items.push(item);
        row.names.add(reg.name);
        rows.set(item.label, row);
      }),
    );
  if (rows.size === 0) return null;
  const list = [...rows.values()];
  const total = list.reduce((n, r) => n + sumFeeAmounts(r.items).total, 0);
  return (
    <div className="admin-card climbers-card">
      <div className="admin-card-title">Paid Directly, Not Through the Org</div>
      <p className="climbers-note">
        Fees these parties pay the venue or locals themselves. They still take
        part, but the org doesn&apos;t collect these amounts. Total not
        collected: <strong>{formatPeso(total)}</strong>.
      </p>
      <div className="transport-table-wrap">
        <table className="transport-table">
          <thead>
            <tr>
              <th>Fee</th>
              <th>People</th>
              <th>Not collected</th>
              <th>Who</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.label}>
                <td>{r.label.trim()}</td>
                <td>{r.items.length}</td>
                <td>{formatPeso(sumFeeAmounts(r.items).total)}</td>
                <td>{[...r.names].join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
