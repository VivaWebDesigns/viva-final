import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { KeywordResearchService } from "@shared/keywordResearch";
import { requireRole } from "../auth/middleware";
import { fetchKeywordDifficulty, fetchKeywordIdeas, fetchSearchIntent, fetchSearchVolume, KeywordDataError, searchAreas, type KeywordMetrics } from "./dataforseo";
import { applySearchIntent, buildKeywordList, classifyKeyword, cleanKeyword, matchSearchAreas, pickSearchArea, serviceDemand, serviceVariants } from "./keywords";
import { createProject, deleteProject, getProject, listProjects, updateProject } from "./repository";
import { discoverCompetitors } from "./discover";
import { buildPlaybook } from "./runPlaybook";
import { runPlan } from "./runPlan";
import { startRun, runBusy } from "./backgroundRun";
import { readWebsite, WebsiteReadError, type WebsitePage } from "./readWebsite";
import { chooseMetro, inferExclusions, ServiceSuggestionError, servicesFromWebsite, suggestServices } from "./suggestServices";
import { assertSafePublicUrl, UnsafeUrlError } from "../technical-seo/url-safety";

const router = Router();
router.use(requireRole("admin", "developer"));

const serviceName = z.string().trim().min(1).max(80);

async function volumesFor(services: string[], city: string, locationName: string) {
  const keywords = [...new Set(services.flatMap(service => serviceVariants(service, city)))];
  const { metrics, cost } = await fetchSearchVolume(keywords, locationName);
  return { volumes: new Map(metrics.map(row => [cleanKeyword(row.keyword), row] as [string, KeywordMetrics])), cost };
}

function sendError(res: import("express").Response, error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid input" });
  if (error instanceof ServiceSuggestionError || error instanceof KeywordDataError) return res.status(502).json({ message: error.message });
  return res.status(500).json({ message: error instanceof Error ? error.message : fallback });
}

/** Google's spelling of a location, matched without regard to capitals ("charlotte" → "Charlotte"). */
async function resolveSearchArea(locationName: string) {
  const wanted = locationName.trim().toLowerCase();
  const match = (await searchAreas()).find(area => area.name.toLowerCase() === wanted);
  if (!match) throw new KeywordDataError(`Google Ads has no location called "${locationName.replace(/,United States$/, "")}". Check the city and state spelling, or pick the area from the Search area list.`);
  return match.name;
}

/** The city's metro area, falling back to the state when Claude cannot place it. */
async function defaultSearchArea(city: string, state: string) {
  const areas = await searchAreas();
  const metros = areas.filter(area => area.type === "DMA Region").map(area => area.name);
  const metro = await chooseMetro(city, state, metros).catch(() => null);
  return pickSearchArea(areas, { city, state }, metro);
}

router.get("/locations", async (req, res) => {
  try {
    res.json({ areas: matchSearchAreas(await searchAreas(), String(req.query.q ?? "")) });
  } catch (error) {
    sendError(res, error, "Unable to load locations");
  }
});

router.get("/projects", async (_req, res) => {
  res.json({ projects: await listProjects(50) });
});

router.get("/projects/:id", async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });
  res.json(project);
});

/** Services the client's own website says it offers. A site that cannot be read never blocks the project. */
async function websiteServices(website: string, trade: string) {
  if (!website) return { services: [] as Array<{ name: string; url: string | null }>, note: null, pages: [] as WebsitePage[] };
  try {
    await assertSafePublicUrl(website);
    const site = await readWebsite(website);
    const found = (await servicesFromWebsite(trade, site.pages))
      .map(service => ({ ...service, name: cleanKeyword(service.name) }))
      .filter(service => service.name);
    const pages = `${site.pages.length} page${site.pages.length === 1 ? "" : "s"}`;
    return { services: found, pages: site.pages, note: found.length ? `Read ${pages} of the website and found ${found.length} services.` : `Read ${pages} of the website but found no services listed.` };
  } catch (error) {
    if (error instanceof ServiceSuggestionError) throw error;
    const reason = error instanceof UnsafeUrlError || error instanceof WebsiteReadError ? error.message : "The website could not be read.";
    return { services: [], pages: [] as WebsitePage[], note: `${reason} Services below are Claude's suggestions for the trade.` };
  }
}

