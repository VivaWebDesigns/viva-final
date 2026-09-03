import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import {
  localFalconProspectProfiles,
  scanReportDeliveries,
  scanReportShares,
} from "@shared/schema";
import { db } from "./db";

const PUBLIC_SITE_URL = "https://vivawebdesigns.com";
const REPORT_COOKIE = "viva_scan_report";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function hashScanReportToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createScanReportToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function createAnonymousScanReportToken(reportId: string): string {
  const secret = process.env.SCAN_REPORT_SHARE_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (!secret) throw new Error("SCAN_REPORT_SHARE_SECRET or SESSION_SECRET is required");
  return crypto.createHmac("sha256", secret)
    .update(`scan-report-share:v1:${reportId}`)
    .digest("base64url");
}

export function scanReportLandingUrl(token: string): string {
  return `${PUBLIC_SITE_URL}/scan-report/${token}`;
}

function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

async function loadReportAccess(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const tokenHash = hashScanReportToken(token);
  const [shared] = await db.select({
    imageUrl: scanReportShares.imageUrl,
    businessName: localFalconProspectProfiles.companyName,
  }).from(scanReportShares)
    .innerJoin(
      localFalconProspectProfiles,
      eq(scanReportShares.reportId, localFalconProspectProfiles.id),
    )
    .where(eq(scanReportShares.publicTokenHash, tokenHash))
    .limit(1);
  if (shared) return shared;

  // Preserve already-issued links without continuing recipient-level engagement tracking.
  const [legacy] = await db.select({
    imageUrl: scanReportDeliveries.imageUrl,
    businessName: localFalconProspectProfiles.companyName,
  }).from(scanReportDeliveries)
    .innerJoin(
      localFalconProspectProfiles,
      eq(scanReportDeliveries.reportId, localFalconProspectProfiles.id),
    )
    .where(eq(scanReportDeliveries.publicTokenHash, tokenHash))
    .limit(1);
  return legacy ?? null;
}

