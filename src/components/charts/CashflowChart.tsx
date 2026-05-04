"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

interface CashflowRow { mes: string; ingresos: number; egresos: number; neto: number }

export function CashflowChart({ data }: { data: CashflowRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 0, right: 8 }} barGap={2}>
        <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
          formatter={(v: number) => [`$${Math.round(v).toLocaleString("es-AR")}`, ""]}
        />
        <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{v}</span>} />
        <ReferenceLine y={0} stroke="#334155" />
        <Bar dataKey="ingresos" name="Ingresos" fill="#2B3990" radius={[3,3,0,0]} />
        <Bar dataKey="egresos" name="Egresos" fill="#92278F" radius={[3,3,0,0]} />
        <Bar dataKey="neto" name="Neto" fill="#4A5BBD" radius={[3,3,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
