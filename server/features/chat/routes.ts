import { Router } from "express";
import { requireAuth, requireRole } from "../auth/middleware";
import { db } from "../../db";
import {
  attachments, chatMessages, chatDmMessages, chatReadState, chatReactions, user,
} from "@shared/schema";
import { eq, desc, asc, and, or, sql, lt, gt, ilike, ne, inArray } from "drizzle-orm";
import { z } from "zod";
import { getIO } from "./socket";
import { CHANNEL_DEFINITIONS, normalizeChannelId } from "@shared/channels";

const router = Router();

router.use(requireAuth, (req, res, next) => {
  if (req.authUser?.role === "extension_worker") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
});

const CHAT_ADMIN_ROLE = "admin";
const isChatAdmin = (role?: string | null) => role === CHAT_ADMIN_ROLE;
const MAX_CHAT_ATTACHMENTS = 5;
const CHAT_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);
const CHAT_MESSAGE_ENTITY = "chat_message";
const CHAT_DM_MESSAGE_ENTITY = "chat_dm_message";

type ChatAttachmentDto = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type AttachmentRow = typeof attachments.$inferSelect;

function toIso(value: Date | string | null | undefined) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function mapAttachment(row: AttachmentRow): ChatAttachmentDto {
  return {
    id: row.id,
    url: row.url,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: toIso(row.createdAt),
  };
}

function hasChatContent(content: string) {
  const trimmed = content.trim();
  return !!trimmed && trimmed !== "<p></p>";
}

async function getAttachmentsByEntity(entityType: string, entityIds: string[]) {
  const map = new Map<string, ChatAttachmentDto[]>();
  if (entityIds.length === 0) return map;

  const rows = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.entityType, entityType), inArray(attachments.entityId, entityIds)))
    .orderBy(asc(attachments.createdAt));

  for (const row of rows) {
    if (!row.entityId) continue;
    const list = map.get(row.entityId) ?? [];
    list.push(mapAttachment(row));
    map.set(row.entityId, list);
  }

  return map;
}

async function validateChatAttachments(attachmentIds: string[] | undefined, uploaderUserId: string) {
  const ids = [...new Set(attachmentIds ?? [])].slice(0, MAX_CHAT_ATTACHMENTS);
  if (ids.length === 0) return [];

  const rows = await db.select().from(attachments).where(inArray(attachments.id, ids));
  const byId = new Map(rows.map((row) => [row.id, row]));
  const orderedRows = ids.map((id) => byId.get(id));

  if (orderedRows.some((row) => !row)) {
    throw new Error("One or more attachments were not found");
  }

  for (const row of orderedRows as AttachmentRow[]) {
    if (row.uploaderUserId !== uploaderUserId) {
      throw new Error("You can only send files you uploaded");
    }
    if (row.entityType || row.entityId) {
      throw new Error("One or more attachments are already attached to another record");
    }
    if (!CHAT_ATTACHMENT_MIME_TYPES.has(row.mimeType)) {
      throw new Error("Team Chat supports images and PDFs only");
    }
  }

  return orderedRows as AttachmentRow[];
}

async function assignChatAttachments(rows: AttachmentRow[], entityType: string, entityId: string) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  await db
    .update(attachments)
    .set({ entityType, entityId })
    .where(inArray(attachments.id, ids));
  return rows.map((row) => mapAttachment({ ...row, entityType, entityId }));
}

async function getUserRole(userId: string) {
  const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId));
  return row?.role ?? null;
}

