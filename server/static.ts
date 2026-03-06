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

  app.use(express.static(distPath));

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

  app.use("/{*path}", (req, res) => {
    const urlPath = req.originalUrl.split("?")[0];
    const mpaFile = mpaHtmlFiles[urlPath];
    const htmlFile = mpaFile ?? "index.html";
    res.sendFile(path.resolve(distPath, htmlFile));
  });
}
