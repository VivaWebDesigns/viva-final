import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Hashed Vite output bundles — cache immutably for 1 year.
  // Vite embeds a content hash in every asset filename (e.g. index-CbJtbRdG.js),
  // so the URL changes on every rebuild. Browsers and CDNs can safely cache forever.
  // Policy: Cache-Control: public, max-age=31536000, immutable
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );

  // All other static files (icons, fonts, manifests, robots.txt) — short-lived.
  // HTML shell files get a strict no-store so the app shell is never served stale
  // after a deploy. Other files use max-age=0 (must-revalidate on each request).
  app.use(
    express.static(distPath, {
      maxAge: 0,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
        if (filePath.endsWith(".xml")) {
          res.setHeader("Content-Type", "application/xml; charset=utf-8");
        }
      },
    }),
  );

  const mpaHtmlFiles: Record<string, string> = {
    // Public demo routes — linked from /demo showroom
    "/empieza": "empieza.html",
    "/empieza.html": "empieza.html",
    "/crece": "crece.html",
    "/crece.html": "crece.html",
    "/domina": "domina.html",
    "/domina.html": "domina.html",
    // Private preview routes — not linked publicly, noindex meta tag, read URL params for customization
    "/preview/empieza": "preview-empieza.html",
    "/preview/crece": "preview-crece.html",
    "/preview/domina": "preview-domina.html",
  };

  // All SPA/MPA HTML shell responses — always no-store so deploys are picked up immediately.
  app.use("/{*path}", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const urlPath = req.originalUrl.split("?")[0];
    const mpaFile =
      mpaHtmlFiles[urlPath] ??
      (urlPath.startsWith("/empieza/") ? "empieza.html" :
       urlPath.startsWith("/crece/")   ? "crece.html"   :
       urlPath.startsWith("/domina/")  ? "domina.html"  :
       undefined);
    const htmlFile = mpaFile ?? "_app.html";
    res.sendFile(path.resolve(distPath, htmlFile));
  });
}
