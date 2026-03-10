/**
 * Dev-Only User Seeding
 *
 * Runs on server startup in development only.
 * Creates test users for each role using env vars as the source of truth.
 * All operations are idempotent — safe to run on every restart.
 *
 * Required env vars (development only):
 *   VITE_DEV_DEVELOPER_EMAIL   / VITE_DEV_DEVELOPER_PASSWORD
 *   VITE_DEV_SALESREP_EMAIL    / VITE_DEV_SALESREP_PASSWORD
 */

import { db } from "../../db";
import { user } from "@shared/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth/auth";

interface DevUser {
  name: string;
  email: string;
  password: string;
  role: "admin" | "developer" | "sales_rep";
}

function getDevUsers(): DevUser[] {
  const users: DevUser[] = [];

  const devEmail = process.env.VITE_DEV_DEVELOPER_EMAIL;
  const devPassword = process.env.VITE_DEV_DEVELOPER_PASSWORD;
  if (devEmail && devPassword) {
    users.push({ name: "Dev User", email: devEmail, password: devPassword, role: "developer" });
  }

  const salesEmail = process.env.VITE_DEV_SALESREP_EMAIL;
  const salesPassword = process.env.VITE_DEV_SALESREP_PASSWORD;
  if (salesEmail && salesPassword) {
    users.push({ name: "Sales Rep", email: salesEmail, password: salesPassword, role: "sales_rep" });
  }

  return users;
}

export async function seedDevUsers(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;

  const devUsers = getDevUsers();
  if (devUsers.length === 0) {
    console.log("[dev-seed] No dev user env vars set — skipping.");
    return;
  }

  for (const devUser of devUsers) {
    try {
      const [existing] = await db
        .select({ id: user.id, role: user.role })
        .from(user)
        .where(eq(user.email, devUser.email))
        .limit(1);

      if (existing) {
        if (existing.role !== devUser.role) {
          await db.update(user).set({ role: devUser.role }).where(eq(user.id, existing.id));
          console.log(`[dev-seed] Updated role for ${devUser.email} → ${devUser.role}`);
        } else {
          console.log(`[dev-seed] ${devUser.role} user already exists (${devUser.email})`);
        }
        continue;
      }

      const result = await auth.api.signUpEmail({
        body: { name: devUser.name, email: devUser.email, password: devUser.password },
      });

      if (result?.user?.id) {
        await db.update(user).set({ role: devUser.role }).where(eq(user.id, result.user.id));
        console.log(`[dev-seed] Created ${devUser.role} user: ${devUser.email}`);
      }
    } catch (err: any) {
      console.error(`[dev-seed] Failed to seed ${devUser.role} user (${devUser.email}):`, err.message);
    }
  }
}
