"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

type DataPoint = { label: string; cashCollected: number; devengados: number };

function fmt(v: number) {
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export function CashVsDevengadoChart({ data }: { data: DataPoint[] }) {
  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis tickFormatter={fmt} tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          labelStyle={{ color: "#e2e8f0" }}
          formatter={(v: number, name: string) => [
            `$${Math.round(v).toLocaleString("es-AR")}`,
            name === "cashCollected" ? "Cash Collected" : "Devengado"
          ]}
        />
        <Legend
          formatter={(v) => (v === "cashCollected" ? "Cash Collected" : "Devengado")}
          wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
        />
        <Bar dataKey="cashCollected" fill="#2B3990" radius={[3, 3, 0, 0]} name="cashCollected" />
        <Line
          type="monotone"
          dataKey="devengados"
          stroke="#92278F"
          strokeWidth={2}
          dot={{ r: 3, fill: "#92278F" }}
          name="devengados"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
