import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Download, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import { keywordDemand, keywordScore, type KeywordPageType, type KeywordResearchKeyword } from "@shared/keywordResearch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchAreaPicker, { areaLabel } from "./SearchAreaPicker";
import CompetitorsCard from "./CompetitorsCard";
import PlaybookCard from "./PlaybookCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProjectListItem {
  id: string;
  name: string;
  trade: string;
  city: string;
  state: string;
  status: string;
  keywordCount: number;
  createdAt: string;
}

const LIST_KEY = ["/api/keyword-research/projects"];
const UNSORTED = "__unsorted";
const ALL = "__all";
const TABLE_LIMIT = 300;
// The checklist's ceiling for a new site: keywords at 15+ need links and authority it does not have yet.
const EASY_DIFFICULTY = 15;
const PAGE_TYPE_LABELS: Record<KeywordPageType, string> = { service: "Service page", city: "City page", cost: "Cost page", blog: "Blog post" };
const INTENT_LABELS = { diy: "DIY", shopping: "Shopping" } as const;
// Matches the playbook's count: at least 25% more searches than the same months last year, on a keyword with real demand.
const RISING_TREND = 0.25;
const isRising = (row: KeywordResearchKeyword) => (row.trend ?? 0) >= RISING_TREND && (keywordDemand(row) ?? 0) >= 30;
const isUnclaimed = (row: KeywordResearchKeyword) => row.competitors != null && !row.competitors.length && row.pageType !== "blog" && (keywordDemand(row) ?? 0) > 0;
const GROUP_LABELS = { competitor: "Added from competitors", rising: "Rising searches", unclaimed: "No picked competitor ranks" } as const;
type KeywordGroup = keyof typeof GROUP_LABELS;
const inGroup: Record<KeywordGroup, (row: KeywordResearchKeyword) => boolean> = {
  competitor: row => row.source === "competitor",
  rising: isRising,
  unclaimed: isUnclaimed,
};

/** apiRequest errors look like `502: {"message":"..."}`; show just the message. */
function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Something went wrong";
  try {
    return (JSON.parse(raw) as { message?: string }).message ?? raw;
  } catch {
    return raw;
  }
}

function formatNumber(value: number | null) {
  return value == null ? "—" : value.toLocaleString();
}

