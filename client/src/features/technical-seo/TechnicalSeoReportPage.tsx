import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import type { TechnicalSeoScanResult } from "@shared/technicalSeo";
import { Button } from "@/components/ui/button";
import { buildTechnicalSeoReportModel, truncateReportText } from "./reportModel";
import "./technical-seo-report.css";

interface ScanRecord { id: string; normalizedUrl: string; createdAt: string; status: string; result?: TechnicalSeoScanResult | null }
const REPORT_LOGO = "/img/logo-header-lockup-20260713-v4.png?v=20260910-technical-report-v1";
function Footer({ domain }: { domain: string }) { return <footer className="seo-report-page-footer"><img src={REPORT_LOGO} alt="Viva Web Designs" /><span>Local SEO & Technical Audit</span><strong>{domain}</strong></footer>; }
function Header({ number, title }: { number: number; title: string }) { return <header className="seo-report-page-header"><div><span>Evidence-based audit</span><h2>{title}</h2></div><b>{String(number).padStart(2, "0")}</b></header>; }
function gradeClass(grade: string) { return grade === "A" || grade === "B" ? "good" : grade === "C" || grade === "Not assessed" ? "warn" : "bad"; }

export default function TechnicalSeoReportPage({ scanId }: { scanId: string }) {
  const [, navigate] = useLocation();
  const { data: scan, isLoading, error } = useQuery<ScanRecord>({ queryKey: [`/api/technical-seo/scans/${scanId}`] });
  if (isLoading) return <div className="flex min-h-[60vh] items-center justify-center gap-2 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" />Preparing report…</div>;
  if (error || !scan?.result) return <div className="mx-auto max-w-xl rounded-xl border bg-white p-8"><h1 className="text-xl font-semibold">Report unavailable</h1><p className="mt-2 text-sm text-gray-600">This report can be generated after the scan completes.</p></div>;
  const report = buildTechnicalSeoReportModel(scan.result);
  const date = new Date(report.capturedAt || scan.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return <div className="seo-report-shell"><div className="seo-report-toolbar"><Button variant="outline" onClick={() => navigate(`/admin/tools/technical-seo/${scanId}`)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><div><strong>Client audit</strong><span>{Math.min(report.issues.length, 7)} highest-impact confirmed problems</span></div><div className="flex justify-end gap-2"><Button onClick={() => window.print()}><Download className="mr-2 h-4 w-4" />Save PDF</Button></div></div>
  <main className="seo-client-report-root">
    <section className="seo-report-page seo-report-cover"><div className="seo-report-cover-mark"><img src={REPORT_LOGO} alt="Viva Web Designs" /></div><div className="seo-report-cover-copy"><span>Local SEO & Technical Audit</span><h1>{report.context?.businessName ?? report.domain}</h1><p>{report.context ? `${report.context.trade} · ${report.context.city}, ${report.context.state}` : report.domain}</p></div><div className="seo-report-grade-grid">{report.grades.map((g) => <div className={`grade-${gradeClass(g.grade)}`} key={g.key}><strong>{g.grade}</strong><span>{g.label}</span></div>)}</div><div className="seo-report-cover-meta"><div><span>Website</span><strong>{report.finalUrl}</strong></div><div><span>Audit date</span><strong>{date}</strong></div><div><span>Scope</span><strong>{report.crawl ? `${report.crawl.crawled} pages crawled` : "Legacy one-page scan"}</strong></div></div><Footer domain={report.domain} /></section>
    <section className="seo-report-page"><Header number={2} title="What is broken and why it matters" /><div className="seo-report-summary">{report.summary.map((item) => <p key={item}>{item}</p>)}</div><h3 className="seo-report-section-title">Category grades</h3><div className="seo-report-grade-detail">{report.grades.map((g) => <article key={g.key}><b className={`grade-${gradeClass(g.grade)}`}>{g.grade}</b><div><strong>{g.label}</strong><p>{g.rationale}</p></div></article>)}</div><div className="seo-report-note"><strong>Evidence standard</strong><p>Grades use only completed checks. Unavailable provider data is labeled Not assessed and is not silently scored as a failure. Low grades reflect confirmed conditions.</p></div><Footer domain={report.domain} /></section>
    <section className="seo-report-page"><Header number={3} title="Highest-impact confirmed problems" /><div className="seo-report-issue-list">{report.issues.slice(0, 7).map((issue, i) => <article key={issue.id}><span>{i + 1}</span><div><small>{issue.severity} · {issue.category}</small><h3>{issue.name}</h3><p>{truncateReportText(issue.observation, 220)}</p><p><b>Why it matters:</b> {truncateReportText(issue.rankingImpact ?? issue.interpretation, 240)}</p></div></article>)}</div><Footer domain={report.domain} /></section>
  </main></div>;
}
