// A climb's status for display and grouping.
//
// `status: "cancelled"` is the source of truth, but climbs cancelled before
// cancellation moved onto `status` still carry it only as `cancellationStatus`
// while `status` sits at whatever it was ("open"/"closed"). Reading both here
// means those older climbs group and badge correctly with no data migration.
export function getEffectiveStatus(climb) {
  if (climb?.cancellationStatus === "cancelled") return "cancelled";
  return climb?.status || "draft";
}
