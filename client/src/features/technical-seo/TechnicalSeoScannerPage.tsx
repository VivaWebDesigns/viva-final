import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, CheckCircle2, Clipboard, Clock3, ExternalLink, Loader2, RefreshCw, SearchCheck, XCircle } from "lucide-react";
import type { TechnicalSeoIssue, TechnicalSeoScanResult, TechnicalSeoSnapshot } from "@shared/technicalSeo";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface ScanRecord {
  id: string;
  requestedUrl: string;
  normalizedUrl: string;
  status: string;
  stage: string;
  progress: number;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  cancellationRequested?: boolean;
  result?: TechnicalSeoScanResult | null;
  summary?: TechnicalSeoScanResult["summary"] | null;
}

const ACTIVE = new Set(["queued", "validating", "fetching", "rendering", "analyzing"]);
const AI_PROMPT = "Analyze this technical SEO scan as if you were reviewing evidence similar to a Google Search Console Live URL Test. Identify anything that could interfere with crawling, rendering, indexing, canonicalization, structured data, internal linking, or Google's interpretation of the page. Separate confirmed problems from possible concerns. Prioritize the issues by impact and provide exact fixes. Do not claim this scan came from Google.";

function titleCase(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleString() : "—"; }
function displayScanError(scan: ScanRecord): string {
  const fallback = "The scan could not be completed. Please retry. If this continues, contact support.";
  const message = scan.errorMessage?.trim();
  if (!message || message.startsWith("Failed query:") || message.length > 500) return fallback;
  return message;
}

function StatusBadge({ status }: { status: string }) {
  const className = status === "completed" ? "bg-emerald-100 text-emerald-800" : status === "failed" ? "bg-red-100 text-red-800" : status === "cancelled" ? "bg-gray-100 text-gray-700" : "bg-blue-100 text-blue-800";
  return <Badge className={className}>{titleCase(status)}</Badge>;
}

function SeverityBadge({ severity }: { severity: TechnicalSeoIssue["severity"] }) {
  const colors = { critical: "bg-red-700", high: "bg-orange-600", medium: "bg-amber-500", low: "bg-blue-500", informational: "bg-slate-500" };
  return <Badge className={`${colors[severity]} text-white`}>{titleCase(severity)}</Badge>;
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "good" | "bad" | "neutral" }) {
  const toneClass = tone === "good" ? "border-emerald-200 bg-emerald-50" : tone === "bad" ? "border-red-200 bg-red-50" : "border-gray-200 bg-white";
  return <div className={`rounded-lg border p-4 ${toneClass}`}><p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-gray-900">{String(value)}</p></div>;
}

function SnapshotSummary({ snapshot }: { snapshot: TechnicalSeoSnapshot }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SummaryCard label="Profile" value={titleCase(snapshot.profile)} />
      <SummaryCard label="User agent" value={snapshot.requestProfile.userAgent} />
      <SummaryCard label="HTTP status" value={snapshot.statusCode ?? "Unavailable"} tone={snapshot.statusCode === 200 ? "good" : "bad"} />
      <SummaryCard label="Final URL" value={snapshot.finalUrl} />
      <SummaryCard label="Response time" value={snapshot.responseTimeMs === null ? "Unavailable" : `${snapshot.responseTimeMs} ms`} />
      <SummaryCard label="Title" value={snapshot.title ?? "Missing"} />
      <SummaryCard label="Canonical" value={snapshot.canonical.join(", ") || "Missing"} />
      <SummaryCard label="Visible words" value={snapshot.visibleWordCount} />
      <SummaryCard label="Links" value={`${snapshot.internalLinks.length} internal / ${snapshot.externalLinks.length} external`} />
    </div>
  );
}

function ComparisonTable({ comparison }: { comparison: Record<string, unknown> }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50"><tr><th className="p-3">Signal</th><th className="p-3">Before</th><th className="p-3">After</th><th className="p-3">Changed</th></tr></thead>
        <tbody>{Object.entries(comparison).map(([key, value]) => {
          const row = value as { raw: unknown; rendered: unknown; changed: boolean };
          return <tr key={key} className="border-t align-top"><td className="p-3 font-medium">{titleCase(key)}</td><td className="max-w-xs break-words p-3 text-gray-600">{typeof row.raw === "string" ? row.raw || "—" : JSON.stringify(row.raw)}</td><td className="max-w-xs break-words p-3 text-gray-600">{typeof row.rendered === "string" ? row.rendered || "—" : JSON.stringify(row.rendered)}</td><td className="p-3">{row.changed ? <Badge className="bg-amber-100 text-amber-800">Changed</Badge> : <span className="text-gray-400">No</span>}</td></tr>;
        })}</tbody>
      </table>
    </div>
  );
}

