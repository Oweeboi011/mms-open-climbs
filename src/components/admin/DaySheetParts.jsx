// Guest details on the climb-day sheet: who rides on a registration, and the
// headcount once guests are counted.
export function DaySheetName({ row }) {
  return (
    <>
      <strong>{row.name}</strong>
      {row.guests.length > 0 && <div className="daysheet-guests">+ {row.guests.join(", ")}</div>}
    </>
  );
}

export function DaySheetExpected({ totals }) {
  const withGuests = totals.expectedHeadcount !== totals.expectedCount;
  return (
    <span>
      <strong>{totals.expectedPresent}</strong> of {totals.expectedCount} expected present
      {withGuests && `, ${totals.expectedHeadcount} people with guests`}
    </span>
  );
}
