import {
  getCashflowForMonth, getEERRCCForMonth, getCashCollectedTimeSeries,
  getDevengadosTimeSeries, getMarketingGastoForMonth, getClientesTrend,
  getVentasReuniones, filterReuniones, isClosedStatus, isEffectiveReunion,
  getFeedbackData, filterFeedbackByMonth,
  currentMonthKey, formatARS,
} from "@/lib/sheets";
import { buildAlerts } from "@/lib/metrics";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { CashVsDevengadoChart } from "@/components/charts/CashVsDevengadoChart";
import { ClientesTrendChart } from "@/components/charts/ClientesTrendChart";
import {
  DollarSign, Users, TrendingUp, BarChart3,
  AlertTriangle, CheckCircle, RefreshCw, Target, Star,
} from "lucide-react";
import Link from "next/link";

export const revalidate = 1800;

export default async function HomeDashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const selectedMonth = sp.month ?? currentMonthKey();

  const [cashflow, eerrcc, gastoMkt, reunionesRaw, feedbackRaw, cashSeries, devengadoSeries, clientesTrend] =
    await Promise.all([
      getCashflowForMonth(selectedMonth),
      getEERRCCForMonth(selectedMonth),
      getMarketingGastoForMonth(selectedMonth),
      getVentasReuniones(),
      getFeedbackData(),
      getCashCollectedTimeSeries(),
      getDevengadosTimeSeries(),
      getClientesTrend(),
    ]);

  // ── Ventas filtradas por mes (fecha de reunion, col L) ──
  const reuniones = filterReuniones(
    reunionesRaw.filter((r) => r["Prospecto"] && r["Fecha de reunion"]),
    { monthKey: selectedMonth, dateCol: "Fecha de reunion" }
  );

  const cerradas = reuniones.filter((r) => isClosedStatus(r["Status"] ?? ""));
  const efectivas = reuniones.filter((r) => isEffectiveReunion(r["Status"] ?? ""));
  const noShowCancelados = reuniones.filter((r) => {
    const s = (r["Status"] ?? "").toLowerCase();
    return s.includes("no show") || s.includes("cancelado");
  });

  const tasaCierre = efectivas.length > 0 ? cerradas.length / efectivas.length : null;
  const noShowRate = reuniones.length > 0 ? noShowCancelados.length / reuniones.length : null;

  // Nuevos del mes = cerrados en la fecha de reunión del mes
  const nuevosMes = cerradas.length;

  // CAC = gasto marketing del mes / cierres del mes
  const cac = cerradas.length > 0 && gastoMkt > 0 ? gastoMkt / cerradas.length : null;

  // ── Feedback del mes ──
  const feedbackMes = filterFeedbackByMonth(feedbackRaw, { monthKey: selectedMonth });
  const puntajes = feedbackMes
    .map((r) => parseFloat(r["¿Qué puntaje le darías al acompañamiento?"] ?? ""))
    .filter((n) => !isNaN(n));
  const avgNPS = puntajes.length > 0 ? puntajes.reduce((a, b) => a + b, 0) / puntajes.length : null;

  // ── KPIs del mes ──
  const cashCollected = cashflow?.cashCollected ?? 0;
  const totalGastos = cashflow?.totalGastos ?? 0;
  const cashflowCC = cashflow?.cashflowCC ?? 0;
  const devengados = eerrcc?.ingresosDevengados ?? null;
  const cantClientes = eerrcc?.totalClientesActivos ?? null;
  const renovaciones = eerrcc?.clientesRenovados ?? null;
  const margen = cashCollected > 0 ? cashflowCC / cashCollected : null;

  // ── Alertas ──
  const alerts = buildAlerts({
    showRate: noShowRate !== null ? 1 - noShowRate : null,
    tasaCierre,
    churnCount: 0,
    prevChurnCount: 0,
    margenBruto: margen,
    prevMargenBruto: null,
    noShowRate,
  });

  // ── Chart data (últimos 12 meses) ──
  const last12 = cashSeries.slice(-12);
  const chartData = last12.map((c) => ({
    label: c.label,
    cashCollected: c.cashCollected,
    devengados: devengadoSeries.find((d) => d.month === c.month)?.devengados ?? 0,
  }));

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mesLabel = `${MESES_ES[selMonth - 1]} ${selYear}`;

  return (
    <div>
      <PageHeader
        title="Dashboard Ejecutivo"
        description={`Resumen del negocio — ${mesLabel}`}
        actions={<MonthSelector selected={selectedMonth} />}
      />

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium border ${
                a.level === "red"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-300"
              }`}
            >
              <AlertTriangle size={15} className="flex-shrink-0" />
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* KPIs fila 1 — Financiero */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard
          label="Cash Collected"
          value={cashCollected > 0 ? formatARS(cashCollected) : "—"}
          sub={`Gastos CC: ${totalGastos > 0 ? formatARS(totalGastos) : "—"}`}
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          label="Cashflow CC"
          value={cashflowCC !== 0 ? formatARS(cashflowCC) : "—"}
          sub={margen !== null ? `Margen: ${(margen * 100).toFixed(1)}%` : undefined}
          icon={TrendingUp}
          color={cashflowCC >= 0 ? "green" : "rose" as "green"}
        />
        <KPICard
          label="Ingresos Devengados"
          value={devengados !== null ? formatARS(devengados) : "—"}
          sub="EERR CC"
          icon={BarChart3}
          color="purple"
        />
        <KPICard
          label="Clientes activos"
          value={cantClientes ?? "—"}
          sub={eerrcc ? `${eerrcc.clientesPrimerPrograma ?? "—"} 1er prog · ${renovaciones ?? "—"} renov · ${eerrcc.downsell ?? "—"} downsell` : undefined}
          icon={Users}
          color="amber"
        />
      </div>

      {/* KPIs fila 2 — Ventas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          label="Tasa de cierre"
          value={tasaCierre !== null ? `${(tasaCierre * 100).toFixed(0)}%` : "—"}
          sub={`${cerradas.length} cerradas / ${efectivas.length} efectivas`}
          icon={Target}
          color={tasaCierre !== null && tasaCierre < 0.2 ? "rose" as "blue" : "blue"}
        />
        <KPICard
          label="Nuevos clientes"
          value={nuevosMes}
          sub="Seña/confirmados este mes"
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          label="CAC del mes"
          value={cac !== null ? formatARS(cac) : "—"}
          sub="Gasto mkt / cierres"
          icon={BarChart3}
          color="purple"
        />
        <KPICard
          label="NPS promedio"
          value={avgNPS !== null ? avgNPS.toFixed(1) : "—"}
          sub={`${puntajes.length} respuestas este mes`}
          icon={Star}
          color="amber"
        />
      </div>

      {/* Gráfico Cash Collected vs Devengado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Cash Collected vs Devengado — mensual</h2>
            <Link href="/dashboard/finanzas" className="text-xs text-brand-500 hover:text-brand-400">
              Ver finanzas →
            </Link>
          </div>
          <CashVsDevengadoChart data={chartData} />
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Clientes activos — evolución</h2>
            <Link href="/dashboard/clientes" className="text-xs text-brand-500 hover:text-brand-400">
              Ver clientes →
            </Link>
          </div>
          <ClientesTrendChart data={clientesTrend.slice(-12)} />
        </div>
      </div>

      {/* Links rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { href: "/dashboard/finanzas", label: "Finanzas", sub: "EERR + Cashflow" },
          { href: "/dashboard/clientes", label: "Clientes", sub: "Pipeline + Perfiles" },
          { href: "/dashboard/ventas", label: "Ventas", sub: "Funnel + Closers" },
          { href: "/dashboard/operaciones", label: "Operaciones", sub: "Coaches + Feedback" },
        ].map(({ href, label, sub }) => (
          <Link
            key={href}
            href={href}
            className="card hover:border-brand-600/50 hover:bg-surface-800 transition-colors cursor-pointer"
          >
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-slate-500 mt-1">{sub}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
