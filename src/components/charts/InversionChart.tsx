"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function InversionChart({ data }: { data: Record<string, string>[] }) {
  const chartData = data
    .filter((r) => r["Fecha"] && r["$"])
    .slice(-16)
    .map((r) => ({
      fecha: String(r["Fecha"]).split("T")[0],
      inversion: parseFloat(r["$"]) || 0,
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
        <defs>
          <linearGradient id="inv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2B3990" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#2B3990" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="fecha" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
          formatter={(v: number) => [`$${v.toLocaleString("es-AR")}`, "Inversión"]}
        />
        <Area dataKey="inversion" stroke="#2B3990" strokeWidth={2} fill="url(#inv)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
