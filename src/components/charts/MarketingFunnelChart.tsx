"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const STAGES = [
  { key: "Leads totales", label: "Leads", color: "#8A96E0" },
  { key: "RESP", label: "Respondieron", color: "#4A5BBD" },
  { key: "PITC", label: "Pitch", color: "#2B3990" },
  { key: "PERMISO PARA AG", label: "Permiso", color: "#B85AB6" },
  { key: "AGENDADO", label: "Agendados", color: "#92278F" },
];

export function MarketingFunnelChart({ data }: { data: Record<string, string>[] }) {
  const totals = STAGES.map(({ key, label, color }) => ({
    label,
    color,
    value: data.reduce((acc, r) => acc + (parseInt(r[key]) || 0), 0),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={totals} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar dataKey="value" radius={4}>
          {totals.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