// Intake: services come from the client, their website and Claude, then each gets its search demand for the checklist.
router.post("/projects", async (req, res) => {
  try {
    const input = z.object({
      name: z.string().trim().min(1).max(160),
      trade: z.string().trim().min(1).max(80),
      city: z.string().trim().min(1).max(100),
      state: z.string().trim().min(2).max(100),
      website: z.string().trim().max(2048).optional().default(""),
      liveDomain: z.string().trim().max(253).optional().default(""),
      serviceCities: z.array(z.string().trim().min(1).max(100)).max(60).optional().default([]),
      services: z.array(serviceName).max(40).optional().default([]),
      locationName: z.string().trim().max(200).optional().default(""),
    }).parse(req.body);
    const locationName = await resolveSearchArea(input.locationName || await defaultSearchArea(input.city, input.state));
    const clientServices = [...new Set(input.services.map(cleanKeyword).filter(Boolean))];
    const fromWebsite = await websiteServices(input.website, input.trade);
    const pageUrls = new Map(fromWebsite.services.map(service => [service.name, service.url]));
    const known = [...new Set([...clientServices, ...pageUrls.keys()])];
    const suggested = (await suggestServices({ ...input, knownServices: known })).map(cleanKeyword).filter(Boolean);
    const names = [...new Set([...known, ...suggested])];
    const { volumes, cost } = await volumesFor(names, input.city, locationName);
    const services: KeywordResearchService[] = names.map(name => ({
      name,
      source: clientServices.includes(name) ? "client" : pageUrls.has(name) ? "website" : "suggested",
      pageUrl: pageUrls.get(name) ?? null,
      demand: serviceDemand(name, input.city, volumes),
      selected: known.includes(name),
    }));
    const project = await createProject({
      name: input.name,
      trade: input.trade,
      city: input.city,
      state: input.state,
      locationName,
      website: input.website || null,
      liveDomain: input.liveDomain || null,
      serviceCities: [...new Set([`${input.city}, ${input.state}`, ...input.serviceCities])],
      // Work the site never mentions is excluded by default; it can be removed on the project.
      exclusions: fromWebsite.pages.length ? await inferExclusions(input.trade, known, fromWebsite.pages).catch(() => []) : [],
      websiteNote: fromWebsite.note,
      services,
      createdBy: req.authUser!.id,
    }, cost);
    return res.status(201).json(project);
  } catch (error) {
    return sendError(res, error, "Unable to create the project");
  }
});

// A wider search area re-pulls service demand; any earlier keyword list was for the old area, so it is cleared.
router.patch("/projects/:id/location", async (req, res) => {
  try {
    const input = z.object({ locationName: z.string().trim().min(1).max(200) }).parse(req.body);
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const locationName = await resolveSearchArea(input.locationName);
    const { volumes, cost } = await volumesFor(project.services.map(service => service.name), project.city, locationName);
    const services = project.services.map(service => ({ ...service, demand: serviceDemand(service.name, project.city, volumes) }));
    return res.json(await updateProject(project.id, { locationName, services, keywords: [], summary: null, competitors: null, status: "choosing_services", researchedAt: null }, cost));
  } catch (error) {
    return sendError(res, error, "Unable to change the search area");
  }
});

// Adds Claude's services for the trade that are not on the list yet, unticked.
router.post("/projects/:id/suggestions", async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const known = project.services.map(service => service.name);
    const added = [...new Set((await suggestServices({ trade: project.trade, city: project.city, state: project.state, knownServices: known })).map(cleanKeyword))]
      .filter(name => name && !known.includes(name));
    if (!added.length) return res.json(project);
    const { volumes, cost } = await volumesFor(added, project.city, project.locationName);
    const services = [...project.services, ...added.map(name => ({ name, source: "suggested" as const, pageUrl: null, demand: serviceDemand(name, project.city, volumes), selected: false }))];
    return res.json(await updateProject(project.id, { services }, cost));
  } catch (error) {
    return sendError(res, error, "Unable to suggest more services");
  }
});

router.post("/projects/:id/services", async (req, res) => {
  try {
    const { name } = z.object({ name: serviceName }).parse(req.body);
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const cleaned = cleanKeyword(name);
    if (!cleaned) return res.status(400).json({ message: "Enter a service name" });
    if (project.services.some(service => service.name === cleaned)) return res.status(409).json({ message: "That service is already on the list" });
    const { volumes, cost } = await volumesFor([cleaned], project.city, project.locationName);
    const services = [...project.services, { name: cleaned, source: "added" as const, demand: serviceDemand(cleaned, project.city, volumes), selected: true }];
    return res.json(await updateProject(project.id, { services }, cost));
  } catch (error) {
    return sendError(res, error, "Unable to add the service");
  }
});

