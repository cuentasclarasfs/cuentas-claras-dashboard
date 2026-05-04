import { getStatusClientes, getAnalisisClientes, getFeedbackData, getDownsell, getSueldos, currentMonthKey } from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { KPICard } from "@/components/ui/KPICard";
import { MonthSelector } from "@/components/ui/MonthSelector";
import { SatisfaccionChart } from "@/components/charts/SatisfaccionChart";
import { Users, Star, TrendingUp, AlertCircle } from "lucide-react";

export const revalidate = 1800;

const FEEDBACK_KEYS = {
  puntaje: "¿Qué puntaje le darías al acompañamiento?",
  avance: " ¿Qué tanto sentís que estás avanzando hacia tus objetivos financieros con el programa?  ",
  conocimiento: "¿Qué tanto conocés tu números hoy?",
  tranquilidad: "¿Cuan tranquilo/a estas con tus finanzas hoy?",
  recomendacion: "¿Probabilidad de recomendación?",
};

function avg(arr: number[]) {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export default async function OperacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const selectedMonth = sp.month ?? currentMonthKey();
  const [statusRaw, analisis, feedback, downsell, sueldos] = await Promise.all([
    getStatusClientes(),
    getAnalisisClientes(),
    getFeedbackData(),
    getDownsell(),
    getSueldos("26"),
  ]);

  const clientes = statusRaw.filter((r) => r["Cliente"]);
  const activos = clientes.filter((r) => {
    const s = String(r["Status"] ?? "").toLowerCase();
    return s.includes("devengando") || s.includes("activ");
  });

  // Coaches únicos (de sueldos o status)
  const coachesSet = new Set<string>();
  clientes.forEach((r) => { if (r["Coach"]) coachesSet.add(r["Coach"].trim()); });
  const coaches = Array.from(coachesSet).sort();

  // Métricas por coach
  const coachMetrics = coaches.map((coach) => {
    const mis = clientes.filter((r) => r["Coach"]?.trim() === coach);
    const activos_ = mis.filter((r) => {
      const s = String(r["Status"] ?? "").toLowerCase();
      return s.includes("devengando") || s.includes("activ");
    });
    const bajas_ = mis.filter((r) => {
      const s = String(r["Status"] ?? "").toLowerCase();
      return s.includes("baja") || s.includes("cancel") || s.includes("inactivo");
    });

    // Feedback del coach
    const fbCoach = feedback.filter((r) => r["¿Quién te está acompañando en el programa?"]?.trim() === coach);
    const puntajes = fbCoach.map((r) => parseFloat(r[FEEDBACK_KEYS.puntaje])).filter((n) => !isNaN(n));
    const avgPuntaje = avg(puntajes);

    // Análisis para renovaciones
    const analisisCoach = analisis.filter((r) => r["Coach"]?.trim() === coach);
    const renovados = analisisCoach.filter((r) => String(r["Tipo de Cliente"] ?? "").toLowerCase().includes("renov"));
    const tasaRenov = analisisCoach.length > 0 ? (renovados.length / analisisCoach.length) * 100 : 0;
    const tasaBaja = mis.length > 0 ? (bajas_.length / mis.length) * 100 : 0;

    return { coach, total: mis.length, activos: activos_.length, bajas: bajas_.length, avgNPS: avgPuntaje, tasaRenov, tasaBaja, feedbacks: fbCoach.length };
  }).filter((c) => c.total > 0);

  // Métricas globales de feedback
  const allPuntajes = feedback.map((r) => parseFloat(r[FEEDBACK_KEYS.puntaje])).filter((n) => !isNaN(n));
  const allAvance = feedback.map((r) => parseFloat(r[FEEDBACK_KEYS.avance])).filter((n) => !isNaN(n));
  const allConocimiento = feedback.map((r) => parseFloat(r[FEEDBACK_KEYS.conocimiento])).filter((n) => !isNaN(n));
  const allTranquilidad = feedback.map((r) => parseFloat(r[FEEDBACK_KEYS.tranquilidad])).filter((n) => !isNaN(n));

  const globalNPS = avg(allPuntajes);
  const globalAvance = avg(allAvance);
  const globalConocimiento = avg(allConocimiento);
  const globalTranquilidad = avg(allTranquilidad);

  return (
    <div>
      <PageHeader title="Operaciones" description="Coaches, performance y satisfacción del programa" actions={<MonthSelector selected={selectedMonth} />} />

      {/* KPIs globales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard label="Clientes activos" value={activos.length} icon={Users} color="green" />
        <KPICard label="Downsell" value={downsell.filter((r) => r["Cliente"]).length} icon={AlertCircle} color="amber" />
        <KPICard label="NPS global" value={globalNPS?.toFixed(1) ?? "—"} sub="Puntaje acompañamiento" icon={Star} color="blue" />
        <KPICard label="Feedbacks totales" value={feedback.length} sub={`${coaches.length} coaches activos`} icon={TrendingUp} color="purple" />
      </div>

      {/* Tabla coaches */}
      <div className="card mb-8">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Performance por coach</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-800">
                {["Coach", "Clientes total", "Activos", "Bajas", "% Baja", "% Renovación", "NPS prom.", "Feedbacks"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coachMetrics.map((c) => (
                <tr key={c.coach} className="border-b border-surface-800/60 hover:bg-surface-800/40">
                  <td className="px-4 py-3 font-semibold text-white">{c.coach}</td>
                  <td className="px-4 py-3 text-slate-300">{c.total}</td>
                  <td className="px-4 py-3 text-emerald-400 font-medium">{c.activos}</td>
                  <td className="px-4 py-3 text-rose-400">{c.bajas}</td>
                  <td className={`px-4 py-3 font-medium ${c.tasaBaja > 30 ? "text-rose-400" : "text-slate-300"}`}>{c.tasaBaja.toFixed(0)}%</td>
                  <td className={`px-4 py-3 font-medium ${c.tasaRenov > 50 ? "text-emerald-400" : "text-amber-400"}`}>{c.tasaRenov.toFixed(0)}%</td>
                  <td className={`px-4 py-3 font-medium ${c.avgNPS !== null && c.avgNPS >= 8 ? "text-emerald-400" : "text-amber-400"}`}>
                    {c.avgNPS !== null ? c.avgNPS.toFixed(1) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{c.feedbacks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico satisfacción */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Evolución NPS mensual</h2>
          <SatisfaccionChart data={feedback} />
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Métricas globales de feedback</h2>
          <FeedbackMetricsGrid metrics={[
            { label: "Puntaje al acompañamiento", value: globalNPS, max: 10 },
            { label: "Avance hacia objetivos", value: globalAvance, max: 10 },
            { label: "Conocimiento de números", value: globalConocimiento, max: 10 },
            { label: "Tranquilidad financiera", value: globalTranquilidad, max: 10 },
          ]} />
        </div>
      </div>

      {/* Feedbacks por coach */}
      <div className="card">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">NPS por coach — comparativo</h2>
        <div className="space-y-4">
          {coachMetrics
            .filter((c) => c.avgNPS !== null)
            .sort((a, b) => (b.avgNPS ?? 0) - (a.avgNPS ?? 0))
            .map((c) => (
              <div key={c.coach} className="flex items-center gap-4">
                <span className="text-sm text-slate-300 w-24 flex-shrink-0 font-medium">{c.coach}</span>
                <div className="flex-1 bg-surface-800 rounded-full h-3 relative overflow-hidden">
                  <div
                    className={`h-3 rounded-full ${(c.avgNPS ?? 0) >= 9 ? "bg-emerald-500" : (c.avgNPS ?? 0) >= 7 ? "bg-brand-500" : "bg-amber-500"}`}
                    style={{ width: `${((c.avgNPS ?? 0) / 10) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-white w-10 text-right">{c.avgNPS?.toFixed(1)}</span>
                <span className="text-xs text-slate-500 w-20">({c.feedbacks} fb)</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function FeedbackMetricsGrid({ metrics }: { metrics: { label: string; value: number | null; max: number }[] }) {
  return (
    <div className="space-y-4">
      {metrics.map(({ label, value, max }) => {
        const pct = value !== null ? (value / max) * 100 : 0;
        return (
          <div key={label}>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-slate-400">{label}</span>
              <span className="text-xs font-bold text-white">{value?.toFixed(1) ?? "—"} / {max}</span>
            </div>
            <div className="bg-surface-800 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-brand-500" : "bg-amber-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