export function buildScanReportLandingPage(input: {
  imageUrl: string;
  businessName?: string | null;
}): string {
  const businessName = input.businessName?.trim() || "your business";
  const scheduleHref = "https://calendly.com/vivawebdesigns/new-meeting";
  const contactHref = `${PUBLIC_SITE_URL}/contact#contact-form`;
  const resultsHref = `${PUBLIC_SITE_URL}/results`;
  const scanHref = `${PUBLIC_SITE_URL}/scan#scan-request`;

  return `<!doctype html>
<html lang="en">
  <head>
    <script>history.replaceState(null,"","/scan-report/view");</script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>Your Google Maps Visibility Scan | Viva Web Designs</title>
    <link rel="icon" href="/favicon.ico?v=20260707-viva-favicon" sizes="any">
    <style>
      :root{color-scheme:light;--navy:#061a3d;--blue:#0f659e;--teal:#0f766e;--ink:#172033;--muted:#5e697b;--line:#dbe4ea;--soft:#f4f7fa}
      *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--soft);color:var(--ink);font-family:Inter,Arial,sans-serif;line-height:1.55}
      a{color:inherit}.shell{width:min(100% - 28px,980px);margin:0 auto}.topbar{background:var(--navy);color:#fff}.topbar-inner{display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:74px}
      .brand{font-size:21px;font-weight:800;letter-spacing:.02em;text-decoration:none}.brand span{color:#29e0f8}.top-link{font-size:14px;color:#dbe8f8;text-decoration:none}.top-link:hover{text-decoration:underline}
      main{padding:38px 0 54px}.intro{text-align:center}.eyebrow{margin:0;color:var(--blue);font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.intro h1{max-width:760px;margin:10px auto 0;color:var(--navy);font-size:clamp(30px,6vw,48px);line-height:1.08}.intro p{max-width:680px;margin:15px auto 0;color:var(--muted);font-size:17px}
      .report-card{margin-top:28px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fff;box-shadow:0 20px 55px rgba(6,26,61,.1)}.report-card img{display:block;width:100%;height:auto;border-radius:9px}
      .action-card{margin-top:28px;padding:30px;border:1px solid var(--line);border-radius:14px;background:#fff;text-align:center}.action-card h2{margin:0;color:var(--navy);font-size:clamp(24px,4vw,34px)}.action-card>p{max-width:650px;margin:12px auto 0;color:var(--muted)}
      .actions{display:grid;gap:12px;margin-top:24px}.actions form{margin:0}.button{display:flex;width:100%;min-height:50px;align-items:center;justify-content:center;padding:12px 18px;border:1px solid var(--blue);border-radius:7px;background:#fff;color:var(--blue);cursor:pointer;font:inherit;font-weight:800;text-decoration:none}.button:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(6,26,61,.12)}.button-primary{border-color:var(--teal);background:var(--teal);color:#fff}
      .another-scan{margin-top:24px;padding:24px;border:1px solid #cfe2ea;border-radius:10px;background:#f2f9fb}.another-scan h3{margin:0;color:var(--navy);font-size:21px}.another-scan p{max-width:650px;margin:8px auto 0;color:var(--muted)}.another-scan .button{width:auto;max-width:320px;margin:17px auto 0;padding-inline:26px}.privacy{margin:18px 0 0;color:#7a8493;font-size:12px}.privacy a{text-decoration:underline}.footer{padding:24px 0;border-top:1px solid var(--line);color:#697486;font-size:13px;text-align:center}
      @media(min-width:700px){main{padding-top:54px}.actions{grid-template-columns:repeat(3,minmax(0,1fr))}.report-card{padding:18px}.action-card{padding:38px}}
    </style>
  </head>
  <body>
    <header class="topbar"><div class="shell topbar-inner"><a class="brand" href="/">V<span>I</span>VA Web Designs</a><a class="top-link" href="tel:+17042227067">(704) 222-7067</a></div></header>
    <main class="shell">
      <section class="intro">
        <p class="eyebrow">Your Local Visibility Snapshot</p>
        <h1>See how ${escapeHtml(businessName)} appears across Google Maps</h1>
        <p>This scan shows where your business is visible when nearby customers search—and where competitors may be winning the click instead.</p>
      </section>
      <section class="report-card" aria-label="Google Maps visibility scan">
        <img src="${escapeHtml(input.imageUrl)}" alt="Google Maps visibility scan for ${escapeHtml(businessName)}" width="1080" height="1920" fetchpriority="high" decoding="async">
      </section>
      <section class="action-card">
        <h2>Want to understand what the scan means?</h2>
        <p>Matt can walk through the weak areas, explain who Google is ranking ahead of you and outline the most practical next step.</p>
        <div class="actions">
          <a class="button button-primary" href="${scheduleHref}">Schedule a Call</a>
          <a class="button" href="${escapeHtml(contactHref)}">Send Matt a Message</a>
          <a class="button" href="${resultsHref}">See Client Results</a>
        </div>
        <div class="another-scan">
          <h3>Want to Check Another Service for Free?</h3>
          <p>See how your company ranks for another service or search phrase. No cost, no obligation, and no sales call required.</p>
          <a class="button" href="${escapeHtml(scanHref)}">Check Another Service</a>
        </div>
        <p class="privacy">This report page does not load Google Analytics or record report views or action selections in the CRM. See our <a href="/privacy-policy">Privacy Policy</a>.</p>
      </section>
    </main>
    <footer class="footer"><div class="shell">&copy; 2026 Viva Web Designs LLC &middot; Charlotte, North Carolina</div></footer>
  </body>
</html>`;
}

function setReportHeaders(res: Response) {
  res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Referrer-Policy", "origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

export function registerPublicScanReportRoutes(app: Express) {
  const renderReport = async (_req: Request, res: Response, token: string) => {
    const record = await loadReportAccess(token);
    if (!record) return res.status(404).send("This scan report link is not available.");
    res.cookie(REPORT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/scan-report",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    setReportHeaders(res);
    return res.type("html").send(buildScanReportLandingPage({
      imageUrl: record.imageUrl,
      businessName: record.businessName,
    }));
  };

  app.get("/scan-report/view", async (req, res, next) => {
    try {
      const token = readCookie(req, REPORT_COOKIE);
      if (!token) return res.status(404).send("Open the secure report link from your email.");
      return await renderReport(req, res, token);
    } catch (error) {
      next(error);
    }
  });

  app.get("/scan-report/:token", async (req, res, next) => {
    try {
      return await renderReport(req, res, req.params.token);
    } catch (error) {
      next(error);
    }
  });

}
