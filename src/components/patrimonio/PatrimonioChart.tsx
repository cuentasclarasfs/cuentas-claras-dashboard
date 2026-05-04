"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import type { HistoriaRow, PortfolioAsset } from "@/lib/sheets";
import { X, TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  historia: HistoriaRow[];
  assets:   PortfolioAsset[];
}

const BARS: { key: keyof HistoriaRow; label: string; color: string }[] = [
  { key: "rePropio",    label: "RE Propio",    color: "#6B7F5E" },
  { key: "reInversion", label: "RE Inversión", color: "#70AD47" },
  { key: "acciones",    label: "Acciones",     color: "#5B9BD5" },
  { key: "creditos",    label: "Crédito Dado", color: "#E06C75" },
  { key: "crypto",      label: "Crypto",       color: "#FF9F00" },
  { key: "cash",        label: "Cash",         color: "#94A3B8" },
];

// Mapping clase → risk for synthetic historical pie (RE Propio excluded as AF)
const CLASE_RISK: Record<string, string> = {
  "Cash":          "BAJO",
  "Acciones":      "MEDIO",
  "Crypto":        "ALTO",
  "RE Inversión":  "BAJO",
  "Crédito Dado":  "BAJO",
};

const RISK_COLORS: Record<string, string> = {
  BAJO:  "#4CAF50",
  MEDIO: "#F5A623",
  ALTO:  "#E05252",
};

const RISK_LABELS: Record<string, string> = {
  BAJO:  "Bajo",
  MEDIO: "Medio",
  ALTO:  "Alto",
};

type PieSlice = { name: string; value: number; grandTotal: number; clases: { clase: string; valor: number }[] };

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtDiff(n: number): string {
  return `${n >= 0 ? "+" : ""}${fmtK(n)}`;
}

function fmtPct(n: number, d = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
}

// Build synthetic risk pie from HistoriaRow (no per-asset data available historically)
function buildHistoriaRisk(row: HistoriaRow): PieSlice[] {
  const items = [
    { clase: "Cash",         valor: row.cash },
    { clase: "Acciones",     valor: row.acciones },
    { clase: "Crypto",       valor: row.crypto },
    { clase: "RE Inversión", valor: row.reInversion },
    { clase: "Crédito Dado", valor: row.creditos },
  ];
  const groups: Record<string, { total: number; clases: { clase: string; valor: number }[] }> = {
    BAJO:  { total: 0, clases: [] },
    MEDIO: { total: 0, clases: [] },
    ALTO:  { total: 0, clases: [] },
  };
  for (const { clase, valor } of items) {
    if (valor <= 0) continue;
    const r = CLASE_RISK[clase] ?? "BAJO";
    groups[r].total += valor;
    groups[r].clases.push({ clase, valor });
  }
  const grandTotal = Object.values(groups).reduce((s, g) => s + g.total, 0);
  return Object.entries(groups)
    .filter(([, g]) => g.total > 0)
    .map(([name, g]) => ({
      name,
      value: Math.round(g.total),
      grandTotal,
      clases: [...g.clases].sort((a, b) => b.valor - a.valor),
    }));
}

