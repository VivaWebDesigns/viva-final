import type { Express } from "express";

export const cleanPublicPageFiles: Record<string, string> = {
  "/results": "results.html",
  "/results/glass-and-door-pro": "results-glass-and-door-pro.html",
  "/results/carolina-custom-automation": "results-carolina-custom-automation.html",
  "/website-design": "website-design.html",
  "/seo-market-expansion": "seo-market-expansion.html",
  "/website-care": "website-care.html",
  "/about": "about.html",
  "/pricing": "pricing.html",
  "/contact": "contact.html",
  "/privacy-policy": "privacy-policy.html",
  "/terms": "terms.html",
  "/scan": "scan.html",
  "/thanks": "thanks.html",
  "/contact-thanks": "contact-thanks.html",
};

export const cleanPublicPageRedirects: Record<string, string> = {
  ...Object.fromEntries(Object.entries(cleanPublicPageFiles).flatMap(([url, file]) => [
    [`/${file}`, url], [`${url}/`, url],
  ])),
  "/index.html": "/",
};

export function registerCleanPublicPageRedirects(app: Express) {
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const cleanPath = cleanPublicPageRedirects[req.path];
    if (!cleanPath) return next();

    return res.redirect(301, cleanPath + req.originalUrl.slice(req.path.length));
  });
}
