import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import { keywordDemand, keywordScore, type KeywordResearchKeyword, type PageOneStrength } from "@shared/keywordResearch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const UNSORTED = "Unsorted";
const RISING_TREND = 0.25;

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Something went wrong";
  try {
    return (JSON.parse(raw) as { message?: string }).message ?? raw;
  } catch {
    return raw;
  }
}

const value = (row: KeywordResearchKeyword) => keywordScore(row) ?? 0;
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

interface ServicePlan {
  service: string;
  value: number;
  keywords: number;
  covered: number;
  coveredValue: number;
  servicePage: string | null;
  cityPages: { have: number; want: number };
  costPage: { have: number; want: number };
  blog: { have: number; want: number };
  mapPackShare: number;
  aiOverviewTopics: number;
  rising: number;
  missing: KeywordResearchKeyword[];
  assets: string[];
}

/**
 * What to build for each service and what only the client can supply for it. The assets are what a competitor
 * cannot copy: real prices, photos from real jobs in each city, reviews, and the owners' own answers.
 */
function buildPlan(keywords: KeywordResearchKeyword[]): ServicePlan[] {
  const groups = new Map<string, KeywordResearchKeyword[]>();
  for (const row of keywords) groups.set(row.service ?? UNSORTED, [...(groups.get(row.service ?? UNSORTED) ?? []), row]);
  return [...groups].map(([service, rows]) => {
    const count = (type: KeywordResearchKeyword["pageType"]) => {
      const typed = rows.filter(row => row.pageType === type);
      return { have: typed.filter(row => row.coveredBy).length, want: typed.length };
    };
    const checked = rows.filter(row => row.pageOne);
    const mapPackShare = percent(checked.filter(row => row.pageOne!.mapPack).length, checked.length);
    const aiOverviewTopics = rows.filter(row => (row.pageType === "blog" || row.pageType === "cost") && row.pageOne?.aiOverview).length;
    const rising = rows.filter(row => (row.trend ?? 0) >= RISING_TREND && (keywordDemand(row) ?? 0) >= 30).length;
    const cityPages = count("city");
    const costPage = count("cost");
    const assets = [
      "The owner explaining how the work is done, on camera or quoted, with warranty and process specifics",
      costPage.want > 0 && "Real price ranges from recent jobs for the cost page",
      cityPages.want > 0 && "Project photos tagged by city, at least 3 for each city page",
      mapPackShare >= 50 && `Reviews from every customer and Google Business Profile photos: the map pack shows on ${mapPackShare}% of these searches`,
      aiOverviewTopics > 0 && `Direct answers with the client's own numbers for ${aiOverviewTopics} topic${aiOverviewTopics === 1 ? "" : "s"} where Google shows an AI Overview`,
      rising > 0 && `Publish first: ${rising} search${rising === 1 ? " is" : "es are"} up 25%+ on last year`,
    ].filter((asset): asset is string => !!asset);
    return {
      service,
      value: rows.reduce((sum, row) => sum + value(row), 0),
      keywords: rows.length,
      covered: rows.filter(row => row.coveredBy).length,
      coveredValue: rows.filter(row => row.coveredBy).reduce((sum, row) => sum + value(row), 0),
      servicePage: rows.find(row => row.pageType === "service" && row.coveredBy)?.coveredBy ?? null,
      cityPages,
      costPage,
      blog: count("blog"),
      mapPackShare,
      aiOverviewTopics,
      rising,
      missing: rows.filter(row => row.coveredBy === null && row.pageType !== "blog").sort((a, b) => value(b) - value(a)).slice(0, 3),
      assets,
    };
  }).sort((a, b) => b.value - a.value);
}

const STRENGTH_LABELS: Record<PageOneStrength, string> = { open: "Open", beatable: "Beatable", contested: "Contested" };

