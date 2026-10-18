import { ComplianceCheck } from "@/components/admin/registrantShared";
import { REQUIRED_DOC_TYPES, isDocSubmitted } from "@/data/requiredDocTypes";

// One registrant's paperwork for the registrant list, showing only what's
// still missing so a full row stays one line tall. Hover lists every check;
// the expanded row shows them all with links.
export default function ComplianceSummary({ reg, climb, detailsComplete }) {
  const checks = [
    { key: "waiver", label: "Waiver", ok: !!reg.waiverSigned },
    // An admin-added participant starts without details, so the gap has to
    // be visible to whoever chases them for it.
    { key: "details", label: "Details", ok: detailsComplete },
    ...REQUIRED_DOC_TYPES.filter((docType) => climb?.[docType.requiresField]).map((docType) => ({
      key: docType.key,
      label: docType.badgeLabel,
      ok: isDocSubmitted(reg[docType.uploadField]),
    })),
  ];
  const missing = checks.filter((c) => !c.ok);
  const summary = checks.map((c) => `${c.ok ? "✓" : "✕"} ${c.label}`).join("\n");

  return (
    <div className="compliance-summary" title={summary}>
      {missing.length === 0 ? (
        <ComplianceCheck ok label="Complete" />
      ) : (
        missing.map((c) => <ComplianceCheck key={c.key} ok={false} label={c.label} />)
      )}
    </div>
  );
}
