"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Point = { mes: string; si: number; no: number; tardeParcial: number; porcentajeNum: number };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const si   = payload.find((p: any) => p.dataKey === "si");
  const no   = payload.find((p: any) => p.dataKey === "no");
  const tard = payload.find((p: any) => p.dataKey === "tardeParcial");
  const pct  = payload.find((p: any) => p.dataKey === "porcentajeNum");
  const fmt  = (v: number) => `$${v.toLocaleString("es-AR")}`;
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontSize: 11 }}>{label}</p>
      {si   && <p style={{ color: "#94a3b8" }}>Pagaron: <strong style={{ color: "#10b981" }}>{fmt(si.value)}</strong></p>}
      {no   && <p style={{ color: "#94a3b8" }}>No pagaron: <strong style={{ color: "#f43f5e" }}>{fmt(no.value)}</strong></p>}
      {tard && tard.value > 0 && <p style={{ color: "#94a3b8" }}>Tarde/Parcial: <strong style={{ color: "#f59e0b" }}>{fmt(tard.value)}</strong></p>}
      {pct  && <p style={{ color: "#94a3b8" }}>% Cobrado: <strong style={{ color: "#6366f1" }}>{pct.value.toFixed(0)}%</strong></p>}
    </div>
  );
}

export function CobranzasTrendChart({ data }: { data: Point[] }) {
  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={32}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
        <YAxis yAxisId="right" orientation="right" tick={{ fill: "#6366f1", fontSize: 11 }} axisLine={false} tickLine={false} width={36}
          tickFormatter={(v) => `${v}%`} domain={[50, 100]} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 6 }} />
        <Bar yAxisId="left" dataKey="si" name="Pagaron" stackId="a" fill="#10b981" radius={[0,0,0,0]} />
        <Bar yAxisId="left" dataKey="tardeParcial" name="Tarde/Parcial" stackId="a" fill="#f59e0b" radius={[0,0,0,0]} />
        <Bar yAxisId="left" dataKey="no" name="No pagaron" stackId="a" fill="#f43f5e" radius={[3,3,0,0]} />
        <Line yAxisId="right" dataKey="porcentajeNum" name="% Cobrado" type="monotone" stroke="#6366f1" strokeWidth={2}
          dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