// The client's answers that steer the plan: up to 3 priority services, the cities they serve, and the live domain when the site assessed is staging.
router.patch("/projects/:id/setup", async (req, res) => {
  try {
    const input = z.object({
      priorities: z.array(serviceName).max(3).optional(),
      serviceCities: z.array(z.string().trim().min(1).max(100)).max(60).optional(),
      liveDomain: z.string().trim().max(253).optional(),
      exclusions: z.array(z.object({
        work: z.string().trim().min(1).max(80),
        terms: z.array(z.string().trim().min(1).max(60)).max(12),
        reason: z.string().trim().max(200),
        source: z.enum(["website", "user"]),
      })).max(30).optional(),
      cityPhrases: z.record(z.string(), z.array(z.string().trim().min(1).max(80)).max(2)).optional(),
    }).parse(req.body);
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const changes: Parameters<typeof updateProject>[1] = {};
    if (input.priorities) {
      const chosen = new Set(input.priorities.map(cleanKeyword));
      changes.services = project.services.map(service => ({ ...service, priority: chosen.has(service.name) }));
    }
    if (input.cityPhrases) {
      const phrases = input.cityPhrases;
      changes.services = (changes.services ?? project.services).map(service => service.name in phrases
        ? { ...service, cityPhrases: [...new Set(phrases[service.name].map(cleanKeyword).filter(Boolean))] }
        : service);
    }
    if (input.serviceCities) changes.serviceCities = [...new Set([`${project.city}, ${project.state}`, ...input.serviceCities])];
    if (input.liveDomain !== undefined) changes.liveDomain = input.liveDomain || null;
    if (input.exclusions) changes.exclusions = input.exclusions.map(item => ({ ...item, work: item.work.toLowerCase(), terms: item.terms.map(term => term.toLowerCase()) }));
    return res.json(await updateProject(project.id, changes));
  } catch (error) {
    return sendError(res, error, "Unable to save the setup");
  }
});

// Re-reads the website and proposes exclusions: work the site never mentions that searchers confuse with the trade.
router.post("/projects/:id/exclusions/infer", async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.website) return res.status(400).json({ message: "Add the client's website first; exclusions are inferred from it." });
    const site = await readWebsite(project.website);
    const services = project.services.filter(service => service.selected).map(service => service.name);
    const inferred = await inferExclusions(project.trade, services, site.pages);
    const kept = project.exclusions.filter(item => item.source === "user");
    const known = new Set(kept.map(item => item.work));
    return res.json(await updateProject(project.id, { exclusions: [...kept, ...inferred.filter(item => !known.has(item.work))] }));
  } catch (error) {
    if (error instanceof WebsiteReadError) return res.status(502).json({ message: error.message });
    return sendError(res, error, "Unable to infer exclusions");
  }
});

// Saves the confirmed services, expands them into keyword ideas, pulls volumes and filters the list.
router.post("/projects/:id/research", async (req, res) => {
  try {
    const { selected } = z.object({ selected: z.array(z.string()).min(1, "Select at least one service").max(60) }).parse(req.body);
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const chosen = new Set(selected);
    const services = project.services.map(service => ({ ...service, selected: chosen.has(service.name) }));
    const selectedNames = services.filter(service => service.selected).map(service => service.name);
    if (!selectedNames.length) return res.status(400).json({ message: "Select at least one service" });

    const trade = cleanKeyword(project.trade);
    const exactList = [...new Set([trade, ...selectedNames].flatMap(name => serviceVariants(name, project.city)))];
    const exact = await fetchSearchVolume(exactList, project.locationName);
    const ideas = await fetchKeywordIdeas([...new Set([trade, ...selectedNames])], project.locationName);
    const { keywords, summary } = buildKeywordList([...exact.metrics, ...ideas.metrics], {
      services: selectedNames,
      trade: project.trade,
      city: project.city,
      state: project.state,
      exactPhrases: exactList,
      exclusions: project.exclusions,
    });
    // Difficulty and intent refine the list but are not needed for it, so a failed pull never blocks the research.
    const phrases = keywords.map(row => row.keyword);
    const [scores, intents] = await Promise.allSettled([fetchKeywordDifficulty(phrases), fetchSearchIntent(phrases)]);
    for (const outcome of [scores, intents]) {
      if (outcome.status === "rejected" && !(outcome.reason instanceof KeywordDataError)) throw outcome.reason;
    }
    let labsCost = 0;
    if (scores.status === "fulfilled") {
      labsCost += scores.value.cost;
      for (const row of keywords) row.difficulty = scores.value.difficulty.get(row.keyword) ?? null;
    }
    if (intents.status === "fulfilled") {
      labsCost += intents.value.cost;
      applySearchIntent(keywords, intents.value.intent);
    }
    summary.difficultyAvailable = scores.status === "fulfilled";
    // Competitors were found from the old keyword list, so they are cleared with it.
    const updated = await updateProject(project.id, { services, keywords, summary, competitors: null, status: "researched", researchedAt: new Date() }, exact.cost + ideas.cost + labsCost);
    return res.json(updated);
  } catch (error) {
    return sendError(res, error, "Unable to run the keyword research");
  }
});

