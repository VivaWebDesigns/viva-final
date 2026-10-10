import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ListChecks, Loader2 } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import type { Opportunity, PageAction, PageKind, PagePlan, PlanConfidence } from "@shared/keywordResearch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { runState } from "./runState";

export const PAGE_ACTION_LABELS: Record<PageAction, string> = {
  improve: "Improve", recommend: "Page recommended", staging: "On staging: review and publish", investigate: "Investigate", keep: "Keep",
};
const OPPORTUNITY_LABELS: Record<Opportunity, string> = { more_room: "More room on page 1", normal: "Normal competition", contested: "Contested (harder)", unchecked: "Page 1 not checked" };
const CONFIDENCE_LABELS: Record<PlanConfidence, string> = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };
const KIND_LABELS: Record<PageKind, string> = { service: "Service page", city: "City page", cost: "Cost guide", blog: "Blog post" };
const ACTIONS: PageAction[] = ["improve", "recommend", "staging", "investigate", "keep"];
const ALL = "__all";

// What a competitor cannot copy, by the kind of page: the facts only the client has.
const CLIENT_ASSETS: Record<PageKind, string> = {
  service: "The owner explaining how the work is done, with warranty and process specifics, and photos of real jobs",
  city: "Photos and details of real projects in this city",
  cost: "Real price ranges from recent jobs",
  blog: "The client's own answer: what they see on jobs, with their numbers",
};

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Something went wrong";
  try {
    return (JSON.parse(raw) as { message?: string }).message ?? raw;
  } catch {
    return raw;
  }
}

function PageRow({ page }: { page: PagePlan }) {
  const [open, setOpen] = useState(false);
  const actionable = page.action === "improve" || page.action === "recommend" || page.action === "staging";
  return (
    <li className="rounded-md border p-3" data-testid={`plan-page-${page.id}`}>
      <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" /> : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />}
        <span className="flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={page.action === "recommend" || page.action === "improve" ? "default" : "outline"} className="text-xs">{PAGE_ACTION_LABELS[page.action]}</Badge>
            <span className="font-medium text-gray-900">{page.title}</span>
            {page.priorityService && <Badge variant="secondary" className="text-xs">priority</Badge>}
          </span>
          <span className="mt-1 block text-xs text-gray-500">
            {KIND_LABELS[page.kind]} · {page.service}{page.city ? ` · ${page.city}` : ""} · {page.keywords.length} keyword{page.keywords.length === 1 ? "" : "s"}
            {" "}· ${page.value.toLocaleString()}/mo{page.unknownValue ? ` + ${page.unknownValue} with unknown value` : ""}
            {" "}· {OPPORTUNITY_LABELS[page.opportunity]} · {CONFIDENCE_LABELS[page.confidence]}
          </span>
          {page.evidence && (
            <span className="block text-xs text-gray-500">
              Checked "{page.evidence.keyword}" from {page.evidence.city}: {page.evidence.smallSites} small sites, {page.evidence.forums} forum threads, {page.evidence.unknownSites} unknown, {page.evidence.cityPages} city-specific results{page.evidence.clientPosition ? `, client #${page.evidence.clientPosition}` : ", client not in top 20"}{page.evidence.mapPack ? ", map pack shows" : ""}.
            </span>
          )}
          {page.questions.map(question => <span key={question} className="block text-xs text-amber-700">? {question}</span>)}
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 pl-6 text-xs text-gray-600">
          <div>
            <div className="font-medium text-gray-800">Why</div>
            {page.reasons.map(reason => <div key={reason}>· {reason}</div>)}
            {page.adjusted && <div>· {page.adjusted}</div>}
          </div>
          {actionable && (
            <div>
              <div className="font-medium text-gray-800">Only the client can supply</div>
              <div>· {CLIENT_ASSETS[page.kind]}</div>
            </div>
          )}
          <div>
            <div className="font-medium text-gray-800">Keywords ({page.keywords.length})</div>
            <div>{page.keywords.join(" · ")}</div>
          </div>
        </div>
      )}
    </li>
  );
}

/** The page plan: which pages to improve, build, publish or look into first, each with its keywords, evidence and open questions. */
export default function PlanCard({ project, onUpdate }: { project: KeywordResearchProject; onUpdate: (project: KeywordResearchProject) => void }) {
  const { toast } = useToast();
  const plan = project.summary?.plan;
  const run = runState(project, "plan");
  const [action, setAction] = useState(ALL);

  const start = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${project.id}/plan`)).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => onUpdate(updated),
    onError: startError => toast({ title: "Could not start the plan", description: errorMessage(startError), variant: "destructive" }),
  });
  const busy = start.isPending || run.running;
  const counts = useMemo(() => Object.fromEntries(ACTIONS.map(name => [name, plan?.pages.filter(page => page.action === name).length ?? 0])) as Record<PageAction, number>, [plan]);
  const visible = plan?.pages.filter(page => action === ALL || page.action === action) ?? [];

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">6. Page plan</CardTitle>
        <p className="text-sm text-gray-600">
          Checks the top keywords as the client's work (against the confirmed services and exclusions), groups them into pages, starting from pages the site already has,
          checks page 1 once per page from the city that page is for, and decides what to do with each page. Runs in the background for 2–4 minutes; about $0.30 in search data plus Claude.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Button onClick={() => start.mutate()} disabled={busy} data-testid="button-kr-build-plan">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
          {busy ? "Building the plan… you can leave this page" : plan ? "Rebuild the plan" : "Build the page plan"}
        </Button>
        {run.error && <p className="text-sm text-red-600">{run.error}</p>}

        {plan && (
          <>
            <p className="text-sm text-gray-600">
              {plan.pages.length} pages from {plan.pages.reduce((sum, page) => sum + page.keywords.length, 0).toLocaleString()} keywords · built {new Date(plan.ranAt).toLocaleDateString()} · data cost ${plan.costUsd.toFixed(2)}.
              {" "}Pages were read from the {plan.siteKind} site{plan.sitePages != null ? ` (${plan.sitePages} pages)` : ""}.
              {plan.siteKind === "staging" && " A staging page is not published or visible in Google."}
              {plan.siteNote && ` ${plan.siteNote}`}
              {" "}Each page's check covers one keyword from one city, not everything under it.
            </p>
            <div className="grid gap-3 sm:grid-cols-5">
              {ACTIONS.map(name => (
                <div key={name} className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">{PAGE_ACTION_LABELS[name]}</div>
                  <div className="text-xl font-semibold tabular-nums">{counts[name]}</div>
                </div>
              ))}
            </div>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="w-full sm:w-72" data-testid="select-kr-plan-action"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All pages ({plan.pages.length})</SelectItem>
                {ACTIONS.map(name => <SelectItem key={name} value={name}>{PAGE_ACTION_LABELS[name]} ({counts[name]})</SelectItem>)}
              </SelectContent>
            </Select>
            <ol className="space-y-2">
              {visible.map(page => <PageRow key={page.id} page={page} />)}
            </ol>
            {plan.unresolved.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-900">Held back ({plan.unresolved.length})</h3>
                <p className="text-xs text-gray-500">Not in any page: uncertain it is the client's work, excluded work, or a city the client does not list.</p>
                <ul className="max-h-64 space-y-0.5 overflow-y-auto text-xs text-gray-600">
                  {plan.unresolved.map(item => <li key={item.keyword}><span className="font-medium text-gray-800">{item.keyword}</span>: {item.reason}</li>)}
                </ul>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
