"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { MonthlyRevenue } from "@/lib/metrics";

export function RevenueTrendChart({ data }: { data: MonthlyRevenue[] }) {
  const chartData = data.slice(-12).map((d) => ({
    mes: d.month.slice(2),
    "Primer programa": Math.round(d.primerPrograma),
    "Renovados": Math.round(d.renovados),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
        <defs>
          <linearGradient id="pp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2B3990" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#2B3990" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="ren" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#92278F" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#92278F" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
          formatter={(v: number) => [`$${v.toLocaleString("es-AR")}`, ""]}
        />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{v}</span>} />
        <Area type="monotone" dataKey="Primer programa" stroke="#2B3990" strokeWidth={2} fill="url(#pp)" dot={false} />
        <Area type="monotone" dataKey="Renovados" stroke="#92278F" strokeWidth={2} fill="url(#ren)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
