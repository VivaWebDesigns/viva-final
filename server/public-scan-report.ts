import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  crmLeadNotes,
  localFalconProspectProfiles,
  scanReportDeliveries,
  scanReportEngagementEvents,
} from "@shared/schema";
import { db } from "./db";

const PUBLIC_SITE_URL = "https://vivawebdesigns.com";
const GA4_MEASUREMENT_ID = "G-8NL7JMJ7MT";
const REPORT_COOKIE = "viva_scan_report";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CTA_TYPES = ["schedule_call", "email_matt", "view_results"] as const;
type CtaType = typeof CTA_TYPES[number];

const clientEventSchema = z.object({
  eventId: z.string().uuid(),
});

const ctaEventSchema = clientEventSchema.extend({
  ctaType: z.enum(CTA_TYPES),
});

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

export function scanReportLandingUrl(token: string): string {
  const params = new URLSearchParams({
    utm_source: "crm",
    utm_medium: "email",
    utm_campaign: "scan_report",
  });
  return `${PUBLIC_SITE_URL}/scan-report/${token}?${params.toString()}`;
}

export function isLikelyAutomatedUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return /(bot|crawler|spider|preview|scanner|safelink|proofpoint|mimecast|barracuda|urlscan|virustotal|headless|phantomjs)/i.test(userAgent);
}

