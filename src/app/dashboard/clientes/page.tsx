import {
  getEERRCCForMonth, getClientesTrend, getFeedbackData,
  getStatusClientes, getAnalisisClientesResumen,
  filterFeedbackByMonth, nextMonthKey, currentMonthKey,
} from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { AsesorFilter } from "@/components/ui/AsesorFilter";
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
  searchParams: Promise<{ month?: string; asesor?: string }>;
}) {
  const sp = await searchParams;
  const selectedMonth = sp.month ?? currentMonthKey();
  const selectedAsesor = sp.asesor ?? "";

  // Feedback is 1 month behind — selected=March → show April feedbacks
  const feedbackMonth = nextMonthKey(selectedMonth);

  const [eerrcc, clientesTrend, feedbackRaw, statusRaw, analisisResumen] = await Promise.all([
    getEERRCCForMonth(selectedMonth),
    getClientesTrend(),
    getFeedbackData(),
    getStatusClientes(),
    getAnalisisClientesResumen(),
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
