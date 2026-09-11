import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertTriangle, CheckCircle2, Clipboard, Clock3, ExternalLink, FileText, Loader2, RefreshCw, SearchCheck, Trash2, XCircle } from "lucide-react";
import type { TechnicalSeoAuditContext, TechnicalSeoIssue, TechnicalSeoScanResult, TechnicalSeoSnapshot } from "@shared/technicalSeo";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
  auditContext?: TechnicalSeoAuditContext | null;
  summary?: TechnicalSeoScanResult["summary"] | null;
}

interface ScanCompany {
  businessName: string;
  scanCount: number;
  activeCount: number;
  latestScanAt: string;
}

const ACTIVE = new Set(["queued", "validating", "fetching", "rendering", "analyzing"]);
const RETIRED_RANKING_ISSUES = new Set(["organic-not-top-ten", "maps-not-top-ten"]);
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
  const [businessName, setBusinessName] = useState("");
  const [trade, setTrade] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [googleBusinessUrl, setGoogleBusinessUrl] = useState("");
  const [targetServices, setTargetServices] = useState("");
  const [serviceAreas, setServiceAreas] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ScanCompany | null>(null);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: historyData } = useQuery<{ scans: ScanRecord[] }>({ queryKey: ["/api/technical-seo/scans"], refetchInterval: 10_000 });
  const { data: companyData } = useQuery<{ companies: ScanCompany[] }>({ queryKey: ["/api/technical-seo/scan-companies"], refetchInterval: 10_000 });
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
    mutationFn: async () => (await apiRequest("POST", "/api/technical-seo/scans", {
      url, businessName, trade, city, state, address, phone, googleBusinessUrl,
      targetServices: targetServices.split(",").map((value) => value.trim()).filter(Boolean),
      serviceAreas: serviceAreas.split(",").map((value) => value.trim()).filter(Boolean),
    })).json() as Promise<ScanRecord>,
    onSuccess: (created) => { setUrl(""); void queryClient.invalidateQueries({ queryKey: ["/api/technical-seo/scans"] }); navigate(`/admin/tools/technical-seo/${created.id}`); },
    onError: (error: Error) => toast({ title: "Scan could not be started", description: error.message, variant: "destructive" }),
  });
  const cancelMutation = useMutation({ mutationFn: () => apiRequest("POST", `/api/technical-seo/scans/${scanId}/cancel`), onSuccess: () => void queryClient.invalidateQueries({ queryKey: [`/api/technical-seo/scans/${scanId}`] }) });
  const retryMutation = useMutation({ mutationFn: () => apiRequest("POST", `/api/technical-seo/scans/${scanId}/retry`), onSuccess: () => void queryClient.invalidateQueries({ queryKey: [`/api/technical-seo/scans/${scanId}`] }) });
  const deleteCompanyMutation = useMutation({
    mutationFn: async (company: ScanCompany) => (await apiRequest("DELETE", "/api/technical-seo/scan-companies", { businessName: company.businessName })).json() as Promise<{ businessName: string; deletedCount: number }>,
    onSuccess: (deleted, company) => {
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/technical-seo/scans"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/technical-seo/scan-companies"] });
      if (scan?.auditContext?.businessName.trim().toLowerCase() === company.businessName.trim().toLowerCase()) {
        queryClient.removeQueries({ queryKey: [`/api/technical-seo/scans/${scanId}`], exact: true });
        navigate("/admin/tools/technical-seo");
      }
      toast({ title: "Company scan history deleted", description: `${deleted.deletedCount} scan${deleted.deletedCount === 1 ? "" : "s"} and associated report data were permanently removed.` });
    },
    onError: (error: Error) => toast({ title: "History could not be deleted", description: error.message, variant: "destructive" }),
  });

  const copy = async (text: string, label: string) => { await navigator.clipboard.writeText(text); toast({ title: `${label} copied` }); };
  const openScan = (id: string) => {
    if (id === scanId) {
      void refetchScan();
      return;
    }
    navigate(`/admin/tools/technical-seo/${id}`);
  };
  const result = scan?.result;
  const sortedIssues = useMemo(() => result?.issues.filter((item) => !RETIRED_RANKING_ISSUES.has(item.id)) ?? [], [result]);

  const submit = (event: FormEvent) => { event.preventDefault(); if (url.trim()) createMutation.mutate(); };
  return (
    <div className="space-y-6" data-testid="technical-seo-scanner-page">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900"><SearchCheck className="h-6 w-6 text-teal-600" />Technical SEO Scanner</h1>
        <p className="mt-1 text-sm text-gray-500">Run a multi-page technical, performance, Business Profile, trust, and conversion audit.</p>
      </div>
      <Card><CardHeader><CardTitle className="text-base">New local SEO audit</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-3">
        <Input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Website URL *" maxLength={2048} required data-testid="input-technical-seo-url" />
        <div className="grid gap-3 md:grid-cols-2"><Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Business name *" required /><Input value={trade} onChange={(e) => setTrade(e.target.value)} placeholder="Primary trade or service *" required /></div>
        <div className="grid gap-3 md:grid-cols-2"><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Primary city *" required /><Input value={state} onChange={(e) => setState(e.target.value)} placeholder="State *" required /></div>
        <div className="grid gap-3 md:grid-cols-2"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Business address (optional)" /><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Business phone (optional)" /></div>
        <Input type="url" value={googleBusinessUrl} onChange={(e) => setGoogleBusinessUrl(e.target.value)} placeholder="Google Business Profile URL (optional)" />
        <div className="grid gap-3 md:grid-cols-2"><Input value={targetServices} onChange={(e) => setTargetServices(e.target.value)} placeholder="Target services, comma separated" /><Input value={serviceAreas} onChange={(e) => setServiceAreas(e.target.value)} placeholder="Service areas, comma separated" /></div>
        <div className="flex items-center justify-between gap-3"><p className="text-xs text-gray-500">Crawls up to 20 pages. Business Profile matching uses no more than two paid provider requests; rankings stay in the dedicated map-pack scan.</p><Button type="submit" disabled={createMutation.isPending || !url.trim() || !businessName.trim() || !trade.trim() || !city.trim() || !state.trim()} data-testid="button-run-technical-seo-scan">{createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}Run Full Audit</Button></div>
      </form></CardContent></Card>

      {scanId && !scan && <Card><CardContent className="flex items-center gap-2 py-10 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading scan…</CardContent></Card>}
      {scan && ACTIVE.has(scan.status) && <Card><CardHeader><CardTitle className="flex items-center justify-between text-base"><span>Scan in progress</span><StatusBadge status={scan.status} /></CardTitle></CardHeader><CardContent><Progress value={scan.progress} /><div className="mt-3 flex items-center justify-between"><p className="text-sm text-gray-600">{titleCase(scan.stage)}</p><Button size="sm" variant="outline" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending || scan.cancellationRequested}>Cancel</Button></div></CardContent></Card>}
      {scan?.status === "failed" && <Card className="border-red-200"><CardContent className="pt-6"><div className="flex gap-3"><XCircle className="h-5 w-5 text-red-600" /><div className="flex-1"><p className="font-semibold text-red-900">Scan failed</p><p className="mt-1 text-sm text-red-700">{displayScanError(scan)}</p><Button className="mt-4" size="sm" variant="outline" onClick={() => retryMutation.mutate()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div></div></CardContent></Card>}
      {scan?.status === "cancelled" && <Card><CardContent className="flex items-center justify-between pt-6"><span className="text-sm text-gray-600">This scan was cancelled.</span><Button size="sm" variant="outline" onClick={() => retryMutation.mutate()}>Retry</Button></CardContent></Card>}

      {result && <>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">{result.disclaimer}</div>
        <div className="flex flex-wrap gap-2"><Button onClick={() => navigate(`/admin/tools/technical-seo/${scanId}/report`)}><FileText className="mr-2 h-4 w-4" />Open Client Report</Button><Button variant="outline" onClick={() => copy(JSON.stringify(result, null, 2), "Full scan JSON")}><Clipboard className="mr-2 h-4 w-4" />Copy Full Scan Data</Button><Button variant="outline" onClick={() => copy(`${AI_PROMPT}\n\n${JSON.stringify(compactAiEvidence(result), null, 2)}`, "AI analysis prompt")}><Clipboard className="mr-2 h-4 w-4" />Copy AI Analysis Prompt</Button><Button variant="ghost" asChild><a href={result.summary.finalUrl} target="_blank" rel="noreferrer">Open final URL <ExternalLink className="ml-2 h-4 w-4" /></a></Button></div>
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
        {result.siteAudit && <Card><CardHeader><CardTitle>Independent category grades</CardTitle></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{result.siteAudit.grades.map((grade) => <div key={grade.key} className="rounded-lg border bg-white p-4"><p className="text-3xl font-bold text-teal-700">{grade.grade}</p><p className="mt-1 text-sm font-semibold text-gray-900">{grade.label}</p><p className="mt-2 text-xs leading-relaxed text-gray-600">{grade.rationale}</p></div>)}</div><p className="mt-4 text-xs text-gray-500">Every category is graded independently. There is no weighted overall score, and unavailable provider data remains Not assessed.</p></CardContent></Card>}
        {result.siteAudit?.insights && <Card><CardHeader><CardTitle>Business story and opportunities</CardTitle></CardHeader><CardContent className="grid gap-5 lg:grid-cols-2"><div><h3 className="text-sm font-semibold text-gray-800">Connected themes</h3><div className="mt-2 space-y-3">{result.siteAudit.insights.themes.map((theme) => <div key={theme.title} className="rounded-lg border p-3"><p className="text-sm font-semibold text-gray-900">{theme.title}</p><p className="mt-1 text-xs leading-relaxed text-gray-600">{theme.summary}</p></div>)}</div></div><div><h3 className="text-sm font-semibold text-gray-800">Specific opportunities</h3><div className="mt-2 space-y-3">{result.siteAudit.insights.opportunities.map((opportunity) => <div key={opportunity.title} className="rounded-lg border p-3"><div className="flex items-center gap-2"><Badge variant="outline">{titleCase(opportunity.priority)}</Badge><p className="text-sm font-semibold text-gray-900">{opportunity.title}</p></div><p className="mt-1 text-xs leading-relaxed text-gray-600">{opportunity.rationale}</p><p className="mt-1 text-xs text-gray-500">Evidence: {opportunity.evidence}</p></div>)}</div></div></CardContent></Card>}
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
          {result.siteAudit && <AccordionItem value="business-evidence"><AccordionTrigger>Page architecture, CTAs, forms, schema, and trust evidence</AccordionTrigger><AccordionContent><pre className="max-h-[36rem] overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(result.siteAudit.pages.map((page) => ({ url: page.url, statusCode: page.statusCode, title: page.title, h1: page.h1, wordCount: page.wordCount, platformHints: page.platformHints, contact: page.contact, signals: page.signals, evidence: page.evidence })), null, 2)}</pre></AccordionContent></AccordionItem>}
          <AccordionItem value="raw-data"><AccordionTrigger>Raw technical data</AccordionTrigger><AccordionContent><pre className="max-h-[36rem] overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">{JSON.stringify(result, null, 2)}</pre></AccordionContent></AccordionItem>
        </Accordion>
      </>}

      <Card><CardHeader><CardTitle className="text-base">Scan history</CardTitle></CardHeader><CardContent className="space-y-5">{!historyData?.scans.length ? <p className="text-sm text-gray-500">No scans yet.</p> : <><div><h3 className="mb-2 text-sm font-semibold text-gray-800">Delete company history</h3><div className="divide-y rounded-lg border">{companyData?.companies.map((company) => <div key={company.businessName.toLowerCase()} className="flex items-center gap-3 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900">{company.businessName}</p><p className="text-xs text-gray-500">{company.scanCount} scan{company.scanCount === 1 ? "" : "s"} with report data · Latest {formatDate(company.latestScanAt)}</p></div><Button type="button" size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={company.activeCount > 0} onClick={() => setDeleteTarget(company)}><Trash2 className="mr-2 h-4 w-4" />{company.activeCount > 0 ? "Scan active" : "Delete all"}</Button></div>)}</div></div><div><h3 className="mb-2 text-sm font-semibold text-gray-800">Individual scans</h3><div className="divide-y rounded-lg border">{historyData.scans.map((item) => <button key={item.id} onClick={() => openScan(item.id)} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50 ${item.id === scanId ? "bg-teal-50" : ""}`}><div className="shrink-0">{item.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : item.status === "failed" ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <Clock3 className="h-5 w-5 text-blue-600" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900">{item.normalizedUrl}</p><p className="text-xs text-gray-500">{formatDate(item.createdAt)}</p></div><StatusBadge status={item.status} /></button>)}</div></div></>}</CardContent></Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !deleteCompanyMutation.isPending) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all history for {deleteTarget?.businessName}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes all {deleteTarget?.scanCount ?? 0} stored scans, technical evidence, results, and generated report data for this company. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCompanyMutation.isPending}>Keep history</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" disabled={deleteCompanyMutation.isPending || !deleteTarget} onClick={(event) => { event.preventDefault(); if (deleteTarget) deleteCompanyMutation.mutate(deleteTarget); }}>{deleteCompanyMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Delete all company data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