function csvCell(value: string | number | null) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(project: KeywordResearchProject) {
  const header = ["Service", "Keyword", "Page type", "Intent", "Avg. monthly searches", "Near me searches", "CPC", "Difficulty", "Score (searches x CPC)", "Change vs last year", "Source", "Competitors ranking", "Competition", "Competition index", "Top of page bid (low)", "Top of page bid (high)", "Same search as"];
  const rows = project.keywords.map(row => [row.service ?? "Unsorted", row.keyword, row.pageType ? PAGE_TYPE_LABELS[row.pageType] : null, row.intent ?? null, row.searchVolume, row.nearMeVolume ?? null, row.cpc, row.difficulty ?? null, keywordScore(row), row.trend == null ? null : `${Math.round(row.trend * 100)}%`, row.source ?? "research", (row.competitors ?? []).map(entry => `${entry.domain} #${entry.position}`).join("; "), row.competition, row.competitionIndex, row.lowTopOfPageBid, row.highTopOfPageBid, (row.variants ?? []).join("; ")]);
  const csv = [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project.name} ${project.trade} ${project.city} keywords.csv`.replace(/[^\w .-]/g, "");
  link.click();
  URL.revokeObjectURL(url);
}

function IntakeView() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", trade: "", city: "", state: "", website: "", services: "", locationName: "" });
  const { data, isLoading } = useQuery<{ projects: ProjectListItem[] }>({ queryKey: LIST_KEY });

  const create = useMutation({
    mutationFn: async () => {
      const services = form.services.split(/[\n,]/).map(value => value.trim()).filter(Boolean);
      const response = await apiRequest("POST", "/api/keyword-research/projects", { ...form, services });
      return response.json() as Promise<KeywordResearchProject>;
    },
    onSuccess: project => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      navigate(`/admin/keyword-research/${project.id}`);
    },
    onError: error => toast({ title: "Could not start the project", description: errorMessage(error), variant: "destructive" }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: { target: { value: string } }) => setForm(previous => ({ ...previous, [key]: event.target.value })),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Keyword Research</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter the trade and city. Claude suggests the services, you tick the ones the client offers, and the keyword list comes from Google Ads data.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">New project</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="kr-name">Client or lead</Label><Input id="kr-name" required placeholder="Smith Plumbing" {...field("name")} data-testid="input-kr-name" /></div>
              <div className="space-y-1.5"><Label htmlFor="kr-trade">Trade</Label><Input id="kr-trade" required placeholder="plumbing" {...field("trade")} data-testid="input-kr-trade" /></div>
              <div className="space-y-1.5"><Label htmlFor="kr-city">City</Label><Input id="kr-city" required placeholder="Tampa" {...field("city")} data-testid="input-kr-city" /></div>
              <div className="space-y-1.5"><Label htmlFor="kr-state">State</Label><Input id="kr-state" required placeholder="FL" {...field("state")} data-testid="input-kr-state" /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Search area (optional)</Label>
              <SearchAreaPicker value={form.locationName} placeholder="The city's metro area" onSelect={locationName => setForm(previous => ({ ...previous, locationName }))} />
              <p className="text-xs text-gray-500">For a small town, pick the county or metro area the client serves so the volumes are meaningful.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kr-website">Client website (optional)</Label>
              <Input id="kr-website" placeholder="smithplumbing.com" {...field("website")} data-testid="input-kr-website" />
              <p className="text-xs text-gray-500">Services listed on the site are found and ticked for you.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kr-services">Services the client mentioned (optional)</Label>
              <Textarea id="kr-services" rows={3} placeholder="One per line or comma separated" {...field("services")} data-testid="input-kr-services" />
            </div>
            <Button type="submit" disabled={create.isPending} data-testid="button-kr-create">
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {create.isPending ? (form.website.trim() ? "Reading the website…" : "Suggesting services…") : "Suggest services"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent projects</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-gray-500">Loading…</p> : !data?.projects.length ? <p className="text-sm text-gray-500">No projects yet.</p> : (
            <ul className="divide-y">
              {data.projects.map(project => (
                <li key={project.id}>
                  <Link href={`/admin/keyword-research/${project.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{project.name}</p>
                      <p className="text-sm text-gray-500">{project.trade} · {project.city}, {project.state}</p>
                    </div>
                    <span className="shrink-0 text-sm text-gray-500">
                      {project.status === "researched" ? `${project.keywordCount.toLocaleString()} keywords` : "Choosing services"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectView({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const projectKey = [`/api/keyword-research/projects/${id}`];
  const { data: project, isLoading, error } = useQuery<KeywordResearchProject>({ queryKey: projectKey });
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [newService, setNewService] = useState("");
  const [filter, setFilter] = useState(ALL);
  const [pageTypeFilter, setPageTypeFilter] = useState(ALL);
  const [easyOnly, setEasyOnly] = useState(false);
  const [group, setGroup] = useState(ALL);

  const selected = selection ?? new Set(project?.services.filter(service => service.selected).map(service => service.name) ?? []);
  const services = useMemo(() => [...(project?.services ?? [])].sort((a, b) => (b.demand ?? -1) - (a.demand ?? -1)), [project]);
  const setProject = (updated: KeywordResearchProject) => {
    queryClient.setQueryData(projectKey, updated);
    void queryClient.invalidateQueries({ queryKey: LIST_KEY });
  };

  const addService = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${id}/services`, { name: newService })).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => {
      const added = updated.services[updated.services.length - 1];
      setSelection(new Set([...selected, added.name]));
      setNewService("");
      setProject(updated);
    },
    onError: addError => toast({ title: "Could not add the service", description: errorMessage(addError), variant: "destructive" }),
  });

  const changeArea = useMutation({
    mutationFn: async (locationName: string) => (await apiRequest("PATCH", `/api/keyword-research/projects/${id}/location`, { locationName })).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => setProject(updated),
    onError: areaError => toast({ title: "Could not change the search area", description: errorMessage(areaError), variant: "destructive" }),
  });

  const suggestMore = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${id}/suggestions`)).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => {
      const added = updated.services.length - (project?.services.length ?? 0);
      toast({ title: added > 0 ? `Added ${added} suggested services` : "No new services to suggest" });
      setProject(updated);
    },
    onError: suggestError => toast({ title: "Could not suggest more services", description: errorMessage(suggestError), variant: "destructive" }),
  });

  const research = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${id}/research`, { selected: [...selected] })).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => {
      setSelection(null);
      setFilter(ALL);
      setProject(updated);
    },
    onError: researchError => toast({ title: "Keyword research failed", description: errorMessage(researchError), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/keyword-research/projects/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
      navigate("/admin/keyword-research");
    },
    onError: removeError => toast({ title: "Could not delete the project", description: errorMessage(removeError), variant: "destructive" }),
  });

  const keywords = project?.keywords ?? [];
  const serviceTotals = useMemo(() => {
    const totals = new Map<string, { count: number; volume: number }>();
    for (const row of keywords) {
      const key = row.service ?? UNSORTED;
      const total = totals.get(key) ?? { count: 0, volume: 0 };
      total.count += 1;
      total.volume += keywordDemand(row) ?? 0;
      totals.set(key, total);
    }
    return [...totals].sort((a, b) => b[1].volume - a[1].volume);
  }, [keywords]);
  // Highest search value first; keywords without a CPC follow, by searches.
  const visible = keywords
    .filter(row => filter === ALL || (row.service ?? UNSORTED) === filter)
    .filter(row => pageTypeFilter === ALL || row.pageType === pageTypeFilter)
    .filter(row => !easyOnly || (row.difficulty != null && row.difficulty < EASY_DIFFICULTY))
    .filter(row => group === ALL || inGroup[group as KeywordGroup](row))
    .sort((a, b) => (keywordScore(b) ?? -1) - (keywordScore(a) ?? -1) || (keywordDemand(b) ?? 0) - (keywordDemand(a) ?? 0));

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  if (error || !project) return <p className="text-sm text-red-600">{error ? errorMessage(error) : "Project not found"}</p>;

  const toggle = (name: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(name); else next.delete(name);
    setSelection(next);
  };
  const changed = selection != null || project.status !== "researched";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" asChild>
            <Link href="/admin/keyword-research"><ArrowLeft className="mr-1 h-4 w-4" />All projects</Link>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-600">{project.trade} · {project.city}, {project.state}{project.website ? ` · ${project.website}` : ""} · data cost ${Number(project.dataCostUsd).toFixed(2)}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { if (window.confirm("Delete this keyword research project?")) remove.mutate(); }} disabled={remove.isPending} data-testid="button-kr-delete">
          <Trash2 className="mr-2 h-4 w-4" />Delete
        </Button>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">1. Confirm the services</CardTitle>
          <p className="text-sm text-gray-600">Tick only what the client actually does. Demand is monthly searches in {areaLabel(project.locationName)} for the service, "{"<service>"} {project.city.toLowerCase()}" and "{"<service>"} near me".</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Search area</span>
            <SearchAreaPicker value={project.locationName} placeholder="Choose an area" onSelect={locationName => { if (locationName !== project.locationName) changeArea.mutate(locationName); }} disabled={changeArea.isPending || research.isPending} />
            {changeArea.isPending && <span className="flex items-center text-sm text-gray-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating demand…</span>}
          </div>
          {project.websiteNote && <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700" data-testid="text-kr-website-note">{project.websiteNote}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelection(new Set(services.map(service => service.name)))}>Select all</Button>
            <Button variant="outline" size="sm" onClick={() => setSelection(new Set())}>Clear</Button>
            <Button variant="outline" size="sm" onClick={() => suggestMore.mutate()} disabled={suggestMore.isPending} data-testid="button-kr-suggest-more">
              {suggestMore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Suggest more services
            </Button>
          </div>
          <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {services.map(service => (
              <li key={service.name}>
                <label className="flex cursor-pointer items-center gap-3 rounded px-2 py-1.5 hover:bg-gray-50">
                  <Checkbox checked={selected.has(service.name)} onCheckedChange={checked => toggle(service.name, checked === true)} data-testid={`checkbox-kr-service-${service.name}`} />
                  <span className="flex-1 text-sm text-gray-900">{service.name}</span>
                  {service.pageUrl && (
                    <a href={service.pageUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} title={service.pageUrl}>
                      <Badge variant="outline" className="text-xs hover:bg-gray-100">on site</Badge>
                    </a>
                  )}
                  {service.source !== "suggested" && service.source !== "website" && <Badge variant="secondary" className="text-xs">{service.source}</Badge>}
                  <span className="w-16 text-right text-sm tabular-nums text-gray-600">{formatNumber(service.demand)}</span>
                </label>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (newService.trim()) addService.mutate(); }}>
            <Input value={newService} onChange={event => setNewService(event.target.value)} placeholder="Add a service" className="max-w-xs" data-testid="input-kr-add-service" />
            <Button type="submit" variant="outline" disabled={addService.isPending || !newService.trim()}>
              {addService.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button onClick={() => research.mutate()} disabled={research.isPending || selected.size === 0 || !changed} data-testid="button-kr-research">
              {research.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              {research.isPending ? "Pulling keywords…" : project.status === "researched" ? "Re-run keyword research" : "Run keyword research"}
            </Button>
            <span className="text-sm text-gray-500">{selected.size} selected{research.isPending ? " · this can take up to a minute" : ""}</span>
          </div>
        </CardContent>
      </Card>

      {project.status === "researched" && project.summary && (
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">2. Keywords</CardTitle>
              <Button size="sm" onClick={() => downloadCsv(project)} data-testid="button-kr-export"><Download className="mr-2 h-4 w-4" />Export CSV</Button>
            </div>
            <p className="text-sm text-gray-600">
              {project.summary.keptKeywords.toLocaleString()} keywords kept from {project.summary.ideasReturned.toLocaleString()} ideas
              · {project.summary.droppedAsJunk.toLocaleString()} dropped as unrelated or junk · {project.summary.droppedNoVolume.toLocaleString()} with no search volume.
              {project.summary.mergedVariants != null && <> {project.summary.mergedVariants.toLocaleString()} close variants merged · {project.summary.foldedNearMe!.toLocaleString()} "near me" searches folded into their plain phrase.</>}
              Unsorted keywords are related to the trade but did not match one service.
              {project.summary.difficultyAvailable === false && " Difficulty scores could not be pulled for this list."}
              {project.summary.difficultyAvailable && " Difficulty is DataForSEO's 0–100 US ranking score; score is searches × CPC."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-80" data-testid="select-kr-service-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All services ({keywords.length.toLocaleString()})</SelectItem>
                  {serviceTotals.map(([key, total]) => (
                    <SelectItem key={key} value={key}>{key === UNSORTED ? "Unsorted" : key} ({total.count.toLocaleString()} · {total.volume.toLocaleString()}/mo)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={pageTypeFilter} onValueChange={setPageTypeFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-kr-page-type-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All page types</SelectItem>
                  {(Object.keys(PAGE_TYPE_LABELS) as KeywordPageType[]).map(type => <SelectItem key={type} value={type}>{PAGE_TYPE_LABELS[type]}</SelectItem>)}
                </SelectContent>
              </Select>
              {project.competitors?.playbook && (
                <Select value={group} onValueChange={setGroup}>
                  <SelectTrigger className="w-full sm:w-56" data-testid="select-kr-group-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All keywords</SelectItem>
                    {(Object.keys(GROUP_LABELS) as KeywordGroup[]).map(key => (
                      <SelectItem key={key} value={key}>{GROUP_LABELS[key]} ({keywords.filter(inGroup[key]).length.toLocaleString()})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox checked={easyOnly} onCheckedChange={checked => setEasyOnly(checked === true)} data-testid="checkbox-kr-easy-only" />
                Difficulty under {EASY_DIFFICULTY}
              </label>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Page type</TableHead>
                    <TableHead className="text-right">Searches/mo</TableHead>
                    <TableHead className="text-right">CPC</TableHead>
                    <TableHead className="text-right">Difficulty</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.slice(0, TABLE_LIMIT).map(row => (
                    <TableRow key={row.keyword}>
                      <TableCell className="font-medium">
                        {row.keyword}
                        {!!row.variants?.length && <span className="block text-xs font-normal text-gray-500">Same search as: {row.variants.join(", ")}</span>}
                        {!!row.competitors?.length && <span className="block text-xs font-normal text-gray-500">{row.source === "competitor" ? "From" : "Ranked by"} {row.competitors.slice(0, 2).map(entry => `${entry.domain} #${entry.position}`).join(", ")}{row.competitors.length > 2 ? ` +${row.competitors.length - 2}` : ""}</span>}
                        {isRising(row) && <span className="block text-xs font-normal text-emerald-700">Rising: +{Math.round(row.trend! * 100)}% vs last year</span>}
                        {isUnclaimed(row) && <span className="block text-xs font-normal text-blue-700">No picked competitor ranks for this</span>}
                      </TableCell>
                      <TableCell className="text-gray-600">{row.service ?? "Unsorted"}</TableCell>
                      <TableCell className="text-gray-600">
                        {row.pageType ? PAGE_TYPE_LABELS[row.pageType] : "—"}
                        {row.intent && row.intent !== "service" && <span className="block text-xs text-gray-500">{INTENT_LABELS[row.intent]}</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {keywordDemand(row) == null ? "Unknown" : formatNumber(keywordDemand(row))}
                        {!!row.nearMeVolume && <span className="block text-xs text-gray-500">incl. {row.nearMeVolume.toLocaleString()} near me</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.cpc == null ? "—" : `$${row.cpc.toFixed(2)}`}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(row.difficulty ?? null)}</TableCell>
                      <TableCell className="text-right tabular-nums">{keywordScore(row) == null ? "—" : `$${keywordScore(row)!.toLocaleString()}`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {visible.length > TABLE_LIMIT && <p className="text-sm text-gray-500">Showing the top {TABLE_LIMIT} of {visible.length.toLocaleString()}. Export the CSV for the full list.</p>}
          </CardContent>
        </Card>
      )}

      {project.status === "researched" && project.summary && (
        <CompetitorsCard key={project.competitors?.ranAt ?? "none"} project={project} onUpdate={setProject} />
      )}

      {project.status === "researched" && !!project.competitors?.picks.length && (
        <PlaybookCard key={project.competitors.ranAt} project={project} onUpdate={setProject} />
      )}
    </div>
  );
}

export default function KeywordResearchPage({ projectId }: { projectId?: string }) {
  return projectId ? <ProjectView key={projectId} id={projectId} /> : <IntakeView />;
}
