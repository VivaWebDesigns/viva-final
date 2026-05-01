import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { STALE } from "@/lib/queryClient";
import {
  CalendarDays,
  CheckCircle2,
  CircleDot,
  MapPinned,
  Target,
  Users,
} from "lucide-react";

type RangeMode = "30" | "60" | "90" | "custom";

interface CoverageTrade {
  value: string;
  label: string;
  count?: number;
}

interface CoverageRep {
  userId: string | null;
  name: string;
  count: number;
}

interface CapturedCity {
  city: string;
  state: string;
  count: number;
}

interface RecentLead {
  id: string;
  sellerFullName: string;
  businessName: string | null;
  city: string | null;
  state: string | null;
  trade: string | null;
  tradeLabel: string;
  convertedAt: string | null;
  convertedByName: string | null;
  crmLeadId: string | null;
}

interface CoverageMarket {
  id: string;
  name: string;
  state: string;
  radiusMiles: number;
  pin: { x: number; y: number } | null;
  includedCities: string[];
  totalLeads: number;
  dateRange: { from: string | null; to: string | null };
  coverage: {
    covered: number;
    total: number;
    percent: number;
    missingTrades: CoverageTrade[];
  };
  reps: CoverageRep[];
  trades: Required<CoverageTrade>[];
  capturedCities: CapturedCity[];
  recentLeads: RecentLead[];
}

interface CoverageSummary {
  range: { from: string; to: string; days: number };
  targetState: string;
  targetTrades: CoverageTrade[];
  totals: {
    totalLeads: number;
    targetMarkets: number;
    marketsWithCoverage: number;
    completeMarkets: number;
    outsideTargetLeads: number;
    averageCoveragePercent: number;
  };
  markets: CoverageMarket[];
  outsideTargetMarkets: CoverageMarket;
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return "No dates";
  return new Date(value).toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "2-digit" });
}

function formatDateRange(range: CoverageMarket["dateRange"]) {
  if (!range.from || !range.to) return "No converted leads";
  if (formatDateShort(range.from) === formatDateShort(range.to)) return formatDateShort(range.from);
  return `${formatDateShort(range.from)} - ${formatDateShort(range.to)}`;
}

