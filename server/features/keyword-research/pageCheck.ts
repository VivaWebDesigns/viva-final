import type { KeywordResearchKeyword, PageEvidence } from "@shared/keywordResearch";
import { isNotCompetitor } from "./competitors";
import type { SerpResult } from "./dataforseo";
import type { PageContent } from "./readWebsite";
import { BLOG_PATH } from "./playbook";
import { meaningStems } from "./quality";

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
  return urls.map(url => {
    const path = new URL(url).pathname;
    const read = contents.get(url);
    const content: PageContent | null = typeof read === "string" ? { title: read, h1: "", headings: [], text: "", textSource: "html" } : read ?? null;
    const headline = content ? `${content.title} ${content.h1}` : "";
    // Section headings name what the page covers; question headings (FAQs) are content, not topic.
    const sections = (content?.headings ?? []).filter(heading => heading !== content?.h1 && !QUESTION_TITLE.test(heading)).slice(0, 12);
    const words = `${decodeURIComponent(path).replace(/[^a-zA-Z0-9]+/g, " ")} ${headline} ${sections.join(" ")}`;
    return {
      path, stems: meaningStems(words), aboutCost: COST_WORDS.test(`${path} ${headline}`),
      article: BLOG_PATH.test(path + "/") || QUESTION_TITLE.test(headline), placePage: PLACE_PAGE.test(path),
      subjectStems: new Set([...meaningStems(headline)].filter(stem => stem.length > 2 && !ACTION_STEMS.has(stem) && !QUESTION_STEMS.has(stem))),
      textStems: meaningStems(`${content?.text ?? ""} ${(content?.headings ?? []).join(" ")}`),
      title: content?.title ?? "", h1: content?.h1 ?? "",
      words: content?.text ? content.text.split(/\s+/).length : 0, textSource: content?.text ? content.textSource : null,
    };
  });
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
  // Most words matched wins; on a tie, a specific page beats the homepage, then the shorter path.
  const rank = (path: string, matched: number) => matched * 10_000 - (path === "/" ? 5_000 : path.length);
  for (const page of pages) {
    if (INDEX_PAGE.test(page.path) || city.some(stem => !page.stems.has(stem))) continue;
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
    if (essential.some(stem => !page.stems.has(stem))) continue;
    const matched = [...wanted].filter(stem => page.stems.has(stem)).length;
    if (matched >= needed && (!best || rank(page.path, matched) > rank(best.path, best.matched))) best = { path: page.path, matched };
  }
  return best?.path ?? null;
}