/** "Charlotte, NC" → { city: "Charlotte", state: "NC" }. */
const searchCity = z.string().trim().max(100).transform((value, context) => {
  const comma = value.lastIndexOf(",");
  const city = value.slice(0, comma).trim();
  const state = value.slice(comma + 1).trim();
  if (comma < 1 || !city || state.length < 2) {
    context.addIssue({ code: "custom", message: `Write each city as "City, ST", for example "Charlotte, NC".` });
    return z.NEVER;
  }
  return { city, state };
});

// Finds the strongest local and national competitors from the researched keywords and pre-picks 2 of each.
router.post("/projects/:id/competitors", async (req, res) => {
  try {
    const { cities } = z.object({ cities: z.array(searchCity).max(3).optional() }).parse(req.body ?? {});
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.status !== "researched" || !project.keywords.some(row => row.pageType)) {
      return res.status(409).json({ message: "Run the keyword research first; competitors are found from its keywords." });
    }
    if (runBusy(project)) return res.status(409).json({ message: "Another step is still running for this project." });
    return res.status(202).json(await startRun(project, "competitors", async () => {
      const scan = await discoverCompetitors(project, cities);
      return { changes: { competitors: scan }, cost: scan.costUsd };
    }));
  } catch (error) {
    return sendError(res, error, "Unable to find competitors");
  }
});

// Confirms which competitors get the deep keyword pull. Comparing these with the automatic picks shows when picking can run unattended.
router.patch("/projects/:id/competitors/picks", async (req, res) => {
  try {
    const { picks } = z.object({ picks: z.array(z.string().trim().min(1)).min(1, "Pick at least one competitor").max(6) }).parse(req.body);
    const project = await getProject(req.params.id);
    if (!project?.competitors) return res.status(404).json({ message: "No competitor scan for this project" });
    const listed = new Set([...project.competitors.local, ...project.competitors.national].map(site => site.domain));
    const unknown = picks.find(domain => !listed.has(domain));
    if (unknown) return res.status(400).json({ message: `${unknown} is not in this scan's competitor lists` });
    const chosen = [...new Set(picks)];
    // A playbook built from other competitors no longer describes these picks.
    const samePicks = chosen.length === project.competitors.picks.length && chosen.every(domain => project.competitors!.picks.includes(domain));
    return res.json(await updateProject(project.id, {
      competitors: { ...project.competitors, picks: chosen, confirmedAt: new Date().toISOString(), playbook: samePicks ? project.competitors.playbook : null },
    }));
  } catch (error) {
    return sendError(res, error, "Unable to save the picks");
  }
});

// Pulls the picked competitors' rankings and folds what matches the client's services into the keyword list.
router.post("/projects/:id/playbook", async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!project.competitors?.picks.length) return res.status(409).json({ message: "Find competitors and pick at least one first." });
    if (runBusy(project)) return res.status(409).json({ message: "Another step is still running for this project." });
    const competitors = project.competitors;
    return res.status(202).json(await startRun(project, "playbook", async () => {
      const { keywords, playbook } = await buildPlaybook(project);
      const summary = project.summary && { ...project.summary, keptKeywords: keywords.length };
      return { changes: { keywords, summary, competitors: { ...competitors, playbook } }, cost: playbook.costUsd };
    }));
  } catch (error) {
    return sendError(res, error, "Unable to build the playbook");
  }
});