/** Page 1 from the client's city for the top keywords, how much of the keyword value already has a page, and the build plan. */
export default function PageCheckCard({ project, onUpdate }: { project: KeywordResearchProject; onUpdate: (project: KeywordResearchProject) => void }) {
  const { toast } = useToast();
  const check = project.summary?.pageCheck;
  const keywords = project.keywords;

  const run = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${project.id}/page-check`)).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => onUpdate(updated),
    onError: runError => toast({ title: "Could not check page 1", description: errorMessage(runError), variant: "destructive" }),
  });

  const stats = useMemo(() => {
    const checked = keywords.filter(row => row.pageOne);
    const strength = (level: PageOneStrength) => checked.filter(row => row.pageOne!.strength === level).length;
    const scored = keywords.filter(row => row.coveredBy !== undefined && value(row) > 0);
    const total = scored.reduce((sum, row) => sum + value(row), 0);
    const covered = scored.filter(row => row.coveredBy).reduce((sum, row) => sum + value(row), 0);
    return {
      checked: checked.length,
      open: strength("open"),
      beatable: strength("beatable"),
      contested: strength("contested"),
      mapPack: checked.filter(row => row.pageOne!.mapPack).length,
      aiOverview: checked.filter(row => (row.pageType === "blog" || row.pageType === "cost") && row.pageOne!.aiOverview).length,
      clientOnPageOne: checked.filter(row => row.pageOne!.clientPosition != null).length,
      coverage: scored.length ? percent(covered, total) : null,
    };
  }, [keywords]);
  const plan = useMemo(() => (check ? buildPlan(keywords) : []), [check, keywords]);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">5. Page 1 and coverage</CardTitle>
        <p className="text-sm text-gray-600">
          Searches the top 75 keywords by score from {project.city} to see who holds page 1, whether a map pack or AI Overview shows, and where the client ranks.
          Then matches every keyword to the page on the client's site that targets it. Takes 1–2 minutes and about $0.20 in search data.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Button onClick={() => run.mutate()} disabled={run.isPending} data-testid="button-kr-page-check">
          {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          {run.isPending ? "Checking… this takes 1–2 minutes" : check ? "Check again" : "Check page 1"}
        </Button>

        {check && (
          <>
            <p className="text-sm text-gray-600">
              Checked {check.checked} keywords from {check.location} on {new Date(check.ranAt).toLocaleDateString()} · data cost ${check.costUsd.toFixed(2)}.
              {check.movedToBlog > 0 && ` ${check.movedToBlog} moved to blog posts because page 1 is mostly articles.`}
            </p>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Open", stats.open, "3+ weak sites on page 1"],
                ["Beatable", stats.beatable, "1–2 weak sites"],
                ["Contested", stats.contested, "no weak sites"],
                ["Client on page 1", stats.clientOnPageOne, `of ${stats.checked} checked`],
              ].map(([label, count, note]) => (
                <div key={label} className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className="text-xl font-semibold tabular-nums">{count}</div>
                  <div className="text-xs text-gray-500">{note}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Map pack on {stats.mapPack} of {stats.checked} searches (won through Google Business Profile, not pages) · AI Overview on {stats.aiOverview} blog and cost topics.
            </p>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Coverage</h3>
              {stats.coverage == null ? (
                <p className="text-sm text-gray-500">{check.siteNote ?? "Coverage was not checked."}</p>
              ) : (
                <>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100" role="meter" aria-valuenow={stats.coverage} aria-valuemin={0} aria-valuemax={100} aria-label="Keyword value with a page">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${stats.coverage}%` }} />
                  </div>
                  <p className="text-sm text-gray-600">{stats.coverage}% of the keyword value (searches × CPC) has a page on the client's site · {check.sitePages} pages found.</p>
                </>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Build plan by service</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Value/mo</TableHead>
                      <TableHead className="text-right">Covered</TableHead>
                      <TableHead>Pages</TableHead>
                      <TableHead>Build next</TableHead>
                      <TableHead>Only the client can supply</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.map(row => (
                      <TableRow key={row.service} className="align-top">
                        <TableCell className="font-medium">{row.service}</TableCell>
                        <TableCell className="text-right tabular-nums">${row.value.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{percent(row.coveredValue, row.value)}%</TableCell>
                        <TableCell className="text-gray-600">
                          <span className="block">Service page: {row.servicePage ?? "none"}</span>
                          <span className="block">City pages: {row.cityPages.have}/{row.cityPages.want}</span>
                          <span className="block">Cost pages: {row.costPage.have}/{row.costPage.want}</span>
                          <span className="block">Blog topics: {row.blog.have}/{row.blog.want}</span>
                        </TableCell>
                        <TableCell className="text-gray-600">{row.missing.length ? row.missing.map(item => <span key={item.keyword} className="block">{item.keyword}</span>) : "—"}</TableCell>
                        <TableCell className="text-gray-600">{row.assets.map(asset => <span key={asset} className="block">· {asset}</span>)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { STRENGTH_LABELS };
