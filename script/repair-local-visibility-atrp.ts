/**
 * Read-only prepare, followed by explicit apply. No scan-submission API is used.
 * REPORT_DATABASE_URL must be the public database URL when run outside Railway.
 * REPORT_RENDERER_MODULE points to an installed Playwright module (maintenance only).
 * Usage: tsx script/repair-local-visibility-atrp.ts --prepare|--apply|--verify /absolute/recovery-directory
 * Original objects are never deleted. recovery.json + per-report records support rollback.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";
import pg from "pg";
import sharp from "sharp";
import { fetchReportAtrp } from "../server/features/local-visibility/metrics";
import { getFileBuffer, uploadFile, uploadPublishedReport } from "../server/services/storage";
import { formatLocalVisibilityAveragePosition, formatLocalVisibilityReportAddress, getLocalFalconMapPresentation } from "../shared/localVisibility";

const mode = process.argv[2];
const output = process.argv[3];
if (!["--prepare", "--apply", "--verify"].includes(mode) || !output || !path.isAbsolute(output)) throw new Error("Pass --prepare, --apply or --verify and an absolute recovery directory.");
const root = path.resolve(import.meta.dirname, "..");
const sha = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");
const client = new pg.Client({ connectionString: process.env.REPORT_DATABASE_URL ?? process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await mkdir(output, { recursive: true, mode: 0o700 });

type Row = Record<string, any>;
type Prepared = { id: string; report_key: string; original: Row; atrp: number; snapshotSha256: string; deliveries: Row[] };
try {
  if (mode === "--prepare") {
    const { rows } = await client.query(`select p.*, b.market_city as batch_city, b.market_state as batch_state,
      coalesce(p.scan_grid_size,b.grid_size) as effective_grid,
      coalesce(p.scan_radius_miles,b.radius_miles) as effective_radius
      from local_falcon_prospect_profiles p join local_falcon_import_batches b on b.id=p.batch_record_id order by p.id`);
    const deliveries = (await client.query("select id, report_id, image_url from scan_report_deliveries")).rows;
    await writeFile(path.join(output, "recovery.json"), JSON.stringify({ createdAt: new Date(), rows, deliveries }, null, 2), { flag: "wx", mode: 0o600 });
    const rendererPath = process.env.REPORT_RENDERER_MODULE;
    if (!rendererPath) throw new Error("REPORT_RENDERER_MODULE is required for preparation.");
    const { chromium } = await import(pathToFileURL(rendererPath).href);
    // Isolated headless renderer; never connects to or controls the user's browser.
    const compiled = await build({
      absWorkingDir: root,
      stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Template from './client/src/features/local-visibility-report/LocalVisibilityReportTemplate'; export const render = (props) => renderToStaticMarkup(React.createElement(Template, props));`, loader: "tsx", resolveDir: root },
      bundle: true, write: false, format: "cjs", platform: "node", jsx: "automatic",
      plugins: [{ name: "ignore-css", setup(api) { api.onLoad({ filter: /\.css$/ }, () => ({ contents: "", loader: "text" })); } }],
    });
    const bundlePath = path.join(output, "renderer.cjs");
    await writeFile(bundlePath, compiled.outputFiles[0].text);
    const { render } = createRequire(import.meta.url)(bundlePath);
    const css = await readFile(path.join(root, "client/src/features/local-visibility-report/local-visibility-report.css"), "utf8");
    // Match the production font, embedding it so snapshot rendering is offline.
    const fontResponse = await fetch("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");
    if (!fontResponse.ok) throw new Error("Report font stylesheet unavailable");
    let fontCss = await fontResponse.text();
    for (const match of [...fontCss.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)]) {
      const response = await fetch(match[1]);
      if (!response.ok) throw new Error("Report font unavailable");
      const encoded = Buffer.from(await response.arrayBuffer()).toString("base64");
      fontCss = fontCss.replaceAll(match[1], `data:font/ttf;base64,${encoded}`);
    }
    await writeFile(path.join(output, "embedded-fonts.css"), fontCss);
    const logos = await Promise.all(["logo-header-lockup-20260713-v2.svg", "logo-report-footer-mark-20260721-v2.svg"].map(async (name) => [name, `data:image/svg+xml;base64,${(await readFile(path.join(root, "client/public/img", name))).toString("base64")}`]));
    const failures: Array<{ reportKey: string; message: string }> = [];
    let index = 0;
    const browser = await chromium.launch({ executablePath: process.env.REPORT_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
    try {
      await Promise.all(Array.from({ length: 3 }, async () => {
        const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
        // All rendered assets are embedded. No requests, tracking, or outside page execution.
        await page.route("**/*", (route: any) => route.abort());
        while (index < rows.length) {
          const row = rows[index++];
          try {
            const atrp = await fetchReportAtrp(row.report_key, row.place_id);
            const [map, old] = await Promise.all([getFileBuffer(row.heatmap_storage_key), row.snapshot_storage_key ? getFileBuffer(row.snapshot_storage_key) : null]);
            const directory = path.join(output, row.id);
            await mkdir(directory, { mode: 0o700 });
            if (old) await writeFile(path.join(directory, "original.png"), old.buffer);
            const data = {
              businessName: row.company_name ?? "", address: formatLocalVisibilityReportAddress({ address: row.address, city: row.scan_city ?? row.city, state: row.scan_state ?? row.state, zip: row.scan_zip ?? row.zip }),
              rating: row.rating, reviewCount: String(row.review_count), searchPhrase: row.scan_keyword,
              market: `${row.scan_city ?? row.batch_city}, ${row.scan_state ?? row.batch_state}`,
              averagePosition: formatLocalVisibilityAveragePosition(atrp), gridSize: row.effective_grid, radius: row.effective_radius,
              heatmapImageUrl: `data:${map.mimeType};base64,${map.buffer.toString("base64")}`,
            };
            let markup = render({ data, ...getLocalFalconMapPresentation(!!row.heatmap_source_url, row.effective_radius) });
            for (const [name, url] of logos) markup = markup.replace(new RegExp(`/img/${name.replaceAll(".", "\\.")}(?:\\?v=[^" ]+)?`, "g"), url);
            await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontCss} html,body{margin:0;background:#fff} ${css}</style></head><body>${markup}</body></html>`);
            await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(img => img.decode())); });
            if (await page.locator(".lvr-business-arp strong").textContent() !== data.averagePosition) throw new Error("Rendered average mismatch");
            if (!(await page.evaluate(() => document.fonts.check('800 50px "Plus Jakarta Sans"')))) throw new Error("Report font did not load");
            const png = await page.locator(".lvr-report").screenshot({ type: "png" });
            const meta = await sharp(png).metadata();
            if (meta.width !== 1080 || meta.height !== 1920) throw new Error("Unexpected snapshot dimensions");
            await writeFile(path.join(directory, "corrected.png"), png);
            const prepared: Prepared = { id: row.id, report_key: row.report_key, original: row, atrp, snapshotSha256: sha(png), deliveries: deliveries.filter(d => d.report_id === row.id) };
            await writeFile(path.join(directory, "prepared.json"), JSON.stringify(prepared, null, 2), { mode: 0o600 });
            console.log(JSON.stringify({ reportKey: row.report_key, oldArp: row.arp, atrp, prepared: true }));
          } catch (error) {
            const failure = { reportKey: row.report_key, message: error instanceof Error ? error.message : "Preparation failed" };
            failures.push(failure);
            console.log(JSON.stringify(failure));
          }
        }
        await page.close();
      }));
    } finally { await browser.close(); }
    await writeFile(path.join(output, "summary.json"), JSON.stringify({ total: rows.length, prepared: rows.length - failures.length, failures }, null, 2));
    console.log(JSON.stringify({ total: rows.length, prepared: rows.length - failures.length, failures: failures.length, writesPerformed: false, scansExecuted: false }));
  } else if (mode === "--verify") {
    const recovery = JSON.parse(await readFile(path.join(output, "recovery.json"), "utf8"));
    const changedFields = new Set(["atrp", "snapshot_storage_key", "snapshot_original_name", "snapshot_mime_type", "snapshot_size_bytes", "snapshot_sha256", "snapshot_generated_at"]);
    let verified = 0;
    let publishedVerified = 0;
    for (const old of recovery.rows) {
      const directory = path.join(output, old.id);
      const prepared: Prepared = JSON.parse(await readFile(path.join(directory, "prepared.json"), "utf8"));
      const current = (await client.query("select * from local_falcon_prospect_profiles where id=$1", [old.id])).rows[0];
      for (const field of Object.keys(current)) {
        if (!changedFields.has(field) && JSON.stringify(current[field]) !== JSON.stringify(old[field])) throw new Error(`Unrelated field changed: ${old.report_key} ${field}`);
      }
      if (Number(current.atrp) !== prepared.atrp || current.snapshot_sha256 !== prepared.snapshotSha256) throw new Error(`Repair mismatch: ${old.report_key}`);
      const image = await getFileBuffer(current.snapshot_storage_key);
      if (sha(image.buffer) !== prepared.snapshotSha256) throw new Error(`Image mismatch: ${old.report_key}`);
      for (const delivery of prepared.deliveries) {
        const row = (await client.query("select image_url from scan_report_deliveries where id=$1 and report_id=$2", [delivery.id, old.id])).rows[0];
        const response = await fetch(row.image_url);
        if (!response.ok || sha(Buffer.from(await response.arrayBuffer())) !== prepared.snapshotSha256) throw new Error(`Published image mismatch: ${old.report_key}`);
        publishedVerified++;
      }
      verified++;
    }
    await writeFile(path.join(output, "verification.json"), JSON.stringify({ verifiedAt: new Date(), verified, publishedVerified, unrelatedFieldsUnchanged: true }, null, 2));
    console.log(JSON.stringify({ verified, publishedVerified, unrelatedFieldsUnchanged: true }));
  } else {
    const recovery = JSON.parse(await readFile(path.join(output, "recovery.json"), "utf8"));
    const summary = JSON.parse(await readFile(path.join(output, "summary.json"), "utf8"));
    if (summary.prepared !== recovery.rows.length || summary.failures.length) throw new Error("Preparation is incomplete; refusing partial repair");
    let applied = 0;
    let skipped = 0;
    for (const old of recovery.rows) {
      const directory = path.join(output, old.id);
      const prepared: Prepared = JSON.parse(await readFile(path.join(directory, "prepared.json"), "utf8"));
      const png = await readFile(path.join(directory, "corrected.png"));
      if (sha(png) !== prepared.snapshotSha256) throw new Error("Prepared image checksum changed");
      const current = (await client.query("select * from local_falcon_prospect_profiles where id=$1", [old.id])).rows[0];
      if (current.snapshot_sha256 === prepared.snapshotSha256 && Number(current.atrp) === prepared.atrp) { skipped++; continue; }
      if (current.snapshot_storage_key !== old.snapshot_storage_key || current.report_key !== old.report_key || current.arp !== old.arp || current.place_id !== old.place_id) throw new Error(`Concurrent report update: ${old.report_key}`);
      const stored = await uploadFile(png, `${old.id}-atrp-snapshot.png`, "image/png", "local-visibility-snapshots");
      const readback = await getFileBuffer(stored.key);
      if (sha(readback.buffer) !== prepared.snapshotSha256) throw new Error("Stored image readback failed");
      const published = prepared.deliveries.length
        ? await uploadPublishedReport(png, `scans/${old.id}/${prepared.snapshotSha256}.png`, "image/png") : null;
      await writeFile(path.join(directory, "uploaded.json"), JSON.stringify({ stored, published }), { mode: 0o600 });
      await client.query("BEGIN");
      try {
        const result = await client.query(`update local_falcon_prospect_profiles set atrp=$1,
          snapshot_storage_key=$2,snapshot_original_name=$3,snapshot_mime_type='image/png',snapshot_size_bytes=$4,
          snapshot_sha256=$5,snapshot_generated_at=now()
          where id=$6 and report_key=$7 and snapshot_storage_key is not distinct from $8 and arp=$9 returning arp,atrp,snapshot_sha256`,
        [String(prepared.atrp), stored.key, stored.originalName, png.length, prepared.snapshotSha256, old.id, old.report_key, old.snapshot_storage_key, old.arp]);
        if (result.rowCount !== 1 || result.rows[0].arp !== old.arp) throw new Error("Concurrent update or ARP mismatch");
        if (published) for (const delivery of prepared.deliveries) {
          await client.query("update scan_report_deliveries set image_url=$1,updated_at=now() where id=$2 and report_id=$3 and image_url=$4", [published.url, delivery.id, old.id, delivery.image_url]);
        }
        await client.query("COMMIT");
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      const verify = (await client.query("select arp,atrp,snapshot_sha256 from local_falcon_prospect_profiles where id=$1", [old.id])).rows[0];
      if (verify.arp !== old.arp || Number(verify.atrp) !== prepared.atrp || verify.snapshot_sha256 !== prepared.snapshotSha256) throw new Error("Post-commit verification failed");
      await writeFile(path.join(directory, "applied.json"), JSON.stringify({ appliedAt: new Date(), ...verify }), { mode: 0o600 });
      applied++;
      console.log(JSON.stringify({ reportKey: old.report_key, repaired: true, publishedLinksUpdated: prepared.deliveries.length }));
    }
    console.log(JSON.stringify({ applied, skipped, scansExecuted: false, emailsSent: false, originalsDeleted: false }));
  }
} finally { await client.end(); }
