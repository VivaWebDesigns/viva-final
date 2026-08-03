import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SalesPriorityBadge from "@/components/SalesPriorityBadge";
import { renderWithProviders } from "../helpers/renderWithProviders";

describe("SalesPriorityBadge", () => {
  it("shows the priority and exposes the concise reason", () => {
    renderWithProviders(
      <SalesPriorityBadge
        salesPriority={{
          priority: 3,
          reason: "No website and active paid-lead usage.",
        }}
        testId="priority"
      />,
    );

    expect(screen.getByTestId("priority")).toHaveTextContent("3");
    expect(screen.getByTestId("priority")).toHaveAttribute(
      "aria-label",
      "Priority 3 — Strong prospect: No website and active paid-lead usage.",
    );
  });

  it("renders nothing without a supported priority", () => {
    const { container } = renderWithProviders(
      <SalesPriorityBadge priority={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
