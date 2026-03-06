import { db } from "../../db";
import {
  notifications,
  notificationPreferences,
  type InsertNotification,
  type Notification,
  type NotificationType,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import * as mailgun from "./mailgun";

interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  channel?: "in_app" | "email" | "both";
  metadata?: Record<string, unknown>;
  recipientEmail?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const channel = input.channel || "in_app";
  const shouldEmail = channel === "email" || channel === "both";

  const [notification] = await db
    .insert(notifications)
    .values({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntityType: input.relatedEntityType || null,
      relatedEntityId: input.relatedEntityId || null,
      channel,
      emailStatus: shouldEmail ? "pending" : "skipped",
      metadata: input.metadata || null,
    })
    .returning();

  if (shouldEmail && input.recipientEmail) {
    sendEmailForNotification(notification, input.recipientEmail).catch((err) => {
      console.error("[Notifications] Email send error:", err);
    });
  }

  return notification;
}

async function sendEmailForNotification(notification: Notification, recipientEmail: string) {
  const result = await mailgun.sendEmail(
    recipientEmail,
    notification.title,
    buildEmailHtml(notification),
    { tags: [notification.type] }
  );

  await db
    .update(notifications)
    .set({
      emailStatus: result.status,
      sentAt: result.status === "sent" ? new Date() : null,
      failureReason: result.error || null,
    })
    .where(eq(notifications.id, notification.id));
}

function buildEmailHtml(notification: Notification): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">Viva Web Designs</h2>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
        <h3 style="margin-top: 0;">${notification.title}</h3>
        <p style="color: #4b5563; line-height: 1.6;">${notification.message}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">This is an automated notification from Viva Web Designs CRM.</p>
      </div>
    </div>
  `;
}

export async function getUserNotifications(
  userId: string,
  filters?: { type?: string; isRead?: boolean; limit?: number; offset?: number }
): Promise<{ notifications: Notification[]; total: number }> {
  const conditions = [eq(notifications.recipientId, userId)];

  if (filters?.type) {
    conditions.push(eq(notifications.type, filters.type));
  }
  if (filters?.isRead !== undefined) {
    conditions.push(eq(notifications.isRead, filters.isRead));
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(...conditions));

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(filters?.limit || 50)
    .offset(filters?.offset || 0);

  return { notifications: rows, total: countResult.count };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));
  return result.count;
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, userId)))
    .returning();
  return result.length > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const result = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)))
    .returning();
  return result.length;
}

export async function getPreferences(userId: string) {
  return db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId));
}
