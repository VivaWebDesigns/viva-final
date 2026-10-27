import { describe, expect, it } from "vitest";
import { CALL_OUTCOME_STAGE, CALL_OUTCOMES, canSetterMoveStage, isSetterWorkingStage } from "@shared/callPipeline";

describe("call pipeline rules", () => {
  it("lets setters move leads only among their own stages or to Closed – Lost", () => {
    expect(canSetterMoveStage("new-lead", "attempted")).toBe(true);
    expect(canSetterMoveStage("contacted", "attempted")).toBe(true);
    expect(canSetterMoveStage("attempted", "closed-lost")).toBe(true);
    expect(canSetterMoveStage("contacted", "demo-scheduled")).toBe(false);
    expect(canSetterMoveStage("contacted", "closed-won")).toBe(false);
  });

  it("locks setters out once a lead reaches Call Scheduled", () => {
    expect(isSetterWorkingStage("demo-scheduled")).toBe(false);
    expect(canSetterMoveStage("demo-scheduled", "closed-lost")).toBe(false);
    expect(canSetterMoveStage("demo-completed", "contacted")).toBe(false);
  });

  it("maps every call outcome to its stage", () => {
    expect(CALL_OUTCOME_STAGE[CALL_OUTCOMES.leftVoicemail]).toBe("attempted");
    expect(CALL_OUTCOME_STAGE[CALL_OUTCOMES.noVoicemail]).toBe("attempted");
    expect(CALL_OUTCOME_STAGE[CALL_OUTCOMES.wrongNumber]).toBe("closed-lost");
    expect(CALL_OUTCOME_STAGE[CALL_OUTCOMES.appointmentSet]).toBe("demo-scheduled");
    expect(CALL_OUTCOME_STAGE[CALL_OUTCOMES.callBack]).toBe("contacted");
    expect(CALL_OUTCOME_STAGE[CALL_OUTCOMES.notInterested]).toBe("closed-lost");
  });
});
