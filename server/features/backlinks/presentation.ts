import { rows, type DataRow } from "./provider";

const fields = ["domain", "target", "page", "anchor", "rank", "backlinks", "referring_domains", "referring_main_domains",
  "referring_pages", "referring_pages_nofollow", "backlinks_spam_score", "broken_backlinks", "first_seen", "last_seen", "lost_date",
  "url_from", "url_to", "domain_from", "domain_from_rank", "page_from_rank", "dofollow", "is_broken", "backlink_spam_score",
  "date", "new_backlinks", "lost_backlinks", "new_referring_domains", "lost_referring_domains"];
const pick = (row: DataRow) => Object.fromEntries(fields.filter(key => key in row).map(key => [key, row[key]]));

// Keep provider evidence in storage, but don't flood a connector call with HTML
// page metadata, repeated histogram dictionaries, and duplicated summary data.
export function presentBacklinkResult(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const response = value as DataRow;
  const report = response.report as DataRow | null;
  if (!report || report.provider !== "DataForSEO" || !report.sections) return value;
  const sections = Object.fromEntries(Object.entries(report.sections as Record<string, DataRow>).map(([key, section]) => {
    const { result, ...receipt } = section;
    const data = result as DataRow | null;
    if (!data || ["summary", "dofollow", "opportunities"].includes(key) || key.startsWith("competitor_")) {
      return [key, { ...receipt, ...(data ? { total_count: data.total_count ?? null, items_count: data.items_count ?? null } : {}) }];
    }
    return [key, { ...receipt, result: {
      target: data.target, total_count: data.total_count ?? null, items_count: data.items_count ?? null,
      items: rows(data.items).map(row => ({ ...pick(row), ...(row.page_summary ? { page_summary: pick(row.page_summary as DataRow) } : {}) })),
    } }];
  }));
  return { ...response, report: { ...report, sections, presentation: "Compact evidence fields; full provider responses retained in the saved snapshot." } };
}
