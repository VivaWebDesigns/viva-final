import type { GroupSuggestion, InventoryPage, PageAction, PageKind, PagePlan } from "./keywordResearch";

/** The user's decision on a suggested combination, keyed by its services joined with "|" in sorted order. */
export type GroupDecision = "combine" | "separate";

/**
 * Where a page stands on evidence, apart from its business value: an existing page; a new page whose page-1 check
 * supports it; one not checked yet; one whose check failed; or one checked where page 1 points away from a page of its
 * own. Being unchecked says nothing about a page's value, only that it needs a check before it is built.
 */
export type EvidenceStatus = "existing" | "supported" | "not_checked" | "check_failed" | "mixed";

export interface BlueprintEntry {
  /** The plan pages this entry builds or keeps (two or more when a combination was approved). */
  pageIds: string[];
  title: string;
  kind: PageKind;
  services: string[];
  city: string | null;
  /** The live or staging address, or a proposed one following the site's own URL pattern. */
  url: string;
  urlStatus: "existing" | "staging" | "proposed";
  action: PageAction;
  phase: 1 | 2 | 3 | 4;
  phaseReason: string;
  evidenceStatus: EvidenceStatus;
  /** A suggested combination this page is part of, and where the decision stands. */
  grouping: { key: string; with: string[]; strength: GroupSuggestion["strength"]; decision: GroupDecision | "pending" } | null;
  keywords: number;
  /** Searches × average CPC, low and high (possible overlaps counted separately); null when not reported. */
  value: number | null;
  valueHigh: number | null;
  /** The service's metro reference average CPC, labelled as a reference, never as this page's own. */
  referenceCpc: number | null;
  /** For a blog topic: why it needs a person's review before anyone writes it. Empty when nothing stands out. */
  review: string[];
}

const QUESTION_START = /^(how|what|why|when|where|which|who|can|does|do|is|are|should|will)\b/;
const TASK_WORDS = /\b(fix|fixing|repair|install|installing|replace|replacing|clean|cleaning|remove|removing|adjust|adjusting|stop|prevent|choose|cost|costs|price|worth|vs|versus|or|best|ideas|guide|tips|problems?|leak\w*|broken|foggy|cracked|stuck)\b/;

/**
 * Why a blog topic needs review before anyone writes it: a product size or spec search, or a bare product or term
 * with no question, problem or task for an article to answer. Flags ask for a person's judgment; they remove nothing.
 */
