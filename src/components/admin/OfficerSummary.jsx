// A climb's officers in two short lines for the climbs list: the first (lead)
// officer and their role, plus how many more. Hover shows everyone; the
// expanded row lists them in full.
export default function OfficerSummary({ officers }) {
  const [lead, ...rest] = officers;
  const everyone = officers
    .map((o) => (o.role ? `${o.name} (${o.role})` : o.name))
    .join("\n");
  return (
    <div className="officer-summary" title={everyone}>
      <div className="officer-summary-name">{lead.name}</div>
      <div className="officer-summary-meta">
        {[lead.role, rest.length > 0 && `+${rest.length} more`].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}
