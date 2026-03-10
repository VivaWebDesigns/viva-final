import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  chatMessages, chatDmMessages, chatReadState, chatReactions, user,
} from "@shared/schema";
import { eq, desc, asc, and, or, sql, lt, gt, ilike } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const CHANNELS = [
  { id: "general",    name: "General",    description: "Anuncios y conversación del equipo" },
  { id: "ventas",     name: "Ventas",     description: "Pipeline de ventas y prospectos" },
  { id: "onboarding", name: "Onboarding", description: "Coordinación de incorporación de clientes" },
  { id: "dev",        name: "Dev",        description: "Temas técnicos y de desarrollo" },
];

// ── Channels with unread counts ───────────────────────────────────────

router.get("/channels", requireAuth, async (req, res) => {
  try {
    const userId = req.authUser?.id!;
    const result = await Promise.all(
      CHANNELS.map(async (ch) => {
        const [readState] = await db
          .select()
          .from(chatReadState)
          .where(and(eq(chatReadState.userId, userId), eq(chatReadState.channelId, ch.id)));

        let unreadCount = 0;
        if (readState) {
          const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(chatMessages)
            .where(and(eq(chatMessages.channel, ch.id), gt(chatMessages.createdAt, readState.lastReadAt)));
          unreadCount = count;
        }
        return { ...ch, unreadCount };
      })
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── Channel messages ──────────────────────────────────────────────────

router.get("/messages", requireAuth, async (req, res) => {
  try {
    const channel = (req.query.channel as string) || "general";
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const before = req.query.before as string | undefined;
    const parentId = req.query.parentId as string | undefined;

    const conditions: any[] = [eq(chatMessages.channel, channel)];
    if (before) conditions.push(lt(chatMessages.createdAt, new Date(before)));
    if (parentId) {
      conditions.push(eq(chatMessages.parentId, parentId));
    } else {
      conditions.push(sql`${chatMessages.parentId} IS NULL`);
    }

    const rows = await db
      .select({
        id: chatMessages.id,
        channel: chatMessages.channel,
        content: chatMessages.content,
        createdAt: chatMessages.createdAt,
        senderId: chatMessages.senderId,
        senderName: user.name,
        senderRole: user.role,
        parentId: chatMessages.parentId,
        isPinned: chatMessages.isPinned,
      })
      .from(chatMessages)
      .innerJoin(user, eq(chatMessages.senderId, user.id))
      .where(and(...conditions))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);

    const msgs = rows.reverse();

    if (msgs.length === 0) return res.json([]);

    const msgIds = msgs.map((m) => m.id);
    const reactions = await db
      .select()
      .from(chatReactions)
      .where(sql`${chatReactions.messageId} = ANY(ARRAY[${sql.join(msgIds.map((id) => sql`${id}`), sql`, `)}])`);

    const reactionMap: Record<string, { emoji: string; count: number; users: string[] }[]> = {};
    for (const r of reactions) {
      if (!reactionMap[r.messageId]) reactionMap[r.messageId] = [];
      const ex = reactionMap[r.messageId].find((x) => x.emoji === r.emoji);
      if (ex) { ex.count++; ex.users.push(r.userId); }
      else reactionMap[r.messageId].push({ emoji: r.emoji, count: 1, users: [r.userId] });
    }

    const threadCounts = await db
      .select({ parentId: chatMessages.parentId, count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(sql`${chatMessages.parentId} = ANY(ARRAY[${sql.join(msgIds.map((id) => sql`${id}`), sql`, `)}])`)
      .groupBy(chatMessages.parentId);
    const threadCountMap: Record<string, number> = {};
    for (const t of threadCounts) if (t.parentId) threadCountMap[t.parentId] = t.count;

    res.json(msgs.map((m) => ({
      ...m,
      reactions: reactionMap[m.id] ?? [],
      replyCount: threadCountMap[m.id] ?? 0,
    })));
  } catch (err: any) {
    console.error("Chat messages error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/messages", requireAuth, async (req, res) => {
  try {
    const { channel, content, parentId } = z.object({
      channel: z.string().default("general"),
      content: z.string().min(1).max(4000),
      parentId: z.string().optional(),
    }).parse(req.body);
    const senderId = req.authUser?.id!;

    const [msg] = await db.insert(chatMessages)
      .values({ channel, content, senderId, parentId: parentId || null })
      .returning();

    const [sender] = await db.select({ name: user.name, role: user.role }).from(user).where(eq(user.id, senderId));

    await db.insert(chatReadState)
      .values({ userId: senderId, channelId: channel, lastReadAt: msg.createdAt })
      .onConflictDoUpdate({ target: [chatReadState.userId, chatReadState.channelId], set: { lastReadAt: msg.createdAt } });

    res.status(201).json({ ...msg, senderName: sender?.name, senderRole: sender?.role, reactions: [], replyCount: 0 });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/messages/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    await db.delete(chatReactions).where(eq(chatReactions.messageId, req.params.id as string));
    await db.delete(chatMessages).where(eq(chatMessages.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── Mark channel read ─────────────────────────────────────────────────

router.post("/read", requireAuth, async (req, res) => {
  try {
    const { channelId } = z.object({ channelId: z.string() }).parse(req.body);
    const userId = req.authUser?.id!;
    await db.insert(chatReadState)
      .values({ userId, channelId, lastReadAt: new Date() })
      .onConflictDoUpdate({ target: [chatReadState.userId, chatReadState.channelId], set: { lastReadAt: new Date() } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ── Pinned messages ───────────────────────────────────────────────────

router.get("/pinned", requireAuth, async (req, res) => {
  const channel = (req.query.channel as string) || "general";
  const rows = await db
    .select({ id: chatMessages.id, content: chatMessages.content, createdAt: chatMessages.createdAt, senderName: user.name })
    .from(chatMessages)
    .innerJoin(user, eq(chatMessages.senderId, user.id))
    .where(and(eq(chatMessages.channel, channel), eq(chatMessages.isPinned, true)))
    .orderBy(desc(chatMessages.createdAt));
  res.json(rows);
});

router.put("/messages/:id/pin", requireRole("admin", "developer"), async (req, res) => {
  try {
    const { pinned } = z.object({ pinned: z.boolean() }).parse(req.body);
    await db.update(chatMessages).set({ isPinned: pinned }).where(eq(chatMessages.id, req.params.id as string));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ── Reactions ─────────────────────────────────────────────────────────

router.post("/messages/:id/react", requireAuth, async (req, res) => {
  try {
    const { emoji } = z.object({ emoji: z.string().max(8) }).parse(req.body);
    const userId = req.authUser?.id!;
    const messageId = req.params.id as string;

    const [existing] = await db.select().from(chatReactions)
      .where(and(eq(chatReactions.messageId, messageId), eq(chatReactions.userId, userId), eq(chatReactions.emoji, emoji)));

    if (existing) {
      await db.delete(chatReactions)
        .where(and(eq(chatReactions.messageId, messageId), eq(chatReactions.userId, userId), eq(chatReactions.emoji, emoji)));
      res.json({ toggled: false });
    } else {
      await db.insert(chatReactions).values({ messageId, userId, emoji });
      res.json({ toggled: true });
    }
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ── Message search ────────────────────────────────────────────────────

router.get("/search", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) return res.json([]);
    const channel = req.query.channel as string | undefined;
    const conditions: any[] = [ilike(chatMessages.content, `%${q}%`)];
    if (channel) conditions.push(eq(chatMessages.channel, channel));
    const rows = await db
      .select({ id: chatMessages.id, channel: chatMessages.channel, content: chatMessages.content, createdAt: chatMessages.createdAt, senderName: user.name })
      .from(chatMessages)
      .innerJoin(user, eq(chatMessages.senderId, user.id))
      .where(and(...conditions))
      .orderBy(desc(chatMessages.createdAt))
      .limit(25);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── Direct Messages ───────────────────────────────────────────────────

router.get("/dm/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.authUser?.id!;
    const rows = await db.execute(sql`
      SELECT
        CASE WHEN dm.sender_id = ${userId} THEN dm.recipient_id ELSE dm.sender_id END AS other_user_id,
        MAX(dm.created_at) AS last_message_at,
        (
          SELECT content FROM chat_dm_messages
          WHERE (sender_id = ${userId} AND recipient_id = CASE WHEN dm.sender_id = ${userId} THEN dm.recipient_id ELSE dm.sender_id END)
             OR (recipient_id = ${userId} AND sender_id = CASE WHEN dm.sender_id = ${userId} THEN dm.recipient_id ELSE dm.sender_id END)
          ORDER BY created_at DESC LIMIT 1
        ) AS last_content,
        COUNT(CASE WHEN dm.recipient_id = ${userId} AND dm.read_at IS NULL THEN 1 END)::int AS unread_count
      FROM chat_dm_messages dm
      WHERE dm.sender_id = ${userId} OR dm.recipient_id = ${userId}
      GROUP BY CASE WHEN dm.sender_id = ${userId} THEN dm.recipient_id ELSE dm.sender_id END
      ORDER BY MAX(dm.created_at) DESC
    `);

    const otherIds = (rows.rows as any[]).map((r) => r.other_user_id as string);
    if (!otherIds.length) return res.json([]);

    const users = await db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(sql`${user.id} = ANY(ARRAY[${sql.join(otherIds.map((id) => sql`${id}`), sql`, `)}])`);

    const userMap: Record<string, { id: string; name: string; role: string }> = {};
    for (const u of users) userMap[u.id] = u;

    res.json((rows.rows as any[]).map((r) => ({
      userId: r.other_user_id,
      userName: userMap[r.other_user_id]?.name ?? "Unknown",
      userRole: userMap[r.other_user_id]?.role ?? "",
      lastMessageAt: r.last_message_at,
      lastContent: r.last_content ?? "",
      unreadCount: Number(r.unread_count),
    })));
  } catch (err: any) {
    console.error("DM conversations error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/dm/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.authUser?.id!;
    const otherUserId = req.query.userId as string;
    if (!otherUserId) return res.status(400).json({ message: "userId required" });

    const rows = await db.select().from(chatDmMessages)
      .where(or(
        and(eq(chatDmMessages.senderId, userId), eq(chatDmMessages.recipientId, otherUserId)),
        and(eq(chatDmMessages.senderId, otherUserId), eq(chatDmMessages.recipientId, userId))
      ))
      .orderBy(asc(chatDmMessages.createdAt))
      .limit(100);

    await db.update(chatDmMessages)
      .set({ readAt: new Date() })
      .where(and(eq(chatDmMessages.recipientId, userId), eq(chatDmMessages.senderId, otherUserId), sql`${chatDmMessages.readAt} IS NULL`));

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/dm/messages", requireAuth, async (req, res) => {
  try {
    const { recipientId, content } = z.object({
      recipientId: z.string().min(1),
      content: z.string().min(1).max(4000),
    }).parse(req.body);
    const senderId = req.authUser?.id!;
    const [msg] = await db.insert(chatDmMessages).values({ senderId, recipientId, content }).returning();
    res.status(201).json(msg);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ── Users (for @mentions + DM picker) ────────────────────────────────

router.get("/users", requireAuth, async (_req, res) => {
  const users = await db.select({ id: user.id, name: user.name, role: user.role }).from(user);
  res.json(users);
});

export default router;
