import {
  getVentasReuniones, getMarketingVSL, getMarketingMsgIG, getMarketingFMA,
  isClosedStatus, parseUSD, parseNumES, formatARS,
} from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesPeriodPicker } from "@/components/ui/SalesPeriodPicker";
import { AlertTriangle } from "lucide-react";

export const revalidate = 0;

// ── helpers ───────────────────────────────────────────────────────────────────

function inDateRange(dateStr: string, from: string, to: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.trim().split("/");
  if (parts.length < 2) return false;
  let day = parseInt(parts[0]), month = parseInt(parts[1]) - 1;
  let year = parts.length === 3 ? parseInt(parts[2]) : new Date().getFullYear();
  if (year < 100) year += 2000;
  const d = new Date(year, month, day);
  return d >= new Date(from) && d <= new Date(to + "T23:59:59");
}

function prevRange(from: string, to: string) {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to   + "T00:00:00");

  // Full month? (from = 1st, to = last day, same month/year)
  const lastDayOfMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const isFullMonth =
    f.getDate() === 1 &&
    t.getDate() === lastDayOfMonth &&
    f.getMonth() === t.getMonth() &&
    f.getFullYear() === t.getFullYear();

  if (isFullMonth) {
    // prev month: works even when f.getMonth()===0 (Jan→Dec prev year)
    const pStart = new Date(f.getFullYear(), f.getMonth() - 1, 1);
    const pEnd   = new Date(f.getFullYear(), f.getMonth(),     0); // day 0 = last of prev month
    return { from: pStart.toISOString().split("T")[0], to: pEnd.toISOString().split("T")[0] };
  }

  // Full year? (Jan 1 → Dec 31, same year)
  const isFullYear =
    f.getMonth() === 0 && f.getDate() === 1 &&
    t.getMonth() === 11 && t.getDate() === 31 &&
    f.getFullYear() === t.getFullYear();

  if (isFullYear) {
    const y = f.getFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }

  // Custom / partial range: same number of days immediately before
  const days   = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const prevTo = new Date(f); prevTo.setDate(f.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevTo.getDate() - days + 1);
  return { from: prevFrom.toISOString().split("T")[0], to: prevTo.toISOString().split("T")[0] };
}

function defaultRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: from.toISOString().split("T")[0], to: today.toISOString().split("T")[0] };
}

function pct(n: number, total: number, decimals = 1) {
  return total > 0 ? ((n / total) * 100).toFixed(decimals) + "%" : "—";
}

function diffArrow(curr: number, prev: number, lowerIsBetter = false) {
  if (prev === 0 || curr === 0) return null;
  const d = ((curr - prev) / prev) * 100;
  if (Math.abs(d) < 1) return null;
  const good = lowerIsBetter ? d < 0 : d > 0;
  return { good, text: `${d > 0 ? "+" : ""}${d.toFixed(0)}%` };
}

const FMA_CANALES = ["Outbound", "Organico", "Comentarios", "Link Perfil", "VSL Insta"];
const isFMA = (canal: string) => FMA_CANALES.some((c) => canal.toLowerCase().includes(c.toLowerCase()));
const CLOSERS = ["Agus", "Foli", "Santi", "Pit", "Joan"];

