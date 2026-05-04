import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TrendMetric = "activeMinutes" | "leadsWorked" | "signIns" | "demosScheduled" | "closedWon";

interface TrendDatum {
  date: string;
  activeMinutes: number;
  signIns: number;
  leadsWorked: number;
  demosScheduled: number;
  closedWon: number;
  signedInNoActivity: number;
}

interface CrmActivityTrendChartsProps {
  trendData: TrendDatum[];
  trendMetric: TrendMetric;
  trendLabel: string;
}

function formatDateLong(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateShort(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function CrmActivityTrendCharts({
  trendData,
  trendMetric,
  trendLabel,
}: CrmActivityTrendChartsProps) {
  return (
    <>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={(value) => formatDateLong(String(value))} formatter={(value) => [value, trendLabel]} />
            <Line type="monotone" dataKey={trendMetric} stroke="#0D9488" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip labelFormatter={(value) => formatDateLong(String(value))} />
            <Bar dataKey="signedInNoActivity" name="Signed in, no activity" fill="#EF4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
