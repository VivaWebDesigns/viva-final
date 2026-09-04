import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import type { TechnicalSeoScanResult } from "@shared/technicalSeo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildTechnicalSeoReportModel, truncateReportText, type ReportSignal, type ReportTone } from "./reportModel";
import "./technical-seo-report.css";

interface ScanRecord {
  id: string;
  normalizedUrl: string;
  createdAt: string;
  status: string;
  result?: TechnicalSeoScanResult | null;
}

function toneLabel(tone: ReportTone) {
  return tone === "positive" ? "Ready" : tone === "negative" ? "Barrier" : tone === "warning" ? "Review" : "Observed";
}

function SignalGrid({ signals }: { signals: ReportSignal[] }) {
  return <div className="seo-report-signal-grid">{signals.map((signal) => <div className={`seo-report-signal is-${signal.tone}`} key={signal.label}><span>{signal.label}</span><strong>{truncateReportText(signal.value, 150)}</strong><small>{toneLabel(signal.tone)}</small></div>)}</div>;
}

function PageHeader({ number, eyebrow, title }: { number: number; eyebrow: string; title: string }) {
  return <header className="seo-report-page-header"><div><span>{eyebrow}</span><h2>{title}</h2></div><b>{String(number).padStart(2, "0")}</b></header>;
}

function PageFooter({ domain }: { domain: string }) {
  return <footer className="seo-report-page-footer"><img src="/img/logo-report-footer-mark-20260721-v2.svg?v=20260721-v2" alt="Viva Web Designs" /><span>Technical SEO & Fresh-Build Readiness</span><strong>{domain}</strong></footer>;
}

