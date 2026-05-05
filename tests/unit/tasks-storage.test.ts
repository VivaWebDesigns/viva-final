import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect, mockUpdate, setPayloads } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  setPayloads: [] as Record<string, unknown>[],
}));

vi.mock("../../server/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
  },
}));

import { getOverdueTasks, syncOpenTaskOwnershipForLeadIds } from "../../server/features/tasks/storage";

function selectRows(rows: unknown[]) {
  return {
    from: () => ({
      innerJoin: () => ({
        where: () => Promise.resolve(rows),
      }),
      leftJoin: () => ({
        where: () => Promise.resolve(rows),
      }),
      where: () => Promise.resolve(rows),
    }),
  };
}

function selectOrderedRows(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        orderBy: () => Promise.resolve(rows),
      }),
    }),
  };
}

function updateRows(rows: unknown[]) {
  return {
    set: (payload: Record<string, unknown>) => {
      setPayloads.push(payload);
      return {
        where: () => ({
          returning: () => Promise.resolve(rows),
        }),
      };
    },
  };
}

describe("syncOpenTaskOwnershipForLeadIds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T14:00:00Z"));
    mockSelect.mockReset();
    mockUpdate.mockReset();
    setPayloads.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves stale automation tasks untouched and reschedules current/manual overdue tasks to today", async () => {
    mockSelect
      .mockReturnValueOnce(selectRows([
        { id: "opp-1", leadId: "lead-1", stageSlug: "demo-completed" },
      ]))
      .mockReturnValueOnce(selectRows([
        {
          id: "stale-new-lead-task",
          leadId: "lead-1",
          opportunityId: "opp-1",
          triggerStageSlug: "new-lead",
          dueDate: new Date("2026-05-01T12:00:00Z"),
        },
        {
          id: "current-demo-task",
          leadId: "lead-1",
          opportunityId: "opp-1",
          triggerStageSlug: "demo-completed",
          dueDate: new Date("2026-05-01T12:00:00Z"),
        },
        {
          id: "manual-task",
          leadId: "lead-1",
          opportunityId: "opp-1",
          triggerStageSlug: null,
          dueDate: new Date("2026-05-01T12:00:00Z"),
        },
        {
          id: "future-current-task",
          leadId: "lead-1",
          opportunityId: "opp-1",
          triggerStageSlug: "demo-completed",
          dueDate: new Date("2026-05-10T12:00:00Z"),
        },
      ]));
    mockUpdate
      .mockReturnValueOnce(updateRows([{ id: "current-demo-task" }, { id: "manual-task" }]))
      .mockReturnValueOnce(updateRows([{ id: "future-current-task" }]));

    const updatedCount = await syncOpenTaskOwnershipForLeadIds(["lead-1"], "rep-2");

    expect(updatedCount).toBe(3);
    expect(setPayloads).toHaveLength(2);
    expect(setPayloads[0]).toMatchObject({ assignedTo: "rep-2" });
    expect(setPayloads[0].dueDate).toBeInstanceOf(Date);
    expect((setPayloads[0].dueDate as Date).toDateString()).toBe(new Date().toDateString());
    expect(setPayloads[1]).toEqual({ assignedTo: "rep-2" });
  });

  it("does nothing when there are no lead ids", async () => {
    const updatedCount = await syncOpenTaskOwnershipForLeadIds([], "rep-2");

    expect(updatedCount).toBe(0);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("open task bucket relevance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-05T14:00:00Z"));
    mockSelect.mockReset();
    mockUpdate.mockReset();
    setPayloads.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("excludes open automation tasks from older pipeline stages", async () => {
    const staleTask = {
      id: "stale-new-lead-task",
      title: "Contact lead",
      notes: null,
      taskType: "follow_up",
      dueDate: new Date("2026-05-01T12:00:00Z"),
      completed: false,
      completedAt: null,
      assignedTo: "rep-2",
      opportunityId: "opp-1",
      leadId: null,
      contactId: null,
      companyId: null,
      createdBy: null,
      createdAt: new Date("2026-05-01T12:00:00Z"),
      followUpTime: null,
      followUpTimezone: null,
      outcome: null,
      completionNote: null,
    };
    const currentTask = {
      ...staleTask,
      id: "current-demo-task",
      title: "Record demo outcome",
    };

    mockSelect
      .mockReturnValueOnce(selectOrderedRows([staleTask, currentTask]))
      .mockReturnValueOnce(selectRows([
        { generatedTaskId: "stale-new-lead-task", triggerStageSlug: "new-lead" },
        { generatedTaskId: "current-demo-task", triggerStageSlug: "demo-completed" },
      ]))
      .mockReturnValueOnce(selectRows([
        { opportunityId: "opp-1", stageSlug: "demo-completed" },
      ]))
      .mockReturnValueOnce(selectRows([
        { generatedTaskId: "current-demo-task", triggerStageSlug: "demo-completed", templateId: "tpl-2", createdAt: new Date("2026-05-01T12:00:00Z") },
      ]))
      .mockReturnValueOnce(selectRows([
        { opportunityId: "opp-1", slug: "demo-completed" },
      ]));

    const tasks = await getOverdueTasks();

    expect(tasks.map((task) => task.id)).toEqual(["current-demo-task"]);
    expect(tasks[0].automationMeta?.triggerStageSlug).toBe("demo-completed");
  });
});
