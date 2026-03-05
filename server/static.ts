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
    "/empieza": "empieza.html",
    "/empieza.html": "empieza.html",
    "/crece": "crece.html",
    "/crece.html": "crece.html",
    "/domina": "domina.html",
    "/domina.html": "domina.html",
  };

  app.use("/{*path}", (req, res) => {
    const urlPath = req.path.split("?")[0];
    const mpaFile = mpaHtmlFiles[urlPath];
    const htmlFile = mpaFile ?? "index.html";
    res.sendFile(path.resolve(distPath, htmlFile));
  });
}
