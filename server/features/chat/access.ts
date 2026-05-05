import { eq } from "drizzle-orm";
import { db } from "../../db";
import { user } from "@shared/schema";

export const PRIMARY_CHAT_ADMIN_EMAIL = "matt@vivawebdesigns.com";

const ALLOWED_SALES_REP_NAMES = new Set([
  "ivonne",
  "ivonne curiel",
  "daniela",
  "daniela ortega",
  "juan",
  "juan salazar",
]);

export interface ChatAccessUser {
  id: string;
  name: string;
  email: string;
  role: string;
  banned?: boolean | null;
  banExpires?: Date | string | null;
}

function normalizeIdentity(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function hasActiveChatBan(chatUser: Pick<ChatAccessUser, "banned" | "banExpires"> | null | undefined) {
  if (!chatUser?.banned) return false;
  if (!chatUser.banExpires) return true;

  const banExpiresAt = chatUser.banExpires instanceof Date
    ? chatUser.banExpires
    : new Date(chatUser.banExpires);

  return Number.isNaN(banExpiresAt.getTime()) || banExpiresAt.getTime() > Date.now();
}

export function isPrimaryChatAdmin(chatUser: Pick<ChatAccessUser, "email" | "role"> | null | undefined) {
  return chatUser?.role === "admin" && normalizeIdentity(chatUser.email) === PRIMARY_CHAT_ADMIN_EMAIL;
}

export function isAllowedSalesRepChatUser(chatUser: Pick<ChatAccessUser, "name" | "role"> | null | undefined) {
  return chatUser?.role === "sales_rep" && ALLOWED_SALES_REP_NAMES.has(normalizeIdentity(chatUser.name));
}

export function canUsersDirectMessage(sender: ChatAccessUser | null | undefined, recipient: ChatAccessUser | null | undefined) {
  if (!sender || !recipient) return false;
  if (sender.id === recipient.id) return false;
  if (hasActiveChatBan(sender) || hasActiveChatBan(recipient)) return false;

  return (
    isPrimaryChatAdmin(sender) && isAllowedSalesRepChatUser(recipient)
  ) || (
    isAllowedSalesRepChatUser(sender) && isPrimaryChatAdmin(recipient)
  );
}

export async function getChatAccessUser(userId: string) {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      banExpires: user.banExpires,
    })
    .from(user)
    .where(eq(user.id, userId));

  return row ?? null;
}

export async function canUserDirectMessageUser(senderId: string, recipientId: string) {
  const [sender, recipient] = await Promise.all([
    getChatAccessUser(senderId),
    getChatAccessUser(recipientId),
  ]);

  return canUsersDirectMessage(sender, recipient);
}
