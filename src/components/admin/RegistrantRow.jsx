import React from "react";
import { Link } from "react-router-dom";
import FeeBreakdownTable from "@/components/FeeBreakdownTable";
import { detailsIncomplete } from "@/components/DetailsPrompt";
import PaymentHistory from "./PaymentHistory";
import { getPaymentEntries, getAllProofs } from "@/utils/payments";
import {
  getServicesForRegistrant,
  isAvailing,
} from "@/utils/registrationFees";
import {
  StatusBadge,
  InfoCell,
  ComplianceCheck,
  SectionLabel,
  EXPERIENCE_LABELS,
  STATUS_OPTIONS,
  STATUS_STYLE,
  PAYMENT_STYLE,
} from "./registrantShared";

const statusStyleWithLabel = Object.fromEntries(
  Object.entries(STATUS_STYLE).map(([k, v]) => [k, { ...v, label: k }]),
);

export default function RegistrantRow({
  reg,
  idx,
  climb,
  expandedId,
  toggleExpand,
  changeStatus,
  changePaymentStatus,
  onEntryStatusChange,
  onRecordPayment,
  toggleOptionalFee,
  onEdit,
  deleteRegistration,
  editNotes,
  setEditNotes,
  startNoteEdit,
  saveNote,
  savingNote,
  setLightboxUrl,
  getOutstanding,
}) {
  return (
    <React.Fragment>
      <tr
        style={{
          cursor: "pointer",
          background: expandedId === reg.id ? "var(--green-pale)" : undefined,
        }}
        onClick={() => toggleExpand(reg.id)}
      >
        {/* # */}
        <td style={{ color: "var(--ink-soft)", fontSize: "0.75rem" }}>
          {idx + 1}
        </td>

        {/* Participant — name, email, type badge, note indicator */}
        <td>
          <div style={{ fontWeight: 600, fontSize: "0.84rem" }}>{reg.name}</div>
          <div
            style={{
              fontSize: "0.72rem",
              color: "var(--ink-soft)",
              marginTop: 1,
            }}
          >
            {reg.email}
          </div>
          <div
            style={{
              display: "flex",
              gap: 5,
              marginTop: 4,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {reg.memberType && (
              <span
                style={{
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  background:
                    reg.memberType === "member"
                      ? "#e8f5e9"
                      : "var(--surface-alt)",
                  color:
                    reg.memberType === "member" ? "#1a6b2c" : "var(--ink-soft)",
                  border: "1px solid",
                  borderColor:
                    reg.memberType === "member" ? "#a7d7b2" : "var(--border)",
                  borderRadius: 99,
                  padding: "2px 8px",
                  textTransform: "uppercase",
                }}
              >
                {reg.memberType === "member" ? "Member" : "Joiner"}
              </span>
            )}
            {reg.adminNotes && (
              <span
                title={reg.adminNotes}
                style={{
                  fontSize: "0.68rem",
                  color: "var(--gold)",
                  fontWeight: 600,
                }}
              >
                &#128203;
              </span>
            )}
          </div>
        </td>

        {/* Compliance — waiver + required docs stacked */}
        <td>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <ComplianceCheck ok={reg.waiverSigned} label="Waiver" />
            {/* An admin-added participant starts with neither, so the gap has
                to be visible to whoever chases them for it. */}
            <ComplianceCheck ok={!detailsIncomplete(reg)} label="Details" />
            {climb?.requiresRegistrationForm && (
              <ComplianceCheck
                ok={!!reg.registrationFormUpload?.url}
                label="Form"
                href={reg.registrationFormUpload?.url}
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {climb?.requiresMedicalCert && (
              <ComplianceCheck
                ok={!!reg.medicalCertUpload?.url}
                label="Med Cert"
                href={reg.medicalCertUpload?.url}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </td>

        {/* Payment — badge + proof count */}
        <td onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={reg.paymentStatus} styleMap={PAYMENT_STYLE} />
          {(() => {
            const proofCount = getAllProofs(reg).length;
            const paymentCount = getPaymentEntries(reg).length;
            if (proofCount === 0 && paymentCount < 2) return null;
            return (
              <div
                style={{
                  fontSize: "0.62rem",
                  color: "var(--ink-soft)",
                  marginTop: 3,
                }}
              >
                {paymentCount > 1 && `${paymentCount} payments`}
                {paymentCount > 1 && proofCount > 0 && " · "}
                {proofCount > 0 &&
                  `${proofCount} file${proofCount > 1 ? "s" : ""}`}
              </div>
            );
          })()}
        </td>

        {/* Balance — paid amount + outstanding in red */}
        <td>
          <div
            style={{
              fontSize: "0.84rem",
              fontWeight: 700,
              fontFamily: "var(--font-head)",
              color: reg.amountPaid ? "var(--green-dark)" : "var(--ink-soft)",
            }}
          >
            {reg.amountPaid
              ? `₱${Number(reg.amountPaid).toLocaleString("en-PH")}`
              : "—"}
          </div>
          {getOutstanding(reg) > 0 && (
            <div
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                color: "#b91c1c",
                marginTop: 2,
                fontFamily: "var(--font-head)",
              }}
            >
              ₱{getOutstanding(reg).toLocaleString("en-PH")} due
            </div>
          )}
        </td>

        {/* Status — pill badge (read-only; dropdown lives in expanded row) */}
        <td>
          <StatusBadge status={reg.status} styleMap={STATUS_STYLE} />
        </td>

        {/* Actions */}
        <td onClick={(e) => e.stopPropagation()}>
          <Link
            to={`/waiver/${reg.id}`}
            className="btn btn-outline btn-sm"
            target="_blank"
            title="Open the printable waiver for this participant"
          >
            Waiver
          </Link>
        </td>
      </tr>

      {/* ── Expanded detail row ── */}
      {expandedId === reg.id && (
        <tr key={`${reg.id}-detail`}>
          <td
            colSpan={7}
            style={{
              background: "var(--green-pale)",
              padding: 0,
              borderBottom: "2px solid var(--border)",
              borderLeft: "3px solid var(--green-light)",
            }}
          >
            <div style={{ padding: "20px 24px" }}>
              {/* Quick actions bar */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--border)",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: "var(--ink-soft)",
                    marginRight: 4,
                  }}
                >
                  Actions
                </span>

                {/* Status change dropdown */}
                <select
                  className="form-select"
                  style={{
                    padding: "4px 8px",
                    fontSize: "0.75rem",
                    width: "auto",
                  }}
                  value={reg.status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    e.stopPropagation();
                    changeStatus(reg.id, e.target.value);
                  }}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <button
                  className="btn btn-outline btn-sm"
                  title="Edit this registrant's details"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(reg);
                  }}
                >
                  &#9998; Edit
                </button>
                <button
                  className="btn btn-sm"
                  style={{
                    background: "#1a6b2c",
                    color: "#fff",
                    border: "none",
                  }}
                  disabled={reg.status === "confirmed"}
                  title="Confirm this registration"
                  onClick={(e) => {
                    e.stopPropagation();
                    changeStatus(reg.id, "confirmed");
                  }}
                >
                  &#10003; Confirm
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={reg.status === "waitlisted"}
                  title="Move to waitlist"
                  onClick={(e) => {
                    e.stopPropagation();
                    changeStatus(reg.id, "waitlisted");
                  }}
                >
                  Waitlist
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  disabled={reg.status === "cancelled"}
                  title="Cancel this registration"
                  onClick={(e) => {
                    e.stopPropagation();
                    changeStatus(reg.id, "cancelled");
                  }}
                >
                  &#10005; Cancel
                </button>
                <span style={{ marginLeft: "auto" }}>
                  <StatusBadge
                    status={reg.status}
                    styleMap={statusStyleWithLabel}
                  />
                </span>
              </div>

              {/* Registration info */}
              <SectionLabel>{"\u{1F4CB}"} Participant Details</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "14px 24px",
                  marginBottom: 20,
                }}
              >
                <InfoCell label="Mobile" value={reg.mobile} />
                <InfoCell
                  label="Registered"
                  value={reg.createdAt?.toDate?.().toLocaleDateString("en-PH")}
                />
                <InfoCell
                  label="Amount Paid"
                  value={
                    reg.amountPaid
                      ? `₱${Number(reg.amountPaid).toLocaleString("en-PH")}`
                      : null
                  }
                />
                <InfoCell label="Date of Birth" value={reg.dateOfBirth} />
                <InfoCell label="Address" value={reg.address} />
                <InfoCell
                  label="Experience"
                  value={
                    EXPERIENCE_LABELS[reg.experienceLevel] ||
                    reg.experienceLevel
                  }
                />
                <InfoCell
                  label="Participant Type"
                  value={reg.memberType === "member" ? "MMS Member" : "Joiner"}
                />
                <InfoCell
                  label="Emergency Contact"
                  value={
                    reg.emergencyContact?.name
                      ? `${reg.emergencyContact.name} (${reg.emergencyContact.relationship}) — ${reg.emergencyContact.mobile}`
                      : "Not provided yet"
                  }
                />
                {/* Never "None declared" for a blank: nothing was declared
                    either way, and officers read this on the trail. */}
                <InfoCell
                  label="Medical"
                  value={reg.medicalConditions || "Not provided yet"}
                />
              </div>

              {/* Fee Breakdown */}
              <div style={{ marginBottom: 16 }}>
                <FeeBreakdownTable
                  reg={reg}
                  climb={climb}
                  title="Fee Breakdown (current fees)"
                />
              </div>

              {/* Optional services this climb offers — transportation,
                  porter, anything added later. Driven off the climb's fee
                  schedule, so a new service needs no change here. */}
              {getServicesForRegistrant(reg, climb).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <SectionLabel>Optional Services</SectionLabel>
                  {getServicesForRegistrant(reg, climb).map((svc) => {
                    const availing = isAvailing(reg, svc.label);
                    return (
                      <label
                        key={svc.label}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
                          fontSize: "0.85rem",
                          marginBottom: 4,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={availing}
                          onChange={() => toggleOptionalFee(reg, svc.label)}
                        />
                        {availing
                          ? `Availing ${svc.label}`
                          : `Not availing ${svc.label}`}
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Waiver section */}
              <div
                style={{
                  background: reg.waiverSigned ? "#e8f5e9" : "#fce8e8",
                  border: `1px solid ${reg.waiverSigned ? "#a7d7b2" : "#fca5a5"}`,
                  borderRadius: 8,
                  padding: "14px 16px",
                  marginBottom: 16,
                  display: "flex",
                  gap: 16,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1 }}>
                  <SectionLabel>
                    {reg.waiverSigned ? "\u2713" : "\u26A0"} Waiver & Release of
                    Liability
                  </SectionLabel>
                  {reg.waiverSigned ? (
                    <>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#1a6b2c",
                          fontSize: "0.9rem",
                        }}
                      >
                        &#10003; Signed as &ldquo;
                        {reg.waiverSignedName}&rdquo;
                      </div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--ink-soft)",
                          marginTop: 2,
                        }}
                      >
                        {reg.waiverSignedAt
                          ?.toDate?.()
                          .toLocaleString("en-PH") || "Date not recorded"}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#b91c1c",
                        fontSize: "0.9rem",
                      }}
                    >
                      &#10005; Waiver not yet signed
                    </div>
                  )}
                </div>
                <Link
                  to={`/waiver/${reg.id}`}
                  className="btn btn-outline btn-sm"
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                >
                  View / Print Waiver
                </Link>
              </div>

              {/* Payment proof section */}
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <SectionLabel>
                    {"\u{1F4B3}"} Payments
                    {getPaymentEntries(reg).length > 1 && (
                      <span
                        style={{
                          color: "var(--ink-soft)",
                          letterSpacing: 0,
                          textTransform: "none",
                          fontWeight: 600,
                        }}
                      >
                        ({getPaymentEntries(reg).length} submissions)
                      </span>
                    )}
                  </SectionLabel>
                  <StatusBadge
                    status={reg.paymentStatus}
                    styleMap={PAYMENT_STYLE}
                  />
                </div>

                {getPaymentEntries(reg).length > 0 ? (
                  <PaymentHistory
                    reg={reg}
                    setLightboxUrl={setLightboxUrl}
                    onEntryStatusChange={onEntryStatusChange}
                  />
                ) : (
                  <div
                    style={{
                      color: "var(--ink-soft)",
                      fontSize: "0.85rem",
                      marginBottom: 12,
                    }}
                  >
                    No payments recorded yet.
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {onRecordPayment && (
                    <button
                      className="btn btn-outline btn-sm"
                      title="Log a payment received outside the app (cash on-site, bank transfer) — it's added to this registrant's history and total"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRecordPayment(reg);
                      }}
                    >
                      + Record Payment
                    </button>
                  )}
                  {getPaymentEntries(reg).length > 0 && (
                    <>
                      <button
                        className="btn btn-sm"
                        style={{
                          background: "#1a6b2c",
                          color: "#fff",
                          border: "none",
                        }}
                        disabled={reg.paymentStatus === "verified"}
                        title="Mark every payment above as verified — total confirmed received"
                        onClick={(e) => {
                          e.stopPropagation();
                          changePaymentStatus(reg.id, "verified");
                        }}
                      >
                        &#10003; Verify Payment
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={reg.paymentStatus === "rejected"}
                        title="Reject this payment — participant will need to resubmit"
                        onClick={(e) => {
                          e.stopPropagation();
                          changePaymentStatus(reg.id, "rejected");
                        }}
                      >
                        &#10005; Reject Payment
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={reg.paymentStatus === "submitted"}
                        title="Reset payment status back to Submitted for re-review"
                        onClick={(e) => {
                          e.stopPropagation();
                          changePaymentStatus(reg.id, "submitted");
                        }}
                      >
                        Reset to Submitted
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <SectionLabel>{"\u{1F4DD}"} Admin Notes</SectionLabel>
                {editNotes[reg.id] !== undefined ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                    }}
                  >
                    <textarea
                      className="form-input"
                      rows={2}
                      style={{
                        flex: 1,
                        resize: "vertical",
                        fontSize: "0.85rem",
                      }}
                      value={editNotes[reg.id]}
                      onChange={(e) =>
                        setEditNotes((prev) => ({
                          ...prev,
                          [reg.id]: e.target.value,
                        }))
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={savingNote === reg.id}
                      title="Save the admin note for this participant"
                      onClick={(e) => {
                        e.stopPropagation();
                        saveNote(reg.id);
                      }}
                    >
                      {savingNote === reg.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      title="Discard changes and close the note editor"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditNotes((prev) => {
                          const n = { ...prev };
                          delete n[reg.id];
                          return n;
                        });
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: reg.adminNotes
                          ? "var(--ink)"
                          : "var(--ink-soft)",
                        flex: 1,
                      }}
                    >
                      {reg.adminNotes || "No notes."}
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      title={
                        reg.adminNotes
                          ? "Edit the existing admin note"
                          : "Add an internal note for this participant"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        startNoteEdit(reg);
                      }}
                    >
                      {reg.adminNotes ? "Edit Note" : "+ Add Note"}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                className="btn btn-danger btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteRegistration(reg);
                }}
              >
                {"\u{1F5D1}"} Delete Registration
              </button>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}
