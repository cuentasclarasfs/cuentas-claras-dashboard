import {
  getEERRCCForMonth, getClientesTrend, getFeedbackData,
  getStatusClientes, getAnalisisClientesResumen, getOpsMetrics,
  filterFeedbackByMonth, nextMonthKey, currentMonthKey,
} from "@/lib/sheets";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { AsesorFilter } from "@/components/ui/AsesorFilter";
import { MesComienzFilter } from "@/components/ui/MesComienzFilter";
import { keyToLabel } from "@/components/ui/mesUtils";
import { ClientesTrendChart } from "@/components/charts/ClientesTrendChart";
import { Users, Star, TrendingUp, AlertCircle } from "lucide-react";

export const revalidate = 1800;

const FB_KEYS = {
  asesor:        "¿Quién te está acompañando en el programa?",
  puntaje:       "¿Qué puntaje le darías al acompañamiento?",
  avance:        "¿Qué tanto sentís que estás avanzando hacia tus objetivos financieros con el programa?",
  conocimiento:  "¿Qué tanto conocés tu números hoy?",
  tranquilidad:  "¿Cuan tranquilo/a estas con tus finanzas hoy?",
  recomendacion: "¿Qué tan probable es que recomiendes este programa a otros dueños de negocio?",
};

const STATUS_COLORS: Record<string, string> = {
  "Onboarding":           "text-brand-400",
  "Primer Programa":      "text-emerald-400",
  "Renovado":             "text-purple-400",
  "Terminó y no renovó":  "text-amber-400",
  "Se bajó":              "text-rose-400",
  "Renovó y se fue":      "text-slate-400",
};

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
function fbMetrics(rows: Record<string, string>[]) {
  const parse = (key: string) =>
    rows.map((r) => parseFloat(r[key] ?? "")).filter((n) => !isNaN(n));
  return {
    count:         rows.length,
    puntaje:       avg(parse(FB_KEYS.puntaje)),
    avance:        avg(parse(FB_KEYS.avance)),
    conocimiento:  avg(parse(FB_KEYS.conocimiento)),
    tranquilidad:  avg(parse(FB_KEYS.tranquilidad)),
    recomendacion: avg(parse(FB_KEYS.recomendacion)),
  };
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; asesor?: string; mesDesde?: string; mesHasta?: string }>;
}) {
  const sp = await searchParams;
  const selectedMonth  = sp.month    ?? currentMonthKey();
  const selectedAsesor = sp.asesor   ?? "";
  const selectedMesDesde = sp.mesDesde ?? "";
  const selectedMesHasta = sp.mesHasta ?? "";

  // Feedback is 1 month behind — selected=March → show April feedbacks
  const feedbackMonth = nextMonthKey(selectedMonth);

  const [eerrcc, clientesTrend, feedbackRaw, statusRaw, analisisResumen, opsMetrics] = await Promise.all([
    getEERRCCForMonth(selectedMonth),
    getClientesTrend(),
    getFeedbackData(),
    getStatusClientes(),
    getAnalisisClientesResumen(),
    getOpsMetrics(),
  ]);

  // ── Clientes EERR CC ──
  const totalActivos = eerrcc?.totalClientesActivos ?? null;
  const primerProg   = eerrcc?.clientesPrimerPrograma ?? null;
  const renovados    = eerrcc?.clientesRenovados ?? null;
  const downsell     = eerrcc?.downsell ?? null;

  // ── Feedback ──
  const feedbackDelMes = filterFeedbackByMonth(feedbackRaw, { monthKey: feedbackMonth });
  const globalFB = fbMetrics(feedbackDelMes);

  const asesorListFB = [...new Set(feedbackDelMes.map((r) => r[FB_KEYS.asesor]).filter(Boolean))].sort() as string[];
  const fbPorAsesor = asesorListFB.map((asesor) => ({
    asesor,
    ...fbMetrics(feedbackDelMes.filter((r) => r[FB_KEYS.asesor] === asesor)),
  }));

  const feedbackFiltrado = selectedAsesor
    ? feedbackDelMes.filter((r) => r[FB_KEYS.asesor] === selectedAsesor)
    : feedbackDelMes;
  const filteredFBMetrics = fbMetrics(feedbackFiltrado);

  // ── Status y Pago ──
  const statusRows = statusRaw.filter((r) => r["Cliente"]);
  const statusFiltrado = selectedAsesor
    ? statusRows.filter((r) => r["Consultor"] === selectedAsesor)
    : statusRows;

  const STATUS_ORDER = ["Onboarding","Primer Programa","Renovado","Terminó y no renovó","Se bajó","Renovó y se fue"];
  const statusCounts: Record<string, number> = {};
  statusFiltrado.forEach((r) => {
    const s = r["Status"] ?? "Sin status";
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  });

  const ACTIVOS_STATUS = new Set(["Primer Programa","Renovado","Onboarding"]);
  const asesoresStatus = [...new Set(statusRows.map((r) => r["Consultor"]).filter(Boolean)) as Set<string>]
    .sort((a, b) => {
      const activosA = statusRows.filter((r) => r["Consultor"] === a && ACTIVOS_STATUS.has(r["Status"] ?? "")).length;
      const activosB = statusRows.filter((r) => r["Consultor"] === b && ACTIVOS_STATUS.has(r["Status"] ?? "")).length;
      return activosB - activosA;
    });
  const allAsesores = [...new Set([...asesorListFB, ...asesoresStatus])].sort();

  // ── Mes de comienzo helpers ──
  const MESES_ES: Record<string, number> = {
    ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8,
    sep:9, sept:9, oct:10, nov:11, dic:12,
  };
  function mesComienzaKey(s: string): string | null {
    const parts = (s ?? "").trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) return null;
    const m = MESES_ES[parts[0]];
    const y = parseInt(parts[1]);
    if (!m || isNaN(y)) return null;
    const fullY = y < 100 ? y + 2000 : y;
    return `${fullY}-${String(m).padStart(2, "0")}`;
  }

  // Unique sorted month keys across ALL status rows (for the filter options)
  const allMesKeys = [...new Set(
    statusRows.map((r) => mesComienzaKey(r["Mes de comienzo"] ?? "")).filter(Boolean) as string[]
  )].sort();

  // ── Análisis por Rango de Facturación ──
  const getRango = (r: Record<string, string>) =>
    (r["Rango de Facturación"] || r["Rango de Facturacion"] || "").trim();

  function buildRangoRow(cl: Record<string, string>[], rango: string, sinRango = false) {
    const total   = cl.length;
    const pp      = cl.filter((r) => r["Status"] === "Primer Programa").length;
    const ob      = cl.filter((r) => r["Status"] === "Onboarding").length;
    const termino = cl.filter((r) => r["Status"] === "Terminó y no renovó").length;
    const renov   = cl.filter((r) => r["Status"] === "Renovado").length;
    const bajo    = cl.filter((r) => r["Status"] === "Se bajó").length;
    const ryf     = cl.filter((r) => r["Status"] === "Renovó y se fue").length;
    const base       = total - pp - ob;          // todos excl. activos (OB + PP)
    const conChances = termino + renov + ryf;    // terminaron el programa (excl. se bajaron)
    return {
      rango, total, pp, ob, termino, renov, bajo, ryf, base, conChances, sinRango,
      // % renovación: de los que terminaron el programa (con chances), cuántos siguieron
      renovaPct: conChances > 0 ? ((renov + ryf) / conChances) * 100 : null,
      // % se bajó: sobre los que terminaron/resolvieron (excl. activos)
      bajaPct:   base > 0 ? (bajo / base) * 100 : null,
    };
  }

  // Apply mes comienzo filter on top of asesor filter for the rango table
  const statusParaRango = statusFiltrado.filter((r) => {
    const key = mesComienzaKey(r["Mes de comienzo"] ?? "");
    if (!key) return true; // keep rows without a date (don't hide them)
    if (selectedMesDesde && key < selectedMesDesde) return false;
    if (selectedMesHasta && key > selectedMesHasta) return false;
    return true;
  });

  const allRangos = [...new Set(statusParaRango.map(getRango).filter(Boolean))].sort();
  const sinRangoRows = statusParaRango.filter((r) => !getRango(r) && (r["Status"] || "").trim());

  const rangoStats = [
    ...allRangos.map((rango) =>
      buildRangoRow(statusParaRango.filter((r) => getRango(r) === rango), rango)
    ),
    ...(sinRangoRows.length > 0 ? [buildRangoRow(sinRangoRows, "Sin Rango", true)] : []),
  ];

  // Totals row
  const rangoTotals = rangoStats.reduce(
    (acc, r) => ({
      total:      acc.total      + r.total,
      pp:         acc.pp         + r.pp,
      ob:         acc.ob         + r.ob,
      termino:    acc.termino    + r.termino,
      renov:      acc.renov      + r.renov,
      bajo:       acc.bajo       + r.bajo,
      ryf:        acc.ryf        + r.ryf,
      base:       acc.base       + r.base,
      conChances: acc.conChances + r.conChances,
    }),
    { total: 0, pp: 0, ob: 0, termino: 0, renov: 0, bajo: 0, ryf: 0, base: 0, conChances: 0 }
  );

  // ── Análisis Clientes Resumen — últimos 6 meses <= selectedMonth ──
  const resumenMeses = analisisResumen.months
    .map((m, idx) => {
      const [mm, yyyy] = m.split("/");
      const mk = `${yyyy}-${(mm ?? "").padStart(2, "0")}`;
      return { label: m, idx, mk };
    })
    .filter(({ mk }) => mk <= selectedMonth)
    .slice(-6);

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const MESES_LONG = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const MESES_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const mesLabel = `${MESES_LONG[selMonth - 1]} ${selYear}`;
  const fbMonthNum = parseInt(feedbackMonth.split("-")[1]) - 1;
  const feedbackLabel = `${MESES_SHORT[fbMonthNum]} ${feedbackMonth.split("-")[0]}`;

  const fmtVal = (v: number | null) => v !== null ? v.toFixed(1) : "—";

  return (
    <div>
      <PageHeader
        title="Clientes"
        description={`Activos, feedback y análisis — ${mesLabel}`}
        actions={<MonthSelector selected={selectedMonth} />}
      />

      {/* ── CLIENTES ACTIVOS (EERR CC) ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Clientes Activos</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label="Total activos" value={totalActivos ?? "—"} icon={Users} color="blue" />
        <KPICard label="1er Programa" value={primerProg ?? "—"} icon={Users} color="green" />
        <KPICard label="Renovados" value={renovados ?? "—"} icon={TrendingUp} color="purple" />
        <KPICard label="Downsell" value={downsell ?? "—"} icon={AlertCircle} color="amber" />
      </div>
      <div className="card mb-10">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Evolución de clientes — últimos 12 meses</h3>
        <ClientesTrendChart data={clientesTrend.slice(-12)} />
      </div>

      {/* ── FEEDBACK MENSUAL ── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
          Feedback Mensual
          <span className="ml-2 normal-case text-slate-600 font-normal text-xs">
            (datos de {feedbackLabel} · {globalFB.count} respuestas)
          </span>
        </h2>
        <AsesorFilter asesores={allAsesores} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KPICard label="Feedbacks" value={filteredFBMetrics.count} sub={selectedAsesor || "Global"} icon={Star} color="blue" />
        <KPICard label="Puntaje acomp." value={fmtVal(filteredFBMetrics.puntaje)} sub="/ 10" icon={Star} color="green" />
        <KPICard label="Avance objetivos" value={fmtVal(filteredFBMetrics.avance)} sub="/ 10" icon={TrendingUp} color="purple" />
        <KPICard label="Conocimiento" value={fmtVal(filteredFBMetrics.conocimiento)} sub="/ 10" icon={Star} color="amber" />
        <KPICard label="Recomendación" value={fmtVal(filteredFBMetrics.recomendacion)} sub="/ 10" icon={Star} color="blue" />
      </div>

      <div className="card mb-10">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Feedback por asesor — {feedbackLabel}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800">
                {["Asesor","Resp.","Puntaje","Avance","Conocimiento","Tranquilidad","Recomendación"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fbPorAsesor.map((a) => (
                <tr key={a.asesor} className={`border-b border-surface-800/60 hover:bg-surface-800/40 ${selectedAsesor === a.asesor ? "bg-brand-600/10" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-white">{a.asesor}</td>
                  <td className="px-4 py-3 text-slate-400">{a.count}</td>
                  <td className={`px-4 py-3 font-medium ${a.puntaje !== null && a.puntaje >= 8 ? "text-emerald-400" : "text-amber-400"}`}>{fmtVal(a.puntaje)}</td>
                  <td className={`px-4 py-3 font-medium ${a.avance !== null && a.avance >= 7 ? "text-emerald-400" : "text-amber-400"}`}>{fmtVal(a.avance)}</td>
                  <td className={`px-4 py-3 font-medium ${a.conocimiento !== null && a.conocimiento >= 7 ? "text-emerald-400" : "text-amber-400"}`}>{fmtVal(a.conocimiento)}</td>
                  <td className={`px-4 py-3 font-medium ${a.tranquilidad !== null && a.tranquilidad >= 7 ? "text-emerald-400" : "text-amber-400"}`}>{fmtVal(a.tranquilidad)}</td>
                  <td className={`px-4 py-3 font-medium ${a.recomendacion !== null && a.recomendacion >= 8 ? "text-emerald-400" : "text-amber-400"}`}>{fmtVal(a.recomendacion)}</td>
                </tr>
              ))}
              {fbPorAsesor.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500 text-xs">Sin feedbacks para {feedbackLabel}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── STATUS Y PAGO ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        Status de Clientes
        {selectedAsesor && <span className="ml-2 normal-case text-brand-400 font-normal text-xs">— {selectedAsesor}</span>}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Distribución por status</h3>
          <div className="space-y-3">
            {STATUS_ORDER.map((status) => {
              const count = statusCounts[status] ?? 0;
              const total = statusFiltrado.length || 1;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={`text-xs w-40 flex-shrink-0 ${STATUS_COLORS[status] ?? "text-slate-400"}`}>{status}</span>
                  <div className="flex-1 bg-surface-800 rounded-full h-2">
                    <div className="bg-brand-500 h-2 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
                  </div>
                  <span className="text-xs text-slate-300 w-8 text-right font-medium">{count}</span>
                  <span className="text-xs text-slate-500 w-10 text-right">{((count / total) * 100).toFixed(0)}%</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-slate-500">{statusFiltrado.length} clientes totales</p>
            <p className="text-xs text-slate-400">
              <span className="font-semibold text-emerald-400">
                {statusFiltrado.filter((r) => ACTIVOS_STATUS.has(r["Status"] ?? "")).length}
              </span>
              {" "}activos (OB + PP + Ren.)
            </p>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Clientes por asesor</h3>
          <div className="space-y-3">
            {asesoresStatus.map((asesor) => {
              const propios = statusRows.filter((r) => r["Consultor"] === asesor);
              const activos = propios.filter((r) => ACTIVOS_STATUS.has(r["Status"] ?? "")).length;
              if (activos === 0) return null;
              return (
                <div key={asesor} className="flex items-center gap-3">
                  <span className={`text-xs w-24 flex-shrink-0 font-medium ${selectedAsesor === asesor ? "text-brand-400" : "text-slate-300"}`}>{asesor}</span>
                  <div className="flex-1 bg-surface-800 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${(activos / (statusRows.length || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs text-emerald-400 w-8 text-right">{activos}</span>
                  <span className="text-xs text-slate-500 w-16 text-right">/ {propios.length} tot.</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── PERMANENCIA DE CLIENTES ── */}
      {(opsMetrics.mesesPromedio !== null || opsMetrics.porAsesor.length > 0) && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Permanencia de Clientes</h2>
          <div className="card mb-8">
            {/* Global KPIs */}
            {(opsMetrics.mesesPromedio !== null || opsMetrics.mesesRenovacion !== null) && (
              <div className="grid grid-cols-2 gap-4 mb-6 pb-5 border-b border-surface-700/40">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Meses promedio (1er programa)</p>
                  <p className="text-3xl font-bold text-white tabular-nums">
                    {opsMetrics.mesesPromedio !== null ? opsMetrics.mesesPromedio.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">meses activos en promedio</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Meses extra si renuevan</p>
                  <p className="text-3xl font-bold text-emerald-400 tabular-nums">
                    {opsMetrics.mesesRenovacion !== null ? opsMetrics.mesesRenovacion.toFixed(1) : "—"}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">meses adicionales en renovación</p>
                </div>
              </div>
            )}

            {/* Per-advisor table */}
            {opsMetrics.porAsesor.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Por asesor</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-700">
                        {["Asesor", "Meses promedio", "Si renuevan"].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase text-left last:text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {opsMetrics.porAsesor
                        .filter((a) => new Set(statusRows.map((r) => r["Consultor"]).filter(Boolean)).has(a.nombre))
                        .sort((a, b) => (b.meses ?? 0) - (a.meses ?? 0))
                        .map((a) => (
                          <tr key={a.nombre} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                            <td className="px-4 py-2.5 font-medium text-slate-300">{a.nombre}</td>
                            <td className="px-4 py-2.5 text-slate-200 font-semibold tabular-nums">
                              {a.meses !== null ? (
                                <span className="flex items-center gap-2">
                                  <span>{a.meses.toFixed(1)}</span>
                                  {opsMetrics.mesesPromedio !== null && (
                                    <span className={`text-[10px] font-normal ${
                                      a.meses >= opsMetrics.mesesPromedio ? "text-emerald-400" : "text-rose-400"
                                    }`}>
                                      {a.meses >= opsMetrics.mesesPromedio ? "▲" : "▼"} prom global
                                    </span>
                                  )}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {a.mesesRenovacion !== null ? (
                                <span className="text-emerald-400 font-semibold">{a.mesesRenovacion.toFixed(1)}</span>
                              ) : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── ANÁLISIS POR RANGO DE FACTURACIÓN ── */}
      {rangoStats.length > 0 && (<>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Análisis por Rango de Facturación
            {selectedAsesor && <span className="ml-2 normal-case text-brand-400 font-normal text-xs">— {selectedAsesor}</span>}
            {(selectedMesDesde || selectedMesHasta) && (
              <span className="ml-2 normal-case text-slate-500 font-normal text-xs">
                · {selectedMesDesde ? keyToLabel(selectedMesDesde) : "inicio"} → {selectedMesHasta ? keyToLabel(selectedMesHasta) : "hoy"}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
            <Suspense fallback={null}>
              <MesComienzFilter
                meses={allMesKeys}
                selectedDesde={selectedMesDesde}
                selectedHasta={selectedMesHasta}
              />
            </Suspense>
            <AsesorFilter asesores={allAsesores} />
          </div>
        </div>
        <div className="card mb-10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Rango</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Total</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-500/70 uppercase">Onb + Activos</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-400/70 uppercase">Terminaron</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-rose-500/70 uppercase">Se bajaron</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-brand-400/70 uppercase">Con chances</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-purple-500/70 uppercase">Renovado</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase">Ren. y se fue</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-500/70 uppercase">% Renovación</th>
              </tr>
              <tr>
                <td colSpan={9} className="px-4 pt-1 pb-2 text-[10px] text-slate-600">
                  Con chances = Terminaron − Se bajaron · % Renovación = (Renovado + Ren.y fue) / Con chances
                </td>
              </tr>
            </thead>
            <tbody>
              {rangoStats.map((r) => (
                <tr key={r.rango} className={`border-b border-surface-800/50 hover:bg-surface-800/30 ${r.sinRango ? "opacity-60" : ""}`}>
                  <td className={`px-4 py-2.5 font-medium ${r.sinRango ? "text-slate-500 italic" : "text-white"}`}>{r.rango}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{r.total}</td>
                  {/* Onb + Activos */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">
                    {(r.pp + r.ob) > 0 ? r.pp + r.ob : "—"}
                  </td>
                  {/* Terminaron (excl. activos) */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                    {r.base > 0 ? r.base : "—"}
                  </td>
                  {/* Se bajaron + % sobre los que terminaron */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-rose-400">
                    {r.bajo > 0 ? (
                      <span>{r.bajo} <span className="text-slate-600 text-[10px]">({r.base > 0 ? ((r.bajo/r.base)*100).toFixed(0) : "—"}%)</span></span>
                    ) : "—"}
                  </td>
                  {/* Con chances de renovar */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-brand-400">
                    {r.conChances > 0 ? r.conChances : "—"}
                  </td>
                  {/* Renovado */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-purple-400">
                    {r.renov > 0 ? r.renov : "—"}
                  </td>
                  {/* Renovó y se fue */}
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">
                    {r.ryf > 0 ? r.ryf : "—"}
                  </td>
                  {/* % Renovación */}
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">
                    {r.renovaPct !== null ? (
                      <span className={r.renovaPct >= 50 ? "text-emerald-400" : r.renovaPct >= 30 ? "text-amber-400" : "text-rose-400"}>
                        {r.renovaPct.toFixed(0)}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-600/60 bg-surface-800/40">
                <td className="px-4 py-2.5 font-bold text-white">Total</td>
                <td className="px-4 py-2.5 text-right font-bold text-white tabular-nums">{rangoTotals.total}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-emerald-400 tabular-nums">
                  {(rangoTotals.pp + rangoTotals.ob) > 0 ? rangoTotals.pp + rangoTotals.ob : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-300 tabular-nums">
                  {rangoTotals.base > 0 ? rangoTotals.base : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-rose-400 tabular-nums">
                  {rangoTotals.bajo > 0 ? `${rangoTotals.bajo} (${rangoTotals.base > 0 ? ((rangoTotals.bajo/rangoTotals.base)*100).toFixed(0) : "—"}%)` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-brand-400 tabular-nums">
                  {rangoTotals.conChances > 0 ? rangoTotals.conChances : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-purple-400 tabular-nums">
                  {rangoTotals.renov > 0 ? rangoTotals.renov : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-400 tabular-nums">
                  {rangoTotals.ryf > 0 ? rangoTotals.ryf : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                  {(() => {
                    if (rangoTotals.conChances === 0) return "—";
                    const pct = ((rangoTotals.renov + rangoTotals.ryf) / rangoTotals.conChances) * 100;
                    return <span className={pct >= 50 ? "text-emerald-400" : pct >= 30 ? "text-amber-400" : "text-rose-400"}>{pct.toFixed(0)}%</span>;
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </>)}

      {/* ── ANÁLISIS CLIENTES RESUMEN ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Análisis Clientes — Resumen por mes</h2>
      <div className="card overflow-x-auto">
        {resumenMeses.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">Sin datos disponibles</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800">
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase w-64">Métrica</th>
                {resumenMeses.map(({ label }) => (
                  <th key={label} className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analisisResumen.rows.map(({ label, values }) => {
                const isVariacion = label.toLowerCase().includes("variacion") || label.toLowerCase().includes("mejora");
                return (
                  <tr key={label} className="border-b border-surface-800/60 hover:bg-surface-800/40">
                    <td className="px-4 py-2.5 text-xs text-slate-400">{label}</td>
                    {resumenMeses.map(({ idx, label: mLabel }) => {
                      const raw = (values[idx] ?? "").trim();
                      const isNeg = raw.startsWith("-");
                      const cls = isVariacion
                        ? isNeg ? "text-rose-400" : raw ? "text-emerald-400" : "text-slate-500"
                        : "text-slate-300";
                      return (
                        <td key={mLabel} className={`px-4 py-2.5 text-xs text-right tabular-nums ${cls}`}>
                          {raw || "—"}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
