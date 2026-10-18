import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ComplianceSummary from "@/components/admin/ComplianceSummary";
import { REQUIRED_DOC_TYPES } from "@/data/requiredDocTypes";

const medCert = REQUIRED_DOC_TYPES.find((d) => d.key === "medicalCert") || REQUIRED_DOC_TYPES[0];
const climb = { [medCert.requiresField]: true };

describe("ComplianceSummary", () => {
  it("shows only what's missing, with every check on hover", () => {
    const { container } = render(
      <ComplianceSummary reg={{ waiverSigned: true }} climb={climb} detailsComplete={false} />,
    );
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText(medCert.badgeLabel)).toBeInTheDocument();
    expect(screen.queryByText("Waiver")).not.toBeInTheDocument();
    expect(container.querySelector(".compliance-summary")).toHaveAttribute(
      "title",
      `✓ Waiver\n✕ Details\n✕ ${medCert.badgeLabel}`,
    );
  });

  it("collapses to one Complete chip when nothing is missing", () => {
    render(
      <ComplianceSummary
        reg={{ waiverSigned: true, [medCert.uploadField]: { url: "https://x/cert.pdf" } }}
        climb={climb}
        detailsComplete
      />,
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.queryByText("Waiver")).not.toBeInTheDocument();
  });

  it("counts a document an admin marked received without a file", () => {
    render(
      <ComplianceSummary
        reg={{ waiverSigned: true, [medCert.uploadField]: { receivedOffline: true, note: "Shown on climb day" } }}
        climb={climb}
        detailsComplete
      />,
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("counts a waiver an admin recorded as received offline", () => {
    render(
      <ComplianceSummary reg={{ waiverReceivedOffline: { note: "Paper waiver" } }} climb={{}} detailsComplete />,
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("ignores documents this climb doesn't require", () => {
    render(<ComplianceSummary reg={{ waiverSigned: true }} climb={{}} detailsComplete />);
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});
