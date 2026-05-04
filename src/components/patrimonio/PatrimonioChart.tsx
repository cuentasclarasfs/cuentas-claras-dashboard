"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { HistoriaRow } from "@/lib/sheets";

interface Props {
  historia: HistoriaRow[];
}

const BARS: { key: keyof HistoriaRow; label: string; color: string }[] = [
  { key: "rePropio",    label: "RE Propio",    color: "#6B7F5E" },
  { key: "reInversion", label: "RE Inversión", color: "#70AD47" },
  { key: "acciones",    label: "Acciones",     color: "#5B9BD5" },
  { key: "creditos",    label: "Crédito Dado", color: "#E06C75" },
  { key: "crypto",      label: "Crypto",       color: "#FF9F00" },
  { key: "cash",        label: "Cash",         color: "#94A3B8" },
];

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[170px]">
      <p className="font-bold text-white mb-2">{label}</p>
      {[...payload].reverse().map((p: any) =>
        p.value > 0 ? (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.fill }} />
              <span className="text-slate-400">{p.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-white">{fmtK(p.value)}</span>
          </div>
        ) : null
      )}
      <div className="border-t border-surface-700 mt-1.5 pt-1.5 flex justify-between">
        <span className="text-slate-500">Total</span>
        <span className="font-bold text-white tabular-nums">{fmtK(total)}</span>
      </div>
    </div>
  );
}

const SELECT_CLS =
  "text-xs bg-surface-800 border border-surface-700 text-slate-300 rounded-lg px-2 py-1.5 " +
  "focus:outline-none focus:ring-1 focus:ring-brand-600";

export function PatrimonioChart({ historia }: Props) {
  const allLabels = historia.map((r) => r.label);

  // Default: last 12 months
  const defaultFrom = allLabels[Math.max(0, allLabels.length - 12)];
  const defaultTo   = allLabels[allLabels.length - 1];

  const [fromLabel, setFromLabel] = useState(defaultFrom);
  const [toLabel,   setToLabel]   = useState(defaultTo);

  const filtered = useMemo(() => {
    const fi = allLabels.indexOf(fromLabel);
    const ti = allLabels.indexOf(toLabel);
    if (fi < 0 || ti < 0 || fi > ti) return historia;
    return historia.slice(fi, ti + 1);
  }, [historia, fromLabel, toLabel, allLabels]);

  const activeBars = BARS.filter((b) =>
    historia.some((r) => (r[b.key] as number) > 0)
  );

  return (
    <div>
      {/* Filter */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Período:</span>
        <div className="flex items-center gap-2">
          <select value={fromLabel} onChange={(e) => setFromLabel(e.target.value)} className={SELECT_CLS}>
            {allLabels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <span className="text-slate-600 text-xs">→</span>
          <select value={toLabel} onChange={(e) => setToLabel(e.target.value)} className={SELECT_CLS}>
            {allLabels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setFromLabel(defaultFrom); setToLabel(defaultTo); }}
          className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
        >
          últimos 12m
        </button>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={filtered} margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={fmtK}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
            formatter={(value) => <span style={{ color: "#94a3b8" }}>{value}</span>}
          />
          {activeBars.map((b, i) => (
            <Bar
              key={b.key}
              dataKey={b.key}
              name={b.label}
              stackId="a"
              fill={b.color}
              radius={i === activeBars.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
