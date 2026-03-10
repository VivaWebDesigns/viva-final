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
