"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Point = { label: string; pct: number; renovados: number; seVencen: number };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const pct      = payload.find((p: any) => p.dataKey === "pct");
  const renovados = payload.find((p: any) => p.dataKey === "renovados");
  const seVencen  = payload.find((p: any) => p.dataKey === "seVencen");
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontSize: 11 }}>{label}</p>
      {seVencen && <p style={{ color: "#94a3b8" }}>Se vencían: <strong style={{ color: "#e2e8f0" }}>{seVencen.value}</strong></p>}
      {renovados && <p style={{ color: "#94a3b8" }}>Renovaron: <strong style={{ color: "#10b981" }}>{renovados.value}</strong></p>}
      {pct && <p style={{ color: "#94a3b8" }}>% Renovados: <strong style={{ color: "#6366f1" }}>{pct.value.toFixed(1)}%</strong></p>}
    </div>
  );
}

export function RenovadosTrendChart({ data }: { data: Point[] }) {
  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6366f1", fontSize: 11 }} axisLine={false} tickLine={false} width={36} tickFormatter={(v) => `${v}%`} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 6 }} />
        <Bar yAxisId="left" dataKey="seVencen" name="Se vencían" fill="#334155" radius={[3,3,0,0]} />
        <Bar yAxisId="left" dataKey="renovados" name="Renovaron" fill="#10b981" radius={[3,3,0,0]} />
        <Line yAxisId="right" dataKey="pct" name="% Renovados" type="monotone" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