async function canUseDirectMessage(senderRole: string | undefined, recipientId: string) {
  if (isChatAdmin(senderRole)) return true;
  const recipientRole = await getUserRole(recipientId);
  return isChatAdmin(recipientRole);
}

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
    if (!isChatAdmin(req.authUser?.role)) return res.json([]);

    const userId = req.authUser?.id!;
    const result = await Promise.all(
      CHANNEL_DEFINITIONS.map(async (ch) => {
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
    if (!isChatAdmin(req.authUser?.role)) {
      return res.status(403).json({ message: "Only admins can access team channels" });
    }

    const channel = normalizeChannelId((req.query.channel as string) || "general") ?? "general";
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

    const attachmentMap = await getAttachmentsByEntity(CHAT_MESSAGE_ENTITY, msgIds);

    res.json(msgs.map((m) => ({
      ...m,
      reactions: reactionMap[m.id] ?? [],
      replyCount: threadCountMap[m.id] ?? 0,
      attachments: attachmentMap.get(m.id) ?? [],
    })));
  } catch (err: any) {
    console.error("Chat messages error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/messages", requireAuth, async (req, res) => {
  try {
    if (!isChatAdmin(req.authUser?.role)) {
      return res.status(403).json({ message: "Only admins can post in team channels" });
    }

    const parsed = z.object({
      channel: z.string().default("general"),
      content: z.string().max(4000).optional().default(""),
      parentId: z.string().optional(),
      attachmentIds: z.array(z.string()).max(MAX_CHAT_ATTACHMENTS).optional().default([]),
    }).parse(req.body);
    const channel = normalizeChannelId(parsed.channel) ?? "general";
    const { content, parentId } = parsed;
    const senderId = req.authUser?.id!;
    const attachmentRows = await validateChatAttachments(parsed.attachmentIds, senderId);

    if (!hasChatContent(content) && attachmentRows.length === 0) {
      return res.status(400).json({ message: "Message content or attachment is required" });
    }

    const [msg] = await db.insert(chatMessages)
      .values({ channel, content, senderId, parentId: parentId || null })
      .returning();

    const messageAttachments = await assignChatAttachments(attachmentRows, CHAT_MESSAGE_ENTITY, msg.id);
    const [sender] = await db.select({ name: user.name, role: user.role }).from(user).where(eq(user.id, senderId));

    await db.insert(chatReadState)
      .values({ userId: senderId, channelId: channel, lastReadAt: msg.createdAt })
      .onConflictDoUpdate({ target: [chatReadState.userId, chatReadState.channelId], set: { lastReadAt: msg.createdAt } });

    const fullMsg = { ...msg, senderName: sender?.name, senderRole: sender?.role, reactions: [], replyCount: 0, attachments: messageAttachments };

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

router.delete("/messages/:id", requireRole("admin"), async (req, res) => {
  try {
    if (!isChatAdmin(req.authUser?.role)) {
      return res.status(403).json({ message: "Only admins can delete team channel messages" });
    }

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
    if (!isChatAdmin(req.authUser?.role)) {
      return res.status(403).json({ message: "Only admins can mark team channels read" });
    }

    const parsed = z.object({ channelId: z.string() }).parse(req.body);
    const channelId = normalizeChannelId(parsed.channelId) ?? parsed.channelId;
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
  if (!isChatAdmin(req.authUser?.role)) {
    return res.status(403).json({ message: "Only admins can access pinned team channel messages" });
  }

  const channel = normalizeChannelId((req.query.channel as string) || "general") ?? "general";
  const rows = await db
    .select({ id: chatMessages.id, content: chatMessages.content, createdAt: chatMessages.createdAt, senderName: user.name })
    .from(chatMessages)
    .innerJoin(user, eq(chatMessages.senderId, user.id))
    .where(and(eq(chatMessages.channel, channel), eq(chatMessages.isPinned, true)))
    .orderBy(desc(chatMessages.createdAt));
  res.json(rows);
});

router.put("/messages/:id/pin", requireRole("admin"), async (req, res) => {
  try {
    if (!isChatAdmin(req.authUser?.role)) {
      return res.status(403).json({ message: "Only admins can pin team channel messages" });
    }

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
    if (!isChatAdmin(req.authUser?.role)) {
      return res.status(403).json({ message: "Only admins can react to team channel messages" });
    }

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
    if (!isChatAdmin(req.authUser?.role)) {
      return res.status(403).json({ message: "Only admins can search team channels" });
    }

    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) return res.json([]);
    const rawChannel = req.query.channel as string | undefined;
    const channel = rawChannel ? normalizeChannelId(rawChannel) : undefined;
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
    const userCanMessageAll = isChatAdmin(req.authUser?.role);

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
      conversationData
        .filter((c) => userCanMessageAll || isChatAdmin(userMap[c.otherId]?.role))
        .map((c) => ({
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
    if (otherUserId === userId) return res.status(400).json({ message: "Cannot open a DM with yourself" });

    const allowed = await canUseDirectMessage(req.authUser?.role, otherUserId);
    if (!allowed) return res.status(403).json({ message: "Non-admin users can only message admins" });

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

    const attachmentMap = await getAttachmentsByEntity(CHAT_DM_MESSAGE_ENTITY, rows.map((row) => row.id));
    res.json(rows.map((row) => ({
      ...row,
      attachments: attachmentMap.get(row.id) ?? [],
    })));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/dm/messages", requireAuth, async (req, res) => {
  try {
    const { recipientId, content, attachmentIds } = z.object({
      recipientId: z.string().min(1),
      content: z.string().max(4000).optional().default(""),
      attachmentIds: z.array(z.string()).max(MAX_CHAT_ATTACHMENTS).optional().default([]),
    }).parse(req.body);
    const senderId = req.authUser?.id!;
    if (recipientId === senderId) return res.status(400).json({ message: "Cannot send a DM to yourself" });
    const attachmentRows = await validateChatAttachments(attachmentIds, senderId);
    if (!hasChatContent(content) && attachmentRows.length === 0) {
      return res.status(400).json({ message: "Message content or attachment is required" });
    }

    const [targetUser] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, recipientId));
    if (!targetUser) return res.status(404).json({ message: "Recipient not found" });
    if (!isChatAdmin(req.authUser?.role) && !isChatAdmin(targetUser.role)) {
      return res.status(403).json({ message: "Non-admin users can only message admins" });
    }

    const [msg] = await db.insert(chatDmMessages).values({ senderId, recipientId, content }).returning();
    const messageAttachments = await assignChatAttachments(attachmentRows, CHAT_DM_MESSAGE_ENTITY, msg.id);

    try {
      const io = getIO();
      if (io) {
        const payload = {
          ...msg,
          createdAt: msg.createdAt.toISOString(),
          readAt: msg.readAt ? msg.readAt.toISOString() : null,
          attachments: messageAttachments,
        };
        io.to(`user:${recipientId}`).emit("chat:dm_message", payload);
        io.to(`user:${senderId}`).emit("chat:dm_message", payload);
      }
    } catch (_) {}

    res.status(201).json({ ...msg, attachments: messageAttachments });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// ── Users (for @mentions + DM picker) ────────────────────────────────

router.get("/users", requireAuth, async (req, res) => {
  const query = db.select({ id: user.id, name: user.name, role: user.role }).from(user);
  const users = isChatAdmin(req.authUser?.role)
    ? await query
    : await query.where(eq(user.role, CHAT_ADMIN_ROLE));
  res.json(users);
});

export default router;
