"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Legend,
} from "recharts";

// ── Label renderers ───────────────────────────────────────────────────────────

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

const TOOLTIP_STYLE = {
  contentStyle: { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e2e8f0" },
  itemStyle: { color: "#94a3b8" },
};

// ── ADS IG Chart ──────────────────────────────────────────────────────────────

export type AdsIgPoint = {
  label: string;
  inversion: number;     // raw $
  invScaled: number;     // inversion / 100
  tipoA: number;
  agendas: number;
  cierres: number;
};

export function AdsIgBarChart({ data }: { data: AdsIgPoint[] }) {
  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(val: any, name: string) =>
          name === "Inversión" ? [`$${Math.round(val * 100).toLocaleString()}`, name] : [val, name]
        } />
        <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 6 }} />

        <Bar dataKey="invScaled" name="Inversión" fill="#92400e" radius={[3,3,0,0]}>
          <LabelList content={InvLabel} />
        </Bar>
        <Bar dataKey="tipoA" name="Leads Tipo A" fill="#475569" radius={[3,3,0,0]}>
          <LabelList content={TopLabel} />
        </Bar>
        <Bar dataKey="agendas" name="Agendas" fill="#3B82F6" radius={[3,3,0,0]}>
          <LabelList content={TopLabel} />
        </Bar>
        <Bar dataKey="cierres" name="Cierres" fill="#10B981" radius={[3,3,0,0]}>
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

// Invisible bar used only to render a top-of-stack label
function StackTopLabel({ x, y, width, value }: any) {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill="#e2e8f0">
      {value}
    </text>
  );
}

export function FmaBarChart({ data }: { data: FmaPoint[] }) {
  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(val: any, name: string) =>
          name === "Inversión FMA" ? [`$${Math.round(val * 100).toLocaleString()}`, name] : [val, name]
        } />
        <Legend wrapperStyle={{ fontSize: 10, color: "#64748b", paddingTop: 6 }} />

        {/* Investment */}
        <Bar dataKey="invScaled" name="Inversión FMA" fill="#92400e" radius={[3,3,0,0]}>
          <LabelList content={InvLabel} />
        </Bar>

        {/* Agendas — stacked */}
        <Bar dataKey="outboundAg"    stackId="ag" name="Outbound ag."    fill="#3B82F6" />
        <Bar dataKey="historiasAg"   stackId="ag" name="Historias ag."   fill="#8B5CF6" />
        <Bar dataKey="comentariosAg" stackId="ag" name="Comentarios ag." fill="#EC4899" />
        <Bar dataKey="organicoAg"    stackId="ag" name="Orgánico ag."    fill="#10B981" radius={[3,3,0,0]}>
          <LabelList dataKey="totalAg" content={StackTopLabel} />
        </Bar>

        {/* Cierres — stacked */}
        <Bar dataKey="outboundCc"    stackId="cc" name="Outbound cc."    fill="#1D4ED8" />
        <Bar dataKey="historiasCc"   stackId="cc" name="Historias cc."   fill="#6D28D9" />
        <Bar dataKey="comentariosCc" stackId="cc" name="Comentarios cc." fill="#BE185D" />
        <Bar dataKey="organicoCc"    stackId="cc" name="Orgánico cc."    fill="#065F46" radius={[3,3,0,0]}>
          <LabelList dataKey="totalCc" content={StackTopLabel} />
        </Bar>
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

export function TotalGeneralBarChart({ data }: { data: TotalGeneralPoint[] }) {
  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(val: any, name: string) =>
          name === "Inversión" ? [`$${Math.round(val * 100).toLocaleString()}`, name] : [val, name]
        } />
        <Legend wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 6 }} />

        <Bar dataKey="invScaled" name="Inversión" fill="#92400e" radius={[3,3,0,0]}>
          <LabelList content={InvLabel} />
        </Bar>
        <Bar dataKey="agendas" name="Agendas" fill="#3B82F6" radius={[3,3,0,0]}>
          <LabelList content={TopLabel} />
        </Bar>
        <Bar dataKey="cierres" name="Confirmados" fill="#10B981" radius={[3,3,0,0]}>
          <LabelList content={TopLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
