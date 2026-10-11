import type { KeywordResearchKeyword, PageEvidence } from "@shared/keywordResearch";
import { isNotCompetitor } from "./competitors";
import type { SerpResult } from "./dataforseo";
import type { PageContent } from "./readWebsite";
import { BLOG_PATH } from "./playbook";
import { actionConflict, meaningStems } from "./quality";

/** Under this many estimated organic visits a month a site counts as small. A size, not a verdict on beating it. */
export const SMALL_TRAFFIC = 1_000;
// Forum threads are counted separately: often a sign nobody has written a good answer, but only a sign.
const FORUMS = ["reddit.com", "quora.com", "facebook.com", "diychatroom.com", "contractortalk.com", "hvac-talk.com", "terrylove.com",
  "doityourself.com", "justanswer.com", "stackexchange.com", "nextdoor.com", "houzz.com"];
const PUBLISHERS = ["thespruce.com", "bobvila.com", "thisoldhouse.com", "familyhandyman.com", "hgtv.com", "forbes.com", "wikihow.com",
  "homeguide.com", "fixr.com", "bhg.com", "architecturaldigest.com", "consumerreports.org"];
const QUESTION_TITLE = /^(how|what|why|when|where|which|who|can|does|do|is|are|should)\b|\?/i;

const onDomain = (domain: string, list: string[]) => list.some(entry => domain === entry || domain.endsWith(`.${entry}`));

export function isForum(domain: string) {
  return onDomain(domain, FORUMS);
}

/** An article, guide or forum post rather than a business's service page. */
export function isArticle(result: { domain: string; url?: string; title: string | null }) {
  return isForum(result.domain) || onDomain(result.domain, PUBLISHERS) || BLOG_PATH.test(result.url ?? "") || QUESTION_TITLE.test(result.title ?? "");
}

/** What page 1 from one city holds for a page's main keyword. Counts are observations, not a verdict. */
export function evidenceFrom(serp: SerpResult, city: string, traffic: Map<string, number>, liveHost: string | null): PageEvidence {
  const top = serp.organic.filter(row => row.position <= 10);
  const others = top.filter(row => row.domain !== liveHost);
  // Forum threads are counted first: Reddit and Facebook are also on the never-a-competitor list.
  const rest = others.filter(row => !isForum(row.domain) && !isNotCompetitor(row.domain));
  const cityText = city.toLowerCase();
  const citySlug = cityText.replace(/\s+/g, "-");
  const client = serp.organic.find(row => row.position <= 20 && row.domain === liveHost) ?? null;
  return {
    keyword: serp.keyword,
    city,
    smallSites: rest.filter(row => traffic.has(row.domain) && traffic.get(row.domain)! < SMALL_TRAFFIC).length,
    forums: others.filter(row => isForum(row.domain)).length,
    unknownSites: rest.filter(row => !traffic.has(row.domain)).length,
    cityPages: top.filter(row => (row.title ?? "").toLowerCase().includes(cityText) || (row.url ?? "").toLowerCase().includes(citySlug)).length,
    mapPack: serp.localPack.length > 0,
    aiOverview: serp.aiOverview ?? false,
    clientPosition: client?.position ?? null,
    clientUrl: client?.url ?? null,
    clientMapPosition: liveHost ? (serp.localPack.findIndex(row => row.domain === liveHost) + 1 || null) : null,
    articles: top.filter(row => isArticle(row)).length,
    checkedAt: new Date().toISOString(),
    settings: {
      location: serp.locationName, locationCode: serp.locationCode ?? null, language: serp.language ?? "en", device: serp.device ?? "desktop",
      depth: serp.depth ?? 20, clientDomain: liveHost,
    },
  };
}

export interface SitePage {
  path: string;
  stems: Set<string>;
  /** About prices (cost, price, estimate, quote), or an article (blog path or a question title). */
  aboutCost: boolean;
  article: boolean;
  /** A page for one place ("/service-areas/monroe-nc"): it only targets keywords naming that place. */
  placePage: boolean;
  /** The words of the page's title and first heading that name what it is about (no action words or state codes). Empty when unread. */
  subjectStems: Set<string>;
  /** Every word of the page's title (the site's name left out) and main heading, action words included. */
  headlineStems: Set<string>;
  /** The page's title (the site's name left out) and main heading, as text. */
  headline: string;
  /** The page's own sentences: its main content with the blocks repeated across the site (link lists, menus) left out. */
  bodySentences: Array<{ text: string; stems: Set<string> }>;
  /** The words of the page's whole main content (menus and footers left out). Empty when the page was not read. */
  textStems: Set<string>;
  title: string;
  h1: string;
  /** Words of main content read; 0 when the page could not be read. */
  words: number;
  textSource: PageContent["textSource"] | null;
}