function compactAiEvidence(result: TechnicalSeoScanResult) {
  const pick = (snapshot: TechnicalSeoSnapshot) => ({
    profile: snapshot.profile, finalUrl: snapshot.finalUrl, statusCode: snapshot.statusCode, redirects: snapshot.redirects,
    headers: snapshot.headers, title: snapshot.title, metaDescription: snapshot.metaDescription, robots: snapshot.robots,
    xRobotsTag: snapshot.xRobotsTag, canonical: snapshot.canonical, headings: snapshot.headings, visibleWordCount: snapshot.visibleWordCount,
    meaningfulContent: snapshot.meaningfulContent, internalLinkCount: snapshot.internalLinks.length, externalLinkCount: snapshot.externalLinks.length,
    structuredData: snapshot.structuredData, pageErrors: snapshot.pageErrors, failedRequests: snapshot.failedRequests, renderError: snapshot.renderError,
  });
  return { disclaimer: result.disclaimer, summary: result.summary, robotsTxt: result.robotsTxt, sitemap: result.sitemap, comparisons: result.comparisons, issues: result.issues, profiles: {
    neutralRaw: pick(result.profiles.neutralRaw), simulatedGooglebotRaw: pick(result.profiles.simulatedGooglebotRaw), simulatedGooglebotRendered: pick(result.profiles.simulatedGooglebotRendered),
  } };
}

