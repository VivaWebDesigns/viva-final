import type { Express } from "express";

export const cleanPublicPageFiles: Record<string, string> = {
  "/results": "results.html",
  "/contact": "contact.html",
  "/privacy-policy": "privacy-policy.html",
  "/scan": "scan.html",
  "/thanks": "thanks.html",
  "/contact-thanks": "contact-thanks.html",
};

export const cleanPublicPageRedirects: Record<string, string> = {
  "/index.html": "/",
  "/results.html": "/results",
  "/results/": "/results",
  "/contact.html": "/contact",
  "/contact/": "/contact",
  "/privacy-policy.html": "/privacy-policy",
  "/privacy-policy/": "/privacy-policy",
  "/scan.html": "/scan",
  "/scan/": "/scan",
  "/thanks.html": "/thanks",
  "/thanks/": "/thanks",
  "/contact-thanks.html": "/contact-thanks",
  "/contact-thanks/": "/contact-thanks",
};

export function registerCleanPublicPageRedirects(app: Express) {
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();

    const cleanPath = cleanPublicPageRedirects[req.path];
    if (!cleanPath) return next();

    return res.redirect(301, cleanPath);
  });
}
