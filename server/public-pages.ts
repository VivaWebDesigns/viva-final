import type { Express } from "express";

export const cleanPublicPageFiles: Record<string, string> = {
  "/results": "results.html",
  "/contact": "contact.html",
  "/scan": "scan.html",
  "/thanks": "thanks.html",
};

export const cleanPublicPageRedirects: Record<string, string> = {
  "/index.html": "/",
  "/results.html": "/results",
  "/results/": "/results",
  "/contact.html": "/contact",
  "/contact/": "/contact",
  "/scan.html": "/scan",
  "/scan/": "/scan",
  "/thanks.html": "/thanks",
  "/thanks/": "/thanks",
};

export function registerCleanPublicPageRedirects(app: Express) {
  Object.entries(cleanPublicPageRedirects).forEach(([legacyPath, cleanPath]) => {
    app.get(legacyPath, (_req, res) => {
      res.redirect(301, cleanPath);
    });
  });
}
