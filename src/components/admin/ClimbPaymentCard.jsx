import React from "react";
import { Link } from "react-router-dom";
import FeeBreakdownTable from "@/components/FeeBreakdownTable";
import ClimbFeeBreakdown from "@/components/ClimbFeeBreakdown";
import { StatBox } from "@/components/admin/paymentShared";
import PaymentHistory from "@/components/admin/PaymentHistory";
import { getPaymentEntries, getAllProofs } from "@/utils/payments";
import { getExpectedTotal } from "@/utils/registrationFees";
import ResponsiveTable from "@/components/admin/ResponsiveTable";

export default function ClimbPaymentCard({
  climb,
  cs,
  expandedId,
  setExpandedId,
  expandedRegId,
  setExpandedRegId,
  qrUploading,
  qrError,
  fileRefs,
  handleQrUpload,
  changePaymentStatus,
  onEntryStatusChange,
  toggleTransportation,
  getOutstanding,
  setLightboxUrl,
  fmt,
}) {
            const isOpen = expandedId === climb.id;
            const awaitingCount = cs.regs.filter(
              (r) => r.paymentStatus === "submitted",
            ).length;
            const verifiedCount = cs.regs.filter(
              (r) => r.paymentStatus === "verified",
            ).length;
            const rejectedCount = cs.regs.filter(
              (r) => r.paymentStatus === "rejected",
            ).length;
            const unpaidCount = cs.regs.filter(
              (r) => r.paymentStatus === "unpaid",
            ).length;

            return (
              <div
                key={climb.id}
                style={{
                  marginBottom: 14,
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  background: "#fff",
                }}
              >
                {/* Climb header row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 20px",
                    cursor: "pointer",
                    background: isOpen ? "var(--surface)" : "#fff",
                  }}
                  onClick={() => setExpandedId(isOpen ? null : climb.id)}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                        {climb.title}
                      </div>
                      {climb.status === "completed" && (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "1px 8px",
                            borderRadius: 99,
                            fontSize: "0.62rem",
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                            background: "#e6f0fc",
                            color: "#0070E0",
                            border: "1px solid #b8d4f5",
                          }}
                        >
                          Completed
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.76rem",
                        color: "var(--ink-soft)",
                        marginTop: 1,
                      }}
                    >
                      {climb.dateLabel} &bull; {climb.location}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ textAlign: "center", minWidth: 60 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: "1.1rem",
                          color: "var(--green-dark)",
                        }}
                      >
                        {fmt(cs.totalVerified)}
                      </div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--ink-soft)",
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                        }}
                      >
                        Verified
                      </div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 60 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: "1.1rem",
                          color: "#e67e00",
                        }}
                      >
                        {awaitingCount}
                      </div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--ink-soft)",
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                        }}
                      >
                        Awaiting Review
                      </div>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 60 }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: "1.1rem",
                          color: "#b91c1c",
                        }}
                      >
                        {unpaidCount}
                      </div>
                      <div
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--ink-soft)",
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                        }}
                      >
                        Unpaid
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "1.2rem",
                        color: "var(--ink-soft)",
                        transition: "transform 0.2s",
                        transform: isOpen ? "rotate(180deg)" : "none",
                      }}
                    >
                      ▾
                    </div>
                  </div>
                </div>

                {/* Expanded body */}
                {isOpen && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      padding: "20px 20px 24px",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 20,
                        marginBottom: 24,
                      }}
                    >
                      {/* Cash flow */}
                      <div>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            color: "var(--ink-soft)",
                            marginBottom: 10,
                          }}
                        >
                          Cash Flow
                        </div>
                        <div
                          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                        >
                          <StatBox
                            label="Total Declared"
                            value={fmt(cs.totalDeclared)}
                            color="var(--ink)"
                          />
                          <StatBox
                            label="Verified"
                            value={fmt(cs.totalVerified)}
                            color="var(--green-dark)"
                          />
                          <StatBox
                            label="Outstanding"
                            value={fmt(cs.totalOutstanding)}
                            sub="Expected fees not yet verified"
                            color="#b91c1c"
                          />
                          <StatBox
                            label="Awaiting"
                            value={awaitingCount}
                            sub="payments to review"
                            color="#e67e00"
                          />
                          <StatBox
                            label="Verified"
                            value={verifiedCount}
                            sub="payments confirmed"
                            color="var(--green-dark)"
                          />
                          <StatBox
                            label="Rejected"
                            value={rejectedCount}
                            sub="payments rejected"
                            color="#b91c1c"
                          />
                          <StatBox
                            label="Unpaid"
                            value={unpaidCount}
                            sub="not yet submitted"
                            color="#b91c1c"
                          />
                        </div>
                      </div>

                      {/* Transportation breakdown */}
                      <div>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            color: "var(--ink-soft)",
                            marginBottom: 10,
                          }}
                        >
                          Transportation
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            marginBottom: 12,
                          }}
                        >
                          <StatBox
                            label="Availing Transport"
                            value={cs.transpoAvailed}
                            sub="selected Transportation Fee"
                            color="#0070E0"
                          />
                          <StatBox
                            label="Own Transport"
                            value={cs.transpoOwn}
                            sub="not availing organized transport"
                            color="var(--ink-soft)"
                          />
                        </div>
                        {cs.regs.length > 0 && (
                          <div
                            style={{
                              height: 8,
                              borderRadius: 99,
                              background: "var(--surface-alt)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                borderRadius: 99,
                                background: "#0070E0",
                                width: `${Math.round((cs.transpoAvailed / cs.regs.length) * 100)}%`,
                                transition: "width 0.3s",
                              }}
                            />
                          </div>
                        )}
                        {cs.regs.length > 0 && (
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--ink-soft)",
                              marginTop: 4,
                            }}
                          >
                            {Math.round(
                              (cs.transpoAvailed / cs.regs.length) * 100,
                            )}
                            % availing organized transport
                          </div>
                        )}
                      </div>
                    </div>

                    {/* GCash QR management */}
                    <div
                      style={{
                        borderTop: "1px solid var(--border)",
                        paddingTop: 18,
                        marginBottom: 22,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: "var(--ink-soft)",
                          marginBottom: 12,
                        }}
                      >
                        GCash Payment Details
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 20,
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ textAlign: "center" }}>
                          <img
                            src={
                              climb.gcashQrUrl || "/gcash-qr-placeholder.svg"
                            }
                            alt="GCash QR"
                            style={{
                              width: 130,
                              height: 130,
                              objectFit: "contain",
                              border: "1px solid var(--border)",
                              borderRadius: 8,
                              background: "#fff",
                              display: "block",
                              cursor: climb.gcashQrUrl ? "zoom-in" : "default",
                            }}
                            onClick={() =>
                              climb.gcashQrUrl &&
                              setLightboxUrl(climb.gcashQrUrl)
                            }
                          />
                          <div
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--ink-soft)",
                              marginTop: 4,
                            }}
                          >
                            {climb.gcashQrUrl ? "Current QR" : "No QR uploaded"}
                          </div>
                        </div>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          {climb.gcashName && (
                            <div style={{ marginBottom: 6 }}>
                              <div
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  letterSpacing: 2,
                                  textTransform: "uppercase",
                                  color: "var(--ink-soft)",
                                }}
                              >
                                Account Name
                              </div>
                              <div style={{ fontWeight: 700 }}>
                                {climb.gcashName}
                              </div>
                            </div>
                          )}
                          {climb.gcashNumber && (
                            <div style={{ marginBottom: 10 }}>
                              <div
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  letterSpacing: 2,
                                  textTransform: "uppercase",
                                  color: "var(--ink-soft)",
                                }}
                              >
                                GCash Number
                              </div>
                              <div
                                style={{ fontWeight: 700, letterSpacing: 1 }}
                              >
                                {climb.gcashNumber}
                              </div>
                            </div>
                          )}
                          <div>
                            <label
                              style={{
                                fontSize: "0.78rem",
                                fontWeight: 700,
                                display: "block",
                                marginBottom: 4,
                              }}
                            >
                              {climb.gcashQrUrl
                                ? "Replace QR Code"
                                : "Upload QR Code"}
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              ref={(el) => {
                                fileRefs.current[climb.id] = el;
                              }}
                              style={{ display: "none" }}
                              onChange={(e) =>
                                handleQrUpload(climb.id, e.target.files[0])
                              }
                            />
                            <button
                              className="btn btn-outline btn-sm"
                              disabled={qrUploading === climb.id}
                              title="Upload a GCash QR code image for this climb"
                              onClick={() =>
                                fileRefs.current[climb.id]?.click()
                              }
                            >
                              {qrUploading === climb.id
                                ? "Uploading…"
                                : "📷 Choose Image"}
                            </button>
                            {qrError[climb.id] && (
                              <div
                                style={{
                                  fontSize: "0.78rem",
                                  color: "#b91c1c",
                                  marginTop: 6,
                                }}
                              >
                                {qrError[climb.id]}
                              </div>
                            )}
                            {!qrError[climb.id] &&
                              climb.gcashQrUrl &&
                              qrUploading !== climb.id && (
                                <div
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "var(--green-dark)",
                                    marginTop: 4,
                                  }}
                                >
                                  ✓ QR uploaded
                                </div>
                              )}
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <Link
                              to={`/admin/climbs/${climb.id}/edit`}
                              className="btn btn-outline btn-sm"
                              title="Edit the GCash account name and number for this climb"
                            >
                              Edit GCash Name / Number
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Climb fee schedule — the source of every expected
                        amount below, shown live so an edit made elsewhere is
                        visible here without a reload. */}
                    <div
                      style={{
                        marginBottom: 16,
                        padding: "12px 14px",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        background: "var(--surface)",
                      }}
                    >
                      <ClimbFeeBreakdown
                        climb={climb}
                        title="Current Fee Schedule"
                      />
                      <Link
                        to={`/admin/climbs/${climb.id}/edit`}
                        className="btn btn-outline btn-sm"
                        style={{ marginTop: 10 }}
                        title="Edit this climb's fees"
                      >
                        Edit Fees
                      </Link>
                    </div>

                    {/* Participant payment list */}
                    <div>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          color: "var(--ink-soft)",
                          marginBottom: 10,
                        }}
                      >
                        Participant Payments ({cs.regs.length})
                      </div>
                      <p
                        style={{
                          fontSize: "0.75rem",
                          color: "var(--ink-soft)",
                          margin: "-4px 0 10px",
                        }}
                      >
                        Expected amounts use this climb's current fee schedule.
                        Click a row for the itemized breakdown and payment
                        history.
                      </p>
                      {cs.regs.length === 0 ? (
                        <p
                          style={{
                            fontSize: "0.85rem",
                            color: "var(--ink-soft)",
                          }}
                        >
                          No registrations yet.
                        </p>
                      ) : (
                        <ResponsiveTable>
                          <table className="admin-table">
                            <thead>
                              <tr>
                                <th style={{ width: "1%" }}>#</th>
                                <th>Participant</th>
                                <th style={{ width: "1%" }}>Type</th>
                                <th style={{ width: "1%" }}>Transport</th>
                                <th style={{ width: "1%" }}>Expected</th>
                                <th style={{ width: "1%" }}>Declared Paid</th>
                                <th style={{ width: "1%" }}>Outstanding</th>
                                <th style={{ width: "1%" }}>Proof</th>
                                <th style={{ width: "1%" }}>Payment Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cs.regs.map((reg, idx) => {
                                const transpoItem = (
                                  reg.feeBreakdown || []
                                ).find((f) => /transport/i.test(f.label));
                                const climbHasTranspoFee = (
                                  climb.fees || []
                                ).some((f) => /transport/i.test(f.label));
                                const showTranspoToggle =
                                  !!transpoItem || climbHasTranspoFee;
                                const hasTranspo = transpoItem?.selected;
                                const outstanding = getOutstanding(reg);
                                const expected = getExpectedTotal(reg, climb);
                                return (
                                  <React.Fragment key={reg.id}>
                                  <tr
                                    style={{
                                      cursor: "pointer",
                                      background:
                                        expandedRegId === reg.id
                                          ? "var(--surface-alt)"
                                          : undefined,
                                    }}
                                    onClick={() =>
                                      setExpandedRegId((p) =>
                                        p === reg.id ? null : reg.id,
                                      )
                                    }
                                  >
                                    <td
                                      style={{
                                        color: "var(--ink-soft)",
                                        fontSize: "0.78rem",
                                      }}
                                    >
                                      {idx + 1}
                                    </td>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>
                                        {reg.name}
                                      </div>
                                      <div
                                        style={{
                                          fontSize: "0.72rem",
                                          color: "var(--ink-soft)",
                                        }}
                                      >
                                        {reg.email}
                                      </div>
                                    </td>
                                    <td style={{ fontSize: "0.78rem" }}>
                                      {reg.memberType === "member"
                                        ? "MMS Member"
                                        : "Joiner"}
                                    </td>
                                    <td
                                      style={{ fontSize: "0.82rem" }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {showTranspoToggle ? (
                                        <label
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                            cursor: "pointer",
                                            color: hasTranspo
                                              ? "#0070E0"
                                              : "var(--ink-soft)",
                                            fontWeight: hasTranspo ? 700 : 400,
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={!!hasTranspo}
                                            onChange={() =>
                                              toggleTransportation(reg)
                                            }
                                          />
                                          {hasTranspo ? "🚌 Availing" : "Own"}
                                        </label>
                                      ) : (
                                        <span
                                          style={{
                                            color: "var(--ink-soft)",
                                            fontStyle: "italic",
                                          }}
                                        >
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        fontWeight: 700,
                                        fontSize: "0.9rem",
                                        whiteSpace: "nowrap",
                                      }}
                                      title="Total of this registrant's fees at the climb's current amounts"
                                    >
                                      {expected > 0 ? (
                                        fmt(expected)
                                      ) : (
                                        <span
                                          style={{ color: "var(--ink-soft)" }}
                                        >
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        fontWeight: 700,
                                        fontSize: "0.9rem",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {reg.amountPaid ? (
                                        <>
                                          {fmt(reg.amountPaid)}
                                          {getPaymentEntries(reg).length > 1 && (
                                            <div
                                              style={{
                                                fontSize: "0.65rem",
                                                fontWeight: 400,
                                                color: "var(--ink-soft)",
                                              }}
                                            >
                                              {getPaymentEntries(reg).length}{" "}
                                              payments
                                            </div>
                                          )}
                                        </>
                                      ) : (
                                        <span
                                          style={{ color: "var(--ink-soft)" }}
                                        >
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      style={{
                                        fontWeight: 700,
                                        fontSize: "0.9rem",
                                        whiteSpace: "nowrap",
                                        color:
                                          outstanding === 0
                                            ? "var(--ink-soft)"
                                            : "#b91c1c",
                                      }}
                                    >
                                      {outstanding === 0 ? "—" : fmt(outstanding)}
                                    </td>
                                    <td>
                                      {getAllProofs(reg).length > 0 ? (
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: 6,
                                            flexWrap: "wrap",
                                          }}
                                        >
                                          {getAllProofs(reg).map((proof, i) =>
                                            proof.fileName?.match(
                                              /\.(jpg|jpeg|png|gif|webp)$/i,
                                            ) ? (
                                              <img
                                                key={i}
                                                src={proof.url}
                                                alt="proof"
                                                style={{
                                                  width: 44,
                                                  height: 44,
                                                  objectFit: "cover",
                                                  borderRadius: 6,
                                                  border:
                                                    "1px solid var(--border)",
                                                  cursor: "zoom-in",
                                                }}
                                                onClick={() =>
                                                  setLightboxUrl(proof.url)
                                                }
                                              />
                                            ) : (
                                              <a
                                                key={i}
                                                href={proof.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                  width: 44,
                                                  height: 44,
                                                  display: "flex",
                                                  alignItems: "center",
                                                  justifyContent: "center",
                                                  borderRadius: 6,
                                                  border:
                                                    "1px solid var(--border)",
                                                  background:
                                                    "var(--surface-alt)",
                                                  textDecoration: "none",
                                                  fontSize: "1.3rem",
                                                }}
                                              >
                                                📄
                                              </a>
                                            ),
                                          )}
                                        </div>
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: "0.75rem",
                                            color: "var(--ink-soft)",
                                          }}
                                        >
                                          —
                                        </span>
                                      )}
                                    </td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <select
                                        className="form-select"
                                        style={{
                                          padding: "4px 8px",
                                          fontSize: "0.75rem",
                                          width: "auto",
                                        }}
                                        value={reg.paymentStatus || "unpaid"}
                                        onChange={(e) =>
                                          changePaymentStatus(
                                            reg.id,
                                            e.target.value,
                                          )
                                        }
                                      >
                                        <option value="unpaid">Unpaid</option>
                                        <option value="submitted">
                                          Submitted
                                        </option>
                                        <option value="verified">
                                          Verified
                                        </option>
                                        <option value="rejected">
                                          Rejected
                                        </option>
                                      </select>
                                    </td>
                                  </tr>
                                  {expandedRegId === reg.id && (
                                    <tr>
                                      <td
                                        colSpan={9}
                                        style={{
                                          background: "var(--surface-alt)",
                                          padding: "12px 16px",
                                        }}
                                      >
                                        <FeeBreakdownTable
                                          reg={reg}
                                          climb={climb}
                                          title="Fee Breakdown (current fees)"
                                        />
                                        {getPaymentEntries(reg).length > 0 && (
                                          <div style={{ marginTop: 14 }}>
                                            <div
                                              style={{
                                                fontSize: "0.68rem",
                                                fontWeight: 700,
                                                letterSpacing: 2,
                                                textTransform: "uppercase",
                                                color: "var(--ink-soft)",
                                                marginBottom: 8,
                                              }}
                                            >
                                              Payments (
                                              {getPaymentEntries(reg).length}{" "}
                                              submission
                                              {getPaymentEntries(reg).length > 1
                                                ? "s"
                                                : ""}
                                              )
                                            </div>
                                            <PaymentHistory
                                              reg={reg}
                                              thumbSize={110}
                                              setLightboxUrl={setLightboxUrl}
                                              onEntryStatusChange={
                                                onEntryStatusChange
                                              }
                                            />
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </ResponsiveTable>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
}