export default function TechnicalSeoReportPage({ scanId }: { scanId: string }) {
  const [, navigate] = useLocation();
  const { data: scan, isLoading, error } = useQuery<ScanRecord>({ queryKey: [`/api/technical-seo/scans/${scanId}`] });

  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" />Preparing report…</div>;
  if (error || !scan?.result) return <div className="mx-auto max-w-xl rounded-xl border bg-white p-8"><h1 className="text-xl font-semibold">Report unavailable</h1><p className="mt-2 text-sm text-gray-600">This report can be generated after the scan completes.</p><Button className="mt-5" variant="outline" onClick={() => navigate(`/admin/tools/technical-seo/${scanId}`)}>Return to scan</Button></div>;

  const report = buildTechnicalSeoReportModel(scan.result);
  const scannedDate = new Date(report.capturedAt || scan.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const counts = scan.result.summary.issueCounts;

  return <div className="seo-report-shell">
    <div className="seo-report-toolbar">
      <Button variant="outline" onClick={() => navigate(`/admin/tools/technical-seo/${scanId}`)}><ArrowLeft className="mr-2 h-4 w-4" />Back to scan</Button>
      <div><strong>Client report</strong><span>Six-page SEO-first summary</span></div>
      <Button onClick={() => window.print()}><Download className="mr-2 h-4 w-4" />Print / Save PDF</Button>
    </div>

    <main className="seo-client-report-root">
      <section className="seo-report-page seo-report-cover">
        <div className="seo-report-cover-mark"><img src="/img/logo-header-lockup-20260713-v4.png?v=20260713-header-caption-20-v4" alt="Viva Web Designs" /></div>
        <div className="seo-report-cover-copy"><span>Technical SEO & Fresh-Build Readiness</span><h1>{report.domain}</h1><p>A concise, evidence-based review of how the scanned page is delivered, interpreted, and rendered for search engines.</p></div>
        <div className={`seo-report-verdict is-${report.verdict.tone}`}><small>Executive conclusion</small><h2>{report.verdict.title}</h2><p>{report.verdict.body}</p></div>
        <div className="seo-report-cover-meta"><div><span>Scanned page</span><strong>{report.finalUrl}</strong></div><div><span>Scan date</span><strong>{scannedDate}</strong></div><div><span>Scope</span><strong>One-URL technical inspection</strong></div></div>
        <PageFooter domain={report.domain} />
      </section>

      <section className="seo-report-page">
        <PageHeader number={2} eyebrow="Executive snapshot" title="What search engines encounter" />
        <p className="seo-report-lede">These are deterministic page-level observations—not rankings, traffic forecasts, or claims from Google Search Console.</p>
        <div className="seo-report-status-row"><div><span>Crawlable</span><strong>{scan.result.summary.crawlable}</strong></div><div><span>Indexability</span><strong>{scan.result.summary.indexability.replace("_", " ")}</strong></div><div><span>Renderable</span><strong>{scan.result.summary.renderable.replace("_", " ")}</strong></div><div><span>Priority findings</span><strong>{counts.critical + counts.high + counts.medium}</strong></div></div>
        <h3 className="seo-report-section-title">Confirmed strengths</h3>
        <ul className="seo-report-check-list">{report.strengths.length ? report.strengths.map((item) => <li key={item}>{item}</li>) : <li>No confirmed strength was promoted without sufficient scan evidence.</li>}</ul>
        <div className="seo-report-callout"><strong>How to use this report</strong><p>Use the findings to define requirements for a fresh website. Validate broader conclusions with representative service, location, contact, and content URLs before finalizing information architecture or migration scope.</p></div>
        <PageFooter domain={report.domain} />
      </section>

      <section className="seo-report-page">
        <PageHeader number={3} eyebrow="Crawling & indexing" title="Can the page be discovered and selected?" />
        <p className="seo-report-lede">Access signals determine whether search engines can request the page, follow its instructions, and understand which URL should be indexed.</p>
        <SignalGrid signals={report.accessSignals} />
        <div className="seo-report-note"><strong>SEO interpretation</strong><p>{scan.result.summary.indexability === "indexable" ? "No deterministic page-level indexing block was detected. This means the page is technically eligible—not that Google will index it or rank it for a particular search." : "The scan found an indexing restriction or uncertainty that should be resolved at the architecture or template level."}</p></div>
        <PageFooter domain={report.domain} />
      </section>

      <section className="seo-report-page">
        <PageHeader number={4} eyebrow="Search understanding" title="What the page communicates" />
        <p className="seo-report-lede">These signals help search engines interpret the page, its primary subject, its relationship to other URLs, and the entities it describes.</p>
        <SignalGrid signals={report.pageSignals} />
        <div className="seo-report-note"><strong>Scope boundary</strong><p>This technical scan does not measure keyword demand, topical authority, backlink strength, conversion performance, or whether the page matches the best search intent. Those require broader research and a multi-page review.</p></div>
        <PageFooter domain={report.domain} />
      </section>

      <section className="seo-report-page">
        <PageHeader number={5} eyebrow="Rendering & evidence" title="What changed after JavaScript ran" />
        <div className="seo-report-render-grid"><div><span>Raw visible words</span><strong>{report.rawWordCount.toLocaleString()}</strong></div><div><span>Rendered visible words</span><strong>{report.renderedWordCount.toLocaleString()}</strong></div><div><span>Changed signals</span><strong>{report.changedSignals.length}</strong></div><div><span>Failed requests</span><strong>{report.failedRequests}</strong></div></div>
        <h3 className="seo-report-section-title">Important raw-to-rendered differences</h3>
        {report.changedSignals.length ? <div className="seo-report-pill-list">{report.changedSignals.slice(0, 10).map((item) => <span key={item}>{item}</span>)}</div> : <p className="seo-report-empty">No important deterministic differences were detected in the compared signals.</p>}
        <div className="seo-report-note"><strong>Rendering conclusion</strong><p>{report.renderError ? `The browser reported a rendering failure: ${truncateReportText(report.renderError, 240)}` : report.changedSignals.length ? "The rendered page differs from the raw response in important ways. A fresh build should ensure primary content and metadata remain available without relying on fragile client-side execution." : "The evaluated primary signals remained substantially consistent after rendering. A fresh build should preserve this server-visible delivery pattern."}</p></div>
        <p className="seo-report-fine-print">Browser page errors: {report.browserErrors}. Some failed third-party resources are normal; prioritize failures affecting primary content, navigation, metadata, or conversion paths.</p>
        <PageFooter domain={report.domain} />
      </section>

      <section className="seo-report-page">
        <PageHeader number={6} eyebrow="Priorities & fresh-build requirements" title="What should shape the next website" />
        <div className="seo-report-priorities">
          <div><h3>Priority findings</h3>{report.topIssues.length ? report.topIssues.map((issue) => <article key={issue.id}><Badge>{issue.severity}</Badge><div><strong>{issue.name}</strong><p><b>Evidence:</b> {truncateReportText(issue.evidence, 180)}</p><p><b>Likely SEO impact:</b> {truncateReportText(issue.interpretation, 180)}</p></div></article>) : <p className="seo-report-empty">No deterministic issues were detected within this scan’s scope.</p>}</div>
          <div><h3>Requirements for a fresh build</h3><ol>{report.requirements.map((item, index) => <li key={item}><span>{index + 1}</span><p>{item}</p></li>)}</ol></div>
        </div>
        <div className="seo-report-scope-box"><strong>Decision standard</strong><p>A fresh-build recommendation should be based on the combined evidence from representative URLs, business goals, search opportunity, platform constraints, and migration risk—not on one isolated warning.</p></div>
        <PageFooter domain={report.domain} />
      </section>
    </main>
  </div>;
}
