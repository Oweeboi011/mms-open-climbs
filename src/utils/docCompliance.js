import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";

// Cancelled registrants are dropped from the denominator — chasing a document
// from someone who isn't climbing anymore would make the tally unreachable.
function isExpectedOf(reg) {
  return reg?.status !== "cancelled";
}

/**
 * Roll up "who has handed in which required document" for one climb.
 *
 * Only the doc types the climb actually switched on count towards the totals,
 * so a climb requiring nothing reports expected: 0 rather than a false gap.
 */
export function getDocCompliance(climb, regs = []) {
  const expectedRegs = regs.filter(isExpectedOf);
  const types = REQUIRED_DOC_TYPES.filter(
    (docType) => climb?.[docType.requiresField],
  ).map((docType) => {
    const submitted = expectedRegs.filter(
      (reg) => reg[docType.uploadField]?.url,
    ).length;
    return {
      key: docType.key,
      label: docType.label,
      badgeLabel: docType.badgeLabel,
      panelLabel: docType.panelLabel,
      pillIcon: docType.pillIcon,
      submitted,
      expected: expectedRegs.length,
      missing: expectedRegs.length - submitted,
    };
  });

  const submitted = types.reduce((sum, t) => sum + t.submitted, 0);
  const expected = types.reduce((sum, t) => sum + t.expected, 0);

  return {
    types,
    submitted,
    expected,
    missing: expected - submitted,
    // Registrants who owe at least one of the required docs — the list the
    // admin actually has to chase, as opposed to the document count.
    registrantsMissing: types.length
      ? expectedRegs.filter((reg) =>
          types.some(
            (t) =>
              !reg[REQUIRED_DOC_TYPES.find((d) => d.key === t.key).uploadField]
                ?.url,
          ),
        ).length
      : 0,
    complete: expected > 0 && submitted === expected,
  };
}
