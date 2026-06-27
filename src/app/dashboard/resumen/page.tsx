import { currentUser } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import {
  getEERRCCForMonth, getCashflowForMonth, getMarketingGastoForMonth,
  getVentasReuniones, filterReuniones, isClosedStatus, parseNumES,
  getFeedbackData, filterFeedbackByMonth, getOpsMetrics,
  getRenovadosTrend, getCashCollectedTimeSeries, getDevengadosTimeSeries,
  formatARS, currentMonthKey,
} from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { CashVsDevengadoChart } from "@/components/charts/CashVsDevengadoChart";
import { RenovadosTrendChart } from "@/components/charts/RenovadosTrendChart";
import {
  DollarSign, TrendingUp, TrendingDown, Users,
  Target, Star, Megaphone, AlertTriangle, RefreshCw,
} from "lucide-react";

export const revalidate = 300;

const OWNER_EMAIL = "cuentaclaraok@gmail.com";

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

function defaultMonthRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2,"0")}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${y}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
  return { from, to };
}

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  // Owner-only gate
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  if (email !== OWNER_EMAIL) notFound();

  const sp = await searchParams;
  const selectedMonth = sp.month ?? currentMonthKey();
  const { from, to } = defaultMonthRange(selectedMonth);

  // Prev month
  const [y, m] = selectedMonth.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
  const prevRange = defaultMonthRange(prevMonthKey);

  const [
    eerrcc, eerrccPrev, cashflow, gastoMkt, gastoMktPrev,
    reunionesRaw, feedbackRaw, opsMetrics,
    renovadosTrend, cashSeries, devengadoSeries,
  ] = await Promise.all([
    getEERRCCForMonth(selectedMonth),
    getEERRCCForMonth(prevMonthKey),
    getCashflowForMonth(selectedMonth),
    getMarketingGastoForMonth(selectedMonth),
    getMarketingGastoForMonth(prevMonthKey),
    getVentasReuniones(),
    getFeedbackData(),
    getOpsMetrics(),
    getRenovadosTrend(),
    getCashCollectedTimeSeries(),
    getDevengadosTimeSeries(),
  ]);

  // ── Agendas del mes (por fecha de agenda, para CPA) ──
  const agendasMes = reunionesRaw.filter(
    (r) => r["Prospecto"] && inDateRange(r["Fecha de la agenda"] ?? "", from, to)
  );
  const cpa = agendasMes.length > 0 && gastoMkt > 0 ? gastoMkt / agendasMes.length : null;

  // ── Ventas del mes (por fecha de reunión) ──
  const reuniones = reunionesRaw.filter(
    (r) => r["Prospecto"] && inDateRange(r["Fecha de reunion"], from, to)
  );
  const reunionesPrev = reunionesRaw.filter(
    (r) => r["Prospecto"] && inDateRange(r["Fecha de reunion"], prevRange.from, prevRange.to)
  );

  const cerrados     = reuniones.filter((r) => isClosedStatus(r["Status"]));
  const cerradosPrev = reunionesPrev.filter((r) => isClosedStatus(r["Status"]));
  const efectivas    = reuniones.filter((r) => {
    const s = (r["Status"] ?? "").toLowerCase();
    return !s.includes("no presentado") && !s.includes("no show") && s !== "cancelado";
  });
  const efectivasPrev = reunionesPrev.filter((r) => {
    const s = (r["Status"] ?? "").toLowerCase();
    return !s.includes("no presentado") && !s.includes("no show") && s !== "cancelado";
  });

  const crPct     = efectivas.length > 0 ? (cerrados.length / efectivas.length) * 100 : 0;
  const crPctPrev = efectivasPrev.length > 0 ? (cerradosPrev.length / efectivasPrev.length) * 100 : 0;

  const aovVals = reuniones.map((r) => parseNumES(r["AOV Trato cerrado"] ?? "")).filter((v) => v > 0);
  const aovProm = aovVals.length > 0 ? aovVals.reduce((s, v) => s + v, 0) / aovVals.length : 0;

  // ── Feedback del mes siguiente (feedback lag) ──
  const [fy, fm] = selectedMonth.split("-").map(Number);
  const nextDate = new Date(fy, fm, 1);
  const feedbackMonthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
  const feedbackMes = filterFeedbackByMonth(feedbackRaw, { monthKey: feedbackMonthKey });
  const puntajes = feedbackMes
    .map((r) => parseFloat(r["¿Qué puntaje le darías al acompañamiento?"] ?? ""))
    .filter((n) => !isNaN(n));
  const avgNPS = puntajes.length > 0 ? puntajes.reduce((a, b) => a + b, 0) / puntajes.length : null;

  // ── Métricas ──
  const cashCollected    = cashflow?.cashCollected ?? 0;
  const resultadoNeto    = eerrcc?.resultadoNeto ?? null;
  const ingresosDevengados = eerrcc?.ingresosDevengados ?? null;
  const margenNeto       = ingresosDevengados && resultadoNeto ? (resultadoNeto / ingresosDevengados) * 100 : null;

  const totalActivos     = eerrcc?.totalClientesActivos ?? null;
  const totalActivosPrev = eerrccPrev?.totalClientesActivos ?? null;
  const primerProg       = eerrcc?.clientesPrimerPrograma ?? null;
  const renovados        = eerrcc?.clientesRenovados ?? null;
  const downsell         = eerrcc?.downsell ?? null;
  const churn            = eerrcc?.clientesChurn ?? null;
  const seVencen         = eerrcc?.clientesQueSeVencen ?? null;
  const pctRenovados     = eerrcc?.pctRenovados ?? null;
  const pctRenovadosPrev = eerrccPrev?.pctRenovados ?? null;

  const cac              = eerrcc?.cac ?? null;
  const cacPrev          = eerrccPrev?.cac ?? null;
  const ltgp             = eerrcc?.ltgp ?? null;
  const ltgpCac          = eerrcc?.relacionLTGPCAC ?? null;

  const variacionClientes = totalActivos !== null && totalActivosPrev !== null
    ? totalActivos - totalActivosPrev : null;

  // ── Chart data ──
  const last12 = cashSeries.slice(-12);
  const cashChartData = last12.map((c) => ({
    label: c.label,
    cashCollected: c.cashCollected,
    devengados: devengadoSeries.find((d) => d.month === c.month)?.devengados ?? 0,
  }));

  const renovadosLast12 = renovadosTrend.slice(-12);

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mesLabel = `${MESES_ES[selMonth - 1]} ${selYear}`;

  const fmt  = (n: number | null) => n !== null ? formatARS(n) : "—";
  const fmtN = (n: number | null, dec = 1) => n !== null ? n.toFixed(dec) : "—";

  function DiffBadge({ curr, prev, lowerBetter = false, suffix = "%" }: {
    curr: number | null; prev: number | null; lowerBetter?: boolean; suffix?: string;
  }) {
    if (curr === null || prev === null || prev === 0) return null;
    const d = ((curr - prev) / Math.abs(prev)) * 100;
    if (Math.abs(d) < 1) return null;
    const good = lowerBetter ? d < 0 : d > 0;
    return (
      <span className={`text-xs font-semibold ${good ? "text-emerald-400" : "text-rose-400"}`}>
        {d > 0 ? "▲" : "▼"}{Math.abs(d).toFixed(0)}{suffix}
      </span>
    );
  }

  function AbsDiffBadge({ curr, prev, lowerBetter = false }: {
    curr: number | null; prev: number | null; lowerBetter?: boolean;
  }) {
    if (curr === null || prev === null) return null;
    const d = curr - prev;
    if (d === 0) return null;
    const good = lowerBetter ? d < 0 : d > 0;
    return (
      <span className={`text-xs font-semibold ${good ? "text-emerald-400" : "text-rose-400"}`}>
        {d > 0 ? "+" : ""}{d}
      </span>
    );
  }

  return (
    <div>
      <PageHeader
        title="Resumen Ejecutivo"
        description={`Vista global del negocio — ${mesLabel}`}
        actions={<MonthSelector selected={selectedMonth} />}
      />

      {/* ── FINANCIERO ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Financiero</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <KPICard
          label="Cash Collected"
          value={cashCollected > 0 ? fmt(cashCollected) : "—"}
          sub={cashflow?.totalGastos ? `Gastos: ${fmt(cashflow.totalGastos)}` : undefined}
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          label="Resultado Neto"
          value={fmt(resultadoNeto)}
          sub={margenNeto !== null ? `Margen: ${margenNeto.toFixed(1)}%` : undefined}
          icon={resultadoNeto !== null && resultadoNeto >= 0 ? TrendingUp : TrendingDown}
          color={resultadoNeto !== null && resultadoNeto >= 0 ? "green" : "rose" as "green"}
        />
        <KPICard
          label="Ingresos Devengados"
          value={fmt(ingresosDevengados)}
          sub="EERR CC"
          icon={TrendingUp}
          color="purple"
        />
      </div>

      {/* ── CLIENTES ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Clientes</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard
          label="Total Activos"
          value={totalActivos ?? "—"}
          sub={variacionClientes !== null
            ? `${variacionClientes >= 0 ? "+" : ""}${variacionClientes} vs mes ant.`
            : undefined}
          icon={Users}
          color={variacionClientes !== null && variacionClientes >= 0 ? "green" : "rose" as "green"}
        />
        <KPICard
          label="1er Programa"
          value={primerProg ?? "—"}
          sub={primerProg !== null && totalActivos ? `${((primerProg / totalActivos) * 100).toFixed(0)}% del total` : undefined}
          icon={Users}
          color="blue"
        />
        <KPICard
          label="Renovados"
          value={renovados ?? "—"}
          sub={renovados !== null && totalActivos ? `${((renovados / totalActivos) * 100).toFixed(0)}% del total` : undefined}
          icon={RefreshCw}
          color="purple"
        />
        <KPICard
          label="Downsell"
          value={downsell ?? "—"}
          sub={downsell !== null && totalActivos ? `${((downsell / totalActivos) * 100).toFixed(0)}% del total` : undefined}
          icon={TrendingDown}
          color="amber"
        />
      </div>

      {/* Churn / Vencimientos / % Renovados */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-rose-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-rose-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Bajas del mes</p>
            <p className="text-2xl font-bold text-rose-400 tabular-nums">{churn ?? "—"}</p>
            <p className="text-xs text-slate-600">Arrancaron y no terminaron</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">Se vencen este mes</p>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">{seVencen ?? "—"}</p>
            <p className="text-xs text-slate-600">Clientes que finalizan 1er programa</p>
          </div>
        </div>
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={18} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-0.5">% Renovados</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-indigo-400 tabular-nums">
                {pctRenovados !== null ? `${pctRenovados.toFixed(1)}%` : "—"}
              </p>
              <DiffBadge curr={pctRenovados} prev={pctRenovadosPrev} suffix="pp" />
            </div>
            <p className="text-xs text-slate-600">
              Ant: {pctRenovadosPrev !== null ? `${pctRenovadosPrev.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* ── ADQUISICIÓN ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Adquisición</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* 1 — Inversión */}
        <KPICard
          label="Inversión"
          value={gastoMkt > 0 ? `$${Math.round(gastoMkt).toLocaleString()}` : "—"}
          sub={gastoMktPrev > 0 ? `Ant: $${Math.round(gastoMktPrev).toLocaleString()}` : undefined}
          icon={Megaphone}
          color="amber"
        />
        {/* 2 — Agendas + CPA */}
        <KPICard
          label="Agendas"
          value={agendasMes.length || reuniones.length}
          sub={cpa !== null ? `CPA: $${Math.round(cpa).toLocaleString()}` : `Efect: ${efectivas.length}`}
          icon={Target}
          color="blue"
        />
        {/* 3 — Cierres + vs ant + CR% */}
        <KPICard
          label="Cierres"
          value={cerrados.length}
          sub={[
            crPct > 0 ? `CR: ${crPct.toFixed(0)}%` : null,
            cerradosPrev.length > 0 ? `ant: ${cerradosPrev.length}` : null,
          ].filter(Boolean).join(" · ") || undefined}
          icon={Target}
          color={crPct >= 30 ? "green" : "rose" as "green"}
        />
        {/* 4 — CAC */}
        <KPICard
          label="CAC"
          value={fmt(cac)}
          sub={cacPrev !== null ? `Ant: ${fmt(cacPrev)}` : undefined}
          icon={DollarSign}
          color={cac !== null && cacPrev !== null && cac <= cacPrev ? "green" : "amber" as "green"}
        />
        {/* 5 — AOV */}
        <KPICard
          label="AOV Prom."
          value={aovProm > 0 ? fmt(aovProm) : "—"}
          sub="Trato cerrado"
          icon={DollarSign}
          color="purple"
        />
        {/* 6 — LTGP */}
        <KPICard
          label="LTGP"
          value={fmt(ltgp)}
          sub={eerrcc?.numMeses !== null && eerrcc?.numMeses ? `${eerrcc.numMeses.toFixed(1)} meses` : undefined}
          icon={TrendingUp}
          color="green"
        />
        {/* 7 — LTGP:CAC */}
        <KPICard
          label="LTGP : CAC"
          value={ltgpCac !== null ? `${ltgpCac.toFixed(1)}x` : "—"}
          sub={ltgpCac !== null ? (ltgpCac >= 3 ? "✓ objetivo ≥3x" : "⚠ por debajo de 3x") : undefined}
          icon={TrendingUp}
          color={ltgpCac !== null && ltgpCac >= 3 ? "green" : "rose" as "green"}
        />
      </div>

      {/* ── CALIDAD ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Calidad</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <KPICard
          label="NPS Promedio"
          value={avgNPS !== null ? avgNPS.toFixed(1) : "—"}
          sub={`${puntajes.length} respuestas`}
          icon={Star}
          color={avgNPS !== null && avgNPS >= 8 ? "green" : "amber" as "green"}
        />
        <KPICard
          label="Permanencia promedio"
          value={opsMetrics.mesesPromedio !== null ? `${opsMetrics.mesesPromedio.toFixed(1)} m` : "—"}
          sub={opsMetrics.mesesRenovacion !== null ? `+${opsMetrics.mesesRenovacion.toFixed(1)} m si renuevan` : undefined}
          icon={RefreshCw}
          color="blue"
        />
      </div>

      {/* ── GRÁFICOS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Cash Collected vs Devengado — últimos 12 meses</h3>
          <CashVsDevengadoChart data={cashChartData} />
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-1">% Renovados — evolución</h3>
          <p className="text-xs text-slate-600 mb-3">Barras: clientes que se vencían vs. renovaron · Línea: %</p>
          <RenovadosTrendChart data={renovadosLast12} />
        </div>
      </div>
    </div>
  );
}
