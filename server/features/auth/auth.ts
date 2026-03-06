import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "../../db";
import * as schema from "@shared/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    admin({
      defaultRole: "sales_rep",
      adminRoles: ["admin"],
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`,
  basePath: "/api/auth",
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || `http://localhost:${process.env.PORT || 5000}`,
    ...(process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",").map(d => `https://${d}`) : []),
    ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
  ],
});