// Listing pages ("/services", "/service-areas") link to pages that target keywords; they do not target any themselves.
const INDEX_PAGE = /^\/(services?|service-areas?|areas?(-we-serve)?|locations?|blog|news|projects|gallery|reviews|about(-us)?|contact(-us)?|faqs?)\/?$/i;
const PLACE_PAGE = /\/(service-areas?|locations?|areas?(-we-serve)?|cities|showroom-locations)\/[^/]+|-(a[klrz]|c[aot]|d[ce]|fl|ga|hi|i[adln]|k[sy]|la|m[adeinost]|n[cdehjmvy]|o[hkr]|pa|ri|s[cd]|t[nx]|ut|v[at]|w[aivy])\/?$/i;
/** A page for one place ("/service-areas/charlotte"): never a service's own page, whatever the intake matched. */
export function isPlacePage(path: string) {
  return PLACE_PAGE.test(path);
}

// Question words carry no topic: "how to fix foggy windows" is the page about fixing foggy windows.
const QUESTION_STEMS = meaningStems("how what why when where which who can does do is are should will vs");
const ACTION_STEMS = meaningStems("install installation installer repair repairs replace replacement service fix custom professional new");
const COST_WORDS = /\b(cost|costs|price|prices|pricing|estimate|estimates|quote|quotes)\b/i;

/**
 * A page's words. Its topic is its URL path, title, main heading and section headings (h2); its subject is its title
 * and main heading; its content is the whole main text. A string stands in for a page known only by its title.
 */
export function sitePages(urls: string[], contents: Map<string, PageContent | string> = new Map()): SitePage[] {
  const read = urls.map(url => {
    const value = contents.get(url);
    return typeof value === "string" ? { title: value, h1: "", headings: [], text: "", textSource: "html" as const } : value ?? null;
  });
  // The site's template: title segments ("| Brand Name") and section headings ("Services", "Service Areas") that
  // repeat on most read pages say nothing about any one page's topic.
  const pagesRead = read.filter(Boolean).length;
  const repeated = (values: string[][]) => {
    const counts = new Map<string, number>();
    for (const list of values) for (const value of new Set(list)) counts.set(value, (counts.get(value) ?? 0) + 1);
    return new Set([...counts].filter(([, count]) => pagesRead >= 4 && count >= pagesRead / 2).map(([value]) => value));
  };
  const segments = (title: string) => title.split(/\s+[|\u2013\u2014-]\s+/).map(part => part.trim().toLowerCase()).filter(Boolean);
  const templateTitles = repeated(read.map(content => (content ? segments(content.title) : [])));
  const templateHeadings = repeated(read.map(content => (content?.headings ?? []).map(heading => heading.toLowerCase())));
  // Body text repeated across the site (a "Related Links" list, a services block): any run of 5 words that appears on
  // half or more of the read pages is template, and a sentence made mostly of template runs is not the page's own.
  const words = read.map(content => (content?.text ?? "").toLowerCase().split(/\s+/).filter(Boolean));
  const runs = repeated(words.map(list => list.slice(0, -4).map((_, index) => list.slice(index, index + 5).join(" "))));
  // A sentence naming another page's main heading is a link card for that page ("Commercial Storefront Glass
  // Replacement & Repair: emergency board-up…" on the door page), not this page's own content.
  // Short headings ("Window Repair") count only at the start of a sentence, where a link card puts its page's name.
  const mainHeadings = read.map(content => (content?.h1 ?? "").toLowerCase().replace(/\s+/g, " ").trim()).map(h1 => (h1.split(" ").length >= 2 ? h1 : ""));
  const ownSentences = (text: string, own: number) => text.split(/(?<=[.!?])\s+/).map(sentence => sentence.trim()).filter(sentence => {
    const list = sentence.toLowerCase().split(/\s+/).filter(Boolean);
    if (list.length < 3) return false;
    const lower = list.join(" ");
    if (mainHeadings.some((h1, index) => h1 && index !== own && h1 !== mainHeadings[own] && (h1.split(" ").length >= 3 ? lower.includes(h1) : lower.startsWith(`${h1} `)))) return false;
    const covered = new Set<number>();
    for (let index = 0; index + 5 <= list.length; index += 1) {
      if (runs.has(list.slice(index, index + 5).join(" "))) for (let offset = 0; offset < 5; offset += 1) covered.add(index + offset);
    }
    return covered.size / list.length < 0.5;
  });
  return urls.map((url, index) => {
    const path = new URL(url).pathname;
    const content = read[index];
    const title = content ? segments(content.title).filter(part => !templateTitles.has(part)).join(" ") : "";
    const headline = content ? `${title} ${content.h1}` : "";
    // Section headings name what the page covers; question headings (FAQs), the site's repeated headings, and
    // sentences styled as headings (over 10 words) do not.
    const sections = (content?.headings ?? []).filter(heading => heading !== content?.h1 && !QUESTION_TITLE.test(heading)
      && !templateHeadings.has(heading.toLowerCase()) && heading.split(/\s+/).length <= 10).slice(0, 12);
    const words = `${decodeURIComponent(path).replace(/[^a-zA-Z0-9]+/g, " ")} ${headline} ${sections.join(" ")}`;
    return {
      path, stems: meaningStems(words), aboutCost: COST_WORDS.test(`${path} ${headline}`),
      article: BLOG_PATH.test(path + "/") || QUESTION_TITLE.test(headline), placePage: PLACE_PAGE.test(path),
      subjectStems: new Set([...meaningStems(headline)].filter(stem => stem.length > 2 && !ACTION_STEMS.has(stem) && !QUESTION_STEMS.has(stem))),
      headlineStems: meaningStems(headline),
      textStems: meaningStems(`${content ? ownSentences(content.text, index).join(" ") : ""} ${(content?.headings ?? []).filter(heading => !templateHeadings.has(heading.toLowerCase())).join(" ")}`),
      headline,
      bodySentences: content ? ownSentences(content.text, index).slice(0, 400).map(text => ({ text: text.slice(0, 300), stems: meaningStems(text) })) : [],
      title: content?.title ?? "", h1: content?.h1 ?? "",
      words: content?.text ? content.text.split(/\s+/).length : 0, textSource: content?.text ? content.textSource : null,
    };
  });
}

