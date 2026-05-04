"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#2B3990", "#92278F", "#4A5BBD", "#B85AB6", "#262262", "#475569"];

export function VentasConversionChart({ data }: { data: Record<string, string>[] }) {
  const counts: Record<string, number> = {};
  data.forEach((r) => {
    const k = r["Status"] || "Sin clasificar";
    counts[k] = (counts[k] || 0) + 1;
  });

  const chartData = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
