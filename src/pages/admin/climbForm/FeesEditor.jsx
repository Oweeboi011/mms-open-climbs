import ReorderButtons from "@/components/admin/ReorderButtons";

export default function FeesEditor({
  addListItem,
  form,
  moveListItem,
  removeListItem,
  updateListItem,
}) {
  return (
    <>
      {/* ── Fees ── */}
      <div className="admin-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div className="admin-card-title" style={{ marginBottom: 0 }}>
            Fees
          </div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              addListItem("fees", {
                label: "",
                amount: "TBA",
                note: "",
                optional: false,
              })
            }
          >
            + Add Fee
          </button>
        </div>
        {form.fees.map((fee, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="Label"
              value={fee.label}
              onChange={(e) =>
                updateListItem("fees", i, {
                  ...fee,
                  label: e.target.value,
                })
              }
              style={{ flex: "2 1 160px" }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Amount"
              value={fee.amount}
              onChange={(e) =>
                updateListItem("fees", i, {
                  ...fee,
                  amount: e.target.value,
                })
              }
              style={{ flex: "1 1 80px" }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Note (optional)"
              value={fee.note}
              onChange={(e) =>
                updateListItem("fees", i, {
                  ...fee,
                  note: e.target.value,
                })
              }
              style={{ flex: "2 1 160px" }}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.8rem",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
              title="Optional fees let participants choose whether to include them"
            >
              <input
                type="checkbox"
                checked={!!fee.optional}
                onChange={(e) =>
                  updateListItem("fees", i, {
                    ...fee,
                    optional: e.target.checked,
                    // Sharing only makes sense for something a
                    // registrant opts into.
                    shareable: e.target.checked ? fee.shareable === true : false,
                  })
                }
              />
              Optional
            </label>
            {fee.optional && !fee.isGuestFee && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: "0.8rem",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
                title="Let admins group registrants who opt in to share one unit of this service (e.g. one porter between several climbers), splitting the cost between them"
              >
                <input
                  type="checkbox"
                  checked={!!fee.shareable}
                  onChange={(e) =>
                    updateListItem("fees", i, {
                      ...fee,
                      shareable: e.target.checked,
                    })
                  }
                />
                Shareable
              </label>
            )}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: "0.8rem",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
              title="Charged only to non-member registrants; never charged to MMS members"
            >
              <input
                type="checkbox"
                checked={!!fee.isGuestFee}
                onChange={(e) =>
                  updateListItem("fees", i, {
                    ...fee,
                    isGuestFee: e.target.checked,
                  })
                }
              />
              Guest Fee
            </label>
            <ReorderButtons
              index={i}
              count={form.fees.length}
              onMove={(from, to) => moveListItem("fees", from, to)}
              label="fee"
            />
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => removeListItem("fees", i)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
