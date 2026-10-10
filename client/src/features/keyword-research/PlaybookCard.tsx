import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles } from "lucide-react";
import type { KeywordResearchProject } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const UNSORTED = "__unsorted";

function errorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "Something went wrong";
  try {
    return (JSON.parse(raw) as { message?: string }).message ?? raw;
  } catch {
    return raw;
  }
}

/** Builds the plan from the picked competitors' rankings and lists keywords that need a human decision. */
export default function PlaybookCard({ project, onUpdate }: { project: KeywordResearchProject; onUpdate: (project: KeywordResearchProject) => void }) {
  const { toast } = useToast();
  const scan = project.competitors!;
  const playbook = scan.playbook;
  const services = project.services.filter(service => service.selected).map(service => service.name);
  const [choices, setChoices] = useState<Record<string, string>>({});

  const build = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/keyword-research/projects/${project.id}/playbook`)).json() as Promise<KeywordResearchProject>,
    onSuccess: updated => {
      const result = updated.competitors?.playbook;
      if (result) toast({ title: `Added ${result.added.toLocaleString()} keywords from competitors` });
      onUpdate(updated);
    },
    onError: buildError => toast({ title: "Could not build the playbook", description: errorMessage(buildError), variant: "destructive" }),
  });

  const addReviewed = useMutation({
    mutationFn: async (keyword: string) => {
      const choice = choices[keyword] ?? UNSORTED;
      return (await apiRequest("POST", `/api/keyword-research/projects/${project.id}/playbook/review`, { keyword, service: choice === UNSORTED ? null : choice })).json() as Promise<KeywordResearchProject>;
    },
    onSuccess: updated => onUpdate(updated),
    onError: addError => toast({ title: "Could not add the keyword", description: errorMessage(addError), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">4. Playbook</CardTitle>
        <p className="text-sm text-gray-600">
          Pulls everything {scan.picks.join(", ")} rank for, strips their cities, and adds what matches the client's services and is searched in {project.locationName.replace(/,United States$/, "")}.
          Also marks rising searches and money keywords no picked competitor ranks for. Takes about 2 minutes and about $1 in search data.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Button onClick={() => build.mutate()} disabled={build.isPending} data-testid="button-kr-build-playbook">
          {build.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          {build.isPending ? "Building… this takes about 2 minutes" : playbook ? "Rebuild playbook" : "Build playbook"}
        </Button>

        {playbook && (
          <>
            <p className="text-sm text-gray-600">
              Built {new Date(playbook.ranAt).toLocaleDateString()} · {playbook.added.toLocaleString()} keywords added from competitors
              · {playbook.rising.toLocaleString()} rising searches · {playbook.unclaimed.toLocaleString()} money keywords no picked competitor ranks for
              · data cost ${playbook.costUsd.toFixed(2)}. Filter the keyword list above to see each group.
            </p>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">How the picked competitors win</h3>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Competitor</TableHead>
                      <TableHead className="text-right">Keywords (top 30)</TableHead>
                      <TableHead className="text-right">Top 10</TableHead>
                      <TableHead className="text-right">Ranking pages</TableHead>
                      <TableHead className="text-right">Value on blog</TableHead>
                      <TableHead>Biggest sections</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {playbook.domains.map(profile => (
                      <TableRow key={profile.domain}>
                        <TableCell className="font-medium">{profile.domain}</TableCell>
                        <TableCell className="text-right tabular-nums">{profile.keywords.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{profile.top10Keywords.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{profile.pages.toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{Math.round(profile.blogValueShare * 100)}%</TableCell>
                        <TableCell className="text-gray-600">{profile.topFolders.map(folder => `${folder.folder} (${folder.keywords})`).join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900">Needs a decision ({playbook.review.length})</h3>
              <p className="text-xs text-gray-500">Searched locally, but matched none of the client's services. Add one only if the client does this work.</p>
              {playbook.review.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Keyword</TableHead>
                        <TableHead className="text-right">Searches/mo</TableHead>
                        <TableHead className="text-right">CPC</TableHead>
                        <TableHead>Ranked by</TableHead>
                        <TableHead>Add under</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {playbook.review.map(row => (
                        <TableRow key={row.keyword}>
                          <TableCell className="font-medium">{row.keyword}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.searchVolume?.toLocaleString() ?? "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.cpc == null ? "—" : `$${row.cpc.toFixed(2)}`}</TableCell>
                          <TableCell className="text-gray-600">{row.competitors.map(entry => `${entry.domain} #${entry.position}`).join(", ")}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select value={choices[row.keyword] ?? UNSORTED} onValueChange={choice => setChoices(previous => ({ ...previous, [row.keyword]: choice }))}>
                                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={UNSORTED}>Unsorted</SelectItem>
                                  {services.map(service => <SelectItem key={service} value={service}>{service}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button size="sm" variant="outline" onClick={() => addReviewed.mutate(row.keyword)} disabled={addReviewed.isPending} data-testid={`button-kr-add-review-${row.keyword}`}>
                                <Plus className="mr-1 h-3 w-3" />Add
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <p className="text-sm text-gray-500">Nothing to review.</p>}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
