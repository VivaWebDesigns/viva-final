import { describe, expect, it, vi } from "vitest";

vi.mock("../../server/db", () => ({ db: {} }));

import { scoreCalls, summarizeCalls } from "../../server/features/crm-activity/service";

const call = (outcome: string, hour: number, openedLead = true, at = "2026-10-30T14:00:00Z") =>
  ({ userId: "richard", outcome, hour, openedLead, completedAt: at });

describe("setter call stats", () => {
  it("counts dials, conversations, appointments, outcomes, pace and unopened calls", () => {
    const stats = summarizeCalls([
      call("No answer", 9, true, "2026-10-30T13:05:00Z"),
      call("Left voicemail", 9),
      call("Call back", 10),
      call("Appointment set", 10),
      call("Not interested", 11, false),
      call("Wrong number", 11, true, "2026-10-30T15:40:00Z"),
    ]);

    expect(stats).toMatchObject({ dials: 6, conversations: 3, appointments: 1, unopenedCalls: 1 });
    expect(stats.outcomes).toEqual({
      "No answer": 1, "Left voicemail": 1, "Call back": 1, "Appointment set": 1, "Not interested": 1, "Wrong number": 1,
    });
    expect(stats.dialsByHour.slice(9, 12)).toEqual([2, 2, 2]);
    expect(stats.firstCallAt).toBe("2026-10-30T13:05:00.000Z");
    expect(stats.lastCallAt).toBe("2026-10-30T15:40:00.000Z");
  });

  it("scores a week against 60 dials a day, 9 conversations a day and 3 appointments a week", () => {
    const { score, breakdown } = scoreCalls({
      businessDays: 5, dials: 240, conversations: 36, appointments: 3,
      callBacksDue: 4, callBacksKept: 3, activeMs: 5 * 30 * 60 * 1000, activeDays: 5,
    });

    // 240/300 = 80, 36/45 = 80, 3/3 = 100, 3/4 = 75, time 100, days 100
    expect(breakdown).toEqual({ dials: 80, conversations: 80, appointments: 100, callBacks: 75, activity: 100, consistency: 100 });
    // 80×.35 + 80×.2 + 100×.15 + 75×.15 + 100×.1 + 100×.05 = 85.25
    expect(score).toBe(85);
  });

  it("does not count missed call-backs when none were due, and caps each part at 100", () => {
    const { breakdown } = scoreCalls({
      businessDays: 1, dials: 200, conversations: 0, appointments: 0,
      callBacksDue: 0, callBacksKept: 0, activeMs: 0, activeDays: 0,
    });
    expect(breakdown.dials).toBe(100);
    expect(breakdown.callBacks).toBe(100);
  });
});