function closingStats(rows: Record<string, string>[]) {
  const total        = rows.length;
  const noPres       = rows.filter((r) => r["Status"].toLowerCase().includes("no presentado")).length;
  const cancelados   = rows.filter((r) => r["Status"].toLowerCase() === "cancelado").length;
  const noShow       = rows.filter((r) => r["Status"].toLowerCase().includes("no show")).length;
  const sena         = rows.filter((r) => r["Status"].toLowerCase() === "seña hecha").length;
  const ccSpa        = rows.filter((r) => isClosedStatus(r["Status"])).length;
  const downsell     = rows.filter((r) => r["Status"].toLowerCase().includes("downsell")).length;
  const efectivas    = total - noPres - noShow - cancelados;
  const cerradosRows = rows.filter((r) => isClosedStatus(r["Status"]) || r["Status"].toLowerCase().includes("downsell"));
  const facturacion  = cerradosRows.reduce((s, r) => s + parseNumES(r["Facturacion"] ?? ""), 0);
  const cashLlamada  = cerradosRows.reduce((s, r) => s + parseNumES(r["Cash Collected"] ?? ""), 0);
  return { total, noPres, cancelados, noShow, sena, efectivas, ccSpa, downsell, facturacion, cashLlamada };
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range  = sp.from && sp.to ? { from: sp.from, to: sp.to } : defaultRange();
  const prev   = prevRange(range.from, range.to);

  const [reunionesRaw, vslData, igData, fmaData] = await Promise.all([
    getVentasReuniones(),
    getMarketingVSL(),
    getMarketingMsgIG(),
    getMarketingFMA(),
  ]);

  // ── gastos por período ──
  function gastosPeriodo(f: string, t: string) {
    const vsl = vslData.filter((r) => inDateRange(r["Fecha"] ?? "", f, t)).reduce((s, r) => s + parseUSD(r["Gasto"] ?? ""), 0);
    const ig  = igData .filter((r) => inDateRange(r["Fecha"] ?? "", f, t)).reduce((s, r) => s + parseUSD(r["$"]    ?? ""), 0);
    const fma = fmaData.filter((r) => inDateRange(r["Fecha"] ?? "", f, t)).reduce((s, r) => s + parseUSD(r["$"]    ?? ""), 0);
    return { vsl, ig, fma, total: vsl + ig + fma };
  }

  // ── agendas (col K) ──
  function agendasPeriodo(f: string, t: string) {
    const all  = reunionesRaw.filter((r) => r["Prospecto"] && inDateRange(r["Fecha de la agenda"], f, t));
    const vsl  = all.filter((r) => r["Canal"] === "Publi a VSL");
    const ig   = all.filter((r) => r["Canal"] === "ADS Mje IG");
    const fma  = all.filter((r) => isFMA(r["Canal"]));
    const otras = all.filter((r) => r["Canal"] !== "Publi a VSL" && r["Canal"] !== "ADS Mje IG" && !isFMA(r["Canal"]));
    return { all, vsl, ig, fma, otras };
  }

  const gastos     = gastosPeriodo(range.from, range.to);
  const gastosPrev = gastosPeriodo(prev.from, prev.to);
  const agendas    = agendasPeriodo(range.from, range.to);
  const agendasPrev = agendasPeriodo(prev.from, prev.to);

  const cpa = (gasto: number, ag: number) => ag > 0 && gasto > 0 ? gasto / ag : null;
  const cpaCurr = {
    vsl:   cpa(gastos.vsl,   agendas.vsl.length),
    ig:    cpa(gastos.ig,    agendas.ig.length),
    fma:   cpa(gastos.fma,   agendas.fma.length),
    total: cpa(gastos.total, agendas.all.length),
  };
  const cpaPrev = {
    vsl:   cpa(gastosPrev.vsl,   agendasPrev.vsl.length),
    ig:    cpa(gastosPrev.ig,    agendasPrev.ig.length),
    fma:   cpa(gastosPrev.fma,   agendasPrev.fma.length),
    total: cpa(gastosPrev.total, agendasPrev.all.length),
  };

  // ── closing (col L) ──
  const reuniones     = reunionesRaw.filter((r) => r["Prospecto"] && inDateRange(r["Fecha de reunion"], range.from, range.to));
  const reunionesPrev = reunionesRaw.filter((r) => r["Prospecto"] && inDateRange(r["Fecha de reunion"], prev.from, prev.to));
  const globalStats   = closingStats(reuniones);
  const prevStats     = closingStats(reunionesPrev);
  const closerStats   = CLOSERS
    .map((closer) => ({ closer, ...closingStats(reuniones.filter((r) => r["Closer"].trim() === closer)) }))
    .filter((c) => c.total > 0);

  // ── canales (col L + col D) ──
  const canalesDef = [
    { nombre: "Publi a VSL", gasto: gastos.vsl, match: (r: Record<string,string>) => r["Canal"] === "Publi a VSL" },
    { nombre: "ADS Mje IG",  gasto: gastos.ig,  match: (r: Record<string,string>) => r["Canal"] === "ADS Mje IG"  },
    { nombre: "FMA",         gasto: gastos.fma, match: (r: Record<string,string>) => isFMA(r["Canal"])             },
    { nombre: "Otras",       gasto: 0,          match: (r: Record<string,string>) => r["Canal"] !== "Publi a VSL" && r["Canal"] !== "ADS Mje IG" && !isFMA(r["Canal"]) },
  ];
  const canalStats = canalesDef.map(({ nombre, gasto, match }) => {
    const s  = closingStats(reuniones.filter(match));
    const costReu      = s.total > 0 && gasto > 0 ? gasto / s.total : null;
    const costEfectiva = s.efectivas > 0 && gasto > 0 ? gasto / s.efectivas : null;
    const cacCanal     = s.ccSpa > 0 && gasto > 0 ? gasto / s.ccSpa : null;
    const cr           = s.efectivas > 0 ? (s.ccSpa / s.efectivas) * 100 : 0;
    return { nombre, gasto, ...s, costReu, costEfectiva, cacCanal, cr };
  });

  // Prev-period stats per canal (for comparison row + CAC Ant. column)
  const canalStatsPrev = [
    { gasto: gastosPrev.vsl, match: (r: Record<string,string>) => r["Canal"] === "Publi a VSL" },
    { gasto: gastosPrev.ig,  match: (r: Record<string,string>) => r["Canal"] === "ADS Mje IG"  },
    { gasto: gastosPrev.fma, match: (r: Record<string,string>) => isFMA(r["Canal"]) },
    { gasto: 0,              match: (r: Record<string,string>) => r["Canal"] !== "Publi a VSL" && r["Canal"] !== "ADS Mje IG" && !isFMA(r["Canal"]) },
  ].map(({ gasto, match }) => {
    const s            = closingStats(reunionesPrev.filter(match));
    const costReu      = s.total > 0 && gasto > 0 ? gasto / s.total : null;
    const costEfectiva = s.efectivas > 0 && gasto > 0 ? gasto / s.efectivas : null;
    const cacCanal     = s.ccSpa > 0 && gasto > 0 ? gasto / s.ccSpa : null;
    const cr           = s.efectivas > 0 ? (s.ccSpa / s.efectivas) * 100 : 0;
    const nsCan        = s.total > 0 ? ((s.noShow + s.cancelados) / s.total) * 100 : 0;
    return { gasto, ...s, costReu, costEfectiva, cacCanal, cr, nsCan };
  });

  const fmtUSD = (n: number | null) => n != null && n > 0 ? `$${Math.round(n).toLocaleString()}` : "—";
  const nsCancelPct = globalStats.total > 0 ? ((globalStats.noShow + globalStats.cancelados) / globalStats.total) * 100 : 0;
  const ccPct       = globalStats.efectivas > 0 ? (globalStats.ccSpa / globalStats.efectivas) * 100 : 0;

  return (
    <div>
      <PageHeader
        title="Ventas"
        description="Generación de agendas · Closing · Canales"
        actions={<SalesPeriodPicker from={sp.from} to={sp.to} />}
      />

      {/* ── 1. GENERACIÓN DE AGENDAS ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Generación de Agendas</h2>
      <div className="card mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Canal", "$ Inversión", "Agendas", "Costo/Agenda", "Período anterior", "Var."].map((h) => (
                  <th key={h} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                { nombre: "VSL",    gasto: gastos.vsl,   ag: agendas.vsl.length,    cpa: cpaCurr.vsl,   cpaP: cpaPrev.vsl   },
                { nombre: "MSG IG", gasto: gastos.ig,    ag: agendas.ig.length,     cpa: cpaCurr.ig,    cpaP: cpaPrev.ig    },
                { nombre: "FMA",    gasto: gastos.fma,   ag: agendas.fma.length,    cpa: cpaCurr.fma,   cpaP: cpaPrev.fma   },
                { nombre: "Otras",  gasto: 0,            ag: agendas.otras.length,  cpa: null,          cpaP: null          },
              ]).map(({ nombre, gasto, ag, cpa: c, cpaP }) => {
                const diff = c && cpaP ? diffArrow(c, cpaP, true) : null;
                return (
                  <tr key={nombre} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                    <td className="px-4 py-3 font-medium text-slate-300">{nombre}</td>
                    <td className="px-4 py-3 text-center text-brand-400">{gasto > 0 ? fmtUSD(gasto) : "—"}</td>
                    <td className="px-4 py-3 text-center text-white font-bold text-base">{ag}</td>
                    <td className="px-4 py-3 text-center text-amber-400 font-semibold">{fmtUSD(c)}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{fmtUSD(cpaP)}</td>
                    <td className="px-4 py-3 text-center">
                      {diff ? (
                        <span className={`text-xs font-semibold ${diff.good ? "text-emerald-400" : "text-rose-400"}`}>
                          {diff.good ? "▼" : "▲"} {diff.text}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-surface-800/40">
                <td className="px-4 py-3 font-bold text-white">TOTAL</td>
                <td className="px-4 py-3 text-center text-brand-400 font-bold">{fmtUSD(gastos.total)}</td>
                <td className="px-4 py-3 text-center text-white font-bold text-base">{agendas.all.length}</td>
                <td className="px-4 py-3 text-center text-amber-400 font-bold">{fmtUSD(cpaCurr.total)}</td>
                <td className="px-4 py-3 text-center text-slate-500">{fmtUSD(cpaPrev.total)}</td>
                <td className="px-4 py-3 text-center">
                  {(() => {
                    const d = cpaCurr.total && cpaPrev.total ? diffArrow(cpaCurr.total, cpaPrev.total, true) : null;
                    return d ? <span className={`text-xs font-semibold ${d.good ? "text-emerald-400" : "text-rose-400"}`}>{d.good ? "▼" : "▲"} {d.text}</span> : "—";
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600 mt-3 px-1">Período anterior: {prev.from} → {prev.to}</p>
      </div>

      {/* ── 2. CLOSING ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Closing</h2>

      {(nsCancelPct > 35 || ccPct < 30) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {nsCancelPct > 35 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <AlertTriangle size={13} /> No show + Cancelados: {nsCancelPct.toFixed(1)}% — supera 35%
            </div>
          )}
          {ccPct < 30 && globalStats.efectivas > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-300">
              <AlertTriangle size={13} /> CC/SPA: {ccPct.toFixed(1)}% — por debajo del 30%
            </div>
          )}
        </div>
      )}

      <div className="card mb-6">
        <ClosingFunnel curr={globalStats} prev={prevStats} prevLabel={`${prev.from} → ${prev.to}`} />
      </div>

      {/* Por closer */}
      {closerStats.length > 0 && (
        <div className="card mb-8">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Por closer</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  {["Closer","Llamadas","N.Pres.","Cancel.","No show","NS+Can%","Efect.","CC/SPA","CR%","DS","Fact.","Cash llam.","Seña"].map((h) => (
                    <th key={h} className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {closerStats.map((c) => {
                  const nsCan  = c.total > 0 ? ((c.noShow + c.cancelados) / c.total) * 100 : 0;
                  const ccPctC = c.efectivas > 0 ? (c.ccSpa / c.efectivas) * 100 : 0;
                  const dNsCan = diffArrow(nsCan, nsCancelPct, true);
                  // pp vs team average for CR%
                  const ppVsAvg   = ccPct > 0 ? ccPctC - ccPct : 0;
                  const crColor   = ccPctC >= 30 ? "text-emerald-400" : ccPctC >= 25 ? "text-amber-400" : "text-rose-400";
                  const ppColor   = ppVsAvg >= 0 ? "text-emerald-400" : "text-rose-400";
                  return (
                    <tr key={c.closer} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                      <td className="px-3 py-3 font-bold text-white">{c.closer}</td>
                      <td className="px-3 py-3 text-center font-bold text-white">{c.total}</td>
                      <CellPct val={c.noPres} total={c.total} warnAbove={10} lowerBetter />
                      <CellPct val={c.cancelados} total={c.total} />
                      <CellPct val={c.noShow} total={c.total} />
                      <td className={`px-3 py-3 text-center tabular-nums font-semibold ${nsCan > 35 ? "text-rose-400" : "text-emerald-400"}`}>
                        {nsCan.toFixed(0)}%
                        {dNsCan && <span className={`text-xs ml-1 ${dNsCan.good ? "text-emerald-400" : "text-rose-400"}`}>{dNsCan.good?"▼":"▲"}{Math.abs(parseFloat(dNsCan.text))}pp</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300">{c.efectivas} <span className="text-xs text-slate-500">({pct(c.efectivas, c.total, 0)})</span></td>
                      {/* CC/SPA — count only */}
                      <td className={`px-3 py-3 text-center font-bold ${ccPctC >= 30 ? "text-emerald-400" : "text-rose-400"}`}>
                        {c.ccSpa}
                      </td>
                      {/* CR% — colored by threshold + pp vs team average */}
                      <td className={`px-3 py-3 text-center font-bold ${crColor}`}>
                        <div>{ccPctC.toFixed(0)}%</div>
                        {ccPct > 0 && Math.abs(ppVsAvg) >= 0.5 && (
                          <div className={`text-[10px] ${ppColor}`}>
                            {ppVsAvg >= 0 ? "▲" : "▼"}{ppVsAvg >= 0 ? "+" : ""}{ppVsAvg.toFixed(1)}pp
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-400">{c.downsell}</td>
                      <td className="px-3 py-3 text-center text-slate-300 tabular-nums">{c.facturacion > 0 ? formatARS(c.facturacion) : "—"}</td>
                      <td className="px-3 py-3 text-center text-emerald-400 tabular-nums">
                        {c.cashLlamada > 0 ? formatARS(c.cashLlamada) : "—"}
                        {c.facturacion > 0 && c.cashLlamada > 0 && <span className="text-xs text-slate-500 ml-1">({((c.cashLlamada/c.facturacion)*100).toFixed(0)}%)</span>}
                      </td>
                      <td className="px-3 py-3 text-center text-amber-300 text-xs">{c.sena > 0 ? c.sena : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 3. CANALES ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Clientes por Canal</h2>
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Canal","$ Inv.","Llamadas","$ Reu.","N.Pres.","Cancel.","No show","NS+Can%","Efect.","C.Efec.","CC/SPA","CR%","CAC","CAC Ant."].map((h) => (
                  <th key={h} className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase whitespace-nowrap first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canalStats.map((c, i) => {
                const nsCan   = c.total > 0 ? ((c.noShow + c.cancelados) / c.total) * 100 : 0;
                const prevC   = canalStatsPrev[i];
                const prevCac = prevC?.cacCanal ?? null;
                const cacDiff = c.cacCanal && prevCac
                  ? ((c.cacCanal - prevCac) / prevCac) * 100 : null;
                return (
                  <tr key={c.nombre} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                    <td className="px-3 py-3 font-medium text-slate-300 whitespace-nowrap">{c.nombre}</td>
                    <td className="px-3 py-3 text-center text-brand-400">{c.gasto > 0 ? fmtUSD(c.gasto) : "—"}</td>
                    <td className="px-3 py-3 text-center font-bold text-white">{c.total}</td>
                    <td className="px-3 py-3 text-center text-slate-400">{fmtUSD(c.costReu)}</td>
                    <CellPct val={c.noPres} total={c.total} />
                    <CellPct val={c.cancelados} total={c.total} />
                    <CellPct val={c.noShow} total={c.total} />
                    <td className={`px-3 py-3 text-center font-semibold ${nsCan > 35 ? "text-rose-400" : "text-emerald-400"}`}>{nsCan.toFixed(0)}%</td>
                    <td className="px-3 py-3 text-center text-slate-300">{c.efectivas}</td>
                    <td className="px-3 py-3 text-center text-amber-400">{fmtUSD(c.costEfectiva)}</td>
                    <td className={`px-3 py-3 text-center font-bold ${c.ccSpa > 0 ? "text-emerald-400" : "text-slate-500"}`}>{c.ccSpa}</td>
                    <td className={`px-3 py-3 text-center ${c.cr >= 30 ? "text-emerald-400" : c.cr > 0 ? "text-amber-400" : "text-slate-500"}`}>{c.cr.toFixed(0)}%</td>
                    <td className="px-3 py-3 text-center text-amber-400">{fmtUSD(c.cacCanal)}</td>
                    {/* CAC Ant. */}
                    <td className="px-3 py-3 text-center">
                      <span className="text-slate-500 tabular-nums">{fmtUSD(prevCac)}</span>
                      {cacDiff !== null && (
                        <span className={`block text-[10px] font-semibold ${cacDiff <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {cacDiff > 0 ? "▲" : "▼"}{cacDiff > 0 ? "+" : ""}{cacDiff.toFixed(0)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* ── TOTAL row ── */}
              {(() => {
                const tot = {
                  gasto:      canalStats.reduce((s, c) => s + c.gasto,      0),
                  total:      canalStats.reduce((s, c) => s + c.total,      0),
                  noPres:     canalStats.reduce((s, c) => s + c.noPres,     0),
                  cancelados: canalStats.reduce((s, c) => s + c.cancelados, 0),
                  noShow:     canalStats.reduce((s, c) => s + c.noShow,     0),
                  efectivas:  canalStats.reduce((s, c) => s + c.efectivas,  0),
                  ccSpa:      canalStats.reduce((s, c) => s + c.ccSpa,      0),
                };
                const tNsCan   = tot.total > 0 ? ((tot.noShow + tot.cancelados) / tot.total) * 100 : 0;
                const tCr      = tot.efectivas > 0 ? (tot.ccSpa / tot.efectivas) * 100 : 0;
                const tCostReu = tot.total > 0 && tot.gasto > 0 ? tot.gasto / tot.total : null;
                const tCostEf  = tot.efectivas > 0 && tot.gasto > 0 ? tot.gasto / tot.efectivas : null;
                const tCac     = tot.ccSpa > 0 && tot.gasto > 0 ? tot.gasto / tot.ccSpa : null;

                // Prev totals for the comparison row
                const prevTot = {
                  gasto:      canalStatsPrev.reduce((s, c) => s + c.gasto,      0),
                  total:      canalStatsPrev.reduce((s, c) => s + c.total,      0),
                  noPres:     canalStatsPrev.reduce((s, c) => s + c.noPres,     0),
                  cancelados: canalStatsPrev.reduce((s, c) => s + c.cancelados, 0),
                  noShow:     canalStatsPrev.reduce((s, c) => s + c.noShow,     0),
                  efectivas:  canalStatsPrev.reduce((s, c) => s + c.efectivas,  0),
                  ccSpa:      canalStatsPrev.reduce((s, c) => s + c.ccSpa,      0),
                };
                const prevNsCan   = prevTot.total > 0 ? ((prevTot.noShow + prevTot.cancelados) / prevTot.total) * 100 : 0;
                const prevCr      = prevTot.efectivas > 0 ? (prevTot.ccSpa / prevTot.efectivas) * 100 : 0;
                const prevCostReu = prevTot.total > 0 && prevTot.gasto > 0 ? prevTot.gasto / prevTot.total : null;
                const prevCostEf  = prevTot.efectivas > 0 && prevTot.gasto > 0 ? prevTot.gasto / prevTot.efectivas : null;
                const prevCac     = prevTot.ccSpa > 0 && prevTot.gasto > 0 ? prevTot.gasto / prevTot.ccSpa : null;
                const cacPctDiff  = tCac && prevCac ? ((tCac - prevCac) / prevCac) * 100 : null;

                // Helper: compact diff badge (lower is better for costs, higher for counts/CR)
                function CmpBadge({ curr, prev, lowerBetter = false }: { curr: number; prev: number; lowerBetter?: boolean }) {
                  if (!prev || !curr) return null;
                  const d = ((curr - prev) / prev) * 100;
                  if (Math.abs(d) < 1) return null;
                  const good = lowerBetter ? d < 0 : d > 0;
                  return (
                    <span className={`text-[10px] font-semibold ml-0.5 ${good ? "text-emerald-400" : "text-rose-400"}`}>
                      {d > 0 ? "▲" : "▼"}{Math.abs(d).toFixed(0)}%
                    </span>
                  );
                }

                return (
                  <>
                    <tr className="bg-surface-800/60 border-t border-surface-600/50">
                      <td className="px-3 py-3 font-bold text-white whitespace-nowrap">TOTAL</td>
                      <td className="px-3 py-3 text-center font-bold text-brand-400">{tot.gasto > 0 ? fmtUSD(tot.gasto) : "—"}</td>
                      <td className="px-3 py-3 text-center font-bold text-white">{tot.total}</td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-400">{fmtUSD(tCostReu)}</td>
                      <td className="px-3 py-3 text-center tabular-nums font-semibold text-slate-300">
                        {tot.noPres} <span className="text-xs text-slate-500">({tot.total > 0 ? ((tot.noPres/tot.total)*100).toFixed(0) : 0}%)</span>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums font-semibold text-slate-300">
                        {tot.cancelados} <span className="text-xs text-slate-500">({tot.total > 0 ? ((tot.cancelados/tot.total)*100).toFixed(0) : 0}%)</span>
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums font-semibold text-slate-300">
                        {tot.noShow} <span className="text-xs text-slate-500">({tot.total > 0 ? ((tot.noShow/tot.total)*100).toFixed(0) : 0}%)</span>
                      </td>
                      <td className={`px-3 py-3 text-center font-bold ${tNsCan > 35 ? "text-rose-400" : "text-emerald-400"}`}>{tNsCan.toFixed(0)}%</td>
                      <td className="px-3 py-3 text-center font-bold text-white">{tot.efectivas}</td>
                      <td className="px-3 py-3 text-center font-semibold text-amber-400">{fmtUSD(tCostEf)}</td>
                      <td className={`px-3 py-3 text-center font-bold ${tCr >= 30 ? "text-emerald-400" : "text-rose-400"}`}>{tot.ccSpa}</td>
                      <td className={`px-3 py-3 text-center font-bold ${tCr >= 30 ? "text-emerald-400" : "text-amber-400"}`}>{tCr.toFixed(0)}%</td>
                      <td className="px-3 py-3 text-center font-semibold text-amber-400">{fmtUSD(tCac)}</td>
                      {/* CAC Ant. for TOTAL */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-slate-500 tabular-nums">{fmtUSD(prevCac)}</span>
                        {cacPctDiff !== null && (
                          <span className={`block text-[10px] font-semibold ${cacPctDiff <= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {cacPctDiff > 0 ? "▲+" : "▼"}{cacPctDiff.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>

                    {/* ── Período anterior comparison row ── */}
                    <tr className="border-t border-surface-700/30 bg-surface-900/40">
                      <td className="px-3 py-2 text-[11px] font-semibold text-slate-600 whitespace-nowrap">Período ant.</td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevTot.gasto > 0 ? fmtUSD(prevTot.gasto) : "—"}
                        <CmpBadge curr={tot.gasto} prev={prevTot.gasto} lowerBetter />
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevTot.total}
                        <CmpBadge curr={tot.total} prev={prevTot.total} />
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {fmtUSD(prevCostReu)}
                        <CmpBadge curr={tCostReu ?? 0} prev={prevCostReu ?? 0} lowerBetter />
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevTot.noPres}
                        <span className="text-slate-700 ml-0.5 text-[10px]">({prevTot.total > 0 ? ((prevTot.noPres/prevTot.total)*100).toFixed(0) : 0}%)</span>
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevTot.cancelados}
                        <span className="text-slate-700 ml-0.5 text-[10px]">({prevTot.total > 0 ? ((prevTot.cancelados/prevTot.total)*100).toFixed(0) : 0}%)</span>
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevTot.noShow}
                        <span className="text-slate-700 ml-0.5 text-[10px]">({prevTot.total > 0 ? ((prevTot.noShow/prevTot.total)*100).toFixed(0) : 0}%)</span>
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevNsCan.toFixed(0)}%
                        <CmpBadge curr={tNsCan} prev={prevNsCan} lowerBetter />
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevTot.efectivas}
                        <CmpBadge curr={tot.efectivas} prev={prevTot.efectivas} />
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {fmtUSD(prevCostEf)}
                        <CmpBadge curr={tCostEf ?? 0} prev={prevCostEf ?? 0} lowerBetter />
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevTot.ccSpa}
                        <CmpBadge curr={tot.ccSpa} prev={prevTot.ccSpa} />
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {prevCr.toFixed(0)}%
                        <CmpBadge curr={tCr} prev={prevCr} />
                      </td>
                      <td className="px-3 py-2 text-center text-[11px] text-slate-600 tabular-nums">
                        {fmtUSD(prevCac)}
                        <CmpBadge curr={tCac ?? 0} prev={prevCac ?? 0} lowerBetter />
                      </td>
                      {/* CAC Ant. column — blank in comparison row (already shown above) */}
                      <td />
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

type Stats = ReturnType<typeof closingStats>;

// ── Badge helpers (module-level, no hooks) ──
function PpBadge({ a, b, goodIfHigh = true }: { a: number; b: number; goodIfHigh?: boolean }) {
  const d = a - b;
  if (Math.abs(d) < 0.1) return null;
  const good = goodIfHigh ? d > 0 : d < 0;
  return (
    <span className={`text-[11px] font-semibold leading-none ${good ? "text-emerald-400" : "text-rose-400"}`}>
      {d > 0 ? "+" : ""}{d.toFixed(1)}pp
    </span>
  );
}

function PctBadge({ a, b, goodIfHigh = true }: { a: number; b: number; goodIfHigh?: boolean }) {
  if (!b) return null;
  const d = ((a - b) / b) * 100;
  if (Math.abs(d) < 1) return null;
  const good = goodIfHigh ? d > 0 : d < 0;
  return (
    <span className={`text-[11px] font-semibold leading-none ${good ? "text-emerald-400" : "text-rose-400"}`}>
      {d > 0 ? "+" : ""}{d.toFixed(0)}%
    </span>
  );
}

// ── Single funnel bar (compact) ──
function FRow({
  w, label, count, pctOfTotal, pctSuffix,
  prevCount, prevPct,
  diffBadge, threshold,
  bg, border, valueColor,
}: {
  w: number; label: string;
  count: number; pctOfTotal: number; pctSuffix?: string;
  prevCount: number; prevPct: number;
  diffBadge: React.ReactNode;
  threshold?: string;
  bg: string; border: string; valueColor: string;
}) {
  return (
    <div className="flex justify-center">
      <div
        style={{ width: `${w}%` }}
        className={`${bg} ${border} border rounded-lg px-5 py-2.5 flex items-center justify-between gap-3 transition-all`}
      >
        {/* Left: data */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">{label}</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-2xl font-bold tabular-nums ${valueColor}`}>{count}</span>
            <span className={`text-sm tabular-nums ${valueColor} opacity-80`}>
              {pctOfTotal.toFixed(1)}%{pctSuffix ? ` ${pctSuffix}` : ""}
            </span>
            {threshold && (
              <span className="text-[10px] text-slate-500 font-medium">{threshold}</span>
            )}
          </div>
        </div>
        {/* Right: prev period */}
        <div className="text-right shrink-0">
          <p className="text-[10px] text-slate-600 mb-0.5">ant.</p>
          <p className="text-sm font-semibold text-slate-400 tabular-nums leading-tight">{prevCount}</p>
          <p className="text-[10px] text-slate-500 tabular-nums">{prevPct.toFixed(1)}%</p>
          {diffBadge}
        </div>
      </div>
    </div>
  );
}

// ── Small connector arrow ──
function FArrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center items-center gap-2 py-1.5">
      <span className="text-slate-700 text-xs">↓</span>
      {children}
    </div>
  );
}

function Chip({ text, val, prev, good }: { text: string; val: number; prev: number; good?: boolean }) {
  return (
    <span className={`text-[11px] border rounded-full px-2.5 py-1 flex items-center gap-1.5
      ${good === false ? "bg-rose-500/8 border-rose-500/20" : "bg-slate-500/10 border-slate-500/20"}`}>
      <span className="text-slate-400">{text}:</span>
      <span className={`font-semibold ${good === false ? "text-rose-400" : "text-slate-300"}`}>{val}</span>
      <span className="text-slate-600 text-[10px]">prev {prev}</span>
    </span>
  );
}

function ClosingFunnel({ curr, prev, prevLabel }: { curr: Stats; prev: Stats; prevLabel: string }) {
  const base     = curr.total || 1;
  const prevBase = prev.total || 1;

  // Funnel widths: survivor-based (how many remain after each filter)
  // Ensures the visual narrows at each step
  const w1 = 100;
  const w2 = Math.max(((base - curr.noPres) / base) * 100, 50);         // after no-pres
  const w3 = Math.max((curr.efectivas / base) * 100, 38);               // after canc+ns = efectivas
  const w4 = Math.max(w3 - 3, 35);                                      // efectivas (slight step)
  const w5 = Math.max((curr.ccSpa / base) * 100, 26);                   // cc/spa

  // Key rates
  const noPct      = (curr.noPres / base) * 100;
  const prevNoPct  = (prev.noPres / prevBase) * 100;
  const cnsPct     = ((curr.cancelados + curr.noShow) / base) * 100;
  const prevCnsPct = ((prev.cancelados + prev.noShow) / prevBase) * 100;
  const efPct      = (curr.efectivas / base) * 100;
  const prevEfPct  = (prev.efectivas / prevBase) * 100;
  const ccPct      = curr.efectivas > 0 ? (curr.ccSpa / curr.efectivas) * 100 : 0;
  const prevCcPct  = prev.efectivas > 0 ? (prev.ccSpa / prev.efectivas) * 100 : 0;
  const cashPct    = curr.facturacion > 0 ? (curr.cashLlamada / curr.facturacion) * 100 : 0;

  // Threshold helpers
  function noPresTheme(p: number) {
    if (p <= 10) return { bg: "bg-emerald-500/10", border: "border-emerald-500/20", clr: "text-emerald-400", tag: "✓ obj <10%" };
    if (p <= 15) return { bg: "bg-amber-500/10",   border: "border-amber-500/20",   clr: "text-amber-400",   tag: "⚠ obj <10%" };
    return           { bg: "bg-rose-500/10",   border: "border-rose-500/20",   clr: "text-rose-400",   tag: "✗ obj <10%" };
  }
  function cnsTheme(p: number) {
    if (p <= 30) return { bg: "bg-emerald-500/10", border: "border-emerald-500/20", clr: "text-emerald-400", tag: "✓ obj <30%" };
    if (p <= 40) return { bg: "bg-amber-500/10",   border: "border-amber-500/20",   clr: "text-amber-400",   tag: "⚠ obj <30%" };
    return           { bg: "bg-rose-500/10",   border: "border-rose-500/20",   clr: "text-rose-400",   tag: "✗ obj <30%" };
  }
  function ccTheme(p: number) {
    if (p >= 30) return { bg: "bg-emerald-500/10", border: "border-emerald-500/20", clr: "text-emerald-400", tag: "✓ obj ≥30%" };
    return           { bg: "bg-rose-500/10",   border: "border-rose-500/20",   clr: "text-rose-400",   tag: "⚠ obj ≥30%" };
  }

  const noT = noPresTheme(noPct);
  const cnsT = cnsTheme(cnsPct);
  const ccT  = ccTheme(ccPct);
  const cnsCount     = curr.cancelados + curr.noShow;
  const prevCnsCount = prev.cancelados + prev.noShow;

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-600 mb-3 text-right">Período anterior: {prevLabel}</p>

      {/* 1 — Llamadas */}
      <FRow
        w={w1} label="Llamadas agendadas"
        count={curr.total} pctOfTotal={100}
        prevCount={prev.total} prevPct={100}
        diffBadge={<PctBadge a={curr.total} b={prev.total} />}
        bg="bg-brand-700/20" border="border-brand-600/25" valueColor="text-white"
      />

      <FArrow>
        <Chip text="No presentados" val={curr.noPres} prev={prev.noPres} good={false} />
      </FArrow>

      {/* 2 — No presentados */}
      <FRow
        w={w2} label="No presentados"
        count={curr.noPres} pctOfTotal={noPct} pctSuffix="del total"
        prevCount={prev.noPres} prevPct={prevNoPct}
        diffBadge={<PpBadge a={noPct} b={prevNoPct} goodIfHigh={false} />}
        threshold={noT.tag}
        bg={noT.bg} border={noT.border} valueColor={noT.clr}
      />

      <FArrow>
        <Chip text="Cancelados" val={curr.cancelados} prev={prev.cancelados} good={false} />
        <Chip text="No show" val={curr.noShow} prev={prev.noShow} good={false} />
      </FArrow>

      {/* 3 — Cancelados + No show */}
      <FRow
        w={w3} label="Cancelados + No show"
        count={cnsCount} pctOfTotal={cnsPct} pctSuffix="del total"
        prevCount={prevCnsCount} prevPct={prevCnsPct}
        diffBadge={<PpBadge a={cnsPct} b={prevCnsPct} goodIfHigh={false} />}
        threshold={cnsT.tag}
        bg={cnsT.bg} border={cnsT.border} valueColor={cnsT.clr}
      />

      {/* 4 — Agendas efectivas */}
      <FRow
        w={w4} label="Agendas efectivas"
        count={curr.efectivas} pctOfTotal={efPct} pctSuffix="del total"
        prevCount={prev.efectivas} prevPct={prevEfPct}
        diffBadge={<PpBadge a={efPct} b={prevEfPct} />}
        bg="bg-brand-600/20" border="border-brand-500/25" valueColor="text-brand-300"
      />

      <FArrow>
        <Chip text="No cerraron" val={curr.efectivas - curr.ccSpa} prev={prev.efectivas - prev.ccSpa} />
        {curr.downsell > 0 && <Chip text="Downsell" val={curr.downsell} prev={prev.downsell} />}
      </FArrow>

      {/* 5 — CC / SPA */}
      <FRow
        w={w5} label="CC / SPA"
        count={curr.ccSpa} pctOfTotal={ccPct} pctSuffix="de efect."
        prevCount={prev.ccSpa} prevPct={prevCcPct}
        diffBadge={<PpBadge a={ccPct} b={prevCcPct} />}
        threshold={ccT.tag}
        bg={ccT.bg} border={ccT.border} valueColor={ccT.clr}
      />

      {/* Señas */}
      {curr.sena > 0 && (
        <p className="text-[11px] text-slate-500 text-center pt-1">
          📌 Señas pendientes:{" "}
          <span className="text-amber-400 font-semibold">{curr.sena}</span>
          <span className="text-slate-600 ml-1">(prev: {prev.sena})</span>
          {" "}— aún sin completar el pago
        </p>
      )}

      {/* Financiero */}
      <div className="grid grid-cols-2 gap-3 pt-4 mt-1 border-t border-surface-700/40">
        <div className="bg-surface-800/50 rounded-xl p-3 text-center border border-surface-700/50">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Facturación total</p>
          <p className="text-xl font-bold text-brand-400 tabular-nums">
            {curr.facturacion > 0 ? formatARS(curr.facturacion) : "—"}
          </p>
          {prev.facturacion > 0 && (
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-center gap-1">
              prev: {formatARS(prev.facturacion)}{" "}
              <PctBadge a={curr.facturacion} b={prev.facturacion} />
            </p>
          )}
        </div>
        <div className="bg-surface-800/50 rounded-xl p-3 text-center border border-surface-700/50">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">Cash collected</p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums">
            {curr.cashLlamada > 0 ? formatARS(curr.cashLlamada) : "—"}
          </p>
          {prev.cashLlamada > 0 && (
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-center gap-1">
              prev: {formatARS(prev.cashLlamada)}{" "}
              <PctBadge a={curr.cashLlamada} b={prev.cashLlamada} />
            </p>
          )}
          {cashPct > 0 && <p className="text-[10px] text-slate-600">{cashPct.toFixed(0)}% de fact.</p>}
        </div>
      </div>
    </div>
  );
}

function CellPct({ val, total, warnAbove, lowerBetter }: { val: number; total: number; warnAbove?: number; lowerBetter?: boolean }) {
  const p = total > 0 ? (val / total) * 100 : 0;
  const warn = warnAbove !== undefined && (lowerBetter ? p > warnAbove : p < warnAbove);
  return (
    <td className="px-3 py-3 text-center tabular-nums">
      <span className={warn ? "text-rose-400" : "text-slate-300"}>{val}</span>
      <span className="text-xs text-slate-500 ml-1">({p.toFixed(0)}%)</span>
    </td>
  );
}
