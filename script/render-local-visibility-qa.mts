import { build } from "esbuild";
import { execFile } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const projectRoot = path.resolve(import.meta.dirname, "..");
const outputPath = process.argv[2];
if (!outputPath) throw new Error("Pass an output HTML path");
const verticalOffset = Number(process.argv[3] || "0");
if (!Number.isFinite(verticalOffset) || verticalOffset < 0) throw new Error("Vertical offset must be zero or greater");

const heatmap = await readFile(path.join(projectRoot, "tests/fixtures/local-visibility/carolina-custom-automation-heatmap.png"));
const heatmapUrl = `data:image/png;base64,${heatmap.toString("base64")}`;
const headerLogo = await readFile(path.join(projectRoot, "client/public/img/logo-header-lockup-20260713-v2.svg"));
const footerLogo = await readFile(path.join(projectRoot, "client/public/img/logo-report-footer-mark-20260721-v2.svg"));
const headerLogoUrl = `data:image/svg+xml;base64,${headerLogo.toString("base64")}`;
const footerLogoUrl = `data:image/svg+xml;base64,${footerLogo.toString("base64")}`;
const entry = `
  import React from "react";
  import { renderToStaticMarkup } from "react-dom/server";
  import LocalVisibilityReportTemplate from "./client/src/features/local-visibility-report/LocalVisibilityReportTemplate";

  const data = ${JSON.stringify({
    businessName: "YA cleaning service",
    address: "Service Area Business",
    rating: "5.0",
    reviewCount: "19",
    searchPhrase: "house cleaning service",
    market: "Charlotte, NC",
    averagePosition: "20+",
    gridSize: "7 × 7",
    radius: "3",
    heatmapImageUrl: heatmapUrl,
    googleMapsComparison: {
      subjectRank: 130,
      totalBusinesses: 148,
      businessesAheadCount: 129,
      rows: [
        { rank: 129, name: "Stefans Pro Cleaning", rating: 5, reviewCount: 6, topThreeVisibility: 0, foundPoints: 1, totalPoints: 49, isSubject: false, relationship: "above" },
        { rank: 130, name: "YA cleaning service", rating: 5, reviewCount: 19, topThreeVisibility: 0, foundPoints: 0, totalPoints: 49, isSubject: true, relationship: "subject" },
        { rank: 131, name: "Queen Squad Pro Cleaning", rating: 4.9, reviewCount: 137, topThreeVisibility: 0, foundPoints: 0, totalPoints: 49, isSubject: false, relationship: "below" },
      ],
    },
  })};
  process.stdout.write(renderToStaticMarkup(
    React.createElement(LocalVisibilityReportTemplate, { data, mapZoom: 140, mapPosition: { x: 0, y: 0 } })
  ));
`;

const result = await build({
  absWorkingDir: projectRoot,
  stdin: { contents: entry, resolveDir: projectRoot, loader: "tsx", sourcefile: "qa-entry.tsx" },
  bundle: true,
  write: false,
  outfile: path.join(projectRoot, ".qa-build/render.cjs"),
  format: "cjs",
  platform: "node",
  jsx: "automatic",
  tsconfig: path.join(projectRoot, "tsconfig.json"),
  plugins: [{
    name: "ignore-css-for-ssr",
    setup(buildApi) {
      buildApi.onLoad({ filter: /\\.css$/ }, () => ({ contents: "", loader: "text" }));
    },
  }],
});

const js = result.outputFiles.find((file) => file.path.endsWith(".cjs"))?.text;
if (!js) throw new Error("QA bundle did not produce JavaScript");

const temporaryBundle = path.join(projectRoot, `.qa-render-${process.pid}.cjs`);
await writeFile(temporaryBundle, js);
const { stdout: renderedMarkup } = await promisify(execFile)(process.execPath, [temporaryBundle], {
  maxBuffer: 10 * 1024 * 1024,
});
await unlink(temporaryBundle);

const css = await readFile(
  path.join(projectRoot, "client/src/features/local-visibility-report/local-visibility-report.css"),
  "utf8",
);
const hydratedMarkup = renderedMarkup
  .replace("/img/logo-header-lockup-20260713-v2.svg", headerLogoUrl)
  .replace("/img/logo-report-footer-mark-20260721-v2.svg?v=20260721-v2", footerLogoUrl);

await writeFile(outputPath, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden;background:#fff}.lvr-report{transform:translateY(-${verticalOffset}px)}${css}</style></head><body>${hydratedMarkup}</body></html>`);
