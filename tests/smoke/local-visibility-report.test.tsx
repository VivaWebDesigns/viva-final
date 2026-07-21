import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LocalVisibilityReportPage from "@features/local-visibility-report/LocalVisibilityReportPage";

describe("LocalVisibilityReportPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("starts with the approved scan defaults and a disabled export", () => {
    render(<LocalVisibilityReportPage />);

    expect(screen.getByLabelText("Grid size")).toHaveValue("7 × 7");
    expect(screen.getByLabelText("Radius (miles)")).toHaveValue(2.5);
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
    expect(mapZoom).toHaveValue("100");
    fireEvent.change(mapZoom, { target: { value: "125" } });
    expect(heatmap).toHaveStyle({ transform: "scale(1.25)" });
  });
});
