import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LeadGenFlowDatum {
  date: string;
  contacted: number;
  converted: number;
}

interface ConversionShareDatum {
  name: string;
  value: number;
}

const PIE_COLORS = ["#10B981", "#2563EB", "#F59E0B", "#8B5CF6", "#EF4444", "#14B8A6", "#64748B"];

function formatDateShort(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
      {children}
    </div>
  );
}

export function LeadGenFlowChart({ data }: { data: LeadGenFlowDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip labelFormatter={(value) => formatDateShort(String(value))} />
        <Bar dataKey="contacted" name="Contacted" fill="#0D9488" radius={[4, 4, 0, 0]} />
        <Bar dataKey="converted" name="Converted" fill="#10B981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ConversionShareChart({ data }: { data: ConversionShareDatum[] }) {
  if (data.length === 0) {
    return <EmptyState>No conversions for this range.</EmptyState>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip formatter={(value) => [`${value} converted`, ""]} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Legend verticalAlign="bottom" iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
