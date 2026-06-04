"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Legend,
} from "recharts";
import { useState } from "react";

// ── Shared helpers ────────────────────────────────────────────────────────────

function TopLabel({ x, y, width, value }: any) {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#e2e8f0">
      {value}
    </text>
  );
}

function InvLabel({ x, y, width, value }: any) {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="#fbbf24">
      ${Math.round(value).toLocaleString()}
    </text>
  );
}

function StackTopLabel({ x, y, width, value }: any) {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#e2e8f0">
      {value}
    </text>
  );
}

// Enhanced single-bar tooltip: shows value + cost + % of previous metric
function makeSingleTooltip(
  activeKey: string | null,
  invKey: string,
  invRaw: Map<string, number>,
  prevMap: Record<string, string> = {},
  showCostFor: Set<string> = new Set(),
) {
  return function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length || !activeKey) return null;
    const item = payload.find((p: any) => p.dataKey === activeKey);
    if (!item?.value) return null;

    // Investment bar: just show $ amount
    if (activeKey === invKey) {
      const inv = invRaw.get(label) ?? 0;
      if (!inv) return null;
      return (
        <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
          <p style={{ color: "#64748b", marginBottom: 4, fontSize: 11 }}>{label}</p>
          <p style={{ color: "#fbbf24", fontWeight: 600 }}>{item.name}: ${Math.round(inv).toLocaleString()}</p>
        </div>
      );
    }

    const value = item.value as number;
    const investment = invRaw.get(label) ?? 0;

    // Cost = investment / value
    const cost = showCostFor.has(activeKey) && investment > 0 && value > 0
      ? investment / value : null;

    // % of previous metric
    const prevKey = prevMap[activeKey];
    const prevItem = prevKey ? payload.find((p: any) => p.dataKey === prevKey) : null;
    const prevVal = prevItem?.value as number | undefined;
    const pct = prevVal && prevVal > 0 ? (value / prevVal) * 100 : null;

    return (
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 12, minWidth: 170 }}>
        <p style={{ color: "#64748b", marginBottom: 4, fontSize: 11 }}>{label}</p>
        <p style={{ color: item.color || "#e2e8f0", fontWeight: 600, marginBottom: (cost || pct) ? 5 : 0 }}>
          {item.name}: {value}
        </p>
        {pct !== null && (
          <p style={{ color: "#94a3b8", fontSize: 11 }}>
            📊 {pct.toFixed(1)}% de {prevItem?.name ?? prevKey}
          </p>
        )}
        {cost !== null && (
          <p style={{ color: "#fbbf24", fontSize: 11 }}>
            💰 Costo: ${Math.round(cost).toLocaleString()}
          </p>
        )}
      </div>
    );
  };
}

const AXIS_STYLE = { fill: "#64748b", fontSize: 11 };

// ── ADS IG Chart ──────────────────────────────────────────────────────────────

export type AdsIgPoint = {
  label: string;
  inversion: number;
  invScaled: number;
  tipoA: number;
  agendas: number;
  cierres: number;
};

const ADS_PREV_MAP: Record<string, string> = { agendas: "tipoA", cierres: "agendas" };
const ADS_COST_KEYS = new Set(["tipoA", "agendas", "cierres"]);

