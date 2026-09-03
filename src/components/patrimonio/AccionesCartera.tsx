"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { PortfolioAsset } from "@/lib/sheets";

const PAIS_COLORS: Record<string, string> = {
  "EEUU":             "#22c55e",
  "Argentina":        "#38bdf8",
  "Crypto":           "#eab308",
  "Resto del Mundo":  "#8b5cf6",
  "Europa":           "#f97316",
  "Brasil":           "#f43f5e",
  "Global":           "#22d3ee",
  "CSPX":             "#a78bfa",
};
const FALLBACK_COLORS = ["#64748b", "#94a3b8", "#475569", "#334155", "#1e293b"];

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <p style={{ color: d.payload.color ?? "#e2e8f0", fontWeight: 600 }}>{d.name}</p>
      <p style={{ color: "#94a3b8" }}>
        {usd(d.value)} · <strong style={{ color: "#e2e8f0" }}>{d.payload.pct.toFixed(1)}%</strong>
      </p>
    </div>
  );
}

export function AccionesCartera({ assets }: { assets: PortfolioAsset[] }) {
  const [openPais, setOpenPais] = useState<string | null>(null);

  const rentaVariable = assets.filter((a) => a.clase === "Acciones" || a.clase === "Crypto");
  if (!rentaVariable.length) return null;

  const totalRV = rentaVariable.reduce((s, a) => s + a.valorUSD, 0);

  // Group Acciones by pais, Crypto as its own group
  const byPais = new Map<string, PortfolioAsset[]>();
  for (const a of rentaVariable) {
    const key = a.clase === "Crypto" ? "Crypto" : (a.pais.trim() || "Sin clasificar");
    if (!byPais.has(key)) byPais.set(key, []);
    byPais.get(key)!.push(a);
  }
  const totalAcciones = rentaVariable.filter((a) => a.clase === "Acciones").reduce((s, a) => s + a.valorUSD, 0);

  // Sort by total desc
  const grupos = [...byPais.entries()]
    .map(([pais, items]) => ({
      pais,
      isCrypto: pais === "Crypto",
      items: items.sort((a, b) => b.valorUSD - a.valorUSD),
      total: items.reduce((s, a) => s + a.valorUSD, 0),
    }))
    .sort((a, b) => b.total - a.total);

  // Pie data
  let fallbackIdx = 0;
  const pieData = grupos.map((g) => ({
    name: g.pais,
    value: g.total,
    pct: totalRV > 0 ? (g.total / totalRV) * 100 : 0,
    color: PAIS_COLORS[g.pais] ?? FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length],
  }));

  return (
    <div className="card mb-8">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: expandable country rows */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Renta Variable + Crypto — {usd(totalRV)} total
            </p>
            <span className="text-[10px] text-slate-600">
              Acciones {usd(totalAcciones)} · Crypto {usd(totalRV - totalAcciones)}
            </span>
          </div>
          <div className="space-y-1">
            {grupos.map((g) => {
              const color = PAIS_COLORS[g.pais] ?? "#64748b";
              const pct   = totalRV > 0 ? (g.total / totalRV) * 100 : 0;
              const isOpen = openPais === g.pais;
              return (
                <div key={g.pais}>
                  {/* Country header row */}
                  <button
                    onClick={() => setOpenPais(isOpen ? null : g.pais)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-800/50 transition-colors text-left"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="flex-1 font-semibold text-white text-sm">{g.pais}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{g.items.length} activo{g.items.length !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-slate-400 tabular-nums w-14 text-right">{pct.toFixed(1)}%</span>
                    <span className="font-semibold tabular-nums text-white text-sm w-24 text-right">{usd(g.total)}</span>
                    <span className={`ml-1 text-slate-500 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                  </button>

                  {/* Expanded stock list */}
                  {isOpen && (
                    <div className="ml-5 mb-1 border-l-2 border-surface-700/50 pl-3">
                      <table className="w-full text-xs mt-1">
                        <thead>
                          <tr className="border-b border-surface-700/40">
                            {["Activo", "Moneda", "Cantidad", "Precio", "Valor USD", "% RV"].map((h) => (
                              <th key={h} className="pb-1.5 text-[10px] font-semibold text-slate-600 uppercase text-right first:text-left">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map((a, i) => {
                            const pctAcc = totalRV > 0 ? (a.valorUSD / totalRV) * 100 : 0;
                            return (
                              <tr key={i} className="border-b border-surface-800/30">
                                <td className="py-1.5 font-medium text-slate-300">{a.activo}</td>
                                <td className="py-1.5 text-right text-slate-500">{a.moneda}</td>
                                <td className="py-1.5 text-right tabular-nums text-slate-400">
                                  {a.cantidad > 0 ? a.cantidad.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
                                </td>
                                <td className="py-1.5 text-right tabular-nums text-slate-400">
                                  {a.precioUSD > 1 ? usd(a.precioUSD) : a.precioUSD > 0 ? `$${a.precioUSD.toFixed(4)}` : "—"}
                                </td>
                                <td className="py-1.5 text-right tabular-nums font-semibold text-white">{usd(a.valorUSD)}</td>
                                <td className="py-1.5 text-right tabular-nums text-slate-500">{pctAcc.toFixed(1)}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: pie chart */}
        <div className="w-full lg:w-64 flex flex-col items-center justify-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Por país</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{value}</span>}
                iconType="circle"
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
