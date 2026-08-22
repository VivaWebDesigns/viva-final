import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LocalVisibilityReportTemplate from "@features/local-visibility-report/LocalVisibilityReportTemplate";
import { formatScanSettings, type LocalVisibilityReportData } from "@features/local-visibility-report/types";
import { buildGoogleMapsVisibilityComparison, type LocalFalconCompetitorBusiness } from "@shared/localVisibility";

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
    const { container } = render(<LocalVisibilityReportTemplate data={report} />);

    expect(screen.getByText("Local Visibility Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Average Google Maps Position")).toBeInTheDocument();
    expect(screen.getByText("3.96")).toBeInTheDocument();
    expect(screen.getByText("Average Google Maps Position").closest(".lvr-business-card")).toBeInTheDocument();
    expect(container.querySelector(".lvr-metric-card")).not.toBeInTheDocument();
    expect(screen.getByText("The center dot marks your business.")).toBeInTheDocument();
    expect(screen.getByText("The surrounding dots show how you rank in nearby areas.")).toBeInTheDocument();
    expect(screen.getByText("Each number is your Google Maps position from that location.")).toBeInTheDocument();
    expect(screen.getByText("7 × 7 grid · 2.5-mile radius")).toBeInTheDocument();
    expect(screen.getByText("(40 reviews)")).toBeInTheDocument();
    expect(screen.getByText("vivawebdesigns.com")).toBeInTheDocument();
    expect(screen.getByAltText("Viva Web Designs")).toHaveAttribute(
      "src",
      "/img/logo-report-footer-mark-20260721-v2.svg?v=20260721-v2",
    );
    expect(screen.getByTestId("local-visibility-report-template")).toHaveAttribute("data-export-height", "1920");
    expect(screen.getByAltText("Uploaded Local Falcon ranking heatmap")).toHaveAttribute("data-crop-mode", "cover-center");
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

  it("preserves ARP precision and applies map zoom and position", () => {
    render(
      <LocalVisibilityReportTemplate
        data={{ ...report, averagePosition: "3.08" }}
        mapZoom={80}
        mapPosition={{ x: 24, y: -18 }}
      />,
    );

    expect(screen.getByText("3.08")).toBeInTheDocument();
    expect(screen.getByAltText("Uploaded Local Falcon ranking heatmap")).toHaveStyle({
      transform: "translate(24px, -18px) scale(0.8)",
    });
  });

  it("replaces the explanatory footer with a compact Google Maps comparison when standings are available", () => {
    const businesses: LocalFalconCompetitorBusiness[] = [
      {
        rank: 129,
        place_id: "above",
        name: "Stefans Pro Cleaning",
        address_raw: "",
        address: null,
        city: null,
        state: null,
        zip: null,
        lat: 0,
        lng: 0,
        arp: 20,
        atrp: null,
        atrp_capped: true,
        solv: 2.04,
        reviews: 6,
        rating: 5,
        is_subject: false,
      },
      {
        rank: 130,
        place_id: "subject",
        name: "YA cleaning service",
        address_raw: "",
        address: null,
        city: null,
        state: null,
        zip: null,
        lat: 0,
        lng: 0,
        arp: 20,
        atrp: null,
        atrp_capped: true,
        solv: 0,
        reviews: 19,
        rating: 5,
        is_subject: true,
      },
      {
        rank: 131,
        place_id: "below",
        name: "Nearby Cleaning Co.",
        address_raw: "",
        address: null,
        city: null,
        state: null,
        zip: null,
        lat: 0,
        lng: 0,
        arp: 20,
        atrp: null,
        atrp_capped: true,
        solv: 0,
        reviews: 12,
        rating: 4.8,
        is_subject: false,
      },
    ];
    const comparison = buildGoogleMapsVisibilityComparison({
      subjectRank: 130,
      totalBusinesses: 148,
      businessesAheadCount: 129,
      businesses,
      subject: { name: "YA cleaning service", rating: 5, reviewCount: 19 },
    });

    const { container } = render(
      <LocalVisibilityReportTemplate
        data={{ ...report, businessName: "YA cleaning service", googleMapsComparison: comparison }}
      />,
    );

    expect(screen.getByText("How You Compare on Google Maps")).toBeInTheDocument();
    expect(screen.getByText("Stefans Pro Cleaning")).toBeInTheDocument();
    expect(screen.getByText("YA cleaning service", { selector: ".lvr-comparison-business strong" })).toBeInTheDocument();
    expect(screen.getByText("Nearby Cleaning Co.")).toBeInTheDocument();
    expect(screen.getByText("129 businesses appeared more prominently across this area scan.")).toBeInTheDocument();
    expect(container.querySelectorAll(".lvr-comparison-row")).toHaveLength(3);
    expect(container.querySelector(".lvr-comparison-row.is-subject")).toHaveTextContent("YA cleaning service");
    expect(screen.queryByText("The center dot marks your business.")).not.toBeInTheDocument();
  });
});
