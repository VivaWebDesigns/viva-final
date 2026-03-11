/**
 * Production User Seeding
 *
 * Runs on server startup in ALL environments (including production).
 * Creates admin, developer, and sales_rep accounts from env vars if they don't exist.
 * Fully idempotent — safe to run on every restart.
 *
 * Required env vars:
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 *   SEED_DEV_EMAIL   / SEED_DEV_PASSWORD
 *   SEED_SALES_EMAIL / SEED_SALES_PASSWORD
 */

import { db } from "../../db";
import { user } from "@shared/schema";
import { eq } from "drizzle-orm";
import { auth } from "../auth/auth";

type Role = "admin" | "developer" | "sales_rep";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: Role;
}

async function ensureUser({ name, email, password, role }: SeedUser): Promise<void> {
  try {
    const [existing] = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);

    if (existing) {
      if (existing.role !== role) {
        await db.update(user).set({ role }).where(eq(user.id, existing.id));
        console.log(`[prod-seed] Updated ${email} → ${role}`);
      } else {
        console.log(`[prod-seed] ${role} user already exists (${email})`);
      }
      return;
    }

    const result = await auth.api.signUpEmail({
      body: { name, email, password },
    });

    if (result?.user?.id) {
      await db.update(user).set({ role }).where(eq(user.id, result.user.id));
      console.log(`[prod-seed] Created ${role} user: ${email}`);
    }
  } catch (err: any) {
    console.error(`[prod-seed] Failed to seed ${role} (${email}):`, err.message);
  }
}

export async function seedAdminUser(): Promise<void> {
  const seeds: SeedUser[] = [];

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    seeds.push({ name: "Admin", email: adminEmail, password: adminPassword, role: "admin" });
  } else {
    console.log("[prod-seed] SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — skipping admin.");
  }

  const devEmail = process.env.SEED_DEV_EMAIL;
  const devPassword = process.env.SEED_DEV_PASSWORD;
  if (devEmail && devPassword) {
    seeds.push({ name: "Dev User", email: devEmail, password: devPassword, role: "developer" });
  } else {
    console.log("[prod-seed] SEED_DEV_EMAIL / SEED_DEV_PASSWORD not set — skipping developer.");
  }

  const salesEmail = process.env.SEED_SALES_EMAIL;
  const salesPassword = process.env.SEED_SALES_PASSWORD;
  if (salesEmail && salesPassword) {
    seeds.push({ name: "Sales Rep", email: salesEmail, password: salesPassword, role: "sales_rep" });
  } else {
    console.log("[prod-seed] SEED_SALES_EMAIL / SEED_SALES_PASSWORD not set — skipping sales_rep.");
  }

  await Promise.all(seeds.map(ensureUser));
}
