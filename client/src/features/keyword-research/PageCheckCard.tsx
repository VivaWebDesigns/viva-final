import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import { keywordDemand, keywordScore, type GridCell, type KeywordResearchKeyword, type PlanAction, type PlanConfidence } from "@shared/keywordResearch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const RISING_TREND = 0.25;

export const ACTION_LABELS: Record<PlanAction, string> = { keep: "Keep", improve: "Improve", publish: "Publish", create: "Create", investigate: "Investigate" };
export const CONFIDENCE_LABELS: Record<PlanConfidence, string> = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };
const ACTION_ORDER: PlanAction[] = ["improve", "create", "publish", "investigate", "keep"];

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Something went wrong";
  try {
    return (JSON.parse(raw) as { message?: string }).message ?? raw;
  } catch {
    return raw;
  }
}

export function ActionBadge({ action }: { action: PlanAction }) {
  const tone = action === "create" || action === "improve" ? "default" : action === "investigate" ? "outline" : "secondary";
  return <Badge variant={tone} className="text-xs">{ACTION_LABELS[action]}</Badge>;
}

const value = (row: KeywordResearchKeyword) => keywordScore(row) ?? 0;
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

interface ServiceAssets {
  service: string;
  value: number;
  assets: string[];
}

/** What only the client can supply for each service: the facts a competitor cannot copy. */
function clientAssets(keywords: KeywordResearchKeyword[]): ServiceAssets[] {
  const groups = new Map<string, KeywordResearchKeyword[]>();
  for (const row of keywords) groups.set(row.service ?? "Unsorted", [...(groups.get(row.service ?? "Unsorted") ?? []), row]);
  return [...groups].map(([service, rows]) => {
    const checks = rows.flatMap(row => row.pageOne ?? []);
    const mapPackShare = percent(checks.filter(check => check.mapPack).length, checks.length);
    const aiOverviewTopics = rows.filter(row => (row.pageType === "blog" || row.pageType === "cost") && row.pageOne?.some(check => check.aiOverview)).length;
    const rising = rows.filter(row => (row.trend ?? 0) >= RISING_TREND && (keywordDemand(row) ?? 0) >= 30).length;
    const costPages = rows.filter(row => row.pageType === "cost" && row.plan?.action === "create").length;
    const cityPages = rows.filter(row => row.pageType === "city" && row.plan?.action === "create").length;
    const assets = [
      "The owner explaining how the work is done, with warranty and process specifics",
      costPages > 0 && "Real price ranges from recent jobs for the cost pages",
      cityPages > 0 && "Project photos tagged by city, at least 3 for each city page",
      mapPackShare >= 50 && `Reviews from every customer and Google Business Profile photos: the map pack shows on ${mapPackShare}% of checked searches`,
      aiOverviewTopics > 0 && `Direct answers with the client's own numbers for ${aiOverviewTopics} topic${aiOverviewTopics === 1 ? "" : "s"} where Google shows an AI Overview`,
      rising > 0 && `Publish first: ${rising} search${rising === 1 ? " is" : "es are"} up 25%+ on last year`,
    ].filter((asset): asset is string => !!asset);
    return { service, value: rows.reduce((sum, row) => sum + value(row), 0), assets };
  }).sort((a, b) => b.value - a.value);
}

