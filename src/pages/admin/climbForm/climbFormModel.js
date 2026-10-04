import { EMPTY_FORM, MONTHS } from "@/pages/admin/climbForm/climbFormShared";
import { serverTimestamp } from "@/services/firestore";
import { mergeOfficerEmails, splitOfficerEmails } from "@/utils/officerContacts";
import { normalizeEmbedInput } from "@/utils/trailEmbeds";

// Fields that once lived on the public climb doc or as a single pre-climb
// meeting. Saves null them out so the old copies don't linger.
const LEGACY_MEETING_FIELDS = [
  "preClimbMeetingDate",
  "preClimbMeetingTime",
  "preClimbMeetingLocation",
  "preClimbMeetingNotes",
];
const nulls = (fields) => Object.fromEntries(fields.map((f) => [f, null]));

// The legacy single googleMapsUrl/allTrailsUrl/komootUrl fields become the
// first entry of the repeatable trailMaps list so existing data isn't lost.
function trailMapsFrom(data) {
  if (data.trailMaps?.length > 0) return data.trailMaps;
  if (!data.googleMapsUrl && !data.allTrailsUrl && !data.komootUrl) return [];
  return [
    {
      label: "",
      googleMapsUrl: data.googleMapsUrl || "",
      allTrailsUrl: data.allTrailsUrl || "",
      komootUrl: data.komootUrl || "",
    },
  ];
}

// The pre-climb meeting used to be a single object (on climbPrivate, then
// briefly on the climb doc) — either legacy shape becomes the repeatable list.
function meetingsFrom(priv, data) {
  if (priv.preClimbMeetings?.length > 0) return priv.preClimbMeetings;
  if (!priv.preClimbMeetingDate && !data.preClimbMeetingDate) return [];
  return [
    {
      date: priv.preClimbMeetingDate ?? data.preClimbMeetingDate ?? "",
      time: priv.preClimbMeetingTime ?? data.preClimbMeetingTime ?? "",
      location: priv.preClimbMeetingLocation ?? data.preClimbMeetingLocation ?? "",
      link: priv.preClimbMeetingLink ?? "",
      recordingLink: priv.preClimbMeetingRecordingLink ?? "",
      notes: priv.preClimbMeetingNotes ?? data.preClimbMeetingNotes ?? "",
    },
  ];
}

// Builds the edit form from the climb, its private doc and officer emails.
export function formFromClimb(climbDoc, privateDoc, officerEmails) {
  // The ids are doc keys, not fields — keep them out of the form so a save
  // never writes them into the climb.
  const { id: _id, ...data } = climbDoc;
  const { id: _privId, ...priv } = privateDoc || {};
  return {
    ...EMPTY_FORM,
    ...data,
    officers: mergeOfficerEmails(data.officers, officerEmails),
    trailMaps: trailMapsFrom(data),
    preClimbMeetings: meetingsFrom(priv, data),
    resources: priv.resources ?? [],
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function invalidOfficerEmailMessage(officers = []) {
  const bad = officers.find((o) => o.email && !EMAIL_RE.test(o.email));
  return bad ? `Invalid email address for officer "${bad.name || "unnamed"}": ${bad.email}` : "";
}

// A cancelled climb is expressed by `status`; `cancellationStatus` is derived
// from it so the onClimbUpdated email trigger and the public banners keep
// reading the one field they always have.
function cancellationFields(form) {
  const cancellationStatus =
    form.status === "cancelled" ? "cancelled" : form.cancellationStatus === "postponed" ? "postponed" : "";
  return {
    cancellationStatus,
    cancellationReason: cancellationStatus ? form.cancellationReason || "" : "",
  };
}

// Splits the form into the three docs a climb is saved as: the public climb,
// registrants-only climbPrivate, and admin-only climbInternal.
export function buildClimbDocs(form) {
  const { preClimbMeetings, resources, ...publicForm } = form;
  const privateData = {
    preClimbMeetings: preClimbMeetings || [],
    resources: resources || [],
    ...nulls([...LEGACY_MEETING_FIELDS, "preClimbMeetingLink", "preClimbMeetingRecordingLink"]),
  };
  const { publicOfficers, officerEmails } = splitOfficerEmails(form.officers);
  // Admins paste the sites' iframe embed code; store just its URL.
  const trailMaps = (form.trailMaps || []).map((t) => ({
    ...t,
    allTrailsUrl: normalizeEmbedInput(t.allTrailsUrl),
    komootUrl: normalizeEmbedInput(t.komootUrl),
  }));
  const payload = {
    ...publicForm,
    maxParticipants: Number(form.maxParticipants),
    // Derived so the card's month tag can never disagree with the date.
    month: MONTHS[Number(form.startDate.slice(5, 7)) - 1] || form.month,
    updatedAt: serverTimestamp(),
    officerIds: (form.officers || []).map((o) => o.userId).filter(Boolean),
    officers: publicOfficers,
    trailMaps,
    // Legacy single-trail fields mirror the first trail so older readers
    // (e.g. the weather location lookup) still resolve.
    googleMapsUrl: trailMaps[0]?.googleMapsUrl || "",
    allTrailsUrl: trailMaps[0]?.allTrailsUrl || "",
    ...nulls(LEGACY_MEETING_FIELDS),
    ...cancellationFields(form),
  };
  return { payload, privateData, internalData: { officerEmails } };
}
