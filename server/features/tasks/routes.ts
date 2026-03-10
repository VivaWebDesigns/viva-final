import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as taskStorage from "./storage";

const router = Router();

const createTaskSchema = z.object({
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  dueDate: z.string().datetime(),
  opportunityId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  dueDate: z.string().datetime().optional(),
  completed: z.boolean().optional(),
}).strict();

router.get("/due-today", requireRole("admin", "sales_rep", "developer"), async (_req, res) => {
  try {
    const [dueTodayTasks, overdueTasks] = await Promise.all([
      taskStorage.getTasksDueToday(),
      taskStorage.getOverdueTasks(),
    ]);
    res.json({ dueToday: dueTodayTasks, overdue: overdueTasks });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/for-opportunity/:id", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const tasks = await taskStorage.getTasksForOpportunity(req.params.id as string);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/for-lead/:id", requireRole("admin", "sales_rep", "developer"), async (req, res) => {
  try {
    const tasks = await taskStorage.getTasksForLead(req.params.id as string);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const validated = createTaskSchema.parse(req.body);
    const task = await taskStorage.createTask({
      ...validated,
      dueDate: new Date(validated.dueDate),
      createdBy: req.authUser?.id,
      completed: false,
    });
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "followup_task",
      entityId: task.id,
      metadata: { title: task.title, dueDate: task.dueDate },
      ipAddress: req.ip,
    });
    res.status(201).json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id/complete", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const task = await taskStorage.completeTask(req.params.id as string);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "followup_task",
      entityId: task.id,
      metadata: { action: "completed", title: task.title },
      ipAddress: req.ip,
    });
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.put("/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    const validated = updateTaskSchema.parse(req.body);
    const data: Record<string, unknown> = { ...validated };
    if (validated.dueDate) data.dueDate = new Date(validated.dueDate);
    if (validated.completed === false) data.completedAt = null;
    const task = await taskStorage.updateTask(req.params.id as string, data as any);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "followup_task",
      entityId: task.id,
      metadata: { title: task.title },
      ipAddress: req.ip,
    });
    res.json(task);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/:id", requireRole("admin", "sales_rep"), async (req, res) => {
  try {
    await taskStorage.deleteTask(req.params.id as string);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "followup_task",
      entityId: req.params.id as string,
      ipAddress: req.ip,
    });
    res.json({ message: "Task deleted" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