function GridTable({ grid }: { grid: GridCell[] }) {
  const cities = [...new Set(grid.map(cell => cell.city))];
  const services = [...new Set(grid.map(cell => cell.service))];
  const cell = (service: string, city: string) => grid.find(entry => entry.service === service && entry.city === city);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            {cities.map(city => <TableHead key={city}>{city}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map(service => (
            <TableRow key={service}>
              <TableCell className="font-medium">{service}</TableCell>
              {cities.map(city => {
                const entry = cell(service, city);
                if (!entry) return <TableCell key={city}>—</TableCell>;
                return (
                  <TableCell key={city} title={entry.reasons.join("\n")}>
                    <ActionBadge action={entry.action} />
                    <span className="block text-xs text-gray-500">
                      {entry.page.path ? `${entry.page.status} page` : "no page"}
                      {entry.checked ? ` · ${entry.position ? `#${entry.position}` : "not top 20"}` : " · not checked"}
                    </span>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Page 1 from the client's cities, which pages exist where, and what to do about each keyword and each service × city. */
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
    const planned = keywords.filter(row => row.plan);
    const actions = Object.fromEntries(ACTION_ORDER.map(action => [action, planned.filter(row => row.plan!.action === action).length])) as Record<PlanAction, number>;
    const checks = keywords.flatMap(row => row.pageOne ?? []);
    const matched = keywords.filter(row => row.pageMatch && value(row) > 0);
    const total = matched.reduce((sum, row) => sum + value(row), 0);
    const withPage = matched.filter(row => row.pageMatch!.path).reduce((sum, row) => sum + value(row), 0);
    return {
      actions,
      checkedKeywords: keywords.filter(row => row.pageOne?.length).length,
      mapPack: checks.filter(entry => entry.mapPack).length,
      checks: checks.length,
      clientOnPageOne: keywords.filter(row => row.pageOne?.some(entry => entry.clientPosition != null && entry.clientPosition <= 10)).length,
      coverage: matched.length ? percent(withPage, total) : null,
    };
  }, [keywords]);
  const assets = useMemo(() => (check ? clientAssets(keywords) : []), [check, keywords]);
  const cities = project.serviceCities.length ? project.serviceCities.map(name => name.split(",")[0]) : [project.city];

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">6. Page 1 and the plan</CardTitle>
        <p className="text-sm text-gray-600">
          Searches the top 75 keywords by score from {project.city} and the top money keywords from up to 2 other served cities ({cities.slice(1, 3).join(", ") || "none listed"}).
          Records who holds page 1, where the client ranks, and whether a map pack or AI Overview shows. Then matches each keyword to a page on the assessed site and decides an action with its reasons.
          Takes 1–2 minutes and about $0.50 in search data.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Button onClick={() => run.mutate()} disabled={run.isPending} data-testid="button-kr-page-check">
          {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          {run.isPending ? "Checking… this takes 1–2 minutes" : check ? "Check again" : "Check page 1 and plan"}
        </Button>

        {check && (
          <>
            <p className="text-sm text-gray-600">
              Checked {check.checked} keywords from {check.location}{check.cities && check.cities.length > 1 ? ` and ${check.cities.slice(1).join(", ")}` : ""} on {new Date(check.ranAt).toLocaleDateString()} · data cost ${check.costUsd.toFixed(2)}.
              {" "}Demand numbers are for {project.locationName.replace(/,United States$/, "")}, not for each city.
              {check.movedToBlog > 0 && ` ${check.movedToBlog} service keyword${check.movedToBlog === 1 ? "" : "s"} moved to blog posts because page 1 is mostly articles.`}
              {check.siteKind === "staging" && " Pages were read from a staging site; a staging page is not published or visible in Google."}
              {!!check.identicalResults?.length && ` Note: ${check.identicalResults.map(pair => pair.join(" and ")).join("; ")} returned the same top 10 for most keywords.`}
            </p>

            <div className="grid gap-3 sm:grid-cols-5">
              {ACTION_ORDER.map(action => (
                <div key={action} className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{ACTION_LABELS[action]}</div>
                  <div className="text-xl font-semibold tabular-nums">{stats.actions[action]}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              Client on page 1 for {stats.clientOnPageOne} of {stats.checkedKeywords} checked keywords · map pack on {stats.mapPack} of {stats.checks} checks (won through Google Business Profile, not pages).
              {" "}Filter the keyword list above by action; each keyword shows the facts behind its action and its confidence.
            </p>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Pages on the {check.siteKind ?? "assessed"} site</h3>
              {stats.coverage == null ? (
                <p className="text-sm text-gray-500">{check.siteNote ?? "Pages were not checked."}</p>
              ) : (
                <>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100" role="meter" aria-valuenow={stats.coverage} aria-valuemin={0} aria-valuemax={100} aria-label="Keyword value with a page">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${stats.coverage}%` }} />
                  </div>
                  <p className="text-sm text-gray-600">
                    {stats.coverage}% of the keyword value (searches × CPC) has a page on the {check.siteKind} site · {check.sitePages} pages found.
                    {check.siteKind === "staging" && " Existing here means built, not published."}
                  </p>
                </>
              )}
            </section>

            {!!check.grid?.length && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Service × city assessment</h3>
                <p className="text-xs text-gray-500">
                  An empty cell is a question, not a page to build: a general service page can serve a city. Create appears only when the city has no page, demand is known, and page 1 from that city (or a picked competitor's rankings) shows room. Hover a cell for its reasons.
                </p>
                <GridTable grid={check.grid} />
              </section>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Only the client can supply</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Value/mo</TableHead>
                      <TableHead>Needed for its pages</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map(row => (
                      <TableRow key={row.service} className="align-top">
                        <TableCell className="font-medium">{row.service}</TableCell>
                        <TableCell className="text-right tabular-nums">${row.value.toLocaleString()}</TableCell>
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
