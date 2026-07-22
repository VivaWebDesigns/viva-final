import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toBlob } from "html-to-image";
import LocalVisibilityReportPage from "@features/local-visibility-report/LocalVisibilityReportPage";
import type { LocalVisibilityReportData } from "@features/local-visibility-report/types";

vi.mock("html-to-image", () => ({ toBlob: vi.fn() }));

const completeReport: LocalVisibilityReportData = {
  businessName: "Carolina Custom Automation",
  address: "2012 SC-160 STE. 106, Fort Mill, SC 29708",
  rating: "5.0",
  reviewCount: "19",
  searchPhrase: "control access near me",
  market: "Fort Mill, SC",
  averagePosition: "1.71",
  gridSize: "7 × 7",
  radius: "2.5",
  heatmapImageUrl: "data:image/png;base64,aGVhdG1hcA==",
};

describe("LocalVisibilityReportPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts with the approved scan defaults and a disabled export", () => {
    render(<LocalVisibilityReportPage />);

    expect(screen.getByLabelText("Grid size")).toHaveValue("7 × 7");
    expect(screen.getByLabelText("Radius (miles)")).toHaveValue(2.5);
    expect(screen.getByTestId("map-controls")).toBeVisible();
    expect(screen.getByTestId("input-map-zoom")).toBeDisabled();
    expect(screen.getByText("Add a heatmap to enable map controls.")).toBeInTheDocument();
    expect(screen.getByTestId("button-copy-report")).toBeDisabled();
    expect(screen.getByTestId("button-download-report")).toBeDisabled();
  });

  it("shows validation feedback before generating an incomplete report", async () => {
    render(<LocalVisibilityReportPage />);
    const generateButton = screen.getByTestId("button-generate-preview");
    fireEvent.submit(generateButton.closest("form") as HTMLFormElement);

    expect(await screen.findByText("Business name is required.")).toBeInTheDocument();
    expect(await screen.findByText("Search phrase is required.")).toBeInTheDocument();
    expect(await screen.findByText("Upload a heatmap image.")).toBeInTheDocument();
  });

  it("keeps paste-area clicks separate from the file picker", () => {
    render(<LocalVisibilityReportPage />);
    const fileInput = screen.getByTestId("input-smart-paste-upload") as HTMLInputElement;
    const inputClick = vi.spyOn(fileInput, "click");

    fireEvent.click(screen.getByTestId("smart-paste-zone"));
    expect(inputClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Choose files" }));
    expect(inputClick).toHaveBeenCalledOnce();
  });

  it("copies the full-resolution report PNG to the clipboard", async () => {
    const reportBlob = new Blob(["report"], { type: "image/png" });
    vi.mocked(toBlob).mockResolvedValue(reportBlob);
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { write } });
    vi.stubGlobal("ClipboardItem", class ClipboardItemMock {
      constructor(public items: Record<string, Blob | Promise<Blob>>) {}
    });

    render(<LocalVisibilityReportPage initialData={completeReport} />);
    const generateButton = screen.getByTestId("button-generate-preview");
    fireEvent.submit(generateButton.closest("form") as HTMLFormElement);
    const copyButton = screen.getByTestId("button-copy-report");
    expect(copyButton).toBeEnabled();
    fireEvent.click(copyButton);

    await waitFor(() => expect(write).toHaveBeenCalledOnce());
    expect(toBlob).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({
      width: 1080,
      height: 1920,
      canvasWidth: 1080,
      canvasHeight: 1920,
      pixelRatio: 1,
    }));
    const clipboardItem = write.mock.calls[0][0][0] as { items: Record<string, Promise<Blob>> };
    await expect(clipboardItem.items["image/png"]).resolves.toBe(reportBlob);
  });

  it("autofills fields and assigns the heatmap after two screenshots are added", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        reportImageIndex: 0,
        heatmapImageIndex: 1,
        fields: {
          businessName: "The Shower Glass",
          address: "8334 Pineville-Matthews Rd Ste 103/185, Charlotte, NC 28226",
          rating: "5.0",
          reviewCount: "40",
          searchPhrase: "frameless shower glass near me",
          market: "Charlotte, NC",
          averagePosition: "3.96",
          gridSize: "7 × 7",
          radius: "8.0",
        },
        lowConfidenceFields: ["market"],
        heatmapImageDataUrl: "data:image/png;base64,Y3JvcHBlZC1oZWF0bWFw",
      }),
    } as Response);

    render(<LocalVisibilityReportPage />);
    const reportImage = new File(["report"], "scan-report.png", { type: "image/png" });
    const heatmapImage = new File(["heatmap"], "heatmap.png", { type: "image/png" });

    fireEvent.change(screen.getByTestId("input-smart-paste-upload"), {
      target: { files: [reportImage, heatmapImage] },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(await screen.findByTestId("smart-paste-success")).toBeInTheDocument();
    expect(screen.getByLabelText("Business name")).toHaveValue("The Shower Glass");
    expect(screen.getByLabelText("Average Google Maps position")).toHaveValue(3.96);
    expect(screen.getByLabelText("Grid size")).toHaveValue("7 × 7");
    expect(screen.getByLabelText("Radius (miles)")).toHaveValue(8);
    expect(screen.getByText("Check this extracted value.")).toBeInTheDocument();
    const heatmap = screen.getByAltText("Uploaded Local Falcon ranking heatmap");
    expect(heatmap).toHaveAttribute("src", "data:image/png;base64,Y3JvcHBlZC1oZWF0bWFw");

    const mapZoom = screen.getByTestId("input-map-zoom");
    const businessHeading = screen.getByText("Business");
    expect(screen.getByTestId("map-controls").nextElementSibling).toContainElement(businessHeading);
    expect(mapZoom).toBeEnabled();
    expect(mapZoom).toHaveValue("100");
    expect(mapZoom).toHaveAttribute("min", "70");
    fireEvent.change(mapZoom, { target: { value: "125" } });
    expect(heatmap).toHaveStyle({ transform: "translate(0px, 0px) scale(1.25)" });

    const heatmapFrame = screen.getByTestId("report-heatmap");
    vi.spyOn(heatmapFrame, "getBoundingClientRect").mockReturnValue({
      width: 500,
      height: 480,
      top: 0,
      right: 500,
      bottom: 480,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.pointerDown(heatmapFrame, { pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(heatmapFrame, { pointerId: 1, clientX: 125, clientY: 90 });
    fireEvent.pointerUp(heatmapFrame, { pointerId: 1, clientX: 125, clientY: 90 });
    expect(heatmap).toHaveStyle({ transform: "translate(50px, -20px) scale(1.25)" });
  });
});