export default function TechnicalSeoScannerPage({ scanId }: { scanId?: string }) {
  const [url, setUrl] = useState("");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: historyData } = useQuery<{ scans: ScanRecord[] }>({ queryKey: ["/api/technical-seo/scans"], refetchInterval: 10_000 });
  const { data: scan, refetch: refetchScan } = useQuery<ScanRecord>({
    queryKey: [`/api/technical-seo/scans/${scanId}`], enabled: !!scanId,
    refetchInterval: (query) => ACTIVE.has((query.state.data as ScanRecord | undefined)?.status ?? "") ? 2_000 : false,
  });
  useEffect(() => { if (scan && !ACTIVE.has(scan.status)) void queryClient.invalidateQueries({ queryKey: ["/api/technical-seo/scans"] }); }, [scan?.status, queryClient]);
  useEffect(() => {
    const latest = historyData?.scans.find((item) => item.id === scanId);
    if (scanId && scan && latest && latest.status !== scan.status) void refetchScan();
  }, [historyData?.scans, scanId, scan?.status, refetchScan]);

  const createMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/technical-seo/scans", { url })).json() as Promise<ScanRecord>,
    onSuccess: (created) => { setUrl(""); void queryClient.invalidateQueries({ queryKey: ["/api/technical-seo/scans"] }); navigate(`/admin/tools/technical-seo/${created.id}`); },
    onError: (error: Error) => toast({ title: "Scan could not be started", description: error.message, variant: "destructive" }),
  });
  const cancelMutation = useMutation({ mutationFn: () => apiRequest("POST", `/api/technical-seo/scans/${scanId}/cancel`), onSuccess: () => void queryClient.invalidateQueries({ queryKey: [`/api/technical-seo/scans/${scanId}`] }) });
  const retryMutation = useMutation({ mutationFn: () => apiRequest("POST", `/api/technical-seo/scans/${scanId}/retry`), onSuccess: () => void queryClient.invalidateQueries({ queryKey: [`/api/technical-seo/scans/${scanId}`] }) });

  const copy = async (text: string, label: string) => { await navigator.clipboard.writeText(text); toast({ title: `${label} copied` }); };
  const openScan = (id: string) => {
    if (id === scanId) {
      void refetchScan();
      return;
    }
    navigate(`/admin/tools/technical-seo/${id}`);
  };
  const result = scan?.result;
  const sortedIssues = useMemo(() => result?.issues ?? [], [result]);

  const submit = (event: FormEvent) => { event.preventDefault(); if (url.trim()) createMutation.mutate(); };
  return (
    <div className="space-y-6" data-testid="technical-seo-scanner-page">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><SearchCheck className="h-6 w-6 text-teal-600" />Technical SEO Scanner</h1>
        <p className="mt-1 text-sm text-gray-500">Compare what a server sends with what a simulated-Googlebot browser profile renders.</p>
      </div>
      <Card><CardContent className="pt-6"><form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row"><Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/page" maxLength={2048} required data-testid="input-technical-seo-url" /><Button type="submit" disabled={createMutation.isPending || !url.trim()} data-testid="button-run-technical-seo-scan">{createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}Run Technical Scan</Button></form><p className="mt-3 text-xs text-gray-500">Public HTTP(S) pages only. This is a simulated crawler inspection, not a Google-generated result.</p></CardContent></Card>

      {scanId && !scan && <Card><CardContent className="flex items-center gap-2 py-10 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading scan…</CardContent></Card>}
      {scan && ACTIVE.has(scan.status) && <Card><CardHeader><CardTitle className="flex items-center justify-between text-base"><span>Scan in progress</span><StatusBadge status={scan.status} /></CardTitle></CardHeader><CardContent><Progress value={scan.progress} /><div className="mt-3 flex items-center justify-between"><p className="text-sm text-gray-600">{titleCase(scan.stage)}</p><Button size="sm" variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending || scan.cancellationRequested}>Cancel</Button></div></CardContent></Card>}
      {scan?.status === "failed" && <Card className="border-red-200"><CardContent className="pt-6"><div className="flex gap-3"><XCircle className="h-5 w-5 text-red-600" /><div className="flex-1"><p className="font-semibold text-red-900">Scan failed</p><p className="mt-1 text-sm text-red-700">{displayScanError(scan)}</p><Button className="mt-4" size="sm" variant="outline" onClick={() => retryMutation.mutate()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div></div></CardContent></Card>}
      {scan?.status === "cancelled" && <Card><CardContent className="flex items-center justify-between pt-6"><span className="text-sm text-gray-600">This scan was cancelled.</span><Button size="sm" variant="outline" onClick={() => retryMutation.mutate()}>Retry</Button></CardContent></Card>}

      {result && <>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{result.disclaimer}</div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => copy(JSON.stringify(result, null, 2), "Full scan JSON")}><Clipboard className="mr-2 h-4 w-4" />Copy Full Scan Data</Button><Button variant="outline" onClick={() => copy(`${AI_PROMPT}\n\n${JSON.stringify(compactAiEvidence(result), null, 2)}`, "AI analysis prompt")}><Clipboard className="mr-2 h-4 w-4" />Copy AI Analysis Prompt</Button><Button variant="ghost" asChild><a href={result.summary.finalUrl} target="_blank" rel="noreferrer">Open final URL <ExternalLink className="ml-2 h-4 w-4" /></a></Button></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="HTTP" value={result.summary.httpStatus ?? "Unavailable"} tone={result.summary.httpStatus === 200 ? "good" : "bad"} />
          <SummaryCard label="Crawlable" value={titleCase(result.summary.crawlable)} tone={result.summary.crawlable === "yes" ? "good" : result.summary.crawlable === "no" ? "bad" : "neutral"} />
          <SummaryCard label="Indexability" value={result.summary.indexability === "indexable" ? "Technically indexable" : titleCase(result.summary.indexability)} tone={result.summary.indexability === "indexable" ? "good" : result.summary.indexability === "not_indexable" ? "bad" : "neutral"} />
          <SummaryCard label="Renderable" value={titleCase(result.summary.renderable)} tone={result.summary.renderable === "yes" ? "good" : result.summary.renderable === "no" ? "bad" : "neutral"} />
          <SummaryCard label="Canonical" value={titleCase(result.summary.canonicalStatus)} />
          <SummaryCard label="robots.txt" value={titleCase(result.summary.robotsStatus)} />
          <SummaryCard label="Structured data" value={result.summary.structuredDataDetected ? "Detected" : "Not detected"} />
          <SummaryCard label="Raw/render changes" value={result.summary.importantRawRenderedDifferences} />
        </div>
        <Card><CardHeader><CardTitle>Issues</CardTitle></CardHeader><CardContent className="space-y-3">{!sortedIssues.length ? <div className="flex items-center gap-2 text-emerald-700"><CheckCircle2 className="h-5 w-5" />No deterministic issues were detected within this scan's scope.</div> : sortedIssues.map((item) => <div key={item.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-center gap-2"><SeverityBadge severity={item.severity} /><Badge variant="outline">{item.category}</Badge><h3 className="font-semibold text-gray-900">{item.name}</h3></div><dl className="mt-3 grid gap-2 text-sm"><div><dt className="font-medium text-gray-700">Observation</dt><dd className="text-gray-600">{item.observation}</dd></div><div><dt className="font-medium text-gray-700">Evidence</dt><dd className="break-words text-gray-600">{item.evidence}</dd></div><div><dt className="font-medium text-gray-700">Interpretation</dt><dd className="text-gray-600">{item.interpretation}</dd></div><div><dt className="font-medium text-gray-700">Recommended action</dt><dd className="text-gray-600">{item.recommendedAction}</dd></div></dl></div>)}</CardContent></Card>
        <Accordion type="multiple" className="rounded-xl border bg-white px-5" defaultValue={["raw-rendered"]}>
          <AccordionItem value="raw-rendered"><AccordionTrigger>Raw HTML vs rendered DOM</AccordionTrigger><AccordionContent><ComparisonTable comparison={result.comparisons.rawVsRendered} /></AccordionContent></AccordionItem>
          <AccordionItem value="fetch-profiles"><AccordionTrigger>Neutral vs simulated-Googlebot fetch</AccordionTrigger><AccordionContent><p className="mb-3 text-sm text-gray-500">Differences are observations and are not automatically classified as cloaking.</p><ComparisonTable comparison={result.comparisons.fetchProfiles} /></AccordionContent></AccordionItem>
          <AccordionItem value="neutral"><AccordionTrigger>Neutral Viva raw fetch</AccordionTrigger><AccordionContent><SnapshotSummary snapshot={result.profiles.neutralRaw} /></AccordionContent></AccordionItem>
          <AccordionItem value="google-raw"><AccordionTrigger>Simulated-Googlebot raw fetch</AccordionTrigger><AccordionContent><SnapshotSummary snapshot={result.profiles.simulatedGooglebotRaw} /></AccordionContent></AccordionItem>
          <AccordionItem value="google-render"><AccordionTrigger>Simulated-Googlebot rendered browser</AccordionTrigger><AccordionContent><SnapshotSummary snapshot={result.profiles.simulatedGooglebotRendered} /></AccordionContent></AccordionItem>
          <AccordionItem value="crawl"><AccordionTrigger>Crawlability, robots.txt, and sitemap</AccordionTrigger><AccordionContent><pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify({ robotsTxt: result.robotsTxt, sitemap: result.sitemap }, null, 2)}</pre></AccordionContent></AccordionItem>
          <AccordionItem value="metadata"><AccordionTrigger>Metadata, headings, and structured data</AccordionTrigger><AccordionContent><pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify({ metadata: { title: result.profiles.simulatedGooglebotRendered.title, description: result.profiles.simulatedGooglebotRendered.metaDescription, canonical: result.profiles.simulatedGooglebotRendered.canonical, robots: result.profiles.simulatedGooglebotRendered.robots, openGraph: result.profiles.simulatedGooglebotRendered.openGraph, twitter: result.profiles.simulatedGooglebotRendered.twitter }, headings: result.profiles.simulatedGooglebotRendered.headings, structuredData: result.profiles.simulatedGooglebotRendered.structuredData }, null, 2)}</pre></AccordionContent></AccordionItem>
          <AccordionItem value="links"><AccordionTrigger>Internal and external links</AccordionTrigger><AccordionContent><pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify({ summary: result.profiles.simulatedGooglebotRendered.links, internal: result.profiles.simulatedGooglebotRendered.internalLinks, external: result.profiles.simulatedGooglebotRendered.externalLinks }, null, 2)}</pre></AccordionContent></AccordionItem>
          <AccordionItem value="javascript"><AccordionTrigger>JavaScript and rendering evidence</AccordionTrigger><AccordionContent><pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify({ renderError: result.profiles.simulatedGooglebotRendered.renderError, pageErrors: result.profiles.simulatedGooglebotRendered.pageErrors, consoleMessages: result.profiles.simulatedGooglebotRendered.consoleMessages, failedRequests: result.profiles.simulatedGooglebotRendered.failedRequests }, null, 2)}</pre></AccordionContent></AccordionItem>
          <AccordionItem value="raw-data"><AccordionTrigger>Raw technical data</AccordionTrigger><AccordionContent><pre className="max-h-[36rem] overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(result, null, 2)}</pre></AccordionContent></AccordionItem>
        </Accordion>
      </>}

      <Card><CardHeader><CardTitle className="text-base">Scan history</CardTitle></CardHeader><CardContent>{!historyData?.scans.length ? <p className="text-sm text-gray-500">No scans yet.</p> : <div className="divide-y rounded-lg border">{historyData.scans.map((item) => <button key={item.id} onClick={() => openScan(item.id)} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50 ${item.id === scanId ? "bg-teal-50" : ""}`}><div className="shrink-0">{item.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : item.status === "failed" ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <Clock3 className="h-5 w-5 text-blue-600" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900">{item.normalizedUrl}</p><p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p></div><StatusBadge status={item.status} /></button>)}</div>}</CardContent></Card>
    </div>
  );
}
