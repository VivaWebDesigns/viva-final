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

    expect(await screen.findByTestId("local-falcon-primary-file")).toHaveTextContent("batch.json");
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

    expect(await screen.findByTestId("local-falcon-primary-file")).toHaveTextContent("batch.json");
    expect(screen.queryByText(/paste the json manifest first/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("button-start-import")).toBeEnabled();
  });

  it("accepts a Scale-First batch without a sidecar", async () => {
    renderModal();
    const zone = screen.getByTestId("local-falcon-package-dropzone");

    fireEvent.paste(zone, {
      clipboardData: {
        files: [],
        getData: () => JSON.stringify({ workflow: "scale_first_v2", batch: { batch_id: "charlotte-b01" }, prospects: [] }),
      },
    });
    expect(await screen.findByTestId("local-falcon-primary-file")).toHaveTextContent("batch.json");
    expect(screen.getByTestId("button-start-import")).toBeEnabled();
  });

  it("rejects a retired competitor sidecar pasted before a batch", async () => {
    renderModal();
    const zone = screen.getByTestId("local-falcon-package-dropzone");

    fireEvent.paste(zone, {
      clipboardData: { files: [], getData: () => JSON.stringify({ version: 2, batch_id: "charlotte-b01", reports: {} }) },
    });
    expect(await screen.findByText("The pasted JSON is not a recognized batch.json artifact.")).toBeInTheDocument();
    expect(screen.getByTestId("button-start-import")).toBeDisabled();

    fireEvent.paste(zone, {
      clipboardData: {
        files: [],
        getData: () => JSON.stringify({ workflow: "scale_first_v2", batch: { batch_id: "charlotte-b01" }, prospects: [] }),
      },
    });
    expect(await screen.findByTestId("local-falcon-primary-file")).toHaveTextContent("batch.json");
    expect(screen.getByTestId("button-start-import")).toBeEnabled();
  });

  it("submits only batch.json in the multipart request", async () => {
    let submittedPackage: File | null = null;
    server.use(
      http.post("/api/crm/leads/import-local-falcon/preview", async ({ request }) => {
        const form = await request.formData();
        submittedPackage = form.get("package") as File | null;
        expect(form.get("competitors")).toBeNull();
        return HttpResponse.json({
          batchId: "charlotte-b01",
          market: { city: "Charlotte", state: "NC" },
          trade: "tree service",
          keyword: "tree service near me",
          scanSpec: { grid_size: "7x7", radius_miles: 3 },
          batchAlreadyImported: false,
          newCount: 0,
          variationCount: 0,
          existingCount: 0,
          flaggedCount: 0,
          sourceMode: "local_falcon",
          rows: [],
        });
      }),
    );
    renderModal();
    const zone = screen.getByTestId("local-falcon-package-dropzone");
    const batch = { workflow: "scale_first_v2", batch: { batch_id: "charlotte-b01" }, prospects: [] };

    fireEvent.paste(zone, { clipboardData: { files: [], getData: () => JSON.stringify(batch) } });
    fireEvent.click(screen.getByTestId("button-start-import"));

    expect(await screen.findByTestId("local-falcon-import-preview")).toBeInTheDocument();
    expect(submittedPackage?.name).toBe("batch.json");
    expect(JSON.parse(await submittedPackage!.text())).toEqual(batch);
  });

  it("rejects competitor sidecar JSON without replacing the loaded batch", async () => {
    renderModal();
    const zone = screen.getByTestId("local-falcon-package-dropzone");
    fireEvent.paste(zone, {
      clipboardData: {
        files: [],
        getData: () => JSON.stringify({ workflow: "scale_first_v2", batch: { batch_id: "charlotte-b01" }, prospects: [] }),
      },
    });
    fireEvent.paste(zone, {
      clipboardData: { files: [], getData: () => JSON.stringify({ version: 2, batch_id: "wrong-batch", reports: {} }) },
    });
    expect(await screen.findByText("The pasted JSON is not a recognized batch.json artifact.")).toBeInTheDocument();
    expect(screen.getByTestId("local-falcon-primary-file")).toHaveTextContent("batch.json");
    expect(screen.getByTestId("button-start-import")).toBeEnabled();
  });

  it("rejects valid JSON that is not a recognized Local Falcon artifact", async () => {
    renderModal();
    const zone = screen.getByTestId("local-falcon-package-dropzone");
    fireEvent.paste(zone, { clipboardData: { files: [], getData: () => "{}" } });
    expect(await screen.findByText("The pasted JSON is not a recognized batch.json artifact.")).toBeInTheDocument();
    expect(screen.getByTestId("button-start-import")).toBeDisabled();
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

  it("rejects a retired competitors.json file", async () => {
    renderModal();

    fireEvent.change(screen.getByTestId("input-csv-file"), {
      target: {
        files: [new File(["{}"], "competitors.json", { type: "application/json" })],
      },
    });

    expect(await screen.findByText(
      "competitors.json is retired. Choose or paste batch.json only.",
    )).toBeInTheDocument();
    expect(screen.getByTestId("button-start-import")).toBeDisabled();
  });

  it("allows map overrides before automatic Local Falcon retrieval", async () => {
    let uploadedOverrideName: string | null = null;
    server.use(
      http.post("/api/crm/leads/import-local-falcon/preview", async ({ request }) => {
        const form = await request.formData();
        uploadedOverrideName = (form.get("heatmaps") as File | null)?.name ?? null;
        return HttpResponse.json({
          batchId: "test",
          market: { city: "Charlotte", state: "NC" },
          trade: "plumbing",
          keyword: "plumber near me",
          scanSpec: { grid_size: "7x7", radius_miles: 3 },
          batchAlreadyImported: false,
          newCount: 0,
          variationCount: 0,
          existingCount: 0,
          flaggedCount: 0,
          sourceMode: "fallback",
          rows: [],
        });
      }),
    );
    renderModal();
    expect(screen.queryByTestId("local-falcon-image-overrides")).not.toBeInTheDocument();

    fireEvent.paste(screen.getByTestId("local-falcon-package-dropzone"), {
      clipboardData: {
        files: [],
        getData: () => "{\"batch\":{\"batch_id\":\"test\"},\"prospects\":[]}",
      },
    });

    expect(await screen.findByTestId("local-falcon-image-overrides")).toBeInTheDocument();
    const override = new File(["image"], "ChIJ-test-1.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("input-local-falcon-map-overrides"), {
      target: { files: [override] },
    });
    expect(screen.getByText("1 map override selected")).toBeInTheDocument();
    expect(screen.getByText("ChIJ-test-1.png")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-start-import"));
    expect(await screen.findByTestId("local-falcon-import-preview")).toBeInTheDocument();
    expect(uploadedOverrideName).toBe("ChIJ-test-1.png");
  });

  it("shows retrieval failures in the always-available map override panel", async () => {
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

    fireEvent.paste(screen.getByTestId("local-falcon-package-dropzone"), {
      clipboardData: {
        files: [],
        getData: () => "{\"batch\":{\"batch_id\":\"test\"},\"prospects\":[]}",
      },
    });
    fireEvent.click(screen.getByTestId("button-start-import"));

    expect(await screen.findByTestId("local-falcon-image-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("local-falcon-image-overrides")).toBeInTheDocument();
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
    expect(screen.getByTestId("local-falcon-scan-magnifier-trigger-position")).toHaveClass(
      "absolute",
      "right-2",
      "top-2",
      "z-20",
    );
    fireEvent.click(screen.getByRole("button", { name: "Magnify scan for Boda Plumbing, Inc." }));
    expect(await screen.findByTestId("local-falcon-scan-magnifier")).toBeInTheDocument();
    expect(screen.getByTestId("local-falcon-scan-magnifier-image")).toHaveAttribute(
      "src",
      "data:image/png;base64,aGVhdG1hcA==",
    );
    expect(screen.getByTestId("button-scan-zoom-fit")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("button-scan-zoom-200"));
    expect(screen.getByTestId("local-falcon-scan-magnifier-image")).toHaveStyle({ width: "200%" });
    fireEvent.click(screen.getByTestId("button-close-scan-magnifier"));
    expect(screen.queryByTestId("local-falcon-scan-magnifier")).not.toBeInTheDocument();
    expect(screen.getByTestId("select-local-falcon-lead-type")).toHaveTextContent("Choose SAB or Location Based");
    expect(screen.getByTestId("button-confirm-local-falcon-import")).toBeDisabled();
  });

  it("can confirm or clear every included report at once", async () => {
    const makeRow = (row: number, placeId: string, companyName: string) => ({
      row,
      placeId,
      companyName,
      address: `${row} Main St`,
      heatmapFile: "Official Local Falcon image",
      heatmapPreviewDataUrl: "data:image/png;base64,aGVhdG1hcA==",
      heatmapSha256: "a".repeat(64),
      heatmapSourceUrl: `https://lf-static-v2.localfalcon.com/image/${placeId}`,
      mapPresentation: {
        mapZoom: 160,
        mapPosition: { x: 0, y: 0 },
      },
      reportData: {
        businessName: companyName,
        address: `${row} Main St, Monroe, NC 28110`,
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
    });

    server.use(
      http.post("/api/crm/leads/import-local-falcon/preview", () => HttpResponse.json({
        batchId: "MONROE-NC-PLUMBING-20260722-01",
        market: { city: "Monroe", state: "NC" },
        trade: "plumbing",
        keyword: "plumber near me",
        scanSpec: { grid_size: "7x7", radius_miles: 2.5 },
        batchAlreadyImported: false,
        newCount: 2,
        existingCount: 0,
        flaggedCount: 0,
        sourceMode: "local_falcon",
        rows: [
          makeRow(1, "ChIJ-test-1", "Acme Plumbing"),
          makeRow(2, "ChIJ-test-2", "Bravo Plumbing"),
        ],
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

    const confirmAll = await screen.findByTestId("checkbox-confirm-all-local-falcon-previews");
    const firstReport = screen.getByTestId("checkbox-confirm-local-falcon-preview-1");
    const secondReport = screen.getByTestId("checkbox-confirm-local-falcon-preview-2");

    expect(confirmAll).not.toBeChecked();
    fireEvent.click(confirmAll);
    expect(confirmAll).toBeChecked();
    expect(firstReport).toBeChecked();
    expect(secondReport).toBeChecked();

    fireEvent.click(firstReport);
    expect(confirmAll).toBePartiallyChecked();
    expect(firstReport).not.toBeChecked();
    expect(secondReport).toBeChecked();

    fireEvent.click(confirmAll);
    expect(confirmAll).toBeChecked();
    expect(firstReport).toBeChecked();
    expect(secondReport).toBeChecked();

    fireEvent.click(confirmAll);
    expect(confirmAll).not.toBeChecked();
    expect(firstReport).not.toBeChecked();
    expect(secondReport).not.toBeChecked();
  });
});
