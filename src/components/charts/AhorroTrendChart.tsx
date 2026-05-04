"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";

type DataPoint = { label: string; ahorro: number };

export function AhorroTrendChart({ data }: { data: DataPoint[] }) {
  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 10 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          labelStyle={{ color: "#e2e8f0" }}
          formatter={(v: number) => [`$${Math.round(v).toLocaleString("es-AR")}`, "Ahorro"]}
        />
        <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 2" />
        <Line
          type="monotone"
          dataKey="ahorro"
          stroke="#4A5BBD"
          strokeWidth={2}
          dot={{ r: 3, fill: "#4A5BBD" }}
          name="Ahorro"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
