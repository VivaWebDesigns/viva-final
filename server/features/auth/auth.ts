import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer, mcp } from "better-auth/plugins";
import { db } from "../../db";
import * as schema from "@shared/schema";

const getBaseURL = () => {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return `http://localhost:${process.env.PORT || 5000}`;
};

const baseURL = getBaseURL();

const trustedOrigins = [
  baseURL,
  "https://vivawebdesigns.com",
  "https://www.vivawebdesigns.com",
  "chrome-extension://*",
  ...(process.env.RAILWAY_PUBLIC_DOMAIN ? [`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`] : []),
  ...(process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",").map(d => `https://${d}`) : []),
  ...(process.env.REPLIT_DEV_DOMAIN ? [`https://${process.env.REPLIT_DEV_DOMAIN}`] : []),
];

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      oauthApplication: schema.oauthApplication,
      oauthAccessToken: schema.oauthAccessToken,
      oauthConsent: schema.oauthConsent,
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
    bearer(),
    mcp({
      loginPage: "/login",
      resource: `${baseURL}/mcp`,
      oidcConfig: {
        loginPage: "/login",
        defaultScope: "openid profile email offline_access sab:read sab:write",
        scopes: ["sab:read", "sab:write"],
        metadata: {
          scopes_supported: [
            "openid",
            "profile",
            "email",
            "offline_access",
            "sab:read",
            "sab:write",
          ],
        },
      },
    }),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  basePath: "/api/auth",
  trustedOrigins,
});