export function blogTopicReview(topic: string) {
  const text = topic.toLowerCase().trim();
  const words = text.split(/\s+/);
  const reasons: string[] = [];
  if (/^\d/.test(text) || /\b\d+\s*(x|by|inch|in|mm|ft|")\s*\d*/.test(text) || words.filter(word => /^\d+$/.test(word)).length >= 2) {
    reasons.push("reads as a product size or spec search, not a question an article answers");
  }
  if (!QUESTION_START.test(text) && !TASK_WORDS.test(text) && words.length <= 4) {
    reasons.push("a product or term with no question, problem or task: may be a shopping search");
  }
  return reasons;
}

export interface Blueprint {
  generatedAt: string;
  phases: Array<{ phase: 1 | 2 | 3 | 4; title: string; rule: string; count: number }>;
  entries: BlueprintEntry[];
  /** The site's own URL conventions the proposed addresses follow. */
  urlPattern: { services: string; blog: string };
}

export const PHASES: Blueprint["phases"] = [
  { phase: 1, title: "Fix and keep what exists", rule: "Pages already on the site: keep the ones that work, improve the rest, publish what is on staging.", count: 0 },
  { phase: 2, title: "Core services and the highest-value city pages", rule: "New service pages, and city pages for the client's priority services or for services whose metro average CPC is in the upper half of the client's services.", count: 0 },
  { phase: 3, title: "Remaining city pages and cost pages", rule: "Other service × city pages, services with no Google Ads figures (placed by the client's judgment, not ranked lower), and cost and quote pages.", count: 0 },
  { phase: 4, title: "Blog library", rule: "Supporting articles, grouped by service.", count: 0 },
];

export const slugify = (text: string) => text.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const groupKey = (services: string[]) => [...services].sort().join("|");

/** The first folder most pages of one kind live under ("services", "blog"), or the fallback. */
function folderOf(paths: string[], fallback: string) {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const first = path.split("/").filter(Boolean)[0];
    if (first && path.split("/").filter(Boolean).length >= 2) counts.set(first, (counts.get(first) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
}

function evidenceStatusOf(page: PagePlan): EvidenceStatus {
  if (page.page.path) return "existing";
  if (page.checkStatus === "failed") return "check_failed";
  if (!page.evidence) return "not_checked";
  return page.action === "recommend" ? "supported" : "mixed";
}

/**
 * The site blueprint from a plan: every page with an address, a build phase and its evidence status, and each
 * suggested combination applied only when the user approved it. Phases order the build by kind and business value
 * (priority services, then the metro average CPC of each service); evidence status is reported separately.
 */
export function buildBlueprint(pages: PagePlan[], inventory: InventoryPage[], suggestions: GroupSuggestion[], decisions: Record<string, GroupDecision>, generatedAt: string): Blueprint {
  const services = folderOf(inventory.filter(page => page.kind === "service").map(page => page.path), "services");
  const blog = folderOf(inventory.filter(page => page.kind === "article").map(page => page.path), "blog");
  // A service's own address: the existing page whose main heading names it most fully (one service per page; the
  // homepage and city pages are never a service's base), else a new one under the site's services folder.
  const words = (text: string) => new Set(text.toLowerCase().replace(/&/g, " ").split(/[^a-z0-9]+/).filter(Boolean).map(word => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word)));
  const serviceUrl = new Map<string, string>();
  const allServices = [...new Set(pages.map(page => page.service).filter((name): name is string => !!name))];
  for (const item of inventory) {
    if (item.path === "/" || item.kind === "city" || item.kind === "article" || !item.services.length) continue;
    const heading = words(`${item.h1} ${item.title}`);
    const h1 = words(item.h1);
    const scored = item.services.filter(service => allServices.includes(service)).map(service => {
      const parts = [...words(service)];
      return { service, size: parts.length, inH1: parts.filter(part => h1.has(part)).length / parts.length, inHeading: parts.filter(part => heading.has(part)).length / parts.length };
      // On a tie, the most specific service: "Commercial Window Replacement" is commercial window replacement's page.
    }).sort((a, b) => b.inH1 - a.inH1 || b.inHeading - a.inHeading || b.size - a.size);
    const own = scored[0];
    if (own && own.inHeading === 1 && !serviceUrl.has(own.service)) serviceUrl.set(own.service, item.path);
  }
  const baseOf = (service: string) => serviceUrl.get(service) ?? `/${services}/${slugify(service)}`;

  // Value ranks services for the build order: priority first, then the metro reference average CPC.
  const cpcOf = new Map<string, number>();
  for (const page of pages) {
    const cpc = page.reference?.avgCpc ?? page.reference?.cpc ?? null;
    if (page.service && cpc != null && !cpcOf.has(page.service)) cpcOf.set(page.service, cpc);
  }
  const known = [...cpcOf.values()].sort((a, b) => a - b);
  const median = known.length ? known[Math.floor((known.length - 1) / 2)] : null;

  const byId = new Map(pages.map(page => [page.id, page]));
  const suggestionOf = new Map<string, { key: string; suggestion: GroupSuggestion; ids: string[] }>();
  for (const suggestion of suggestions) {
    const key = groupKey(suggestion.services);
    for (const place of suggestion.pages) for (const id of place.pageIds) suggestionOf.set(id, { key, suggestion, ids: place.pageIds });
  }

  const used = new Set<string>();
  const taken = new Set<string>(inventory.map(page => page.path));
  const unique = (url: string) => {
    let candidate = url;
    // Never propose an address the site already uses or another proposal took.
    for (let index = 2; taken.has(candidate); index += 1) candidate = `${url}-${index}`;
    taken.add(candidate);
    return candidate;
  };

  const entries: BlueprintEntry[] = [];
  for (const page of pages) {
    if (used.has(page.id)) continue;
    const grouped = suggestionOf.get(page.id);
    const decision = grouped ? decisions[grouped.key] ?? "pending" : null;
    const members = grouped && decision === "combine" ? grouped.ids.map(id => byId.get(id)).filter((item): item is PagePlan => !!item) : [page];
    for (const member of members) used.add(member.id);
    const lead = members.find(member => member.page.path) ?? members[0];
    const names = [...new Set(members.map(member => member.service).filter((name): name is string => !!name))];

    let url: string;
    let urlStatus: BlueprintEntry["urlStatus"] = "proposed";
    if (lead.page.path) {
      url = lead.page.path;
      urlStatus = lead.page.status === "staging" ? "staging" : "existing";
    } else {
      const service = names.find(name => serviceUrl.has(name)) ?? lead.service ?? "";
      const base = baseOf(service);
      url = unique(lead.kind === "city" && lead.city ? `${base}/${slugify(lead.city)}`
        : lead.kind === "cost" ? `${base}/cost`
          : lead.kind === "blog" ? `/${blog}/${slugify(lead.mainKeyword)}`
            : base);
    }

    const cpc = names.map(name => cpcOf.get(name)).filter((value): value is number => value != null).sort((a, b) => b - a)[0] ?? null;
    const priority = members.some(member => member.priorityService);
    let phase: BlueprintEntry["phase"];
    let phaseReason: string;
    if (lead.page.path) [phase, phaseReason] = [1, "already on the site"];
    else if (lead.kind === "blog") [phase, phaseReason] = [4, "supporting article"];
    else if (lead.kind === "cost") [phase, phaseReason] = [3, "cost and quote page"];
    else if (lead.kind === "service") [phase, phaseReason] = [2, "a confirmed service with no page of its own"];
    else if (priority) [phase, phaseReason] = [2, "a priority service"];
    else if (cpc != null && median != null && cpc >= median) [phase, phaseReason] = [2, `metro average CPC $${cpc.toFixed(2)}, in the upper half of the client's services (reference, not this page's own)`];
    else if (cpc == null) [phase, phaseReason] = [3, "no Google Ads figures for this service: placed by the client's judgment, not ranked lower"];
    else [phase, phaseReason] = [3, `metro average CPC $${cpc.toFixed(2)}, in the lower half of the client's services (reference, not this page's own)`];

    const statuses = members.map(evidenceStatusOf);
    const evidenceStatus: EvidenceStatus = statuses.includes("existing") ? "existing" : statuses.includes("supported") ? "supported"
      : statuses.includes("mixed") ? "mixed" : statuses.includes("check_failed") ? "check_failed" : "not_checked";
    const measured = members.filter(member => member.value > 0 || !member.unknownValue);
    entries.push({
      pageIds: members.map(member => member.id),
      title: members.length > 1 && lead.city ? `${names.join(" & ")} in ${lead.city}` : lead.title,
      kind: lead.kind, services: names, city: lead.city, url, urlStatus,
      action: members.some(member => member.action === "keep") ? "keep" : lead.action,
      phase, phaseReason, evidenceStatus,
      grouping: grouped ? { key: grouped.key, with: grouped.suggestion.services, strength: grouped.suggestion.strength, decision: decision! } : null,
      keywords: members.reduce((sum, member) => sum + member.keywords.length, 0),
      value: measured.length ? measured.reduce((sum, member) => sum + member.value, 0) : null,
      valueHigh: measured.length ? measured.reduce((sum, member) => sum + (member.valueHigh ?? member.value), 0) : null,
      referenceCpc: cpc,
      review: lead.kind === "blog" ? blogTopicReview(lead.mainKeyword) : [],
    });
  }
  entries.sort((a, b) => a.phase - b.phase || (b.referenceCpc ?? -1) - (a.referenceCpc ?? -1) || (a.city ?? "").localeCompare(b.city ?? "") || a.title.localeCompare(b.title));
  return {
    generatedAt,
    phases: PHASES.map(item => ({ ...item, count: entries.filter(entry => entry.phase === item.phase).length })),
    entries,
    urlPattern: { services: `/${services}/{service}/{city}`, blog: `/${blog}/{topic}` },
  };
}
