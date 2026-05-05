import { describe, expect, it } from "vitest";
import {
  PRIMARY_CHAT_ADMIN_EMAIL,
  canUsersDirectMessage,
  isAllowedSalesRepChatUser,
  isPrimaryChatAdmin,
  type ChatAccessUser,
} from "../../server/features/chat/access";

function chatUser(overrides: Partial<ChatAccessUser>): ChatAccessUser {
  return {
    id: overrides.id ?? overrides.email ?? overrides.name ?? "user",
    name: overrides.name ?? "User",
    email: overrides.email ?? "user@example.com",
    role: overrides.role ?? "sales_rep",
    banned: overrides.banned ?? false,
    banExpires: overrides.banExpires ?? null,
  };
}

describe("chat DM access", () => {
  const matt = chatUser({
    id: "matt",
    name: "Matt Carney",
    email: PRIMARY_CHAT_ADMIN_EMAIL,
    role: "admin",
  });
  const oldMatt = chatUser({
    id: "old-matt",
    name: "Matt Carney",
    email: "m.carney3002@gmail.com",
    role: "admin",
    banned: true,
  });
  const unusedAdmin = chatUser({
    id: "unused-admin",
    name: "Admin",
    email: "admin@vivawebdesigns.com",
    role: "admin",
  });
  const ivonne = chatUser({ id: "ivonne", name: "Ivonne", role: "sales_rep" });
  const daniela = chatUser({ id: "daniela", name: "Daniela Ortega", role: "sales_rep" });
  const juan = chatUser({ id: "juan", name: "Juan Salazar", role: "sales_rep" });
  const otherRep = chatUser({ id: "other-rep", name: "Other Rep", role: "sales_rep" });
  const bannedRep = chatUser({ id: "banned-rep", name: "Banned Rep", role: "sales_rep", banned: true });

  it("recognizes the primary Matt admin account by email", () => {
    expect(isPrimaryChatAdmin(matt)).toBe(true);
    expect(isPrimaryChatAdmin(unusedAdmin)).toBe(false);
    expect(isPrimaryChatAdmin(oldMatt)).toBe(false);
  });

  it("allows active sales reps without depending on display-name spelling", () => {
    expect(isAllowedSalesRepChatUser(ivonne)).toBe(true);
    expect(isAllowedSalesRepChatUser(daniela)).toBe(true);
    expect(isAllowedSalesRepChatUser(juan)).toBe(true);
    expect(isAllowedSalesRepChatUser(otherRep)).toBe(true);
  });

  it("only allows DMs between Matt and active sales reps", () => {
    expect(canUsersDirectMessage(matt, ivonne)).toBe(true);
    expect(canUsersDirectMessage(ivonne, matt)).toBe(true);
    expect(canUsersDirectMessage(matt, daniela)).toBe(true);
    expect(canUsersDirectMessage(juan, matt)).toBe(true);
    expect(canUsersDirectMessage(otherRep, matt)).toBe(true);

    expect(canUsersDirectMessage(ivonne, daniela)).toBe(false);
    expect(canUsersDirectMessage(ivonne, unusedAdmin)).toBe(false);
    expect(canUsersDirectMessage(unusedAdmin, ivonne)).toBe(false);
    expect(canUsersDirectMessage(ivonne, oldMatt)).toBe(false);
    expect(canUsersDirectMessage(bannedRep, matt)).toBe(false);
    expect(canUsersDirectMessage(matt, bannedRep)).toBe(false);
  });
});
