import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LocalVisibilityReportPage from "@features/local-visibility-report/LocalVisibilityReportPage";

describe("LocalVisibilityReportPage", () => {
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
});
