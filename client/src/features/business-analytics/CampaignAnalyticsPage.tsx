import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, FileText, Loader2, LogOut, MapPin, MousePointerClick, Send, Sparkles, UserPlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { apiRequest, STALE } from "@/lib/queryClient";

type Row = Record<string, string | number>;

type CampaignSnapshot = {
  targetCities: string[];
  summary: Row & { outsideSessions: number };
  cities: (Row & { inTarget: boolean })[];
  landingPages: Row[];
  devices: Row[];
  actions: Row[];
  email: {
    leadsAddedToCampaign: number;
    webhookEventTotals: Record<string, number>;
  };
};

type Turn = { role: "user" | "assistant"; text: string };

const RANGES = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

const SUGGESTIONS = [
  "What happened on the website today?",
  "Which landing pages are people bouncing from this week?",
  "Which target-area cities are visiting, and how engaged are they?",
  "Did website visits go up after we added leads to the campaign?",
];

const EVENT_LABELS: Record<string, string> = {
  reply_received: "Replies",
  lead_interested: "Interested",
  lead_meeting_booked: "Meetings booked",
  lead_not_interested: "Not interested",
  lead_unsubscribed: "Unsubscribed",
  email_bounced: "Bounced",
};

const num = (value: unknown) => Number(value ?? 0);
const percent = (fraction: unknown) => `${Math.round(num(fraction) * 100)}%`;
const label = (value: string) => value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());

function duration(seconds: unknown) {
  const total = Math.round(num(seconds));
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, "0")}s`;
}

function Tile({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: typeof Clock }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <Icon className="mb-3 h-5 w-5 text-teal-600" />
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-1 text-xs text-gray-400">{detail}</p>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">{subtitle}</p>
      {children}
    </section>
  );
}

function Table({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-400">
            {headers.map((header, index) => (
              <th key={header} className={`pb-2 font-semibold ${index === 0 ? "pr-3" : "px-2 text-right"}`}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex}>
              {cells.map((cell, index) => (
                <td key={index} className={`py-2.5 ${index === 0 ? "max-w-xs truncate pr-3 font-medium text-gray-900" : "px-2 text-right text-gray-700"}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AskPanel() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const ask = useMutation({
    mutationFn: async (text: string) => {
      const res = await apiRequest("POST", "/api/business-analytics/campaign/ask", { question: text, history: turns.slice(-10) });
      return (await res.json()) as { answer: string };
    },
    onSuccess: ({ answer }, text) => {
      setTurns((current) => [...current, { role: "user", text }, { role: "assistant", text: answer }]);
      setQuestion("");
    },
  });

  const submit = (text: string) => {
    if (text.trim() && !ask.isPending) ask.mutate(text.trim());
  };

  return (
    <section className="rounded-xl border border-teal-200 bg-white p-5" data-testid="campaign-ask">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-teal-600" />
        <h2 className="font-semibold text-gray-900">Ask about the website</h2>
      </div>

      {turns.length > 0 && (
        <div className="mb-4 max-h-[32rem] space-y-3 overflow-y-auto">
          {turns.map((turn, index) => (
            <div
              key={index}
              className={turn.role === "user"
                ? "ml-auto w-fit max-w-[85%] rounded-lg bg-teal-600 px-4 py-2 text-sm text-white"
                : "whitespace-pre-wrap rounded-lg bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-800"}
            >
              {turn.text}
            </div>
          ))}
        </div>
      )}

      {ask.isPending && (
        <p className="mb-3 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Looking at the data…
        </p>
      )}
      {ask.error && <p className="mb-3 text-sm text-red-600">{(ask.error as Error).message}</p>}

      <form
        className="flex gap-2"
        onSubmit={(event: FormEvent) => { event.preventDefault(); submit(question); }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What happened today?"
          maxLength={1000}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!question.trim() || ask.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" /> Ask
        </button>
      </form>

      {turns.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => submit(suggestion)}
              disabled={ask.isPending}
              className="rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600 hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      {turns.length > 0 && (
        <button type="button" onClick={() => setTurns([])} className="mt-3 text-xs text-gray-400 hover:text-gray-600">
          Start a new conversation
        </button>
      )}
    </section>
  );
}

