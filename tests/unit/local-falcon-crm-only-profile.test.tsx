import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/renderWithProviders";
import CrmOnlyEvidenceCard from "../../client/src/features/profiles/CrmOnlyEvidenceCard";
import { getCompanyReportLibrary } from "../../server/features/local-visibility/reportLibrary";
import { db } from "../../server/db";

vi.mock("../../server/db", () => ({ db: { select: vi.fn() } }));
const evidence = {
  leadId: "lead-1", placeId: "ChIJ-test", contactTag: "Email Ready", scanKeyword: "plumber",
  marketReference: {
    kind: "market_reference_only" as const, source: "auxiliary_scan_reverse_geocode" as const,
    latitude: 35, longitude: -80, city: "Test Market", state: "NC", zip: "28000",
    auxiliary_report_key: "abcdef123456789", auxiliary_report_url: "https://example.com/observed-auxiliary-public-url",
  },
};
function reply(rows: unknown[]) {
  const chain: any = { then: (resolve: any) => Promise.resolve(rows).then(resolve) };
  for (const name of ["from", "innerJoin", "where", "orderBy"]) chain[name] = () => chain;
  return chain;
}
beforeEach(() => vi.clearAllMocks());

describe("post-import CRM-only profile evidence", () => {
  it("labels stored market provenance clearly without report, metric, image or outreach controls", () => {
    renderWithProviders(<CrmOnlyEvidenceCard evidence={evidence} />);
    expect(screen.getByTestId("card-crm-only-evidence")).toHaveTextContent("Market reference only: Test Market, NC 28000");
    expect(screen.getByText(/not a validated business location/)).toBeInTheDocument();
    expect(screen.getByText(/Automatic scan outreach is disabled/)).toBeInTheDocument();
    expect(screen.getByText("Email Ready")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Auxiliary evidence — operational use only" }))
      .toHaveAttribute("href", evidence.marketReference.auxiliary_report_url);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/Average Google Maps Position|ATRP|ARP/)).not.toBeInTheDocument();
  });

  it("returns CRM-only provenance separately from the profile report list", async () => {
    vi.mocked(db.select).mockReturnValueOnce(reply([])).mockReturnValueOnce(reply([evidence]));
    expect(await getCompanyReportLibrary("company-1")).toEqual({ ownReports: [], crmOnlyProspects: [evidence] });
  });

  it("does not present historical CRM-only status as active once a real deliverable exists", async () => {
    const report = { id: "report-1", leadId: "lead-1", companyId: "company-1", batchRecordId: "batch-1", batchId: "batch",
      placeId: "ChIJ-test", businessName: "Test prospect", keyword: "plumber", marketCity: "Test Market", marketState: "NC",
      radius: "3", gridSize: "7x7", scanDate: new Date("2026-08-31"), averagePosition: "20.6",
      reportUrl: "https://example.com/observed-deliverable-url", snapshotStorageKey: "snapshot" };
    vi.mocked(db.select).mockReturnValueOnce(reply([report])).mockReturnValueOnce(reply([evidence]));
    const result = await getCompanyReportLibrary("company-1");
    expect(result.ownReports).toHaveLength(1);
    expect(result.crmOnlyProspects).toEqual([]);
  });
});
