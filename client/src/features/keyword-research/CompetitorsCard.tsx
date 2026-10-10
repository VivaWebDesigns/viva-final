import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import type { CompetitorSite, CompetitorSiteLabel } from "@shared/keywordResearch";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const LABELS: Record<CompetitorSiteLabel, string> = {
  contractor: "Contractor", franchise: "Franchise", manufacturer: "Manufacturer", retailer: "Retailer", directory: "Directory", other: "Other",
};

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Something went wrong";
  try {
    return (JSON.parse(raw) as { message?: string }).message ?? raw;
  } catch {
    return raw;
  }
}

function money(value: number | null) {
  return value == null ? "—" : `$${value.toLocaleString()}`;
}

function count(value: number | null) {
  return value == null ? "—" : value.toLocaleString();
}

function foundIn(site: CompetitorSite) {
  const places = [
    site.localAppearances > 0 && "this market",
    site.metros > 0 && `${site.metros} other metro${site.metros === 1 ? "" : "s"}`,
    (site.contentKeywords ?? 0) > 0 && "national blog and cost results",
  ].filter(Boolean);
  return places.join(", ") || "map pack";
}

function SiteTable({ sites, scope, picks, onToggle }: {
  sites: CompetitorSite[];
  scope: "local" | "national";
  picks: Set<string>;
  onToggle: (domain: string, checked: boolean) => void;
}) {
  if (!sites.length) return <p className="text-sm text-gray-500">No contractors found.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Pick</TableHead>
            <TableHead>Site</TableHead>
            {scope === "local" ? <TableHead className="text-right">Searches on page 1–2</TableHead> : <TableHead>Found in</TableHead>}
            {scope === "local" && <TableHead className="text-right">Best position</TableHead>}
            <TableHead className="text-right">Top-10 keywords</TableHead>
            <TableHead className="text-right">Traffic value/mo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sites.map(site => (
            <TableRow key={site.domain}>
              <TableCell>
                <Checkbox checked={picks.has(site.domain)} onCheckedChange={checked => onToggle(site.domain, checked === true)} data-testid={`checkbox-kr-pick-${site.domain}`} />
              </TableCell>
              <TableCell>
                <a href={`https://${site.domain}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">{site.domain}</a>
                {site.label && <Badge variant={site.label === "contractor" ? "secondary" : "outline"} className="ml-2 text-xs">{LABELS[site.label]}</Badge>}
                {site.labelReason && <span className="block text-xs text-gray-500">{site.labelReason}</span>}
              </TableCell>
              {scope === "local"
                ? <TableCell className="text-right tabular-nums">{site.localAppearances}</TableCell>
                : <TableCell className="text-gray-600">{foundIn(site)}</TableCell>}
              {scope === "local" && <TableCell className="text-right tabular-nums">{site.bestPosition ?? "—"}</TableCell>}
              <TableCell className="text-right tabular-nums">{count(site.top10Keywords)}</TableCell>
              <TableCell className="text-right tabular-nums">{money(site.trafficValue)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Finds the strongest local and national competitors and lets the user confirm the 4 picked for the deep keyword pull. */
export default function CompetitorsCard({ project, onUpdate }: { project: KeywordResearchProject; onUpdate: (project: KeywordResearchProject) => void }) {
  const { toast } = useToast();
  const scan = project.competitors;
  const [cities, setCities] = useState(scan?.searchCities.map(name => name.replace(/,([^,]+)$/, "")).join("\n") ?? "");
  const [picks, setPicks] = useState(new Set(scan?.picks ?? []));

  const discover = useMutation({
    mutationFn: async () => {
      const list = cities.split("\n").map(line => line.trim()).filter(Boolean);
      return (await apiRequest("POST", `/api/keyword-research/projects/${project.id}/competitors`, list.length ? { cities: list } : {})).json() as Promise<KeywordResearchProject>;
    },
    onSuccess: updated => {
      setPicks(new Set(updated.competitors?.picks ?? []));
      onUpdate(updated);
    },
    onError: discoverError => toast({ title: "Could not find competitors", description: errorMessage(discoverError), variant: "destructive" }),
  });

  const confirm = useMutation({
    mutationFn: async () => (await apiRequest("PATCH", `/api/keyword-research/projects/${project.id}/competitors/picks`, { picks: [...picks] })).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => {
      toast({ title: "Picks confirmed" });
      onUpdate(updated);
    },
    onError: confirmError => toast({ title: "Could not save the picks", description: errorMessage(confirmError), variant: "destructive" }),
  });

  const toggle = (domain: string, checked: boolean) => {
    const next = new Set(picks);
    if (checked) next.add(domain); else next.delete(domain);
    setPicks(next);
  };
  // Additions plus removals: how far the confirmed picks are from what discovery chose on its own.
  const changed = scan
    ? scan.picks.filter(domain => !scan.autoPicks.includes(domain)).length + scan.autoPicks.filter(domain => !scan.picks.includes(domain)).length
    : 0;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">3. Competitors</CardTitle>
        <p className="text-sm text-gray-600">
          Searches the top money keywords from the client's city and the 2 largest cities in its metro area, plus the top services in 12 large metros and the top blog topics nationally.
          Claude labels each site, and only contractors are picked as models. Takes about 2 minutes and about $0.60–$0.80 in search data.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="kr-search-cities">Search from (optional, one "City, ST" per line, up to 3)</Label>
          <Textarea id="kr-search-cities" rows={3} value={cities} onChange={event => setCities(event.target.value)}
            placeholder={`Leave blank for ${project.city} plus the 2 largest cities in its metro area`} data-testid="input-kr-search-cities" />
          <Button onClick={() => discover.mutate()} disabled={discover.isPending} data-testid="button-kr-find-competitors">
            {discover.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
            {discover.isPending ? "Searching… this takes about 2 minutes" : scan ? "Search again" : "Find competitors"}
          </Button>
        </div>

        {scan && (
          <>
            <p className="text-sm text-gray-600">
              Searched {scan.localKeywords.length} keywords from {scan.searchCities.join("; ")} on {new Date(scan.ranAt).toLocaleDateString()} · data cost ${scan.costUsd.toFixed(2)}.
              {" "}The client's site is on page 1 for {scan.clientAppearances} of {scan.localKeywords.length * scan.searchCities.length} of these searches.
            </p>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Local leaders</h3>
              <SiteTable sites={scan.local} scope="local" picks={picks} onToggle={toggle} />
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Strongest contractors anywhere</h3>
              <p className="text-xs text-gray-500">Found in this market, 12 other large metros or national blog and cost results, ranked by organic traffic value; independents before franchises.</p>
              <SiteTable sites={scan.national} scope="national" picks={picks} onToggle={toggle} />
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Map pack leaders</h3>
              <p className="text-xs text-gray-500">Won through Google Business Profile (reviews, categories, distance), not pages.</p>
              {scan.mapPack.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead className="text-right">Map packs shown in</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                        <TableHead className="text-right">Reviews</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scan.mapPack.map(business => (
                        <TableRow key={business.title}>
                          <TableCell className="font-medium">{business.title}{business.domain && <span className="block text-xs font-normal text-gray-500">{business.domain}</span>}</TableCell>
                          <TableCell className="text-right tabular-nums">{business.appearances}</TableCell>
                          <TableCell className="text-right tabular-nums">{business.rating ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{count(business.reviews)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-gray-500">No map packs in these searches.</p>}
            </section>

            {scan.excluded.length > 0 && (
              <p className="text-xs text-gray-500">
                Left out: {scan.excluded.map(site => `${site.domain} (${site.label ? LABELS[site.label].toLowerCase() : "unknown"})`).join(", ")}.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button onClick={() => confirm.mutate()} disabled={confirm.isPending || picks.size === 0} data-testid="button-kr-confirm-picks">
                {confirm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm {picks.size} pick{picks.size === 1 ? "" : "s"}
              </Button>
              <span className="text-sm text-gray-600">
                {scan.confirmedAt
                  ? `Confirmed ${new Date(scan.confirmedAt).toLocaleDateString()} · ${changed === 0 ? "kept the automatic picks" : `${changed} change${changed === 1 ? "" : "s"} from the automatic picks`}.`
                  : `${scan.autoPicks.length} picked automatically; untick or tick to change.`}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
