import type { Express, Response } from "express";
import { hashScanReportToken } from "./public-scan-report";
import { optOutReportOutreachByTokenHash } from "./features/crm/reportOutreach";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://vivawebdesigns.com").replace(/\/$/, "");

export function emailUnsubscribeUrl(token: string): string {
  return `${PUBLIC_SITE_URL}/email/unsubscribe/${token}`;
}

function pageHeaders(res: Response) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
}

export function buildEmailUnsubscribePage(token: string, completed = false): string {
  const action = `/email/unsubscribe/${token}`;
  const content = completed
    ? `<h1>You’re unsubscribed</h1><p>We won’t send you any more scan-report marketing emails.</p><a href="/">Return to Viva Web Designs</a>`
    : `<h1>Stop scan-report emails?</h1><p>Confirm below and we won’t send you any more scan-report marketing emails.</p><form method="post" action="${action}"><button type="submit">Unsubscribe</button></form><a class="cancel" href="/">Cancel</a>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>${completed ? "Unsubscribed" : "Unsubscribe"} | Viva Web Designs</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f4f7fa;color:#172033;font-family:Arial,sans-serif}.card{width:min(100%,520px);padding:38px;border:1px solid #dbe4ea;border-radius:14px;background:#fff;box-shadow:0 18px 50px rgba(6,26,61,.1);text-align:center}h1{margin:0;color:#061a3d;font-size:32px}p{margin:14px 0 24px;line-height:1.6;color:#5e697b}button{width:100%;min-height:50px;border:0;border-radius:7px;background:#0f766e;color:#fff;font:inherit;font-weight:700;cursor:pointer}a{color:#0f659e}.cancel{display:inline-block;margin-top:20px}</style></head>
<body><main class="card">${content}</main></body></html>`;
}

export function registerPublicEmailUnsubscribeRoutes(app: Express) {
  app.get("/email/unsubscribe/:token", (req, res) => {
    pageHeaders(res);
    if (!TOKEN_PATTERN.test(req.params.token)) return res.status(404).send("This unsubscribe link is not available.");
    return res.type("html").send(buildEmailUnsubscribePage(req.params.token));
  });

  app.post("/email/unsubscribe/:token", async (req, res, next) => {
    try {
      pageHeaders(res);
      if (!TOKEN_PATTERN.test(req.params.token)) return res.status(404).send("This unsubscribe link is not available.");
      const processed = await optOutReportOutreachByTokenHash(hashScanReportToken(req.params.token));
      if (!processed) return res.status(404).send("This unsubscribe link is not available.");
      return res.type("html").send(buildEmailUnsubscribePage(req.params.token, true));
    } catch (error) {
      next(error);
    }
  });
}
