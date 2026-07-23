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

    expect((await screen.findAllByText("batch.json")).length).toBeGreaterThan(1);
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
});
