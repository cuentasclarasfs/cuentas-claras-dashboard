import {
  getCashflowForMonth, getEERRCCForMonth, getAhorroTimeSeries,
  formatARS, currentMonthKey,
} from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { AhorroTrendChart } from "@/components/charts/AhorroTrendChart";
import {
  DollarSign, TrendingUp, TrendingDown, Users,
  BarChart3, Target, Percent, Star,
} from "lucide-react";

export const revalidate = 1800;

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const selectedMonth = sp.month ?? currentMonthKey();

  const [cashflow, eerrcc, ahorroSeries] = await Promise.all([
    getCashflowForMonth(selectedMonth),
    getEERRCCForMonth(selectedMonth),
    getAhorroTimeSeries(),
  ]);

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mesLabel = `${MESES_ES[selMonth - 1]} ${selYear}`;

  // Financiero
  const cashCollected = cashflow?.cashCollected ?? 0;
  const egresosCC = cashflow?.totalGastos ?? 0;
  const profitNeto = cashflow?.cashflowCC ?? 0;
  const gastosPersonales = cashflow?.totalGastosPersonales ?? 0;
  const primerProgramaCC = cashflow?.primerProgramaCC ?? 0;
  const renovadosCC = cashflow?.renovadosCC ?? 0;
  const margenCC = cashCollected > 0 ? (profitNeto / cashCollected) * 100 : 0;

  // Ingresos por categoría
  const ingresosCat = [
    { label: "1er Programa", value: primerProgramaCC },
    { label: "Renovados", value: renovadosCC },
  ].filter((c) => c.value > 0);

  // Económico
  const ingresosDevengados = eerrcc?.ingresosDevengados ?? null;
  const gastosVariables = eerrcc?.totalGastosVariables ?? null;
  const resultadoBruto = eerrcc?.resultadoBruto ?? null;
  const gastosFijos = eerrcc?.totalGastosFijos ?? null;
  const resultadoNeto = eerrcc?.resultadoNeto ?? null;
  const totalClientes = eerrcc?.totalClientesActivos ?? null;

  // Análisis Publicidad
  const clientesNuevos = eerrcc?.clientesNuevosCerrados ?? null;
  const gastosMkt = eerrcc?.gastosMarketingRedes ?? null;
  const cac = eerrcc?.cac ?? null;

  // LTGP
  const ticketPromedio = eerrcc?.ticketPromedio ?? null;
  const grossProfit = eerrcc?.grossProfit ?? null;
  const numMeses = eerrcc?.numMeses ?? null;
  const ltgp = eerrcc?.ltgp ?? null;
  const relacionLTGPCAC = eerrcc?.relacionLTGPCAC ?? null;

  const fmt = (n: number | null) => n !== null ? formatARS(n) : "—";
  const fmtX = (n: number | null) => n !== null ? `${n.toFixed(1)}x` : "—";
  const fmtN = (n: number | null) => n !== null ? n.toFixed(1) : "—";

  return (
    <div>
      <PageHeader
        title="Finanzas"
        description={`Estado financiero y económico — ${mesLabel}`}
        actions={<MonthSelector selected={selectedMonth} />}
      />

      {/* ── SECCIÓN FINANCIERO ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Financiero</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          label="Cash Collected"
          value={cashCollected > 0 ? fmt(cashCollected) : "—"}
          sub="Total ingresos cobrados"
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          label="Egresos CC"
          value={egresosCC > 0 ? fmt(egresosCC) : "—"}
          sub="Total gastos Cuentas Claras"
          icon={TrendingDown}
          color="rose"
        />
        <KPICard
          label="Profit Neto"
          value={cashCollected > 0 ? fmt(profitNeto) : "—"}
          sub={cashCollected > 0 ? `Margen: ${margenCC.toFixed(1)}%` : undefined}
          icon={TrendingUp}
          color={profitNeto >= 0 ? "green" : "rose" as "green"}
        />
        <KPICard
          label="Gastos Personales"
          value={gastosPersonales > 0 ? fmt(gastosPersonales) : "—"}
          sub="Total gastos personales"
          icon={Users}
          color="amber"
        />
      </div>

      {/* Ingresos por categoría + Ahorro */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-5">Ingresos por categoría — {mesLabel}</h3>
          {ingresosCat.length > 0 ? (
            <div className="space-y-4">
              {ingresosCat.map(({ label, value }) => (
                <div key={label} className="flex items-center gap-4">
                  <span className="text-sm text-slate-400 w-28 flex-shrink-0">{label}</span>
                  <div className="flex-1 bg-surface-800 rounded-full h-3">
                    <div
                      className="bg-brand-500 h-3 rounded-full"
                      style={{ width: `${cashCollected > 0 ? (value / cashCollected) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-300 w-28 text-right tabular-nums font-medium">{fmt(value)}</span>
                  <span className="text-xs text-slate-500 w-10 text-right">
                    {cashCollected > 0 ? `${((value / cashCollected) * 100).toFixed(0)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Sin datos este mes</p>
          )}
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-4">Ahorro del mes — evolución</h3>
          <AhorroTrendChart data={ahorroSeries.slice(-18)} />
        </div>
      </div>

      {/* ── SECCIÓN ECONÓMICO ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Económico</h2>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KPICard label="Ingresos Devengados" value={fmt(ingresosDevengados)} sub="EERR CC" icon={BarChart3} color="blue" />
        <KPICard label="Gastos Variables" value={fmt(gastosVariables)} icon={TrendingDown} color="rose" />
        <KPICard
          label="Resultado Bruto"
          value={fmt(resultadoBruto)}
          sub={ingresosDevengados && resultadoBruto ? `Margen: ${((resultadoBruto / ingresosDevengados) * 100).toFixed(1)}%` : undefined}
          icon={TrendingUp}
          color={resultadoBruto !== null && resultadoBruto >= 0 ? "green" : "rose" as "green"}
        />
        <KPICard label="Gastos Fijos" value={fmt(gastosFijos)} icon={TrendingDown} color="amber" />
        <KPICard
          label="Resultado Neto"
          value={fmt(resultadoNeto)}
          sub={ingresosDevengados && resultadoNeto ? `Margen: ${((resultadoNeto / ingresosDevengados) * 100).toFixed(1)}%` : undefined}
          icon={TrendingUp}
          color={resultadoNeto !== null && resultadoNeto >= 0 ? "green" : "rose" as "green"}
        />
        <KPICard label="Clientes Activos" value={totalClientes ?? "—"} icon={Users} color="purple" />
      </div>

      {/* Análisis Publicidad + LTGP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-5">Análisis Publicidad</h3>
          <div className="space-y-4">
            <MetricRow label="Clientes nuevos cerrados" value={clientesNuevos !== null ? String(clientesNuevos) : "—"} />
            <MetricRow label="Gastos Marketing y Redes" value={fmt(gastosMkt)} highlight="blue" />
            <MetricRow label="CAC" value={fmt(cac)} highlight="amber" />
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-slate-300 mb-5">Ticket Promedio / LTGP</h3>
          <div className="space-y-4">
            <MetricRow label="Ticket Promedio" value={fmt(ticketPromedio)} highlight="blue" />
            <MetricRow label="Gross Profit" value={fmt(grossProfit)} highlight="green" />
            <MetricRow label="# de meses" value={numMeses !== null ? fmtN(numMeses) : "—"} />
            <MetricRow label="LTGP" value={fmt(ltgp)} highlight="purple" />
            <MetricRow
              label="Relación LTGP:CAC"
              value={relacionLTGPCAC !== null ? fmtX(relacionLTGPCAC) : "—"}
              highlight={relacionLTGPCAC !== null && relacionLTGPCAC >= 3 ? "green" : "amber"}
              large
            />
          </div>
        </div>

      </div>
    </div>
  );
}

function MetricRow({
  label, value, highlight, large,
}: {
  label: string;
  value: string;
  highlight?: "blue" | "green" | "amber" | "purple";
  large?: boolean;
}) {
  const colorMap = {
    blue: "text-brand-400",
    green: "text-emerald-400",
    amber: "text-amber-400",
    purple: "text-purple-400",
  };
  const valueClass = highlight ? colorMap[highlight] : "text-slate-300";
  return (
    <div className="flex items-center justify-between py-1 border-b border-surface-800/60 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`font-semibold tabular-nums ${large ? "text-lg" : "text-sm"} ${valueClass}`}>{value}</span>
    </div>
  );
}