// Adds a keyword from the playbook's review list, under the service the user chose (or unsorted).
router.post("/projects/:id/playbook/review", async (req, res) => {
  try {
    const input = z.object({ keyword: z.string().trim().min(1), service: serviceName.nullable() }).parse(req.body);
    const project = await getProject(req.params.id);
    const playbook = project?.competitors?.playbook;
    if (!project || !playbook) return res.status(404).json({ message: "No playbook for this project" });
    const item = playbook.review.find(row => row.keyword === input.keyword);
    if (!item) return res.status(404).json({ message: "That keyword is not on the review list" });
    if (input.service && !project.services.some(service => service.name === input.service && service.selected)) {
      return res.status(400).json({ message: "Pick one of the project's selected services" });
    }
    const keyword = {
      keyword: item.keyword, searchVolume: item.searchVolume, cpc: item.cpc, competition: null, competitionIndex: null,
      lowTopOfPageBid: null, highTopOfPageBid: null, nearMeVolume: null, variants: [], difficulty: null,
      service: input.service, source: "competitor" as const, competitors: item.competitors, trend: null,
      ...classifyKeyword(item.keyword, project),
    };
    const review = playbook.review.filter(row => row.keyword !== item.keyword);
    return res.json(await updateProject(project.id, {
      keywords: [...project.keywords, keyword],
      summary: project.summary && { ...project.summary, keptKeywords: project.keywords.length + 1 },
      competitors: { ...project.competitors!, playbook: { ...playbook, review, added: playbook.added + 1 } },
    }));
  } catch (error) {
    return sendError(res, error, "Unable to add the keyword");
  }
});

// Evidence about pages from outside the page-1 check: reported leads and captured rankings. Kept across plan rebuilds.
router.post("/projects/:id/observations", async (req, res) => {
  try {
    const input = z.object({
      kind: z.enum(["city_leads", "page_leads", "captured_ranking"]),
      surface: z.enum(["organic", "map_pack", "ai_answer"]).nullable().default(null),
      query: z.string().trim().max(200).nullable().default(null),
      position: z.number().int().min(1).max(100).nullable().default(null),
      path: z.string().trim().max(300).nullable().default(null),
      service: z.string().trim().max(100).nullable().default(null),
      cities: z.array(z.string().trim().min(1).max(100)).max(60).default([]),
      observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      source: z.string().trim().min(1).max(120),
      note: z.string().trim().max(500).default(""),
    }).refine(item => item.kind !== "captured_ranking" || (item.surface && item.position), { message: "A captured ranking needs where it was seen and its position." })
      .refine(item => item.kind !== "city_leads" || item.cities.length, { message: "Name the cities the leads came from." })
      .refine(item => item.kind !== "page_leads" || item.path, { message: "Leads attributed to a page need the page." })
      .parse(req.body);
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const observation = { ...input, query: input.query ? input.query.toLowerCase() : null, id: randomUUID(), recordedAt: new Date().toISOString() };
    return res.json(await updateProject(project.id, { observations: [...project.observations, observation] }));
  } catch (error) {
    return sendError(res, error, "Unable to record the evidence");
  }
});

router.delete("/projects/:id/observations/:observationId", async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    return res.json(await updateProject(project.id, { observations: project.observations.filter(item => item.id !== req.params.observationId) }));
  } catch (error) {
    return sendError(res, error, "Unable to remove the evidence");
  }
});

// Groups the keywords into pages, checks page 1 once per page, and decides an action per page. Runs in the background.
router.post("/projects/:id/plan", async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (project.status !== "researched") return res.status(409).json({ message: "Run the keyword research first." });
    if (runBusy(project)) return res.status(409).json({ message: "Another step is still running for this project." });
    return res.status(202).json(await startRun(project, "plan", async () => {
      const { keywords, summary, services } = await runPlan(project);
      return { changes: { keywords, summary, services }, cost: summary.plan!.costUsd };
    }));
  } catch (error) {
    return sendError(res, error, "Unable to build the plan");
  }
});

router.delete("/projects/:id", async (req, res) => {
  if (!(await deleteProject(req.params.id))) return res.status(404).json({ message: "Project not found" });
  res.status(204).end();
});

export default router;
