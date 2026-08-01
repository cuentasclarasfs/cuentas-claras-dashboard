"use client";

import { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Point = { label: string; crPct: number; [key: string]: number | string };

const CLOSER_COLORS: Record<string, string> = {
  Agus: "#6366f1", Foli: "#10b981", Santi: "#f59e0b", Pit: "#f43f5e", Joan: "#22d3ee",
};
const DEFAULT_COLOR = "#64748b";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const pct = payload.find((p: any) => p.dataKey === "crPct");
  const bars = payload.filter((p: any) => p.dataKey !== "crPct" && p.value > 0);
  const total = bars.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontSize: 11 }}>{label}</p>
      {bars.map((p: any) => (
        <p key={p.dataKey} style={{ color: "#94a3b8" }}>
          {p.dataKey}: <strong style={{ color: p.color ?? "#e2e8f0" }}>{p.value}</strong>
          {total > 0 && <span style={{ color: "#475569", fontSize: 10 }}> ({((p.value / total) * 100).toFixed(0)}%)</span>}
        </p>
      ))}
      {pct && (
        <p style={{ color: "#94a3b8", marginTop: 4, borderTop: "1px solid #1e293b", paddingTop: 4 }}>
          CR%: <strong style={{ color: "#a78bfa" }}>{Number(pct.value).toFixed(1)}%</strong>
        </p>
      )}
    </div>
  );
}

export function CloserHistoryChart({ data, closers }: { data: Point[]; closers: string[] }) {
  const [open, setOpen] = useState(false);
  if (!data.length || !closers.length) return null;

  return (
    <div className="mt-4 pt-3 border-t border-surface-700/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
      >
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        {open ? "Ocultar evolución histórica" : "Ver evolución histórica (6 meses)"}
      </button>
      {open && (
        <div className="mt-4">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#a78bfa", fontSize: 11 }} axisLine={false} tickLine={false} width={34} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 6 }} />
              {closers.map((c) => (
                <Bar key={c} yAxisId="left" dataKey={c} stackId="a" fill={CLOSER_COLORS[c] ?? DEFAULT_COLOR} radius={c === closers[closers.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
              ))}
              <Line yAxisId="right" dataKey="crPct" name="CR%" type="monotone" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3, fill: "#a78bfa" }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
