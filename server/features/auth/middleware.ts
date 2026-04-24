import { Request, Response, NextFunction } from "express";
import { auth } from "./auth";
import { fromNodeHeaders } from "better-auth/node";
import type { Role } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        name: string;
        email: string;
        role: string;
        image?: string | null;
      };
      authSession?: {
        id: string;
        userId: string;
        token: string;
        expiresAt: Date;
      };
      authSource?: "bearer" | "cookie";
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!result || !result.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // BetterAuth returns its own User/Session types which differ from the
    // Express request augmentation. The cast is intentional: req.authUser
    // is augmented in server/types.d.ts and carries the same runtime shape.
    req.authUser = result.user as any;
    req.authSession = result.session as any;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export function requireRole(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    await requireAuth(req, res, () => {
      if (!req.authUser) return;

      if (!roles.includes(req.authUser.role as Role)) {
        return res.status(403).json({ message: "Forbidden: insufficient permissions" });
      }
      next();
    });
  };
}

// ─── Bearer-first session resolution ──────────────────────────────────────
//
// BetterAuth's bearer() plugin resolves bearer tokens by APPENDING an injected
// session cookie to the existing cookie header, meaning the existing browser
// cookie (e.g. an admin or another worker's session) would win via first-cookie
// precedence. This middleware strips cookies before calling getSession when an
// Authorization: Bearer header is present, guaranteeing the bearer token's
// identity is the resolved identity regardless of what cookies Chrome sends.
//
// Use this instead of requireRole() for routes where per-worker identity
// must be correct even when the caller also has a browser session cookie.

async function resolveSessionBearerFirst(req: Request): Promise<{
  result: Awaited<ReturnType<typeof auth.api.getSession>>;
  source: "bearer" | "cookie";
}> {
  const authHeader = req.headers["authorization"] as string | undefined;
  if (authHeader && authHeader.slice(0, 7).toLowerCase() === "bearer ") {
    const headersNoCookie = { ...req.headers };
    delete headersNoCookie["cookie"];
    const result = await auth.api.getSession({
      headers: fromNodeHeaders(headersNoCookie),
    });
    return { result, source: "bearer" };
  }
  const result = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  return { result, source: "cookie" };
}

export function requireRoleBearerFirst(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { result, source } = await resolveSessionBearerFirst(req);
      if (!result || !result.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      req.authUser    = result.user as any;
      req.authSession = result.session as any;
      req.authSource  = source;
      if (!roles.includes(req.authUser!.role as Role)) {
        return res.status(403).json({ message: "Forbidden: insufficient permissions" });
      }
      next();
    } catch {
      return res.status(401).json({ message: "Unauthorized" });
    }
  };
}
