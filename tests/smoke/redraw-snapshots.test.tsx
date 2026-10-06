import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders } from "../helpers/renderWithProviders";
import { server } from "../helpers/server";

vi.mock("@/features/local-visibility-report/exportReport", () => ({
  renderLocalVisibilityReportBlob: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
}));
vi.mock("@/features/local-visibility-report/LocalVisibilityReportTemplate", async () => {
  const { forwardRef } = await import("react");
  return { default: forwardRef<HTMLDivElement, { data: { businessName: string } }>((props, ref) => <div ref={ref}>{props.data.businessName}</div>) };
});

import RedrawSnapshotsPage from "@features/admin/pages/RedrawSnapshotsPage";

const report = (businessName: string) => ({
  data: { businessName, reviewCount: "19", rating: "4.9" },
  mapPresentation: { mapZoom: 1, mapPosition: { x: 0, y: 0 } },
});

describe("RedrawSnapshotsPage", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
  afterAll(() => server.close());

  it("redraws only pictures made before today and uploads each one", async () => {
    const uploaded: string[] = [];
    server.use(
      http.get("/api/instantly/enrollment/redraw-queue", () => HttpResponse.json([
        { reportId: "r1", businessName: "Old One", snapshotGeneratedAt: "2026-09-01T00:00:00Z" },
        { reportId: "r2", businessName: "Old Two", snapshotGeneratedAt: null },
        { reportId: "r3", businessName: "Done Today", snapshotGeneratedAt: new Date().toISOString() },
      ])),
      http.get("/api/local-visibility/reports/:id", ({ params }) => HttpResponse.json(report(String(params.id)))),
      http.post("/api/local-visibility/reports/:id/snapshot", ({ params }) => {
        uploaded.push(String(params.id));
        return HttpResponse.json({ snapshotGeneratedAt: new Date().toISOString() });
      }),
    );
    renderWithProviders(<RedrawSnapshotsPage />, { route: "/admin/tools/redraw-report-pictures" });
    expect(await screen.findByText("2 of 3 pictures still need redrawing")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-redraw-start"));
    await waitFor(() => expect(screen.getByTestId("text-redraw-progress")).toHaveTextContent("2 of 2 done"));
    expect(uploaded).toEqual(["r1", "r2"]);
  });

  it("redraws pictures drawn today when asked", async () => {
    const uploaded: string[] = [];
    server.use(
      http.get("/api/instantly/enrollment/redraw-queue", () => HttpResponse.json([
        { reportId: "r3", businessName: "Done Today", snapshotGeneratedAt: new Date().toISOString() },
      ])),
      http.get("/api/local-visibility/reports/:id", ({ params }) => HttpResponse.json(report(String(params.id)))),
      http.post("/api/local-visibility/reports/:id/snapshot", ({ params }) => {
        uploaded.push(String(params.id));
        return HttpResponse.json({});
      }),
    );
    renderWithProviders(<RedrawSnapshotsPage />, { route: "/admin/tools/redraw-report-pictures" });
    expect(await screen.findByText("0 of 1 pictures still need redrawing")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("checkbox-redraw-include-today"));
    expect(await screen.findByText("1 of 1 pictures still need redrawing")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-redraw-start"));
    await waitFor(() => expect(uploaded).toEqual(["r3"]));
  });
});
