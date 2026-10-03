"use client";

import { useState } from "react";
import type { PortfolioAsset } from "@/lib/sheets";

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function PatrimonioTabla({ assets, totalPatrimonio }: { assets: PortfolioAsset[]; totalPatrimonio: number }) {
  const [claseFilter, setClaseFilter] = useState<string>("");

  const clases = [...new Set(assets.map((a) => a.clase))].sort();
  const filtered = claseFilter ? assets.filter((a) => a.clase === claseFilter) : assets;
  const filteredTotal = filtered.reduce((s, a) => s + a.valorUSD, 0);

  return (
    <div className="card mb-8">
      {/* Filtro por clase */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setClaseFilter("")}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            claseFilter === ""
              ? "bg-brand-600 border-brand-500 text-white font-semibold"
              : "border-surface-600 text-slate-400 hover:text-slate-200 hover:border-slate-500"
          }`}
        >
          Todos
        </button>
        {clases.map((c) => (
          <button
            key={c}
            onClick={() => setClaseFilter(claseFilter === c ? "" : c)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              claseFilter === c
                ? "bg-brand-600 border-brand-500 text-white font-semibold"
                : "border-surface-600 text-slate-400 hover:text-slate-200 hover:border-slate-500"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700">
              {["Activo", "Clase", "Moneda", "Cantidad", "Precio", "Valor USD", "% Total", "Riesgo", "País"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered
              .sort((a, b) => b.valorUSD - a.valorUSD)
              .map((a, i) => (
                <tr key={i} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                  <td className="px-3 py-2 font-medium text-white">{a.activo}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs">{a.clase}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs text-center">{a.moneda}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">
                    {a.cantidad > 0 ? a.cantidad.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">
                    {a.precioUSD > 1 ? usd(a.precioUSD) : a.precioUSD > 0 ? a.precioUSD.toFixed(4) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-semibold text-white text-right">{usd(a.valorUSD)}</td>
                  <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">{pct(a.pctTotal)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                      a.riesgo === "ALTO" ? "text-rose-400"
                      : a.riesgo === "ACTIVO FIJO" ? "text-slate-500"
                      : a.riesgo === "MEDIO" ? "text-amber-400"
                      : "text-emerald-400"
                    }`}>{a.riesgo}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-xs text-center">{a.pais || "—"}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-surface-600/60 bg-surface-800/40">
              <td className="px-3 py-2.5 font-bold text-white" colSpan={5}>
                {claseFilter ? claseFilter : "Total"}
              </td>
              <td className="px-3 py-2.5 font-bold tabular-nums text-white text-right">{usd(filteredTotal)}</td>
              <td className="px-3 py-2.5 font-bold text-white text-right text-xs">
                {claseFilter ? `${((filteredTotal / totalPatrimonio) * 100).toFixed(1)}%` : "100%"}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
