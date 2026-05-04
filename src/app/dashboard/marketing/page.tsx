import { getMarketingTotales, getMarketingVSL, getMarketingInversion, getMarketingRubros, getMarketingMsgIG, getMarketingFMA, dateStrToMonthKey, parseUSD } from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { MarketingFunnelChart } from "@/components/charts/MarketingFunnelChart";
import { InversionChart } from "@/components/charts/InversionChart";
import { VSLTable, RubrosTable } from "@/components/tables/MarketingTables";
import { DollarSign, Users, Calendar, Target, ImageIcon } from "lucide-react";

export const revalidate = 3600;

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const [totales, vsl, inversion, rubros, msgIG, fma] = await Promise.all([
    getMarketingTotales(),
    getMarketingVSL(),
    getMarketingInversion(),
    getMarketingRubros(),
    getMarketingMsgIG(),
    getMarketingFMA(),
  ]);

  // Date filter helper
  const inRange = (dateStr: string) => {
    if (!sp.from && !sp.to) return true;
    const parts = (dateStr ?? "").trim().split("/");
    if (parts.length < 2) return false;
    const year = parts.length === 3 ? parseInt(parts[2]) : new Date().getFullYear();
    const d = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
    if (sp.from && d < new Date(sp.from)) return false;
    if (sp.to && d > new Date(sp.to + "T23:59:59")) return false;
    return true;
  };

  const totalesFilt = totales.filter((r) => inRange(r["Fecha"] ?? ""));
  const vslFilt = vsl.filter((r) => inRange(r["Fecha"] ?? ""));
  const msgIGFilt = msgIG.filter((r) => inRange(r["Fecha"] ?? ""));
  const fmaFilt = fma.filter((r) => inRange(r["Fecha"] ?? ""));

  const gastoTotal = totalesFilt.reduce((acc, r) => acc + parseUSD(r["$"] ?? ""), 0);
  const leadsTotal = totalesFilt.reduce((acc, r) => acc + (parseInt(r["Leads totales"]) || 0), 0);
  const agendadosTotal = totalesFilt.reduce((acc, r) => acc + (parseInt(r["AGENDADO"]) || 0), 0);
  const cpa = agendadosTotal > 0 ? gastoTotal / agendadosTotal : 0;

  // Por canal
  const gastoVSL = vslFilt.reduce((acc, r) => acc + parseUSD(r["Gasto"] ?? ""), 0);
  const agendasVSL = vslFilt.reduce((acc, r) => acc + (parseInt(r["Agendas"]) || 0), 0);
  const gastoIG = msgIGFilt.reduce((acc, r) => acc + parseUSD(r["$"] ?? ""), 0);
  const agendasIG = msgIGFilt.reduce((acc, r) => acc + (parseInt(r["AGENDADO"]) || 0), 0);
  const gastoFMA = fmaFilt.reduce((acc, r) => acc + parseUSD(r["$"] ?? ""), 0);
  const agendasFMA = fmaFilt.reduce((acc, r) => acc + (parseInt(r["AGENDADO"] ?? r["Agenda"] ?? "0")) || 0, 0);

  const canales = [
    { nombre: "VSL", gasto: gastoVSL, agendas: agendasVSL, cpa: agendasVSL > 0 ? gastoVSL / agendasVSL : 0 },
    { nombre: "MSG IG", gasto: gastoIG, agendas: agendasIG, cpa: agendasIG > 0 ? gastoIG / agendasIG : 0 },
    { nombre: "FMA", gasto: gastoFMA, agendas: agendasFMA, cpa: agendasFMA > 0 ? gastoFMA / agendasFMA : 0 },
  ].filter((c) => c.gasto > 0 || c.agendas > 0);

  return (
    <div>
      <PageHeader title="Marketing" description="Ads, canales y creativos" actions={<DateRangePicker from={sp.from} to={sp.to} />} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard label="Inversión total" value={`$${gastoTotal.toLocaleString("es-AR")}`} icon={DollarSign} color="blue" />
        <KPICard label="Leads totales" value={leadsTotal} icon={Users} color="purple" />
        <KPICard label="Agendados" value={agendadosTotal} icon={Calendar} color="green" />
        <KPICard label="CPA promedio" value={`$${cpa.toFixed(0)}`} sub="Costo por agenda" icon={Target} color="amber" />
      </div>

      {/* Performance por canal */}
      <div className="card mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Performance por canal</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800">
                {["Canal", "Inversión", "Agendas", "CPA", "% del total"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {canales.map((c) => (
                <tr key={c.nombre} className="border-b border-surface-800/60 hover:bg-surface-800/40">
                  <td className="px-4 py-3 font-medium text-white">{c.nombre}</td>
                  <td className="px-4 py-3 text-brand-400">${c.gasto.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                  <td className="px-4 py-3 text-slate-300">{c.agendas}</td>
                  <td className="px-4 py-3 text-amber-400 font-mono">${c.cpa.toFixed(0)}</td>
                  <td className="px-4 py-3 text-slate-400">{gastoTotal > 0 ? `${((c.gasto / gastoTotal) * 100).toFixed(0)}%` : "—"}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-surface-700 bg-surface-800/30">
                <td className="px-4 py-3 font-semibold text-white">Total</td>
                <td className="px-4 py-3 font-semibold text-brand-400">${gastoTotal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                <td className="px-4 py-3 font-semibold text-slate-300">{agendadosTotal}</td>
                <td className="px-4 py-3 font-semibold text-amber-400 font-mono">${cpa.toFixed(0)}</td>
                <td className="px-4 py-3 text-slate-400">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Inversión semanal</h2>
          <InversionChart data={inversion} />
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Funnel de conversión acumulado</h2>
          <MarketingFunnelChart data={totales} />
        </div>
      </div>

      {/* Creativos — Placeholder */}
      <div className="card mb-8 border-dashed border-2 border-surface-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <ImageIcon size={18} className="text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Creativos</h2>
            <p className="text-xs text-slate-500">Ranking de anuncios por performance</p>
          </div>
          <span className="ml-auto badge bg-amber-400/10 text-amber-400">Próximamente</span>
        </div>
        <p className="text-sm text-slate-400">
          Cuando Facu tenga el Excel con fecha de posteo, formato, ángulo y métricas de cada creativo, lo conectamos acá.
          Va a mostrar ranking automático de los top 10 anuncios y los peores 10.
        </p>
      </div>

      {/* VSL */}
      <div className="mb-6">
        <h2 className="text-base font-semibold text-white mb-3">VSL — Historial</h2>
        <VSLTable data={vsl.slice(-20).reverse()} />
      </div>

      {/* Rubros */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Tipo de negocio de leads</h2>
        <RubrosTable data={rubros.filter((r) => r["Nombre"])} />
      </div>
    </div>
  );
}
