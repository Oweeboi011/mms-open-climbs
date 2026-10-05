import { moveItem } from "@/components/admin/ReorderButtons";

// State updaters for the climb form's repeatable lists. Pure functions of
// `setForm`, so they need no hook of their own.

export function listActions(setForm) {
  const setList = (field, fn) => setForm((p) => ({ ...p, [field]: fn(p[field] || []) }));
  return {
    addListItem: (field, item) => setList(field, (list) => [...list, item]),
    removeListItem: (field, i) => setList(field, (list) => list.filter((_, idx) => idx !== i)),
    moveListItem: (field, from, to) => setList(field, (list) => moveItem(list, from, to)),
    updateListItem: (field, i, val) => setList(field, (list) => list.map((item, idx) => (idx === i ? val : item))),
  };
}

export function itineraryActions(setForm) {
  const updateDayAt = (dayIdx, fn) =>
    setForm((p) => ({ ...p, itinerary: p.itinerary.map((d, i) => (i === dayIdx ? fn(d) : d)) }));
  const updateEntries = (dayIdx, fn) => updateDayAt(dayIdx, (d) => ({ ...d, entries: fn(d.entries) }));
  return {
    addDay: () => setForm((p) => ({ ...p, itinerary: [...(p.itinerary || []), { day: "", entries: [] }] })),
    removeDay: (i) => setForm((p) => ({ ...p, itinerary: p.itinerary.filter((_, idx) => idx !== i) })),
    updateDay: (i, val) => updateDayAt(i, (d) => ({ ...d, day: val })),
    addEntry: (dayIdx) => updateEntries(dayIdx, (entries) => [...entries, { time: "", activity: "" }]),
    removeEntry: (dayIdx, entryIdx) => updateEntries(dayIdx, (entries) => entries.filter((_, j) => j !== entryIdx)),
    moveEntry: (dayIdx, from, to) => updateEntries(dayIdx, (entries) => moveItem(entries, from, to)),
    updateEntry: (dayIdx, entryIdx, field, val) =>
      updateEntries(dayIdx, (entries) => entries.map((e, j) => (j === entryIdx ? { ...e, [field]: val } : e))),
  };
}
