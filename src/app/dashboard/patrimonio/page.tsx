import {
  getPatrimonioPortfolio,
  getPatrimonioHistoria,
  type PortfolioAsset,
  type PatrimonioClase,
} from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { PatrimonioChart } from "@/components/patrimonio/PatrimonioChart";
import { RiskPieChart } from "@/components/patrimonio/RiskPieChart";

export const revalidate = 0;

// ── helpers ───────────────────────────────────────────────────────────────────

function usd(n: number, decimals = 0): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function claseSum(assets: PortfolioAsset[], clase: PatrimonioClase): number {
  return assets.filter((a) => a.clase === clase).reduce((s, a) => s + a.valorUSD, 0);
}

function riskProfile(assets: PortfolioAsset[]): { label: string; desc: string; color: string } {
  const total = assets.reduce((s, a) => s + a.valorUSD, 0);
  if (!total) return { label: "—", desc: "", color: "text-slate-400" };
  const p = (c: PatrimonioClase) => (claseSum(assets, c) / total) * 100;
  const cryptoPct    = p("Crypto");
  const cashPct      = p("Cash");
  const accionesPct  = p("Acciones");
  if (cryptoPct > 25)
    return { label: "Agresivo", desc: `${cryptoPct.toFixed(0)}% en Crypto`, color: "text-rose-400" };
  if (cashPct > 50)
    return { label: "Conservador", desc: `${cashPct.toFixed(0)}% en Cash`, color: "text-emerald-400" };
  if (cashPct < 25 && accionesPct > 35)
    return { label: "Dinámico", desc: `${accionesPct.toFixed(0)}% en Acciones`, color: "text-brand-400" };
  return { label: "Moderado", desc: "Cartera balanceada", color: "text-amber-400" };
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function PatrimonioPage() {
  const [assets, historia] = await Promise.all([
    getPatrimonioPortfolio(),
    getPatrimonioHistoria(),
  ]);

  const totalPatrimonio = assets.reduce((s, a) => s + a.valorUSD, 0);
  const totalSinAF = assets
    .filter((a) => a.clase !== "Real Estate Propio")
    .reduce((s, a) => s + a.valorUSD, 0);

  // Last month variation (from Historia)
  const lastHist = historia[historia.length - 1] ?? null;
  const varUSD   = lastHist?.varUSD  ?? null;
  const varPct   = lastHist?.varPct  ?? null;

  const profile  = riskProfile(assets);

  // Distribution by clase
  const CLASES: { key: PatrimonioClase; label: string }[] = [
    { key: "Cash",                  label: "Cash" },
    { key: "Acciones",              label: "Acciones" },
    { key: "Crypto",                label: "Crypto" },
    { key: "Real Estate Propio",    label: "RE Propio (AF)" },
    { key: "Real Estate Inversión", label: "RE Inversión" },
    { key: "Crédito Dado",          label: "Crédito Dado" },
  ];

  // Historia: last 12 months (reversed so newest first)
  const hist12 = historia.slice(-12).reverse();

  return (
    <div>
      <PageHeader title="Patrimonio" description="Portfolio · Evolución · Distribución" />

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Total patrimonio</p>
          <p className="text-2xl font-bold text-white tabular-nums">{usd(totalPatrimonio)}</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Total s/AF</p>
          <p className="text-2xl font-bold text-white tabular-nums">{usd(totalSinAF)}</p>
          <p className="text-xs text-slate-600 mt-1">sin inmueble propio</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Var. mensual</p>
          {varUSD !== null ? (
            <>
              <p className={`text-2xl font-bold tabular-nums ${varUSD >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {varUSD >= 0 ? "+" : ""}{usd(varUSD)}
              </p>
              {varPct !== null && (
                <p className={`text-xs mt-1 font-semibold ${varUSD >= 0 ? "text-emerald-400/70" : "text-rose-400/70"}`}>
                  {varUSD >= 0 ? "▲" : "▼"} {Math.abs(varPct * 100).toFixed(1)}%
                </p>
              )}
            </>
          ) : (
            <p className="text-2xl font-bold text-slate-500">—</p>
          )}
        </div>
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Perfil de riesgo</p>
          <p className={`text-2xl font-bold ${profile.color}`}>{profile.label}</p>
          <p className="text-xs text-slate-600 mt-1">{profile.desc}</p>
        </div>
      </div>

      {/* ── Distribución + Riesgo ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Distribución</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">

        {/* Left: distribution by clase */}
        <div className="card">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Por clase de activo</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Clase", "Valor", "% Total", "% s/AF"].map((h) => (
                  <th key={h} className="pb-2 text-xs font-semibold text-slate-600 uppercase text-left last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLASES.map(({ key, label }) => {
                const valor  = claseSum(assets, key);
                if (valor === 0) return null;
                const pTot   = totalPatrimonio > 0 ? (valor / totalPatrimonio) * 100 : 0;
                const pSinAF = key !== "Real Estate Propio" && totalSinAF > 0
                  ? (valor / totalSinAF) * 100 : null;
                return (
                  <tr key={key} className="border-b border-surface-800/40">
                    <td className="py-2.5 font-medium text-white text-sm">{label}</td>
                    <td className="py-2.5 tabular-nums text-slate-300 font-semibold">{usd(valor)}</td>
                    <td className="py-2.5 tabular-nums text-slate-400 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-700/60">
                          <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.min(pTot, 100).toFixed(1)}%` }} />
                        </div>
                        {pTot.toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-2.5 tabular-nums text-slate-500 text-xs text-right">
                      {pSinAF !== null ? `${pSinAF.toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-600/60">
                <td className="pt-2.5 font-bold text-white">Total</td>
                <td className="pt-2.5 font-bold text-white tabular-nums">{usd(totalPatrimonio)}</td>
                <td className="pt-2.5 text-xs text-slate-500">100%</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Right: risk pie chart */}
        <div className="card flex flex-col justify-center">
          <RiskPieChart assets={assets} />
        </div>

      </div>

      {/* ── Gráfico de evolución ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Evolución histórica</h2>
      <div className="card mb-8">
        <PatrimonioChart historia={historia} />
      </div>

      {/* ── Detalle de activos ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Composición actual</h2>
      <div className="card mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Activo", "Clase", "Moneda", "Cantidad", "Precio", "Valor USD", "% Total", "Riesgo", "Liquidez"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase text-left first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets
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
                    <td className="px-3 py-2 tabular-nums font-semibold text-white text-right">
                      {usd(a.valorUSD)}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">
                      {pct(a.pctTotal)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                        a.riesgo === "ALTO"
                          ? "text-rose-400"
                          : a.riesgo === "ACTIVO FIJO"
                          ? "text-slate-500"
                          : a.riesgo === "MEDIO"
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}>{a.riesgo}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-400 text-xs text-center">{a.liquidez}</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-600/60 bg-surface-800/40">
                <td className="px-3 py-2.5 font-bold text-white" colSpan={5}>Total</td>
                <td className="px-3 py-2.5 font-bold tabular-nums text-white text-right">{usd(totalPatrimonio)}</td>
                <td className="px-3 py-2.5 font-bold text-white text-right text-xs">100%</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Evolución mensual ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        Evolución mensual
        <span className="ml-2 normal-case font-normal text-slate-600">(últimos 12 meses)</span>
      </h2>
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Mes", "Total", "s/AF", "Cash", "Acciones", "Crypto", "RE Inv.", "Var. $", "Var. %"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase text-right first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hist12.map((row, i) => {
                const isLatest = i === 0;
                return (
                  <tr key={row.monthKey} className={`border-b border-surface-800/50 hover:bg-surface-800/30 ${isLatest ? "bg-surface-800/20" : ""}`}>
                    <td className={`px-3 py-2 font-semibold tabular-nums ${isLatest ? "text-white" : "text-slate-400"}`}>
                      {row.label}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-semibold text-white text-right">{usd(row.total)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">{usd(row.totalSinAF)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">{usd(row.cash)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">{usd(row.acciones)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">{usd(row.crypto)}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-400 text-right text-xs">
                      {row.reInversion > 0 ? usd(row.reInversion) : "—"}
                    </td>
                    <td className={`px-3 py-2 tabular-nums text-right font-semibold text-xs ${
                      row.varUSD === null ? "text-slate-600"
                        : row.varUSD >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {row.varUSD === null ? "—" : `${row.varUSD >= 0 ? "+" : ""}${usd(row.varUSD)}`}
                    </td>
                    <td className={`px-3 py-2 tabular-nums text-right font-semibold text-xs ${
                      row.varPct === null ? "text-slate-600"
                        : row.varPct >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {row.varPct === null ? "—"
                        : `${row.varPct >= 0 ? "▲" : "▼"} ${Math.abs(row.varPct * 100).toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