function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.headers.cookie?.split(";") ?? [];
  for (const cookie of cookies) {
    const [rawName, ...rawValue] = cookie.trim().split("=");
    if (rawName === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}

async function loadDelivery(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const [record] = await db.select({
    delivery: scanReportDeliveries,
    businessName: localFalconProspectProfiles.companyName,
  }).from(scanReportDeliveries)
    .innerJoin(
      localFalconProspectProfiles,
      eq(scanReportDeliveries.reportId, localFalconProspectProfiles.id),
    )
    .where(eq(scanReportDeliveries.publicTokenHash, hashScanReportToken(token)))
    .limit(1);
  return record ?? null;
}

async function recordLandingRequest(deliveryId: string) {
  const now = new Date();
  await db.update(scanReportDeliveries).set({
    requestCount: sql`${scanReportDeliveries.requestCount} + 1`,
    lastRequestedAt: now,
    updatedAt: now,
  }).where(eq(scanReportDeliveries.id, deliveryId));
}

async function recordEngagement(input: {
  token: string;
  clientEventId: string;
  eventType: "report_view" | "cta_click";
  ctaType?: CtaType;
  automated: boolean;
}) {
  const record = await loadDelivery(input.token);
  if (!record) return false;
  const now = new Date();

  await db.transaction(async (tx) => {
    const [event] = await tx.insert(scanReportEngagementEvents).values({
      deliveryId: record.delivery.id,
      clientEventId: input.clientEventId,
      eventType: input.eventType,
      ctaType: input.ctaType ?? null,
      automated: input.automated,
    }).onConflictDoNothing().returning({ id: scanReportEngagementEvents.id });
    if (!event || input.automated) return;

    if (input.eventType === "report_view") {
      await tx.update(scanReportDeliveries).set({
        viewCount: sql`${scanReportDeliveries.viewCount} + 1`,
        firstViewedAt: record.delivery.firstViewedAt ?? now,
        lastViewedAt: now,
        updatedAt: now,
      }).where(eq(scanReportDeliveries.id, record.delivery.id));
      await tx.insert(crmLeadNotes).values({
        leadId: record.delivery.leadId,
        userId: null,
        type: "system",
        content: record.delivery.viewCount > 0 ? "Scan report viewed again" : "Scan report viewed",
        metadata: {
          trackingEvent: "scan_report_view",
          deliveryId: record.delivery.id,
          reportId: record.delivery.reportId,
        },
      });
      return;
    }

    const labels: Record<CtaType, string> = {
      schedule_call: "Schedule a Call",
      email_matt: "Email Matt",
      view_results: "See Client Results",
    };
    await tx.update(scanReportDeliveries).set({
      ctaClickCount: sql`${scanReportDeliveries.ctaClickCount} + 1`,
      firstCtaClickedAt: record.delivery.firstCtaClickedAt ?? now,
      lastCtaClickedAt: now,
      updatedAt: now,
    }).where(eq(scanReportDeliveries.id, record.delivery.id));
    await tx.insert(crmLeadNotes).values({
      leadId: record.delivery.leadId,
      userId: null,
      type: "system",
      content: `Scan report CTA clicked: ${labels[input.ctaType!]}`,
      metadata: {
        trackingEvent: "scan_report_cta_click",
        ctaType: input.ctaType,
        deliveryId: record.delivery.id,
        reportId: record.delivery.reportId,
      },
    });
  });
  return true;
}

function reportDestination(ctaType: Exclude<CtaType, "email_matt">): string {
  return ctaType === "schedule_call"
    ? "https://calendly.com/vivawebdesigns/new-meeting"
    : `${PUBLIC_SITE_URL}/results`;
}

export function buildScanReportLandingPage(input: {
  token: string;
  imageUrl: string;
  businessName?: string | null;
}): string {
  const token = input.token;
  const businessName = input.businessName?.trim() || "your business";
  const viewEndpoint = `/scan-report/${token}/events/view`;
  const ctaEndpoint = `/scan-report/${token}/events/cta`;
  const scheduleEndpoint = `/scan-report/${token}/go/schedule_call`;
  const resultsEndpoint = `/scan-report/${token}/go/view_results`;
  const emailHref = "mailto:matt@vivawebdesigns.com?subject=Google%20Maps%20visibility%20scan";

  return `<!doctype html>
<html lang="en">
  <head>
    <script>history.replaceState(null,"","/scan-report/view"+location.search);</script>
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
      .privacy{margin:18px 0 0;color:#7a8493;font-size:12px}.privacy a{text-decoration:underline}.footer{padding:24px 0;border-top:1px solid var(--line);color:#697486;font-size:13px;text-align:center}
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
          <form class="tracked-form" method="post" action="${scheduleEndpoint}" data-cta="schedule_call"><input type="hidden" name="eventId"><button class="button button-primary" type="submit">Schedule a Call</button></form>
          <a class="button tracked-email" href="${emailHref}" data-cta="email_matt">Email Matt</a>
          <form class="tracked-form" method="post" action="${resultsEndpoint}" data-cta="view_results"><input type="hidden" name="eventId"><button class="button" type="submit">See Client Results</button></form>
        </div>
        <p class="privacy">Engagement with this report may be recorded to help Viva respond to your inquiry. See our <a href="/privacy-policy">Privacy Policy</a>.</p>
      </section>
    </main>
    <footer class="footer"><div class="shell">&copy; 2026 Viva Web Designs LLC &middot; Charlotte, North Carolina</div></footer>
    <script>
      (function(){
        var measurementId=${JSON.stringify(GA4_MEASUREMENT_ID)};
        var viewEndpoint=${JSON.stringify(viewEndpoint)};
        var ctaEndpoint=${JSON.stringify(ctaEndpoint)};
        var viewKey=${JSON.stringify(`viva_scan_report_view:${token}`)};
        var analyticsStarted=false;
        function eventId(){return self.crypto&&crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16)});}
        function beacon(url,data){var body=new URLSearchParams(data);if(navigator.sendBeacon){navigator.sendBeacon(url,body);return;}fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:body.toString(),keepalive:true,credentials:"same-origin"}).catch(function(){});}
        function gtag(){window.dataLayer=window.dataLayer||[];window.dataLayer.push(arguments);}
        function startAnalytics(){
          if(analyticsStarted)return;analyticsStarted=true;window.gtag=gtag;
          gtag("js",new Date());
          gtag("config",measurementId,{page_title:"Visibility Scan Report",page_location:location.href});
          gtag("event","scan_report_view",{report_type:"local_visibility_scan",delivery_channel:"email"});
          var script=document.createElement("script");script.async=true;script.src="https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(measurementId);document.head.appendChild(script);
        }
        function recordView(){
          if(document.visibilityState!=="visible")return;
          try{if(sessionStorage.getItem(viewKey))return;sessionStorage.setItem(viewKey,"1");}catch(_){}
          beacon(viewEndpoint,{eventId:eventId()});startAnalytics();
        }
        setTimeout(recordView,650);
        document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")setTimeout(recordView,250);});
        document.querySelectorAll(".tracked-form").forEach(function(form){form.addEventListener("submit",function(event){
          if(form.dataset.submitting==="1")return;event.preventDefault();form.dataset.submitting="1";var id=eventId();form.querySelector('[name="eventId"]').value=id;startAnalytics();gtag("event","scan_report_cta_click",{cta_type:form.dataset.cta,report_type:"local_visibility_scan",delivery_channel:"email",transport_type:"beacon"});setTimeout(function(){form.submit();},180);
        });});
        var email=document.querySelector(".tracked-email");email.addEventListener("click",function(){var id=eventId();beacon(ctaEndpoint,{eventId:id,ctaType:"email_matt"});startAnalytics();gtag("event","scan_report_cta_click",{cta_type:"email_matt",report_type:"local_visibility_scan",delivery_channel:"email",transport_type:"beacon"});});
      })();
    </script>
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
    const record = await loadDelivery(token);
    if (!record) return res.status(404).send("This scan report link is not available.");
    await recordLandingRequest(record.delivery.id);
    res.cookie(REPORT_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/scan-report",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    setReportHeaders(res);
    return res.type("html").send(buildScanReportLandingPage({
      token,
      imageUrl: record.delivery.imageUrl,
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

  app.post("/scan-report/:token/events/view", async (req, res, next) => {
    try {
      const body = clientEventSchema.parse(req.body);
      const found = await recordEngagement({
        token: req.params.token,
        clientEventId: body.eventId,
        eventType: "report_view",
        automated: isLikelyAutomatedUserAgent(req.get("user-agent")),
      });
      return found ? res.status(204).end() : res.status(404).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/scan-report/:token/events/cta", async (req, res, next) => {
    try {
      const body = ctaEventSchema.parse(req.body);
      const found = await recordEngagement({
        token: req.params.token,
        clientEventId: body.eventId,
        eventType: "cta_click",
        ctaType: body.ctaType,
        automated: isLikelyAutomatedUserAgent(req.get("user-agent")),
      });
      return found ? res.status(204).end() : res.status(404).end();
    } catch (error) {
      next(error);
    }
  });

  app.post("/scan-report/:token/go/:ctaType", async (req, res, next) => {
    try {
      const ctaType = z.enum(["schedule_call", "view_results"]).parse(req.params.ctaType);
      const eventId = z.string().uuid().catch(() => crypto.randomUUID()).parse(req.body.eventId);
      const found = await recordEngagement({
        token: req.params.token,
        clientEventId: eventId,
        eventType: "cta_click",
        ctaType,
        automated: isLikelyAutomatedUserAgent(req.get("user-agent")),
      });
      if (!found) return res.status(404).send("This scan report link is not available.");
      return res.redirect(303, reportDestination(ctaType));
    } catch (error) {
      next(error);
    }
  });
}
