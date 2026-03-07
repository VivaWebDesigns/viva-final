import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import { chatMessages, user } from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const VALID_CHANNELS = ["general", "sales", "onboarding", "dev"] as const;

router.get("/channels", requireAuth, (_req, res) => {
  res.json([
    { id: "general", name: "General", description: "Team-wide announcements and conversation" },
    { id: "sales", name: "Sales", description: "Sales pipeline and deal discussions" },
    { id: "onboarding", name: "Onboarding", description: "Client onboarding coordination" },
    { id: "dev", name: "Dev", description: "Technical and development topics" },
  ]);
});

router.get("/messages", requireAuth, async (req, res) => {
  try {
    const channel = (req.query.channel as string) || "general";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;

    const rows = await db
      .select({
        id: chatMessages.id,
        channel: chatMessages.channel,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
        senderId: chatMessages.senderId,
        senderName: user.name,
        senderRole: user.role,
      })
      .from(chatMessages)
      .innerJoin(user, eq(chatMessages.senderId, user.id))
      .where(
        before
          ? and(eq(chatMessages.channel, channel), sql`${chatMessages.createdAt} < ${before}`)
          : eq(chatMessages.channel, channel)
      )
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    res.json(rows.reverse());
  } catch (err: any) {
    console.error("Chat messages error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/messages", requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      channel: z.string().default("general"),
      content: z.string().min(1).max(4000),
    });
    const { channel, content } = schema.parse(req.body);
    const senderId = req.authUser?.id;
    if (!senderId) return res.status(401).json({ message: "Unauthorized" });

    const [msg] = await db
      .insert(chatMessages)
      .values({ channel, content, senderId })
      .returning();

    const [sender] = await db.select({ name: user.name, role: user.role }).from(user).where(eq(user.id, senderId));

    res.status(201).json({ ...msg, senderName: sender?.name, senderRole: sender?.role });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/messages/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    await db.delete(chatMessages).where(eq(chatMessages.id, req.params.id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
