import { FieldError } from "@/pages/register/registerShared";

export default function PaymentProofField({
  bindField,
  clearFieldError,
  fieldErrors,
  inputClass,
  paymentFiles,
  paymentPreviews,
  setPaymentFiles,
  setPaymentPreviews,
}) {
  return (
    <>
      <div className="form-group">
        <label className="form-label">
          Upload Proof of Payment
        </label>
        <input
          type="file"
          accept="image/*,application/pdf"
          ref={bindField("paymentFiles")}
          className={inputClass("paymentFiles")}
          aria-invalid={!!fieldErrors.paymentFiles}
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            setPaymentFiles(files);
            clearFieldError("paymentFiles");
            clearFieldError("amountPaid");
            Promise.all(
              files.map(
                (file) =>
                  new Promise((resolve) => {
                    if (file.type.startsWith("image/")) {
                      const reader = new FileReader();
                      reader.onload = (ev) =>
                        resolve({
                          name: file.name,
                          preview: ev.target.result,
                          isImage: true,
                        });
                      reader.readAsDataURL(file);
                    } else {
                      resolve({
                        name: file.name,
                        preview: null,
                        isImage: false,
                      });
                    }
                  }),
              ),
            ).then(setPaymentPreviews);
          }}
        />
        <div className="form-hint">
          You can select multiple files. Accepted formats: images (JPG,
          PNG) or PDF.
        </div>
        <FieldError message={fieldErrors.paymentFiles} />
        {paymentPreviews.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 10,
            }}
          >
            {paymentPreviews.map((item, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "var(--surface-alt)",
                }}
              >
                {item.isImage ? (
                  <img
                    src={item.preview}
                    alt={item.name}
                    style={{
                      width: 110,
                      height: 110,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 110,
                      height: 110,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: "2rem" }}>&#128196;</span>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--ink-soft)",
                        padding: "0 6px",
                        textAlign: "center",
                        wordBreak: "break-all",
                      }}
                    >
                      PDF
                    </span>
                  </div>
                )}
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--ink-soft)",
                    padding: "4px 6px",
                    maxWidth: 110,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </div>
              </div>
            ))}
          </div>
        )}
        {paymentFiles.length > 0 && (
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--green-dark)",
              marginTop: 6,
            }}
          >
            &#10003; {paymentFiles.length} file
            {paymentFiles.length > 1 ? "s" : ""} selected
          </div>
        )}
      </div>
    </>
  );
}
