"use client";

import { useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

type Point = { label: string; ccSpa: number; crPct: number };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const cc  = payload.find((p: any) => p.dataKey === "ccSpa");
  const pct = payload.find((p: any) => p.dataKey === "crPct");
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: "#64748b", marginBottom: 6, fontSize: 11 }}>{label}</p>
      {cc  && <p style={{ color: "#94a3b8" }}>Cierres: <strong style={{ color: "#10b981" }}>{cc.value}</strong></p>}
      {pct && <p style={{ color: "#94a3b8" }}>CR%: <strong style={{ color: "#a78bfa" }}>{Number(pct.value).toFixed(1)}%</strong></p>}
    </div>
  );
}

export function CanalHistoryChart({
  data, canales,
}: {
  data: Record<string, Point[]>;
  canales: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(canales[0] ?? "");
  if (!canales.length) return null;

  const points = data[selected] ?? [];

  return (
    <div className="mt-4 pt-3 border-t border-surface-700/30">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
      >
        <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▼</span>
        {open ? "Ocultar evolución histórica" : "Ver evolución por canal (6 meses)"}
      </button>
      {open && (
        <div className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Canal:</label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="text-sm bg-surface-800 border border-surface-700 text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
            >
              {canales.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={points} margin={{ top: 8, right: 24, left: 0, bottom: 0 }} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#a78bfa", fontSize: 11 }} axisLine={false} tickLine={false} width={34} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar yAxisId="left" dataKey="ccSpa" name="Cierres" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" dataKey="crPct" name="CR%" type="monotone" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3, fill: "#a78bfa" }} activeDot={{ r: 5 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