function coverageTone(percent: number, totalLeads: number) {
  if (totalLeads === 0) return "bg-gray-400";
  if (percent >= 80) return "bg-emerald-500";
  if (percent >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function coverageBorderTone(percent: number, totalLeads: number) {
  if (totalLeads === 0) return "border-gray-200 bg-white";
  if (percent >= 80) return "border-emerald-200 bg-emerald-50";
  if (percent >= 40) return "border-amber-200 bg-amber-50";
  return "border-rose-200 bg-rose-50";
}

function StatBlock({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Target;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0D9488] text-white">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function LeadCoverageMapPage() {
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [rangeMode, setRangeMode] = useState<RangeMode>("30");
  const [customFrom, setCustomFrom] = useState(toDateInputValue(addDays(new Date(), -29)));
  const [customTo, setCustomTo] = useState(today);
  const [selectedMarketId, setSelectedMarketId] = useState("nc-charlotte");

  const rangeQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (rangeMode === "custom") {
      params.set("from", customFrom);
      params.set("to", customTo);
    } else {
      params.set("days", rangeMode);
      params.set("to", today);
    }
    return params.toString();
  }, [customFrom, customTo, rangeMode, today]);

  const { data, error, isError, isLoading } = useQuery<CoverageSummary>({
    queryKey: [`/api/marketplace/lead-coverage/summary?${rangeQuery}`],
    staleTime: STALE.MEDIUM,
  });

  const markets = data?.markets ?? [];
  const selectedMarket =
    markets.find((market) => market.id === selectedMarketId) ??
    markets.find((market) => market.totalLeads > 0) ??
    markets[0] ??
    null;

  const maxMarketLeads = Math.max(1, ...markets.map((market) => market.totalLeads));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-lead-coverage-title">
            Lead Coverage Map
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Converted Marketplace leads rolled into North Carolina target markets.
          </p>
        </div>
        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1" data-testid="filter-lead-coverage-range">
            {[
              ["30", "30d"],
              ["60", "60d"],
              ["90", "90d"],
              ["custom", "Custom"],
            ].map(([range, label]) => (
              <button
                key={range}
                onClick={() => setRangeMode(range as RangeMode)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  rangeMode === range ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
                data-testid={`button-lead-coverage-range-${range}`}
              >
                {label}
              </button>
            ))}
          </div>
          {rangeMode === "custom" && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1.5 text-gray-700"
                data-testid="input-lead-coverage-from"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="rounded-md border border-gray-200 px-2 py-1.5 text-gray-700"
                data-testid="input-lead-coverage-to"
              />
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700" data-testid="error-lead-coverage-summary">
          <p className="font-semibold">Lead Coverage Map could not load.</p>
          <p className="mt-1 text-red-600">
            {error instanceof Error ? error.message : "Refresh the page or try another date range."}
          </p>
        </div>
      ) : data ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatBlock label="Converted leads" value={data.totals.totalLeads} icon={CheckCircle2} />
            <StatBlock label="Markets active" value={`${data.totals.marketsWithCoverage}/${data.totals.targetMarkets}`} icon={MapPinned} />
            <StatBlock label="Avg trade coverage" value={`${data.totals.averageCoveragePercent}%`} icon={Target} />
            <StatBlock label="Outside targets" value={data.totals.outsideTargetLeads} icon={CircleDot} />
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-lead-coverage-map">
              <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">NC Target Markets</h2>
                  <p className="text-xs text-gray-500">One pin per target market. Smaller captured cities roll into these markets.</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Strong</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Partial</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Gap</span>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <div className="relative mx-auto aspect-[16/9] max-w-5xl overflow-hidden rounded-lg border border-gray-200 bg-[#eef6f3]">
                  <svg viewBox="0 0 1000 560" className="absolute inset-0 h-full w-full" aria-hidden="true">
                    <path
                      d="M104 286 C170 248 238 229 324 238 C430 250 506 214 602 196 C688 180 761 210 839 213 C894 215 929 233 944 262 C896 281 850 303 812 336 C768 376 721 398 661 404 C584 412 521 387 450 391 C365 395 296 421 211 402 C154 389 119 350 104 286 Z"
                      fill="#d7ebe4"
                      stroke="#8cc4b3"
                      strokeWidth="4"
                    />
                    <path
                      d="M168 312 C302 286 419 313 545 267 C680 218 775 244 904 256"
                      fill="none"
                      stroke="#b7d8ce"
                      strokeWidth="2"
                      strokeDasharray="8 10"
                    />
                  </svg>

                  {markets.map((market) => {
                    if (!market.pin) return null;
                    const selected = selectedMarket?.id === market.id;
                    const size = 28 + Math.round((market.totalLeads / maxMarketLeads) * 18);
                    return (
                      <button
                        key={market.id}
                        type="button"
                        onClick={() => setSelectedMarketId(market.id)}
                        className="absolute -translate-x-1/2 -translate-y-1/2 text-left"
                        style={{ left: `${market.pin.x}%`, top: `${market.pin.y}%` }}
                        data-testid={`button-market-pin-${market.id}`}
                        aria-label={`${market.name}, ${market.state}: ${market.totalLeads} converted leads`}
                      >
                        <span
                          className={`flex items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-lg ring-2 ${
                            selected ? "ring-gray-900" : "ring-white/70"
                          } ${coverageTone(market.coverage.percent, market.totalLeads)}`}
                          style={{ width: size, height: size }}
                        >
                          {market.totalLeads}
                        </span>
                        <span className="mt-1 hidden whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 shadow-sm sm:block">
                          {market.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-selected-market">
              {selectedMarket ? (
                <>
                  <div className="border-b border-gray-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          {selectedMarket.name}, {selectedMarket.state}
                        </h2>
                        <p className="mt-1 text-xs text-gray-500">{selectedMarket.radiusMiles} mile target radius</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${coverageBorderTone(selectedMarket.coverage.percent, selectedMarket.totalLeads)}`}>
                        {selectedMarket.coverage.covered}/{selectedMarket.coverage.total} trades
                      </span>
                    </div>
                  </div>
                  <div className="space-y-5 p-5">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Converted leads</p>
                        <p className="mt-1 text-xl font-bold text-gray-900">{selectedMarket.totalLeads}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Date range</p>
                        <p className="mt-1 text-sm font-semibold text-gray-900">{formatDateRange(selectedMarket.dateRange)}</p>
                      </div>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <Users className="h-4 w-4 text-[#0D9488]" />
                        Converted reps
                      </div>
                      {selectedMarket.reps.length === 0 ? (
                        <p className="text-sm text-gray-500">No converted leads in this range.</p>
                      ) : (
                        <div className="space-y-2">
                          {selectedMarket.reps.map((rep) => (
                            <div key={rep.userId ?? rep.name} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                              <span className="font-medium text-gray-800">{rep.name}</span>
                              <span className="font-semibold text-gray-900">{rep.count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
                        <Target className="h-4 w-4 text-[#0D9488]" />
                        Missing primary trades
                      </div>
                      {selectedMarket.coverage.missingTrades.length === 0 ? (
                        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">All primary trades covered.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {selectedMarket.coverage.missingTrades.map((trade) => (
                            <span key={trade.value} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-inset ring-rose-100">
                              {trade.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-5 text-sm text-gray-500">No target markets found.</div>
              )}
            </section>
          </div>

          {selectedMarket && (
            <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
              <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-market-trades">
                <div className="border-b border-gray-100 px-5 py-4">
                  <h2 className="text-base font-semibold text-gray-900">Trade Breakdown</h2>
                  <p className="text-xs text-gray-500">Exact trade values selected in the extension.</p>
                </div>
                <div className="p-5">
                  {selectedMarket.trades.length === 0 ? (
                    <p className="text-sm text-gray-500">No trades captured for this market in the selected range.</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedMarket.trades.map((trade) => {
                        const width = selectedMarket.totalLeads > 0 ? Math.max(8, Math.round((trade.count / selectedMarket.totalLeads) * 100)) : 0;
                        return (
                          <div key={trade.value}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="font-medium text-gray-800">{trade.label}</span>
                              <span className="font-semibold text-gray-900">{trade.count}</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100">
                              <div className="h-2 rounded-full bg-[#0D9488]" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-white" data-testid="card-market-cities">
                <div className="border-b border-gray-100 px-5 py-4">
                  <h2 className="text-base font-semibold text-gray-900">Captured Cities</h2>
                  <p className="text-xs text-gray-500">Original captured cities rolled into {selectedMarket.name}.</p>
                </div>
                <div className="max-h-80 overflow-auto p-5">
                  {selectedMarket.capturedCities.length === 0 ? (
                    <p className="text-sm text-gray-500">No captured cities in this range.</p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedMarket.capturedCities.map((city) => (
                        <div key={`${city.city}-${city.state}`} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                          <span className="font-medium text-gray-800">{city.city}, {city.state}</span>
                          <span className="font-semibold text-gray-900">{city.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-white xl:col-span-2" data-testid="card-market-recent-leads">
                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">Recent Converted Leads</h2>
                    <p className="text-xs text-gray-500">Latest converted records for the selected market.</p>
                  </div>
                  <CalendarDays className="h-5 w-5 text-gray-400" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Lead</th>
                        <th className="px-5 py-3 font-semibold">Trade</th>
                        <th className="px-5 py-3 font-semibold">Captured city</th>
                        <th className="px-5 py-3 font-semibold">Converted rep</th>
                        <th className="px-5 py-3 font-semibold">Converted</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedMarket.recentLeads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-500">No converted leads for this market.</td>
                        </tr>
                      ) : (
                        selectedMarket.recentLeads.map((lead) => (
                          <tr key={lead.id} className="hover:bg-gray-50/70">
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-900">{lead.businessName || lead.sellerFullName}</p>
                              <p className="text-xs text-gray-500">{lead.sellerFullName}</p>
                            </td>
                            <td className="px-5 py-3 text-gray-700">{lead.tradeLabel}</td>
                            <td className="px-5 py-3 text-gray-700">{[lead.city, lead.state].filter(Boolean).join(", ") || "Unknown"}</td>
                            <td className="px-5 py-3 text-gray-700">{lead.convertedByName || "Unknown rep"}</td>
                            <td className="px-5 py-3 text-gray-700">{formatDateShort(lead.convertedAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {data.outsideTargetMarkets.totalLeads > 0 && (
                <section className="rounded-lg border border-amber-200 bg-amber-50 xl:col-span-2" data-testid="card-outside-target-markets">
                  <div className="px-5 py-4">
                    <h2 className="text-base font-semibold text-amber-900">Outside Target Markets</h2>
                    <p className="mt-1 text-sm text-amber-800">
                      {data.outsideTargetMarkets.totalLeads} converted NC leads are outside the current target-market rollups.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.outsideTargetMarkets.capturedCities.map((city) => (
                        <span key={`${city.city}-${city.state}`} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                          {city.city}, {city.state}: {city.count}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
