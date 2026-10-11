import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Map as MapIcon } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import type { BlueprintEntry, EvidenceStatus, GroupDecision } from "@shared/blueprint";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_ACTION_LABELS } from "./PlanCard";

const EVIDENCE_LABELS: Record<EvidenceStatus, string> = {
  existing: "On the site",
  supported: "Page 1 checked: supports it",
  not_checked: "Not checked yet",
  check_failed: "Check failed: unknown",
  mixed: "Checked: page 1 favours general pages",
};
const STRENGTH_LABELS = {
  page_names_both: "an existing page names both",
  page_body_covers_both: "an existing page's body covers both",
  intake_match: "matched to one page at intake (a guess)",
  identical_numbers: "identical Google Ads numbers (possible overlap)",
} as const;
const ALL = "__all";

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Something went wrong";
  try {
    return (JSON.parse(raw) as { message?: string }).message ?? raw;
  } catch {
    return raw;
  }
}

function money(value: number | null) {
  return value == null ? null : `$${value.toLocaleString()}`;
}

function EntryRow({ entry }: { entry: BlueprintEntry }) {
  const provisional = entry.evidenceStatus !== "existing" && entry.evidenceStatus !== "supported";
  return (
    <li className="rounded-md border p-3 text-sm" data-testid={`blueprint-entry-${entry.pageIds[0]}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-900">{entry.title}</span>
        <Badge variant={entry.action === "keep" ? "secondary" : "outline"} className="text-xs">{PAGE_ACTION_LABELS[entry.action]}</Badge>
        <Badge variant="outline" className={`text-xs ${provisional ? "border-amber-300 text-amber-800" : ""}`}>{EVIDENCE_LABELS[entry.evidenceStatus]}</Badge>
        {entry.grouping && (
          <Badge variant="outline" className="text-xs">
            {entry.grouping.decision === "combine" ? "combined" : entry.grouping.decision === "separate" ? "kept separate" : "combination to review"}
          </Badge>
        )}
      </div>
      <div className="mt-1 font-mono text-xs text-gray-700 break-all">
        {entry.url} <span className="font-sans text-gray-500">({entry.urlStatus === "proposed" ? "proposed address" : entry.urlStatus === "staging" ? "on staging" : "live"})</span>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {entry.keywords} keyword{entry.keywords === 1 ? "" : "s"}
        {entry.value != null ? ` · ${money(entry.value)}${entry.valueHigh && entry.valueHigh > entry.value ? `–${money(entry.valueHigh)}` : ""}/mo (searches × avg CPC)` : " · searches not reported"}
        {entry.referenceCpc != null ? ` · metro reference avg CPC $${entry.referenceCpc.toFixed(2)}` : ""}
        {" "}· phase {entry.phase}: {entry.phaseReason}
      </div>
    </li>
  );
}

/** The site blueprint: every page with its address, build phase and evidence status, and the combinations to decide. */
export default function BlueprintCard({ project, onUpdate }: { project: KeywordResearchProject; onUpdate: (project: KeywordResearchProject) => void }) {
  const { toast } = useToast();
  const plan = project.summary?.plan;
  const blueprint = plan?.blueprint;
  const [phase, setPhase] = useState(ALL);
  const [evidence, setEvidence] = useState(ALL);

  const rebuild = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${project.id}/plan/blueprint`)).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => onUpdate(updated),
    onError: error => toast({ title: "Could not build the blueprint", description: errorMessage(error), variant: "destructive" }),
  });
  const decide = useMutation({
    mutationFn: async (input: { services: string[]; decision: GroupDecision | "pending" }) =>
      (await apiRequest("POST", `/api/keyword-research/projects/${project.id}/plan/groupings`, input)).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => onUpdate(updated),
    onError: error => toast({ title: "Could not save the decision", description: errorMessage(error), variant: "destructive" }),
  });

  const visible = useMemo(() => (blueprint?.entries ?? [])
    .filter(entry => phase === ALL || String(entry.phase) === phase)
    .filter(entry => evidence === ALL || (evidence === "provisional" ? entry.evidenceStatus !== "existing" && entry.evidenceStatus !== "supported" : entry.evidenceStatus === evidence)), [blueprint, phase, evidence]);
  const provisional = (blueprint?.entries ?? []).filter(entry => entry.evidenceStatus !== "existing" && entry.evidenceStatus !== "supported").length;

  if (!plan) return null;
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">7. Site blueprint</CardTitle>
        <p className="text-sm text-gray-600">
          Every page of the plan with an address, a build phase and where it stands on evidence. Phases order the build by kind and business value;
          evidence status is separate, so a page that is not checked yet is never ranked lower for that alone.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {!blueprint ? (
          <Button onClick={() => rebuild.mutate()} disabled={rebuild.isPending} data-testid="button-kr-build-blueprint">
            {rebuild.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapIcon className="mr-2 h-4 w-4" />}Build the blueprint from this plan
          </Button>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              {blueprint.phases.map(item => (
                <div key={item.phase} className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Phase {item.phase}</div>
                  <div className="text-sm font-medium text-gray-900">{item.title}</div>
                  <div className="text-xl font-semibold tabular-nums">{item.count}</div>
                  <div className="mt-1 text-xs text-gray-500">{item.rule}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              {blueprint.entries.length} pages · {provisional} provisional (need a completed page-1 check before building) · proposed addresses follow the site's own pattern,{" "}
              <span className="font-mono">{blueprint.urlPattern.services}</span> and <span className="font-mono">{blueprint.urlPattern.blog}</span> · built {new Date(blueprint.generatedAt).toLocaleString()}.
            </p>

            {!!plan.groupSuggestions?.length && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Combinations to decide ({plan.groupSuggestions.length})</h3>
                <p className="text-xs text-gray-500">Each service keeps its own pages until you combine them. Combining puts them on one page per city in the blueprint.</p>
                <ul className="space-y-2">
                  {plan.groupSuggestions.map(item => {
                    const key = [...item.services].sort().join("|");
                    const decision = project.summary?.groupDecisions?.[key] ?? "pending";
                    return (
                      <li key={key} className="rounded-md border p-3 text-xs text-gray-600">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{item.services.join(" + ")}</span>
                          <Badge variant="outline" className="text-xs">{STRENGTH_LABELS[item.strength]}</Badge>
                          <span>{item.pages.length} {item.pages.length === 1 ? "place" : "places"}</span>
                        </div>
                        <div className="mt-1">{item.evidence[0]}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(["combine", "separate", "pending"] as const).map(choice => (
                            <Button key={choice} type="button" size="sm" variant={decision === choice ? "default" : "outline"} className="h-7"
                              disabled={decide.isPending} onClick={() => decide.mutate({ services: item.services, decision: choice })} data-testid={`button-kr-group-${choice}-${key}`}>
                              {choice === "combine" ? "Combine" : choice === "separate" ? "Keep separate" : "Undecided"}
                            </Button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={phase} onValueChange={setPhase}>
                <SelectTrigger className="w-full sm:w-64" data-testid="select-kr-blueprint-phase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All phases ({blueprint.entries.length})</SelectItem>
                  {blueprint.phases.map(item => <SelectItem key={item.phase} value={String(item.phase)}>Phase {item.phase}: {item.title} ({item.count})</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={evidence} onValueChange={setEvidence}>
                <SelectTrigger className="w-full sm:w-72" data-testid="select-kr-blueprint-evidence"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any evidence status</SelectItem>
                  <SelectItem value="provisional">Provisional ({provisional})</SelectItem>
                  {(Object.keys(EVIDENCE_LABELS) as EvidenceStatus[]).map(status => (
                    <SelectItem key={status} value={status}>{EVIDENCE_LABELS[status]} ({blueprint.entries.filter(entry => entry.evidenceStatus === status).length})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ol className="space-y-2">
              {visible.map(entry => <EntryRow key={entry.pageIds.join("+")} entry={entry} />)}
            </ol>
            <Button variant="outline" size="sm" onClick={() => rebuild.mutate()} disabled={rebuild.isPending}>
              {rebuild.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Rebuild the blueprint from the saved plan
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
