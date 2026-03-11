import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  chatMessages, chatDmMessages, chatReadState, chatReactions, user,
} from "@shared/schema";
import { eq, desc, asc, and, or, sql, lt, gt, ilike, ne, inArray } from "drizzle-orm";
import { z } from "zod";
import { getIO } from "./socket";

const router = Router();

const CHANNELS = [
  { id: "general",    name: "General",    description: "Team announcements and conversation" },
  { id: "sales",      name: "Sales",      description: "Sales pipeline and prospects" },
  { id: "onboarding", name: "Onboarding", description: "Client onboarding coordination" },
  { id: "dev",        name: "Dev",        description: "Technical and development topics" },
];

// ── One-time migration: rename legacy "ventas" channel → "sales" ──────
(async () => {
  try {
    await db.execute(sql`UPDATE chat_messages SET channel = 'sales' WHERE channel = 'ventas'`);
    await db.execute(sql`UPDATE chat_read_state SET channel_id = 'sales' WHERE channel_id = 'ventas'`);
  } catch {
    // migration may already be applied or table may not exist yet
  }
})();

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

    const fullMsg = { ...msg, senderName: sender?.name, senderRole: sender?.role, reactions: [], replyCount: 0 };

    try {
      const io = getIO();
      if (io) {
        io.to(`channel:${channel}`).emit("chat:channel_message", {
          ...fullMsg,
          createdAt: fullMsg.createdAt.toISOString(),
          parentId: fullMsg.parentId ?? null,
          isPinned: fullMsg.isPinned ?? false,
          senderName: fullMsg.senderName ?? "",
          senderRole: fullMsg.senderRole ?? "",
        });
      }
    } catch (_) {}

    res.status(201).json(fullMsg);
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

    const sent = await db
      .select({ otherId: chatDmMessages.recipientId })
      .from(chatDmMessages)
      .where(eq(chatDmMessages.senderId, userId));

    const received = await db
      .select({ otherId: chatDmMessages.senderId })
      .from(chatDmMessages)
      .where(eq(chatDmMessages.recipientId, userId));

    const otherIdSet = new Set<string>();
    for (const r of sent) otherIdSet.add(r.otherId);
    for (const r of received) otherIdSet.add(r.otherId);
    const otherIds = [...otherIdSet];

    if (!otherIds.length) return res.json([]);

    const conversationData = await Promise.all(
      otherIds.map(async (otherId) => {
        const [lastMsg] = await db
          .select()
          .from(chatDmMessages)
          .where(
            or(
              and(eq(chatDmMessages.senderId, userId), eq(chatDmMessages.recipientId, otherId)),
              and(eq(chatDmMessages.senderId, otherId), eq(chatDmMessages.recipientId, userId))
            )
          )
          .orderBy(desc(chatDmMessages.createdAt))
          .limit(1);

        const [{ unreadCount }] = await db
          .select({ unreadCount: sql<number>`count(*)::int` })
          .from(chatDmMessages)
          .where(
            and(
              eq(chatDmMessages.recipientId, userId),
              eq(chatDmMessages.senderId, otherId),
              sql`${chatDmMessages.readAt} IS NULL`
            )
          );

        return {
          otherId,
          lastMessageAt: lastMsg?.createdAt ?? new Date(0),
          lastContent: lastMsg?.content ?? "",
          unreadCount: unreadCount ?? 0,
        };
      })
    );

    conversationData.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

    const users = await db
      .select({ id: user.id, name: user.name, role: user.role })
      .from(user)
      .where(inArray(user.id, otherIds));

    const userMap: Record<string, { id: string; name: string; role: string }> = {};
    for (const u of users) userMap[u.id] = u;

    res.json(
      conversationData.map((c) => ({
        userId: c.otherId,
        userName: userMap[c.otherId]?.name ?? "Unknown",
        userRole: userMap[c.otherId]?.role ?? "",
        lastMessageAt: c.lastMessageAt,
        lastContent: c.lastContent,
        unreadCount: c.unreadCount,
      }))
    );
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

    const [targetUser] = await db.select({ id: user.id }).from(user).where(eq(user.id, recipientId));
    if (!targetUser) return res.status(404).json({ message: "Recipient not found" });

    const [msg] = await db.insert(chatDmMessages).values({ senderId, recipientId, content }).returning();

    try {
      const io = getIO();
      if (io) {
        const payload = {
          ...msg,
          createdAt: msg.createdAt.toISOString(),
          readAt: msg.readAt ? msg.readAt.toISOString() : null,
        };
        io.to(`user:${recipientId}`).emit("chat:dm_message", payload);
        io.to(`user:${senderId}`).emit("chat:dm_message", payload);
      }
    } catch (_) {}

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