const QUESTION_SENTENCE = /\?\s*$|^(how|what|why|when|where|which|who|can|does|do|is|are|should)\b/i;
const ACTION_WORD = /^(repair|repairs|repairing|repaired|fix|fixing|fixed|install|installs|installing|installation|installer|installed|replace|replacing|replacement|replaced)$/;

/** Whether a page's own statements (not questions, not link cards) offer the search's action for its subject, twice or more. */
export function coversAction(page: SitePage, keyword: string, placeStems: Set<string> = new Set()) {
  const words = keyword.toLowerCase().split(/\s+/);
  const action = meaningStems(words.filter(word => ACTION_WORD.test(word)).join(" "));
  // The subject without place words: the city belongs in the page's address and title, not in every statement.
  const subject = [...meaningStems(words.filter(word => !ACTION_WORD.test(word)).join(" "))].filter(stem => stem.length > 2 && !ACTION_STEMS.has(stem) && !placeStems.has(stem));
  if (!action.size) return false;
  const actionRoots = [...action].map(stem => stem.slice(0, 4));
  return page.bodySentences.filter(sentence => !QUESTION_SENTENCE.test(sentence.text)
    && subject.every(stem => sentence.stems.has(stem))
    && actionRoots.some(root => [...sentence.stems].some(stem => stem.startsWith(root)))).length >= 2;
}

/**
 * The client page that targets a keyword: the service's own page for the service phrase itself, otherwise the page
 * whose URL, title or first heading holds the keyword's words (a keyword of 4+ words may miss one action word). A city keyword's
 * page must name the city, a page for one place covers only keywords naming it, a cost keyword's page must be about
 * prices, and a blog topic's page must be an article.
 * The homepage covers keywords made only of the trade and the client's place ("glass company matthews nc").
 */
