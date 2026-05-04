"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { PortfolioAsset, PatrimonioClase } from "@/lib/sheets";

interface Props {
  assets: PortfolioAsset[];
}

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

function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry  = payload[0];
  const riesgo = entry.name as string;
  const total  = entry.value as number;
  const claseBreakdown = entry.payload.clases as { clase: string; valor: number }[];
  const grandTotal     = entry.payload.grandTotal as number;

  return (
    <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2.5 text-xs shadow-xl min-w-[190px]">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: RISK_COLORS[riesgo] }} />
        <span className="font-bold text-white">Riesgo {RISK_LABELS[riesgo] ?? riesgo}</span>
      </div>
      <p className="text-slate-400 mb-2 tabular-nums">
        {fmtK(total)} · {grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : 0}% del portafolio s/AF
      </p>
      <div className="border-t border-surface-700 pt-2 space-y-0.5">
        {claseBreakdown.map(({ clase, valor }) => (
          <div key={clase} className="flex justify-between gap-4">
            <span className="text-slate-400">{clase}</span>
            <span className="font-semibold text-white tabular-nums">
              {fmtK(valor)} <span className="text-slate-500">({total > 0 ? ((valor / total) * 100).toFixed(0) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
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

export function RiskPieChart({ assets }: Props) {
  // Exclude activo fijo
  const filtered = assets.filter((a) => a.riesgo !== "ACTIVO FIJO");
  const grandTotal = filtered.reduce((s, a) => s + a.valorUSD, 0);

  // Group by riesgo
  const byRiesgo: Record<string, { total: number; clases: Record<PatrimonioClase, number> }> = {};
  for (const a of filtered) {
    const r = a.riesgo || "BAJO";
    if (!byRiesgo[r]) byRiesgo[r] = { total: 0, clases: {} as Record<PatrimonioClase, number> };
    byRiesgo[r].total += a.valorUSD;
    byRiesgo[r].clases[a.clase] = (byRiesgo[r].clases[a.clase] ?? 0) + a.valorUSD;
  }

  const ORDER = ["BAJO", "MEDIO", "ALTO"];
  const data = ORDER.filter((r) => byRiesgo[r]).map((r) => ({
    name:       r,
    value:      Math.round(byRiesgo[r].total),
    grandTotal,
    clases:     Object.entries(byRiesgo[r].clases)
      .map(([clase, valor]) => ({ clase, valor: Math.round(valor) }))
      .sort((a, b) => b.valor - a.valor),
  }));

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
        Perfil de riesgo s/AF
      </p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={40}
            dataKey="value"
            labelLine={false}
            label={CustomLabel}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={RISK_COLORS[entry.name] ?? "#888"} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => (
              <span style={{ color: "#94a3b8", fontSize: 11 }}>
                {RISK_LABELS[value] ?? value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
