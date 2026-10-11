import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ListChecks, Loader2, Plus, X } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import type { Opportunity, PageAction, PageKind, PageObservation, PagePlan, PlanConfidence } from "@shared/keywordResearch";
import { comparePages, describeObservation, observationsFor, withObservations } from "@shared/pagePlan";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const EVIDENCE_KINDS: Record<string, string> = {
  captured_ranking: "Captured search ranking",
  city_leads: "Client reports leads from this city",
  page_leads: "Leads attributed to this page",
};
const SURFACES: Record<string, string> = { organic: "Regular results", map_pack: "Map pack", ai_answer: "AI answer" };

/** Records evidence for a page from outside the page-1 check. It sits beside the check and is never overwritten by it. */
function EvidenceForm({ page, projectId, onUpdate }: { page: PagePlan; projectId: string; onUpdate: (project: KeywordResearchProject) => void }) {
  const { toast } = useToast();
  const [kind, setKind] = useState("captured_ranking");
  const [surface, setSurface] = useState("organic");
  const [query, setQuery] = useState(page.mainKeyword);
  const [position, setPosition] = useState("");
  const [observedOn, setObservedOn] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const add = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${projectId}/observations`, {
      kind,
      surface: kind === "captured_ranking" ? surface : null,
      query: kind === "captured_ranking" && query.trim() ? query.trim() : null,
      position: kind === "captured_ranking" && position ? Number(position) : null,
      path: page.page.path,
      service: page.service,
      cities: page.city ? [page.city] : [],
      observedOn, source, note,
    })).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => {
      setPosition("");
      setNote("");
      onUpdate(updated);
    },
    onError: addError => toast({ title: "Could not record the evidence", description: errorMessage(addError), variant: "destructive" }),
  });
  return (
    <div className="space-y-2 rounded-md bg-gray-50 p-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(EVIDENCE_KINDS).map(([value, label]) => <SelectItem key={value} value={value} disabled={value === "city_leads" ? !page.city : value === "page_leads" ? !page.page.path : false}>{label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" className="h-8 text-xs" value={observedOn} onChange={event => setObservedOn(event.target.value)} aria-label="Observed on" />
        <Input className="h-8 text-xs" value={source} onChange={event => setSource(event.target.value)} placeholder="Reported by, e.g. Matt, screenshots" />
      </div>
      {kind === "captured_ranking" && (
        <div className="grid gap-2 sm:grid-cols-[10rem_1fr_5rem]">
          <Select value={surface} onValueChange={setSurface}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(SURFACES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-8 text-xs" value={query} onChange={event => setQuery(event.target.value)} placeholder="The search or AI question" />
          <Input className="h-8 text-xs" type="number" min={1} value={position} onChange={event => setPosition(event.target.value)} placeholder="#" aria-label="Position" />
        </div>
      )}
      <div className="flex gap-2">
        <Input className="h-8 text-xs" value={note} onChange={event => setNote(event.target.value)} placeholder="Note (optional)" />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => add.mutate()} disabled={add.isPending || !source.trim() || (kind === "captured_ranking" && !position)}>
          {add.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Plus className="mr-1 h-3 w-3" />}Record
        </Button>
      </div>
    </div>
  );
}

function PageRow({ page, observations, projectId, onUpdate }: { page: PagePlan; observations: PageObservation[]; projectId: string; onUpdate: (project: KeywordResearchProject) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const recorded = observationsFor(page, observations);
  const remove = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/keyword-research/projects/${projectId}/observations/${id}`)).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => onUpdate(updated),
    onError: removeError => toast({ title: "Could not remove the evidence", description: errorMessage(removeError), variant: "destructive" }),
  });
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
            {page.grid && <Badge variant="outline" className="text-xs">service × city</Badge>}
            {recorded.length > 0 && <Badge variant="outline" className="text-xs">{recorded.length} recorded</Badge>}
          </span>
          <span className="mt-1 block text-xs text-gray-500">
            {KIND_LABELS[page.kind]} · {page.service}{page.city ? ` · ${page.city}` : ""} · {page.keywords.length} keyword{page.keywords.length === 1 ? "" : "s"}
            {" "}· {page.value || !page.unknownValue ? `$${page.value.toLocaleString()}/mo (searches × avg CPC)` : "value unknown"}{page.unknownValue ? ` · ${page.unknownValue} keyword${page.unknownValue === 1 ? "" : "s"} not reported` : ""}
            {" "}· {OPPORTUNITY_LABELS[page.opportunity]} · {CONFIDENCE_LABELS[page.confidence]}
          </span>
          {page.evidence && (
            <span className="block text-xs text-gray-500">
              Checked "{page.evidence.keyword}" from {page.evidence.city}: {page.evidence.clientPosition ? `client #${page.evidence.clientPosition} in regular results` : "client not in the top 20 regular results"}
              {page.evidence.clientMapPosition ? `, #${page.evidence.clientMapPosition} in the map pack` : page.evidence.mapPack ? ", not in the map pack" : ""}; {page.evidence.cityPages} city-specific results, {page.evidence.smallSites} small sites, {page.evidence.forums} forum threads, {page.evidence.unknownSites} unknown.
            </span>
          )}
          {page.checkStatus === "failed" && <span className="block text-xs text-amber-700">The page-1 check failed at DataForSEO: ranking unknown, not absent.</span>}
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
          <div>
            <div className="font-medium text-gray-800">Recorded evidence ({recorded.length})</div>
            {recorded.map(item => (
              <div key={item.id} className="flex items-start gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => remove.mutate(item.id)} disabled={remove.isPending} aria-label="Remove this evidence"><X className="h-3 w-3" /></Button>
                <span>{describeObservation(item)}</span>
              </div>
            ))}
            <EvidenceForm page={page} projectId={projectId} onUpdate={onUpdate} />
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
  // Recorded evidence applies on top of the plan, so recording it changes the page right away without a rebuild.
  const pages = useMemo(() => plan
    ? plan.pages.map(page => withObservations(page, project.observations, new Date(plan.ranAt).toLocaleDateString())).sort(comparePages)
    : [], [plan, project.observations]);
  const counts = useMemo(() => Object.fromEntries(ACTIONS.map(name => [name, pages.filter(page => page.action === name).length])) as Record<PageAction, number>, [pages]);
  const visible = pages.filter(page => action === ALL || page.action === action);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">6. Page plan</CardTitle>
        <p className="text-sm text-gray-600">
          Checks the top keywords as the client's work (against the confirmed services and exclusions), pairs every confirmed service's city phrase with every served city,
          groups them into pages, starting from pages the site already has, checks page 1 once per page from the city that page is for (city pages for their target phrase),
          and decides what to do with each page. Runs in the background for 3–8 minutes; about $1 in search data plus Claude.
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
              {!!plan.failedChecks && ` ${plan.failedChecks} page-1 checks failed at DataForSEO; those pages read as not checked.`}
              {!!plan.uncheckedPages && ` ${plan.uncheckedPages} pages were past the page-1 check budget; they stay in the plan as not checked.`}
              {!!plan.notJudged && ` ${plan.notJudged.toLocaleString()} keywords with no matched service were not judged this run; they stay on the keyword list.`}
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
              {visible.map(page => <PageRow key={page.id} page={page} observations={project.observations} projectId={project.id} onUpdate={onUpdate} />)}
            </ol>
            {!!plan.inventory?.length && (
              <details className="rounded-md border p-3 text-xs text-gray-600">
                <summary className="cursor-pointer text-sm font-semibold text-gray-900">
                  Site inventory ({plan.inventory.length} pages, {plan.inventory.filter(page => page.words).length} read in full)
                </summary>
                <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
                  {plan.inventory.map(page => (
                    <li key={page.path}>
                      <span className="font-medium text-gray-800">{page.path}</span> · {page.kind}
                      {page.services.length ? ` · ${page.services.join(", ")}` : ""}{page.cities.length ? ` · ${page.cities.join(", ")}` : ""}
                      {" "}· {page.words ? `${page.words.toLocaleString()} words${page.textSource === "embedded" ? " (from embedded data)" : ""}` : "not read"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
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
