import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LocalVisibilityReportTemplate from "@features/local-visibility-report/LocalVisibilityReportTemplate";
import { formatScanSettings, type LocalVisibilityReportData } from "@features/local-visibility-report/types";

const report: LocalVisibilityReportData = {
  businessName: "The Shower Glass",
  address: "8334 Pineville-Matthews Rd, Charlotte, NC",
  rating: "5.0",
  reviewCount: "40",
  searchPhrase: "frameless shower glass near me",
  market: "Charlotte, NC",
  averagePosition: "3.96",
  gridSize: "7 x 7",
  radius: "2.5",
  heatmapImageUrl: "data:image/png;base64,example",
};

describe("LocalVisibilityReportTemplate", () => {
  it("renders the approved SMS report contract", () => {
    render(<LocalVisibilityReportTemplate data={report} />);

    expect(screen.getByText("Local Visibility Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Average Google Maps Position")).toBeInTheDocument();
    expect(screen.getByText("3.96")).toBeInTheDocument();
    expect(screen.getByText(/The center dot is your business location/)).toBeInTheDocument();
    expect(screen.getByText("7 × 7 grid · 2.5-mile radius")).toBeInTheDocument();
    expect(screen.getByText("(40 reviews)")).toBeInTheDocument();
    expect(screen.getByText("vivawebdesigns.com")).toBeInTheDocument();
    expect(screen.getByAltText("Viva Web Designs")).toHaveAttribute(
      "src",
      "/img/logo-footer-mark-20260721.svg?v=20260721",
    );
  });

  it("does not include retired metrics or square-mile coverage", () => {
    const { container } = render(<LocalVisibilityReportTemplate data={report} />);
    const content = container.textContent ?? "";

    expect(content).not.toMatch(/\bATRP\b/);
    expect(content).not.toMatch(/\bSoLV\b/i);
    expect(content).not.toMatch(/square miles|mi²|mi2/i);
  });

  it("normalizes scan settings", () => {
    expect(formatScanSettings({ gridSize: "9x9", radius: "3" })).toBe("9 × 9 grid · 3-mile radius");
  });
});
