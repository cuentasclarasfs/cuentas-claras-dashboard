import { PageHeader } from "@/components/ui/PageHeader";
import { SalesPeriodPicker } from "@/components/ui/SalesPeriodPicker";
import { getContenidoPosteos, getContenidoHistorias } from "@/lib/sheets";
import { MiniPie, assignColors } from "@/components/contenido/ContenidoPieCharts";
import type { JSX } from "react";

export const revalidate = 0;

// ── helpers ────────────────────────────────────────────────────────────────────

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
  const lastDayOfMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const isFullMonth =
    f.getDate() === 1 &&
    t.getDate() === lastDayOfMonth &&
    f.getMonth() === t.getMonth() &&
    f.getFullYear() === t.getFullYear();
  if (isFullMonth) {
    const pStart = new Date(f.getFullYear(), f.getMonth() - 1, 1);
    const pEnd   = new Date(f.getFullYear(), f.getMonth(), 0);
    return { from: pStart.toISOString().split("T")[0], to: pEnd.toISOString().split("T")[0] };
  }
  const isFullYear =
    f.getMonth() === 0 && f.getDate() === 1 &&
    t.getMonth() === 11 && t.getDate() === 31 &&
    f.getFullYear() === t.getFullYear();
  if (isFullYear) {
    const y = f.getFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const prevTo = new Date(f); prevTo.setDate(f.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevTo.getDate() - days + 1);
  return { from: prevFrom.toISOString().split("T")[0], to: prevTo.toISOString().split("T")[0] };
}

function defaultRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: from.toISOString().split("T")[0], to: today.toISOString().split("T")[0] };
}

function num(n: number) { return n.toLocaleString("es-AR"); }

function countBy(rows: Record<string, string>[], key: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = (r[key] ?? "").trim();
    if (v) out[v] = (out[v] ?? 0) + 1;
  }
  return out;
}

function toInt(s: string) { return parseInt((s ?? "").replace(/[.,]/g, "")) || 0; }

