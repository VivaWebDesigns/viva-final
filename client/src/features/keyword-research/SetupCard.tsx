import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles, Star, X } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import type { Exclusion } from "@shared/keywordResearch";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MAX_PRIORITIES = 3;

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Something went wrong";
  try {
    return (JSON.parse(raw) as { message?: string }).message ?? raw;
  } catch {
    return raw;
  }
}

/** The client's answers that steer the plan: the services they most want jobs for, the cities they serve, and the live domain. */
export default function SetupCard({ project, onUpdate }: { project: KeywordResearchProject; onUpdate: (project: KeywordResearchProject) => void }) {
  const { toast } = useToast();
  const selected = project.services.filter(service => service.selected);
  const [priorities, setPriorities] = useState(new Set(selected.filter(service => service.priority).map(service => service.name)));
  const [cities, setCities] = useState(project.serviceCities.join("\n"));
  const [liveDomain, setLiveDomain] = useState(project.liveDomain ?? "");
  const [exclusions, setExclusions] = useState<Exclusion[]>(project.exclusions);
  const [newWork, setNewWork] = useState("");
  const [newTerms, setNewTerms] = useState("");

  const save = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/keyword-research/projects/${project.id}/setup`, {
      priorities: [...priorities],
      serviceCities: cities.split("\n").map(line => line.trim()).filter(Boolean),
      liveDomain,
      exclusions,
    })).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => {
      toast({ title: "Setup saved" });
      onUpdate(updated);
    },
    onError: saveError => toast({ title: "Could not save the setup", description: errorMessage(saveError), variant: "destructive" }),
  });

  const infer = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${project.id}/exclusions/infer`)).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => {
      setExclusions(updated.exclusions);
      onUpdate(updated);
    },
    onError: inferError => toast({ title: "Could not infer exclusions", description: errorMessage(inferError), variant: "destructive" }),
  });

  const addExclusion = () => {
    const work = newWork.trim().toLowerCase();
    if (!work) return;
    const terms = [...new Set([work, ...newTerms.split(",").map(term => term.trim().toLowerCase()).filter(Boolean)])];
    setExclusions(previous => [...previous.filter(item => item.work !== work), { work, terms, reason: "Added by hand", source: "user" }]);
    setNewWork("");
    setNewTerms("");
  };

  const togglePriority = (name: string) => {
    const next = new Set(priorities);
    if (next.has(name)) next.delete(name);
    else if (next.size < MAX_PRIORITIES) next.add(name);
    else return toast({ title: `Pick up to ${MAX_PRIORITIES} priority services` });
    setPriorities(next);
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">2. Client priorities</CardTitle>
        <p className="text-sm text-gray-600">
          Three answers from the client steer the plan: which services they most want more jobs for, which cities they actually serve, and where the live site is.
          Demand is measured for the metro; these cities decide which pages are assessed.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Priority services (up to {MAX_PRIORITIES}, optional)</Label>
          <p className="text-xs text-gray-500">Leave empty when the client has no preference: every confirmed service is then researched evenly.</p>
          <div className="flex flex-wrap gap-2">
            {selected.map(service => (
              <Button key={service.name} type="button" size="sm" variant={priorities.has(service.name) ? "default" : "outline"} onClick={() => togglePriority(service.name)} data-testid={`button-kr-priority-${service.name}`}>
                <Star className={`mr-1 h-3 w-3 ${priorities.has(service.name) ? "fill-current" : ""}`} />{service.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="kr-service-cities">Cities served (one "City, ST" per line)</Label>
            <Textarea id="kr-service-cities" rows={5} value={cities} onChange={event => setCities(event.target.value)} placeholder={`${project.city}, ${project.state}`} data-testid="input-kr-service-cities" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kr-live-domain">Live domain</Label>
            <Input id="kr-live-domain" value={liveDomain} onChange={event => setLiveDomain(event.target.value)} placeholder="clientsite.com" data-testid="input-kr-live-domain" />
            <p className="text-xs text-gray-500">Rankings are read from here. Fill it in when the website above is a staging site, so a staging page is never mistaken for a published one.</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Work the client does not do</Label>
            <Button type="button" size="sm" variant="outline" onClick={() => infer.mutate()} disabled={infer.isPending || !project.website} data-testid="button-kr-infer-exclusions">
              {infer.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Infer from the website
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Inferred from what the website never mentions, and applied to the keywords, competitor searches and plan. Remove one if the client does that work after all.
          </p>
          {exclusions.length ? (
            <ul className="space-y-1">
              {exclusions.map(item => (
                <li key={item.work} className="flex items-start gap-2 text-sm">
                  <Button type="button" size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setExclusions(previous => previous.filter(entry => entry.work !== item.work))} aria-label={`Remove ${item.work}`} data-testid={`button-kr-remove-exclusion-${item.work}`}>
                    <X className="h-3 w-3" />
                  </Button>
                  <span>
                    <span className="font-medium text-gray-900">{item.work}</span>{" "}
                    <Badge variant="outline" className="text-xs">{item.source === "website" ? "inferred" : "added"}</Badge>
                    <span className="block text-xs text-gray-500">{item.reason} · terms: {item.terms.join(", ")}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-500">None yet.</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={newWork} onChange={event => setNewWork(event.target.value)} placeholder="Work, e.g. garage doors" className="sm:max-w-xs" data-testid="input-kr-exclusion-work" />
            <Input value={newTerms} onChange={event => setNewTerms(event.target.value)} placeholder="Search terms, comma separated" data-testid="input-kr-exclusion-terms" />
            <Button type="button" variant="outline" onClick={addExclusion} disabled={!newWork.trim()}><Plus className="mr-2 h-4 w-4" />Add</Button>
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-kr-save-setup">
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
        </Button>
      </CardContent>
    </Card>
  );
}
