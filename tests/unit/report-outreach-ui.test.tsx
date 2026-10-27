import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers/renderWithProviders";
import CompleteTaskModal from "../../client/src/components/CompleteTaskModal";

afterEach(cleanup);

function openTask(taskType: string) {
  renderWithProviders(<CompleteTaskModal open onClose={vi.fn()} outcomeMode="new-lead"
    task={{ id: "task-1", title: "Report follow-up", leadId: "lead-1", opportunityId: "opp-1", taskType }} />);
  fireEvent.click(screen.getByTestId("select-outcome"));
}

describe("report outreach completion form", () => {
  it("shows email-response outcomes rather than the old call outcomes", async () => {
    openTask("report_email_followup");
    expect(await screen.findByTestId("option-outcome-interested")).toBeInTheDocument();
    expect(screen.getByTestId("option-outcome-optedOut")).toBeInTheDocument();
    expect(screen.getByTestId("option-outcome-emailBounced")).toBeInTheDocument();
    expect(screen.queryByTestId("option-outcome-noAnswer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("option-outcome-noResponse")).not.toBeInTheDocument();
    expect(screen.getByText("Open lead to email the report")).toHaveAttribute("href", "/admin/crm/leads/lead-1");
  });
  it("offers No Response only for the final review task", async () => {
    openTask("report_email_review");
    expect(await screen.findByTestId("option-outcome-noResponse")).toHaveTextContent("pause outreach");
  });
  it("walks a call task through the step-by-step call prompt", async () => {
    renderWithProviders(<CompleteTaskModal open onClose={vi.fn()}
      task={{ id: "task-1", title: "Call lead", leadId: "lead-1", opportunityId: "opp-1", taskType: "call" }} />);
    expect(screen.queryByTestId("select-outcome")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("call-answered"));
    fireEvent.click(screen.getByTestId("answered-sent-sms"));
    fireEvent.click(screen.getByTestId("after-sms-call-back"));
    expect(screen.getByTestId("input-call-date")).toBeInTheDocument();
    expect(screen.getByTestId("button-call-save")).toBeDisabled();
    fireEvent.click(screen.getByTestId("button-call-back-step"));
    expect(screen.getByTestId("after-sms-interested")).toBeInTheDocument();
  });
});