function DeltaBadge({ cur, p, isPercent = false }: { cur: number; p: number; isPercent?: boolean }): JSX.Element | null {
  if (p === 0) return null;
  const delta = cur - p;
  const pct   = Math.abs((delta / p) * 100);
  const sign  = delta >= 0 ? "▲" : "▼";
  const color = delta >= 0 ? "text-emerald-400" : "text-red-400";
  const label = isPercent
    ? `${sign}${Math.abs(delta).toFixed(1)}pp`
    : `${sign}${pct.toFixed(0)}%`;
  return <span className={`text-[10px] font-semibold ${color} ml-1`}>{label}</span>;
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function ContenidoPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.from && sp.to ? { from: sp.from, to: sp.to } : defaultRange();
  const prev  = prevRange(range.from, range.to);

  const [posteos, historias] = await Promise.all([
    getContenidoPosteos(),
    getContenidoHistorias(),
  ]);

  // ── POSTEOS ──────────────────────────────────────────────────────────────────
  const postCur  = posteos.filter((r) => inDateRange(r["Fecha"] ?? "", range.from, range.to));
  const postPrev = posteos.filter((r) => inDateRange(r["Fecha"] ?? "", prev.from, prev.to));

  const totalPostCur  = postCur.length;
  const totalPostPrev = postPrev.length;

  const viewsCur  = postCur .reduce((s, r) => s + toInt(r["Visualizaciones"] ?? r["Views"] ?? ""), 0);
  const viewsPrev = postPrev.reduce((s, r) => s + toInt(r["Visualizaciones"] ?? r["Views"] ?? ""), 0);

  const comentCur  = postCur .reduce((s, r) => s + toInt(r["Comentarios"] ?? ""), 0);
  const comentPrev = postPrev.reduce((s, r) => s + toInt(r["Comentarios"] ?? ""), 0);

  const comentPctCur  = viewsCur  > 0 ? (comentCur  / viewsCur)  * 100 : 0;
  const comentPctPrev = viewsPrev > 0 ? (comentPrev / viewsPrev) * 100 : 0;

  // top 7 ángulos por comentarios
  const angulosMap: Record<string, { comentarios: number; views: number }> = {};
  for (const r of postCur) {
    const ang = (r["Tipo de ángulo"] ?? r["Ángulo"] ?? r["Angulo"] ?? "").trim();
    if (!ang) continue;
    if (!angulosMap[ang]) angulosMap[ang] = { comentarios: 0, views: 0 };
    angulosMap[ang].comentarios += toInt(r["Comentarios"] ?? "");
    angulosMap[ang].views       += toInt(r["Visualizaciones"] ?? r["Views"] ?? "");
  }
  const top7Angulos = Object.entries(angulosMap)
    .sort((a, b) => b[1].comentarios - a[1].comentarios)
    .slice(0, 7);

  // pie charts posteos
  const pieAngulo   = assignColors(Object.entries(countBy(postCur, "Tipo de ángulo")).map(([name, value]) => ({ name, value })));
  const pieFormato  = assignColors(Object.entries(countBy(postCur, "Formato")).map(([name, value]) => ({ name, value })));
  const pieTipoCont = assignColors(Object.entries(countBy(postCur, "Tipo de contenido")).map(([name, value]) => ({ name, value })));

  // ── HISTORIAS ────────────────────────────────────────────────────────────────
  const histCur  = historias.filter((r) => inDateRange(r["Fecha"] ?? "", range.from, range.to));
  const histPrev = historias.filter((r) => inDateRange(r["Fecha"] ?? "", prev.from, prev.to));

  const getSecuencias = (rows: Record<string, string>[]) => {
    const vals = rows.map((r) => (r["Secuencia"] ?? "").trim()).filter(Boolean);
    return vals.length > 0 ? new Set(vals).size : rows.length;
  };
  const secCur  = getSecuencias(histCur);
  const secPrev = getSecuencias(histPrev);

  // por Tipo de Accionable
  type TipoAcEntry = { count: number; countPrev: number; views: number; viewsPrev: number; leads: number; leadsPrev: number };
  const tipoAcMap: Record<string, TipoAcEntry> = {};
  const ensureTipo = (k: string) => { if (!tipoAcMap[k]) tipoAcMap[k] = { count: 0, countPrev: 0, views: 0, viewsPrev: 0, leads: 0, leadsPrev: 0 }; };
  for (const r of histCur) {
    const k = (r["Tipo de Accionable"] ?? "").trim() || "(sin tipo)";
    ensureTipo(k);
    tipoAcMap[k].count++;
    tipoAcMap[k].views += toInt(r["Visualizaciones"] ?? r["Views"] ?? "");
    tipoAcMap[k].leads += toInt(r["Leads"] ?? "");
  }
  for (const r of histPrev) {
    const k = (r["Tipo de Accionable"] ?? "").trim() || "(sin tipo)";
    ensureTipo(k);
    tipoAcMap[k].countPrev++;
    tipoAcMap[k].viewsPrev += toInt(r["Visualizaciones"] ?? r["Views"] ?? "");
    tipoAcMap[k].leadsPrev += toInt(r["Leads"] ?? "");
  }
  const tipoAcRows = Object.entries(tipoAcMap).sort((a, b) => b[1].leads - a[1].leads);

  // top 5 temas por leads
  const temasMap: Record<string, number> = {};
  for (const r of histCur) {
    const tema = (r["Tema"] ?? r["Título"] ?? r["Titulo"] ?? "").trim();
    if (!tema) continue;
    temasMap[tema] = (temasMap[tema] ?? 0) + toInt(r["Leads"] ?? "");
  }
  const top5Temas = Object.entries(temasMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxLeadsTema = top5Temas[0]?.[1] ?? 1;

  // pie charts historias
  const pieTipoAc      = assignColors(Object.entries(countBy(histCur, "Tipo de Accionable")).map(([name, value]) => ({ name, value })));
  const pieFormatoHist = assignColors(Object.entries(countBy(histCur, "Formato")).map(([name, value]) => ({ name, value })));

  return (
    <div>
      <PageHeader
        title="Contenido"
        description="Métricas de posteos e historias"
        actions={<SalesPeriodPicker from={sp.from} to={sp.to} />}
      />

      {/* ═══════════ POSTEOS ═══════════ */}
      <section className="mb-10">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Posteos</h2>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Posteos</p>
            <p className="text-2xl font-bold text-white">{num(totalPostCur)}</p>
            <p className="text-xs text-slate-500 mt-0.5">prev {num(totalPostPrev)}<DeltaBadge cur={totalPostCur} p={totalPostPrev} /></p>
          </div>
          <div className="card text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Visualizaciones</p>
            <p className="text-2xl font-bold text-white">{num(viewsCur)}</p>
            <p className="text-xs text-slate-500 mt-0.5">prev {num(viewsPrev)}<DeltaBadge cur={viewsCur} p={viewsPrev} /></p>
          </div>
          <div className="card text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Comentarios</p>
            <p className="text-2xl font-bold text-white">{num(comentCur)}</p>
            <p className="text-xs text-slate-500 mt-0.5">prev {num(comentPrev)}<DeltaBadge cur={comentCur} p={comentPrev} /></p>
          </div>
          <div className="card text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">% Coment./Views</p>
            <p className="text-2xl font-bold text-white">{comentPctCur.toFixed(2)}%</p>
            <p className="text-xs text-slate-500 mt-0.5">prev {comentPctPrev.toFixed(2)}%<DeltaBadge cur={comentPctCur} p={comentPctPrev} isPercent /></p>
          </div>
        </div>

        {/* Top 7 ángulos */}
        {top7Angulos.length > 0 && (
          <div className="card mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Top 7 ángulos por comentarios</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-surface-700">
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold">Ángulo</th>
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold text-right">Comentarios</th>
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold text-right">Views</th>
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold text-right">% Coment./Views</th>
                </tr>
              </thead>
              <tbody>
                {top7Angulos.map(([ang, { comentarios, views }]) => {
                  const pctLabel = views > 0 ? `${((comentarios / views) * 100).toFixed(2)}%` : "—";
                  return (
                    <tr key={ang} className="border-b border-surface-800 hover:bg-surface-800/40">
                      <td className="py-2 text-slate-300">{ang}</td>
                      <td className="py-2 text-white font-semibold text-right">{num(comentarios)}</td>
                      <td className="py-2 text-slate-400 text-right">{num(views)}</td>
                      <td className="py-2 text-slate-400 text-right">{pctLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3 pie charts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card"><MiniPie data={pieAngulo}   title="Tipo de ángulo"    unit="posts" /></div>
          <div className="card"><MiniPie data={pieFormato}  title="Formato"           unit="posts" /></div>
          <div className="card"><MiniPie data={pieTipoCont} title="Tipo de contenido" unit="posts" /></div>
        </div>
      </section>

      {/* ═══════════ HISTORIAS ═══════════ */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">Historias</h2>

        {/* Secuencias KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Secuencias</p>
            <p className="text-2xl font-bold text-white">{num(secCur)}</p>
            <p className="text-xs text-slate-500 mt-0.5">prev {num(secPrev)}<DeltaBadge cur={secCur} p={secPrev} /></p>
          </div>
        </div>

        {/* Por Tipo de Accionable */}
        {tipoAcRows.length > 0 && (
          <div className="card mb-6 overflow-x-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Por Tipo de Accionable</p>
            <table className="w-full text-sm min-w-[620px]">
              <thead>
                <tr className="text-left border-b border-surface-700">
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold">Tipo</th>
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold text-right">Cantidad</th>
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold text-right">Views</th>
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold text-right">Prom. views</th>
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold text-right">Leads</th>
                  <th className="pb-2 text-[11px] text-slate-500 font-semibold text-right">% Leads/Views</th>
                </tr>
              </thead>
              <tbody>
                {tipoAcRows.map(([tipo, s]) => {
                  const avgViews     = s.count > 0     ? Math.round(s.views     / s.count)     : 0;
                  const avgViewsPrev = s.countPrev > 0 ? Math.round(s.viewsPrev / s.countPrev) : 0;
                  const leadsPct     = s.views > 0 ? `${((s.leads / s.views) * 100).toFixed(2)}%` : "—";
                  return (
                    <tr key={tipo} className="border-b border-surface-800 hover:bg-surface-800/40">
                      <td className="py-2 text-slate-300">{tipo}</td>
                      <td className="py-2 text-white font-semibold text-right">
                        {num(s.count)}<DeltaBadge cur={s.count} p={s.countPrev} />
                      </td>
                      <td className="py-2 text-slate-400 text-right">{num(s.views)}</td>
                      <td className="py-2 text-slate-400 text-right">
                        {num(avgViews)}<DeltaBadge cur={avgViews} p={avgViewsPrev} />
                      </td>
                      <td className="py-2 text-white font-semibold text-right">
                        {num(s.leads)}<DeltaBadge cur={s.leads} p={s.leadsPrev} />
                      </td>
                      <td className="py-2 text-slate-400 text-right">{leadsPct}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Top 5 temas por leads */}
        {top5Temas.length > 0 && (
          <div className="card mb-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Top 5 temas por leads</p>
            <div className="space-y-2">
              {top5Temas.map(([tema, leads], i) => {
                const barW = maxLeadsTema > 0 ? (leads / maxLeadsTema) * 100 : 0;
                return (
                  <div key={tema} className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500 w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs text-slate-300 truncate pr-2">{tema}</span>
                        <span className="text-xs font-bold text-white shrink-0">{num(leads)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-700">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2 pie charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card"><MiniPie data={pieTipoAc}      title="Tipo de Accionable" unit="historias" /></div>
          <div className="card"><MiniPie data={pieFormatoHist} title="Formato"             unit="historias" /></div>
        </div>
      </section>
    </div>
  );
}