export function AdsIgBarChart({ data }: { data: AdsIgPoint[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const invMap = new Map(data.map((d) => [d.label, d.inversion]));

  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={makeSingleTooltip(activeKey, "invScaled", invMap, ADS_PREV_MAP, ADS_COST_KEYS)} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 6 }} />

        <Bar dataKey="invScaled" name="Inversión" fill="#92400e" radius={[3,3,0,0]}
          onMouseEnter={() => setActiveKey("invScaled")} onMouseLeave={() => setActiveKey(null)}>
          <LabelList content={InvLabel} />
        </Bar>
        <Bar dataKey="tipoA" name="Leads Tipo A" fill="#475569" radius={[3,3,0,0]}
          onMouseEnter={() => setActiveKey("tipoA")} onMouseLeave={() => setActiveKey(null)}>
          <LabelList content={TopLabel} />
        </Bar>
        <Bar dataKey="agendas" name="Agendas" fill="#3B82F6" radius={[3,3,0,0]}
          onMouseEnter={() => setActiveKey("agendas")} onMouseLeave={() => setActiveKey(null)}>
          <LabelList content={TopLabel} />
        </Bar>
        <Bar dataKey="cierres" name="Cierres" fill="#10B981" radius={[3,3,0,0]}
          onMouseEnter={() => setActiveKey("cierres")} onMouseLeave={() => setActiveKey(null)}>
          <LabelList content={TopLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── FMA Chart (stacked per strategy) ─────────────────────────────────────────

export type FmaPoint = {
  label: string;
  inversion: number;
  invScaled: number;
  outboundAg: number; outboundCc: number;
  historiasAg: number; historiasCc: number;
  comentariosAg: number; comentariosCc: number;
  organicoAg: number; organicoCc: number;
  totalAg: number; totalCc: number;
};

const FMA_BARS = [
  { key: "outboundAg",    name: "Outbound ag.",    color: "#3B82F6", stack: "ag" },
  { key: "historiasAg",   name: "Historias ag.",   color: "#8B5CF6", stack: "ag" },
  { key: "comentariosAg", name: "Comentarios ag.", color: "#EC4899", stack: "ag" },
  { key: "organicoAg",    name: "Orgánico ag.",    color: "#10B981", stack: "ag" },
  { key: "outboundCc",    name: "Outbound cc.",    color: "#1D4ED8", stack: "cc" },
  { key: "historiasCc",   name: "Historias cc.",   color: "#6D28D9", stack: "cc" },
  { key: "comentariosCc", name: "Comentarios cc.", color: "#BE185D", stack: "cc" },
  { key: "organicoCc",    name: "Orgánico cc.",    color: "#065F46", stack: "cc" },
] as const;

const FMA_PREV_MAP: Record<string, string> = {
  outboundCc: "outboundAg", historiasCc: "historiasAg",
  comentariosCc: "comentariosAg", organicoCc: "organicoAg",
};

export function FmaBarChart({ data }: { data: FmaPoint[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const invMap = new Map(data.map((d) => [d.label, d.inversion]));

  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={makeSingleTooltip(activeKey, "invScaled", invMap, FMA_PREV_MAP)} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 10, color: "#64748b", paddingTop: 6 }} />

        <Bar dataKey="invScaled" name="Inversión FMA" fill="#92400e" radius={[3,3,0,0]}
          onMouseEnter={() => setActiveKey("invScaled")} onMouseLeave={() => setActiveKey(null)}>
          <LabelList content={InvLabel} />
        </Bar>

        {FMA_BARS.map(({ key, name, color, stack }) => (
          <Bar key={key} dataKey={key} name={name} fill={color} stackId={stack}
            radius={key === "organicoAg" || key === "organicoCc" ? [3,3,0,0] : undefined}
            onMouseEnter={() => setActiveKey(key)} onMouseLeave={() => setActiveKey(null)}>
            {(key === "organicoAg") && <LabelList dataKey="totalAg" content={StackTopLabel} />}
            {(key === "organicoCc") && <LabelList dataKey="totalCc" content={StackTopLabel} />}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Total General Chart ───────────────────────────────────────────────────────

export type TotalGeneralPoint = {
  label: string;
  inversion: number;
  invScaled: number;
  agendas: number;
  cierres: number;
};

const TOT_PREV_MAP: Record<string, string> = { cierres: "agendas" };
const TOT_COST_KEYS = new Set(["agendas", "cierres"]);

export function TotalGeneralBarChart({ data }: { data: TotalGeneralPoint[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const invMap = new Map(data.map((d) => [d.label, d.inversion]));

  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={28} />
        <Tooltip content={makeSingleTooltip(activeKey, "invScaled", invMap, TOT_PREV_MAP, TOT_COST_KEYS)} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 6 }} />

        <Bar dataKey="invScaled" name="Inversión" fill="#92400e" radius={[3,3,0,0]}
          onMouseEnter={() => setActiveKey("invScaled")} onMouseLeave={() => setActiveKey(null)}>
          <LabelList content={InvLabel} />
        </Bar>
        <Bar dataKey="agendas" name="Agendas" fill="#3B82F6" radius={[3,3,0,0]}
          onMouseEnter={() => setActiveKey("agendas")} onMouseLeave={() => setActiveKey(null)}>
          <LabelList content={TopLabel} />
        </Bar>
        <Bar dataKey="cierres" name="Confirmados" fill="#10B981" radius={[3,3,0,0]}
          onMouseEnter={() => setActiveKey("cierres")} onMouseLeave={() => setActiveKey(null)}>
          <LabelList content={TopLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