// Build actual risk pie from current PortfolioAsset[]
function buildAssetsRisk(assets: PortfolioAsset[]): PieSlice[] {
  const filtered  = assets.filter((a) => a.riesgo !== "ACTIVO FIJO");
  const grandTotal = filtered.reduce((s, a) => s + a.valorUSD, 0);
  const groups: Record<string, { total: number; clases: Record<string, number> }> = {
    BAJO:  { total: 0, clases: {} },
    MEDIO: { total: 0, clases: {} },
    ALTO:  { total: 0, clases: {} },
  };
  for (const a of filtered) {
    const r = a.riesgo || "BAJO";
    if (!groups[r]) continue;
    groups[r].total += a.valorUSD;
    groups[r].clases[a.clase] = (groups[r].clases[a.clase] ?? 0) + a.valorUSD;
  }
  return Object.entries(groups)
    .filter(([, g]) => g.total > 0)
    .map(([name, g]) => ({
      name,
      value: Math.round(g.total),
      grandTotal,
      clases: Object.entries(g.clases)
        .map(([clase, valor]) => ({ clase, valor: Math.round(valor) }))
        .sort((a, b) => b.valor - a.valor),
    }));
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: { value?: number }) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[180px]">
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="text-slate-500 mb-2 text-[10px]">Click para comparar vs actual</p>
      {[...payload].reverse().map((p: { dataKey: string; value?: number; fill: string; name: string }) =>
        (p.value ?? 0) > 0 ? (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-0.5">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.fill }} />
              <span className="text-slate-400">{p.name}</span>
            </span>
            <span className="font-semibold tabular-nums text-white">{fmtK(p.value ?? 0)}</span>
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry      = payload[0];
  const riesgo     = entry.name as string;
  const total      = entry.value as number;
  const grandTotal = entry.payload.grandTotal as number;
  const clases     = entry.payload.clases as { clase: string; valor: number }[];
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[180px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLORS[riesgo] }} />
        <span className="font-bold text-white">Riesgo {RISK_LABELS[riesgo] ?? riesgo}</span>
      </div>
      <p className="text-slate-400 mb-2 tabular-nums">
        {fmtK(total)} · {grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : 0}% s/AF
      </p>
      <div className="border-t border-surface-700 pt-2 space-y-0.5">
        {clases.map(({ clase, valor }) => (
          <div key={clase} className="flex justify-between gap-4">
            <span className="text-slate-400">{clase}</span>
            <span className="font-semibold text-white tabular-nums">
              {fmtK(valor)}{" "}
              <span className="text-slate-500">
                ({total > 0 ? ((valor / total) * 100).toFixed(0) : 0}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

function MiniPie({ data, label }: { data: PieSlice[]; label: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 text-center">
        {label}
      </p>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={72}
              innerRadius={28}
              dataKey="value"
              labelLine={false}
              label={PieLabel}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? "#888"} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<PieTooltipContent />} />
            <Legend
              formatter={(value) => (
                <span style={{ color: "#94a3b8", fontSize: 10 }}>
                  {RISK_LABELS[value as string] ?? value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[200px] flex items-center justify-center text-slate-600 text-xs">
          Sin datos
        </div>
      )}
    </div>
  );
}

// ── Select style ──────────────────────────────────────────────────────────────

const SELECT_CLS =
  "text-xs bg-surface-800 border border-surface-700 text-slate-300 rounded-lg px-2 py-1.5 " +
  "focus:outline-none focus:ring-1 focus:ring-brand-600";

// ── Main component ────────────────────────────────────────────────────────────

export function PatrimonioChart({ historia, assets }: Props) {
  const allLabels  = historia.map((r) => r.label);
  const currentRow = historia[historia.length - 1];

  const defaultFrom = allLabels[Math.max(0, allLabels.length - 12)];
  const defaultTo   = allLabels[allLabels.length - 1];

  const [fromLabel, setFromLabel] = useState(defaultFrom);
  const [toLabel,   setToLabel]   = useState(defaultTo);
  const [selected,  setSelected]  = useState<HistoriaRow | null>(null);

  const filtered = useMemo(() => {
    const fi = allLabels.indexOf(fromLabel);
    const ti = allLabels.indexOf(toLabel);
    if (fi < 0 || ti < 0 || fi > ti) return historia;
    return historia.slice(fi, ti + 1);
  }, [historia, fromLabel, toLabel, allLabels]);

  const activeBars = BARS.filter((b) =>
    historia.some((r) => (r[b.key] as number) > 0)
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function handleClick(data: any) {
    if (!data?.activePayload?.[0]) return;
    const row = data.activePayload[0].payload as HistoriaRow;
    // Don't compare current month with itself
    if (row.monthKey === currentRow?.monthKey) return;
    setSelected((prev) => (prev?.monthKey === row.monthKey ? null : row));
  }

  // Comparison computed values
  const varTotal    = selected && currentRow ? currentRow.total - selected.total : null;
  const varPctTotal = selected && currentRow && selected.total > 0
    ? ((currentRow.total - selected.total) / selected.total) * 100
    : null;
  const varSinAF    = selected && currentRow ? currentRow.totalSinAF - selected.totalSinAF : null;

  const selRisk = selected ? buildHistoriaRisk(selected) : null;
  const curRisk = buildAssetsRisk(assets);

  return (
    <div>
      {/* ── Period filter ── */}
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
        {selected && (
          <span className="ml-auto text-xs text-brand-400 font-medium animate-pulse">
            ↓ {selected.label} vs {currentRow?.label}
          </span>
        )}
      </div>

      {/* ── Bar chart ── */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={filtered}
          margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          barCategoryGap="20%"
          onClick={handleClick}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2235" vertical={false} />
          <XAxis
            dataKey="label"
            tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
              const isSelected = selected?.label === payload.value;
              return (
                <text
                  x={x} y={y + 10}
                  fill={isSelected ? "#60a5fa" : "#64748b"}
                  fontSize={isSelected ? 12 : 11}
                  fontWeight={isSelected ? "bold" : "normal"}
                  textAnchor="middle"
                >
                  {payload.value}
                </text>
              );
            }}
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
          <Tooltip content={<BarTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
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
              opacity={selected ? (filtered.find(r => r.label === selected.label) ? undefined : undefined) : undefined}
              radius={i === activeBars.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* ── Comparison panel ── */}
      {selected && currentRow && (
        <div className="mt-5 border border-brand-600/30 rounded-xl bg-surface-900/60 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-surface-700/60">
            <h3 className="text-sm font-bold text-white">
              Comparación:{" "}
              <span className="text-brand-400">{selected.label}</span>
              <span className="text-slate-500 mx-2">→</span>
              <span className="text-emerald-400">{currentRow.label}</span>
              <span className="text-slate-500 font-normal ml-1 text-xs">(actual)</span>
            </h3>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-500 hover:text-white transition-colors p-1 rounded"
            >
              <X size={14} />
            </button>
          </div>

          <div className="p-5">
            {/* ── KPI row ── */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-surface-800/60 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">{selected.label}</p>
                <p className="text-xl font-bold text-white tabular-nums">{fmtK(selected.total)}</p>
                <p className="text-[10px] text-slate-500 mt-1">s/AF: {fmtK(selected.totalSinAF)}</p>
              </div>

              <div className="bg-surface-800/60 rounded-lg p-3 text-center flex flex-col items-center justify-center gap-0.5">
                {varTotal !== null ? (
                  <>
                    {varTotal >= 0
                      ? <TrendingUp  size={16} className="text-emerald-400" />
                      : <TrendingDown size={16} className="text-rose-400" />
                    }
                    <p className={`text-xl font-bold tabular-nums ${varTotal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {fmtDiff(varTotal)}
                    </p>
                    {varPctTotal !== null && (
                      <p className={`text-xs font-semibold tabular-nums ${varTotal >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                        {fmtPct(varPctTotal)}
                      </p>
                    )}
                    {varSinAF !== null && (
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        s/AF: {fmtDiff(varSinAF)}
                      </p>
                    )}
                  </>
                ) : <span className="text-slate-600">—</span>}
              </div>

              <div className="bg-surface-800/60 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">
                  {currentRow.label} (actual)
                </p>
                <p className="text-xl font-bold text-white tabular-nums">{fmtK(currentRow.total)}</p>
                <p className="text-[10px] text-slate-500 mt-1">s/AF: {fmtK(currentRow.totalSinAF)}</p>
              </div>
            </div>

            {/* ── Per-clase breakdown ── */}
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                Variación por clase
              </p>
              <div className="space-y-2">
                {BARS.map((b) => {
                  const valSel = selected[b.key] as number;
                  const valCur = currentRow[b.key] as number;
                  if (valSel === 0 && valCur === 0) return null;
                  const diff    = valCur - valSel;
                  const diffPct = valSel > 0 ? ((diff / valSel) * 100) : null;
                  const maxVal  = Math.max(valSel, valCur);
                  return (
                    <div key={b.key} className="flex items-center gap-3 text-xs">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                        style={{ background: b.color }}
                      />
                      <span className="text-slate-400 w-24 flex-shrink-0">{b.label}</span>
                      {/* mini progress comparison */}
                      <div className="flex-1 flex items-center gap-2 min-w-0">
                        <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${maxVal > 0 ? (valCur / maxVal) * 100 : 0}%`,
                              background: b.color,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                      </div>
                      <span className="tabular-nums text-slate-400 w-14 text-right flex-shrink-0">
                        {valSel > 0 ? fmtK(valSel) : "—"}
                      </span>
                      <span className="text-slate-600 flex-shrink-0">→</span>
                      <span className="tabular-nums text-slate-300 w-14 text-right flex-shrink-0">
                        {valCur > 0 ? fmtK(valCur) : "—"}
                      </span>
                      <span className={`tabular-nums font-semibold w-16 text-right flex-shrink-0 ${
                        diff > 0 ? "text-emerald-400" : diff < 0 ? "text-rose-400" : "text-slate-500"
                      }`}>
                        {diff !== 0 ? fmtDiff(diff) : "="}
                      </span>
                      {diffPct !== null && (
                        <span className={`tabular-nums text-[10px] w-12 text-right flex-shrink-0 ${
                          diffPct >= 0 ? "text-emerald-400/70" : "text-rose-400/70"
                        }`}>
                          {fmtPct(diffPct, 0)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Pie charts ── */}
            <div className="grid grid-cols-2 gap-6">
              <MiniPie
                data={selRisk ?? []}
                label={`Riesgo s/AF — ${selected.label}`}
              />
              <MiniPie
                data={curRisk}
                label={`Riesgo s/AF — ${currentRow.label} (actual)`}
              />
            </div>

            <p className="text-[10px] text-slate-600 mt-3 text-center">
              * Perfil de riesgo histórico es aproximado (basado en clase de activo)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