export default function CampaignAnalyticsPage() {
  const [days, setDays] = useState(1);
  const { data, isLoading, error } = useQuery<CampaignSnapshot>({
    queryKey: [`/api/business-analytics/campaign?days=${days}`],
    staleTime: STALE.MEDIUM,
  });
  const range = RANGES.find((option) => option.days === days)?.label ?? "";
  const replies = data ? Object.entries(data.email.webhookEventTotals) : [];

  return (
    <div className="space-y-6" data-testid="campaign-analytics-page">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaign website</h1>
          <p className="mt-1 text-sm text-gray-500">How the website performs for visitors from the Charlotte target area (Google Analytics 4).</p>
        </div>
        <div className="flex w-fit rounded-lg bg-gray-100 p-1">
          {RANGES.map((option) => (
            <button
              type="button"
              key={option.days}
              onClick={() => setDays(option.days)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${days === option.days ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <AskPanel />

      {isLoading ? (
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Campaign analytics could not be loaded: {(error as Error).message}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <Tile title="Target-area visits" value={num(data.summary.sessions).toLocaleString()} detail={`${data.summary.outsideSessions} from elsewhere`} icon={MapPin} />
            <Tile title="Bounce rate" value={percent(data.summary.bounceRate)} detail={`${num(data.summary.engagedSessions)} engaged visits`} icon={LogOut} />
            <Tile title="Avg. visit length" value={duration(data.summary.averageSessionDuration)} detail="Target-area visits" icon={Clock} />
            <Tile title="Pages viewed" value={num(data.summary.screenPageViews).toLocaleString()} detail="Target-area visits" icon={FileText} />
            <Tile title="Key events" value={num(data.summary.keyEvents).toLocaleString()} detail="Leads, calls, bookings" icon={MousePointerClick} />
            <Tile title="Leads added" value={data.email.leadsAddedToCampaign.toLocaleString()} detail={`To Instantly · ${range}`} icon={UserPlus} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Landing pages" subtitle="Where target-area visitors arrived">
              <Table
                headers={["Page", "Visits", "Bounce", "Avg. time"]}
                rows={data.landingPages.map((row) => [
                  <span title={String(row.landingPagePlusQueryString)}>{row.landingPagePlusQueryString}</span>,
                  num(row.sessions), percent(row.bounceRate), duration(row.averageSessionDuration),
                ])}
                empty="No target-area visits in this period."
              />
            </Panel>

            <Panel title="Cities" subtitle="All visits; target-area cities are marked">
              <Table
                headers={["City", "Visits", "Bounce", "Avg. time"]}
                rows={data.cities.map((row) => [
                  <span className={row.inTarget ? "text-gray-900" : "text-gray-400"}>
                    {row.city}, {row.region}
                    {row.inTarget && <span className="ml-2 rounded bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-700">Target</span>}
                  </span>,
                  num(row.sessions), percent(row.bounceRate), duration(row.averageSessionDuration),
                ])}
                empty="No visits in this period."
              />
            </Panel>

            <Panel title="Actions taken" subtitle="Clicks, scrolls and form activity from target-area visits">
              <Table
                headers={["Action", "Count"]}
                rows={data.actions.map((row) => [label(String(row.eventName)), num(row.eventCount)])}
                empty="No actions recorded in this period."
              />
            </Panel>

            <Panel title="Devices and email responses" subtitle="Target-area devices, and Instantly events received">
              <Table
                headers={["Device", "Visits", "Bounce", "Avg. time"]}
                rows={data.devices.map((row) => [
                  label(String(row.deviceCategory)), num(row.sessions), percent(row.bounceRate), duration(row.averageSessionDuration),
                ])}
                empty="No target-area visits in this period."
              />
              <div className="mt-5">
                <Table
                  headers={["Instantly event", "Count"]}
                  rows={replies.map(([type, count]) => [EVENT_LABELS[type] ?? label(type), count])}
                  empty="No Instantly events in this period."
                />
              </div>
            </Panel>
          </div>

          <p className="text-xs text-gray-400">Target area: {data.targetCities.join(", ")}. Locations come from IP addresses and are approximate.</p>
        </>
      ) : null}
    </div>
  );
}
