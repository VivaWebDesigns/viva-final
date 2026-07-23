import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { CsvImportModal } from "@features/crm/CsvImportExportModal";
import { renderWithProviders } from "../helpers/renderWithProviders";
import { server } from "../helpers/server";

describe("Local Falcon import clipboard", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  const renderModal = () => {
    server.use(
      http.get("/api/crm/leads/assignable-users", () => HttpResponse.json([])),
    );
    return renderWithProviders(<CsvImportModal open onClose={() => undefined} />);
  };

  it("focuses the import box and accepts pasted JSON text", async () => {
    renderModal();
    const zone = screen.getByTestId("local-falcon-package-dropzone");

    fireEvent.click(zone);
    expect(zone).toHaveFocus();

    fireEvent.paste(zone, {
      clipboardData: {
        files: [],
        getData: () => "```json\n{\"batch\":{\"batch_id\":\"test\"},\"prospects\":[]}\n```",
      },
    });

    expect(await screen.findByText("batch.json")).toBeInTheDocument();
    expect(screen.getByTestId("button-start-import")).toBeEnabled();
  });

  it("uses pasted JSON text when the clipboard also contains an image", async () => {
    renderModal();
    const zone = screen.getByTestId("local-falcon-package-dropzone");
    const clipboardImage = new File(["image"], "clipboard.png", { type: "image/png" });

    fireEvent.paste(zone, {
      clipboardData: {
        files: [clipboardImage],
        getData: (type: string) => type === "text/plain"
          ? "{\"batch\":{\"batch_id\":\"test\"},\"prospects\":[]}"
          : "",
      },
    });

    expect(await screen.findByText("batch.json")).toBeInTheDocument();
    expect(screen.queryByText(/paste the json manifest first/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("button-start-import")).toBeEnabled();
  });

  it("shows a useful error when pasted text is not JSON", async () => {
    renderModal();
    const zone = screen.getByTestId("local-falcon-package-dropzone");

    fireEvent.paste(zone, {
      clipboardData: {
        files: [],
        getData: () => "this is not JSON",
      },
    });

    expect(await screen.findByText("The pasted clipboard text is not valid JSON.")).toBeInTheDocument();
    expect(screen.getByTestId("button-start-import")).toBeDisabled();
  });

  it("shows the image uploader only after automatic Local Falcon retrieval fails", async () => {
    server.use(
      http.post("/api/crm/leads/import-local-falcon/preview", () => HttpResponse.json({
        code: "LOCAL_FALCON_IMAGE_FETCH_FAILED",
        message: "Local Falcon could not retrieve 1 official map.",
        failures: [{
          placeId: "ChIJ-test-1",
          companyName: "Acme Roofing",
          reportKey: "abcdef123456789",
          reason: "Local Falcon returned HTTP 404",
        }],
      }, { status: 422 })),
    );
    renderModal();
    expect(screen.queryByTestId("local-falcon-image-fallback")).not.toBeInTheDocument();

    fireEvent.paste(screen.getByTestId("local-falcon-package-dropzone"), {
      clipboardData: {
        files: [],
        getData: () => "{\"batch\":{\"batch_id\":\"test\"},\"prospects\":[]}",
      },
    });
    fireEvent.click(screen.getByTestId("button-start-import"));

    expect(await screen.findByTestId("local-falcon-image-fallback")).toBeInTheDocument();
    expect(screen.getByText(/name the file/i)).toHaveTextContent("ChIJ-test-1.png");
    expect(screen.getByText("Last error: Local Falcon returned HTTP 404")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry automatic retrieval" })).toBeEnabled();
  });

  it("shows automatically retrieved maps with the approved centered crop", async () => {
    server.use(
      http.post("/api/crm/leads/import-local-falcon/preview", () => HttpResponse.json({
        batchId: "MONROE-NC-PLUMBING-20260722-01",
        market: { city: "Monroe", state: "NC" },
        trade: "plumbing",
        keyword: "plumber near me",
        scanSpec: { grid_size: "7x7", radius_miles: 2.5 },
        batchAlreadyImported: false,
        newCount: 1,
        existingCount: 0,
        flaggedCount: 0,
        sourceMode: "local_falcon",
        rows: [{
          row: 1,
          placeId: "ChIJ-test-1",
          companyName: "Boda Plumbing, Inc.",
          address: "1909 Tower Industrial Dr",
          heatmapFile: "Official Local Falcon image",
          heatmapPreviewDataUrl: "data:image/png;base64,aGVhdG1hcA==",
          heatmapSha256: "a".repeat(64),
          heatmapSourceUrl: "https://lf-static-v2.localfalcon.com/image/279b8ac00c7ec41",
          mapPresentation: {
            mapZoom: 160,
            mapPosition: { x: 0, y: 0 },
          },
          reportData: {
            businessName: "Boda Plumbing, Inc.",
            address: "1909 Tower Industrial Dr, Monroe, NC 28110",
            rating: "5",
            reviewCount: "60",
            searchPhrase: "plumber near me",
            market: "Monroe, NC",
            averagePosition: "4.45",
            gridSize: "7x7",
            radius: "2.5",
            heatmapImageUrl: "data:image/png;base64,aGVhdG1hcA==",
          },
          outcome: "new",
        }],
      })),
    );
    renderModal();

    fireEvent.paste(screen.getByTestId("local-falcon-package-dropzone"), {
      clipboardData: {
        files: [],
        getData: () => "{\"batch\":{\"batch_id\":\"test\"},\"prospects\":[]}",
      },
    });
    fireEvent.click(screen.getByTestId("button-start-import"));

    expect(await screen.findByAltText("Uploaded Local Falcon ranking heatmap")).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.6)",
    });
  });
});