export function coveringPage(
  row: KeywordResearchKeyword,
  pages: SitePage[],
  context: { servicePages: Map<string, string>; homeStems: Set<string>; cityStems: Set<string>; cityNames?: string[]; serviceNames?: string[] },
): string | null {
  // A service's own page targets the service phrase itself; its other phrasings need pages of their own.
  if (row.service && row.keyword === row.service && context.servicePages.has(row.service)) return context.servicePages.get(row.service)!;
  const wanted = new Set([...meaningStems(row.keyword)].filter(stem => !QUESTION_STEMS.has(stem)));
  if (!wanted.size) return null;
  if ([...wanted].every(stem => context.homeStems.has(stem))) return "/";
  // A city counts only when the keyword names it ("stallings"), not when a word shares its stem ("shower stall").
  const city = context.cityNames
    ? [...new Set(context.cityNames.filter(name => new RegExp(`\\b${name.toLowerCase().replace(/[^a-z0-9 ]/g, "")}\\b`).test(row.keyword)).flatMap(name => [...meaningStems(name)]))]
    : [...wanted].filter(stem => context.cityStems.has(stem));
  // A page must hold every word, except that a keyword of 4+ words may miss one action word ("installation"),
  // never the thing itself: "glass shower door installation" is not the glass door repair page.
  const essential = [...wanted].filter(stem => !ACTION_STEMS.has(stem));
  const needed = wanted.size >= 4 && essential.length < wanted.size ? wanted.size - 1 : wanted.size;
  let best: { path: string; matched: number } | null = null;
  // A page whose body covers the search, when no page's title or headings do: see the body rule below.
  let fromBody: { path: string; matched: number } | null = null;
  // Most words matched wins; on a tie, a specific page beats the homepage, then the shorter path.
  const rank = (path: string, matched: number) => matched * 10_000 - (path === "/" ? 5_000 : path.length);
  for (const page of pages) {
    // The homepage covers only trade-and-place searches (above); a search for a specific service belongs on that
    // service's page or a new one, never on the homepage by default.
    if (page.path === "/" || INDEX_PAGE.test(page.path) || city.some(stem => !page.stems.has(stem))) continue;
    // A repair search does not belong on a page about installation or replacement, or the other way round, even
    // when every other word matches ("window repair monroe nc" is not the Charlotte & Monroe installation page),
    // unless the page genuinely covers both: two or more of its own statements pair the subject with that action.
    if (page.headline && actionConflict(row.keyword, page.headline) && !coversAction(page, row.keyword, context.cityStems)) continue;
    if ((row.pageType === "cost" && !page.aboutCost) || (row.pageType === "blog" && !page.article)) continue;
    if (page.placePage && !city.length) continue;
    // A page for one place covers searches for its own subject there: "door installation charlotte nc" is not the
    // Charlotte glass shower door page, though every word of it is on that page. One subject word may be missing.
    const subject = [...page.subjectStems].filter(stem => !context.cityStems.has(stem));
    if (page.placePage && subject.filter(stem => !wanted.has(stem)).length > 1) continue;
    // Variants of the page's own subject belong on it ("frameless shower doors matthews" on the Matthews shower door
    // page) when the search holds the subject's most distinctive word (the one fewest of the client's services
    // share) and the page's content covers the search's other words.
    if (page.placePage && subject.length && context.serviceNames?.length) {
      const shared = (stem: string) => context.serviceNames!.filter(name => meaningStems(name).has(stem)).length;
      const rarest = Math.min(...subject.map(shared));
      const covered = essential.every(stem => page.stems.has(stem) || page.textStems.has(stem));
      if (covered && subject.filter(stem => shared(stem) === rarest).every(stem => wanted.has(stem))) {
        const matched = [...wanted].filter(stem => page.stems.has(stem) || page.textStems.has(stem)).length;
        if (!best || rank(page.path, matched) > rank(best.path, best.matched)) best = { path: page.path, matched };
        continue;
      }
    }
    if (essential.some(stem => !page.stems.has(stem))) {
      // The page's own body confirms a page already matched to the search's service (by the intake or by its title):
      // one of its sentences holds every word of the search other than the place ("We provide emergency board-up
      // service" on the storefront glass page). Body text never claims a service for a page not matched to it, so
      // a passing mention on the homepage, a legal page or another service's page is not coverage. Place words
      // still have to be in the page's address, title or headings, and template blocks never count.
      // The search's confirmed service (its relevance verdict) decides which page it may confirm, not the word matcher's guess.
      const service = row.relevance?.verdict === "yes" && row.relevance.service ? row.relevance.service : row.service;
      if (!page.placePage && row.pageType !== "blog" && row.pageType !== "cost" && service && context.servicePages.get(service) === page.path) {
        // Two-letter words ("up", "nc") carry no topic and are left out.
        const core = essential.filter(stem => !city.includes(stem) && stem.length > 2);
        const rest = essential.filter(stem => city.includes(stem));
        const support = page.bodySentences.filter(sentence => core.every(stem => sentence.stems.has(stem))).length;
        // The page with the most sentences about it wins.
        if (core.length && support && rest.every(stem => page.stems.has(stem)) && (!fromBody || support > fromBody.matched)) fromBody = { path: page.path, matched: support };
      }
      continue;
    }
    const matched = [...wanted].filter(stem => page.stems.has(stem)).length;
    if (matched >= needed && (!best || rank(page.path, matched) > rank(best.path, best.matched))) best = { path: page.path, matched };
  }
  return best?.path ?? fromBody?.path ?? null;
}
