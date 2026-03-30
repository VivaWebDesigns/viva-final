import { Router } from "express";
import { requireAuth } from "./middleware";
import { db } from "../../db";
import { user } from "@shared/schema";
import { eq } from "drizzle-orm";
import { auth } from "./auth";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});

router.get("/setup-status", async (_req, res) => {
  try {
    const [adminUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.role, "admin"))
      .limit(1);

    res.json({ needsSetup: !adminUser });
  } catch (err: any) {
    console.error("[setup-status] error:", err.message);
    res.status(500).json({ message: "Failed to check setup status" });
  }
});

router.post("/setup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const created = await db.transaction(async (tx) => {
      const [existingAdmin] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.role, "admin"))
        .limit(1);

      if (existingAdmin) {
        return null;
      }

      const result = await auth.api.signUpEmail({
        body: { name, email, password },
      });

      if (!result?.user?.id) {
        throw new Error("signup_failed");
      }

      await tx.update(user).set({ role: "admin" }).where(eq(user.id, result.user.id));
      return result.user.id;
    });

    if (!created) {
      return res.status(403).json({ message: "Admin account already exists. Setup is disabled." });
    }

    console.log(`[setup] First admin account created: ${email}`);
    res.json({ success: true, message: "Admin account created successfully." });
  } catch (err: any) {
    console.error("[setup] error:", err.message);
    if (err.message?.includes("UNIQUE") || err.message?.includes("duplicate")) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }
    res.status(500).json({ message: "Failed to create admin account." });
  }
});

export default router;
