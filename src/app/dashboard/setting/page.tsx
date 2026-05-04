import {
  getSettingMsgIG, getSettingTiposLeads, getSettingAnalisisFMA,
  getVentasReuniones, isClosedStatus, parseUSD,
} from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { SalesPeriodPicker } from "@/components/ui/SalesPeriodPicker";
import { TiposPieCharts } from "@/components/ui/TiposPieCharts";

export const revalidate = 0;

// ── date helpers ──────────────────────────────────────────────────────────────

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

function defaultRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  return { from: from.toISOString().split("T")[0], to: today.toISOString().split("T")[0] };
}

function prevRange(from: string, to: string) {
  const f = new Date(from + "T00:00:00");
  const t = new Date(to   + "T00:00:00");
  const lastDayOfMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const isFullMonth =
    f.getDate() === 1 && t.getDate() === lastDayOfMonth &&
    f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();
  if (isFullMonth) {
    const pStart = new Date(f.getFullYear(), f.getMonth() - 1, 1);
    const pEnd   = new Date(f.getFullYear(), f.getMonth(), 0);
    return { from: pStart.toISOString().split("T")[0], to: pEnd.toISOString().split("T")[0] };
  }
  const isFullYear =
    f.getMonth() === 0 && f.getDate() === 1 &&
    t.getMonth() === 11 && t.getDate() === 31 && f.getFullYear() === t.getFullYear();
  if (isFullYear) {
    const y = f.getFullYear() - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
  const prevTo = new Date(f); prevTo.setDate(f.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevTo.getDate() - days + 1);
  return { from: prevFrom.toISOString().split("T")[0], to: prevTo.toISOString().split("T")[0] };
}

// ── small helpers ─────────────────────────────────────────────────────────────

function sumInt(rows: Record<string, string>[], key: string): number {
  return rows.reduce((s, r) => s + (parseInt(r[key]) || 0), 0);
}

function pct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—";
}

function matchTipo(row: Record<string, string>, tipo: string): boolean {
  const t = (row["Tipo de lead"] ?? "").trim().toUpperCase();
  return t === tipo || t === `TIPO ${tipo}`;
}

function DiffBadge({ curr, prev }: { curr: number; prev: number }) {
  if (!prev) return null;
  const diff = curr - prev;
  const sign = diff >= 0 ? "+" : "";
  const pctDiff = Math.round(Math.abs(diff / prev) * 100);
  const color = diff >= 0
    ? "bg-emerald-900/50 text-emerald-400 border-emerald-800/50"
    : "bg-rose-900/50 text-rose-400 border-rose-800/50";
  return (
    <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${color}`}>
      {sign}{diff} ({sign}{pctDiff}%)
    </span>
  );
}

const LEAD_TIPOS = ["A", "B", "C", "D"] as const;
const FMA_ORIGINS = ["Organico", "Comentarios", "VSL Insta", "Link Perfil"] as const;

// ── page ──────────────────────────────────────────────────────────────────────

export default async function SettingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.from && sp.to ? { from: sp.from, to: sp.to } : defaultRange();
  const prev  = prevRange(range.from, range.to);

  const [msgIGRaw, tiposLeadsRaw, analisisFMARaw, reunionesRaw] = await Promise.all([
    getSettingMsgIG(),
    getSettingTiposLeads(),
    getSettingAnalisisFMA(),
    getVentasReuniones(),
  ]);

  // Filter each dataset to selected date range
  const inR     = (dateStr: string) => inDateRange(dateStr, range.from, range.to);
  const inRPrev = (dateStr: string) => inDateRange(dateStr, prev.from, prev.to);

  const msgIG        = msgIGRaw.filter((r) => inR(r["Fecha"]));
  const tiposLeads   = tiposLeadsRaw.filter((r) => inR(r["Fecha"]));
  const analisisFMA  = analisisFMARaw.filter((r) => inR(r["Fecha"]));
  const analisisPrev = analisisFMARaw.filter((r) => inRPrev(r["Fecha"]));

  // Reuniones filtered by Fecha de la agenda (col K)
  const reuniones = reunionesRaw.filter(
    (r) => r["Prospecto"] && inR(r["Fecha de la agenda"])
  );

  // Helper: reuniones by exact canal match (case-insensitive)
  const byCanal = (canal: string) =>
    reuniones.filter((r) => r["Canal"].trim().toLowerCase() === canal.trim().toLowerCase());

  // ── Pre-compute Outbound counts (needed in Section 1 for Resumen) ─────────
  const tienenNegocioResumen = sumInt(analisisFMA, "Tienen negocio");

  // ── SECTION 1: Resumen total ──────────────────────────────────────────────

  // Leads for each channel (only ADS IG and Outbound have lead counts)
  const totalLeads    = sumInt(msgIG, "Total leads");

  const estrategias = [
    { nombre: "ADS IG",      canal: "ADS Mje IG",   leads: totalLeads       || null },
    { nombre: "Orgánico",    canal: "Organico",      leads: null },
    { nombre: "Comentarios", canal: "Comentarios",   leads: null },
    { nombre: "VSL Insta",   canal: "VSL Insta",     leads: null },
    { nombre: "VSL",         canal: "Publi a VSL",   leads: null },
    { nombre: "Link Perfil", canal: "Link Perfil",   leads: null },
    { nombre: "Outbound",    canal: "Outbound",       leads: tienenNegocioResumen || null },
    { nombre: "Historias",   canal: "Historias",      leads: null },
  ].map((e) => {
    const rows    = byCanal(e.canal);
    const agendas = rows.length;
    const cierres = rows.filter((r) => isClosedStatus(r["Status"])).length;
    return { ...e, agendas, cierres };
  });

  // ── SECTION 2: ADS MJE IG ────────────────────────────────────────────────

  const inversion     = msgIG.reduce((s, r) => s + parseUSD(r["Gasto"]), 0);
  const pitch         = sumInt(msgIG, "Pitch");
  const permiso       = sumInt(msgIG, "Permiso");
  const agendaEnviada = sumInt(msgIG, "Agenda enviada");
  const agendado      = sumInt(msgIG, "Agendado");

  const reunADS    = byCanal("ADS Mje IG");
  const cierresADS = reunADS.filter((r) => isClosedStatus(r["Status"])).length;

  // Lead type summary — current period
  const leadTypesADS = LEAD_TIPOS.map((tipo) => ({
    tipo,
    leads:   tiposLeads.reduce((s, r) => s + (parseInt(r[`Tipo ${tipo}`]) || 0), 0),
    agendas: reunADS.filter((r) => matchTipo(r, tipo)).length,
    cierres: reunADS.filter((r) => matchTipo(r, tipo) && isClosedStatus(r["Status"])).length,
  }));
  const tiposTotal = leadTypesADS.reduce((s, t) => s + t.leads, 0);

  // Lead type summary — previous period (for pie chart comparison + column deltas)
  const tiposLeadsPrev    = tiposLeadsRaw.filter((r) => inRPrev(r["Fecha"]));
  const reunADSPrev       = reunionesRaw.filter((r) => r["Prospecto"] && inRPrev(r["Fecha de la agenda"]) && r["Canal"].trim().toLowerCase() === "ads mje ig");
  const tiposTotalPrev    = tiposLeadsPrev.reduce((s, r) => s + (parseInt(r["Tipo A"]) || 0) + (parseInt(r["Tipo B"]) || 0) + (parseInt(r["Tipo C"]) || 0) + (parseInt(r["Tipo D"]) || 0), 0);
  const leadTypesADSPrev  = LEAD_TIPOS.map((tipo) => ({
    tipo,
    leads:   tiposLeadsPrev.reduce((s, r) => s + (parseInt(r[`Tipo ${tipo}`]) || 0), 0),
    agendas: reunADSPrev.filter((r) => matchTipo(r, tipo)).length,
  }));

  // Pie chart data
  const TIPO_COLORS: Record<string, string> = {
    A: "#10b981", // emerald-500 — verde
    B: "#eab308", // yellow-500 — amarillo
    C: "#f87171", // red-400    — rojo clarito
    D: "#9f1239", // rose-900   — bordo
  };
  const pieDataCurrent = leadTypesADS.map((t) => ({
    name: `Tipo ${t.tipo}`,
    value: t.leads,
    color: TIPO_COLORS[t.tipo],
  }));
  const pieDataPrev = leadTypesADSPrev.map((t) => ({
    name: `Tipo ${t.tipo}`,
    value: t.leads,
    color: TIPO_COLORS[t.tipo],
  }));
  const inversionPorTipoA = leadTypesADS[0].leads > 0 && inversion > 0
    ? inversion / leadTypesADS[0].leads : null;

  // AD de origen — agendas ADS Mje IG grouped by col E
  const adOrigenStats = (() => {
    const mapa = new Map<string, { agendas: number; cierres: number }>();
    for (const r of reunADS) {
      const ad = (r["AD de origen"] ?? "").trim();
      if (!ad) continue;
      const entry = mapa.get(ad) ?? { agendas: 0, cierres: 0 };
      entry.agendas++;
      if (isClosedStatus(r["Status"])) entry.cierres++;
      mapa.set(ad, entry);
    }
    return [...mapa.entries()]
      .map(([ad, v]) => ({ ad, ...v }))
      .sort((a, b) => b.agendas - a.agendas);
  })();

  // Cumulative funnel (survivors at each stage = everyone who reached that stage OR beyond)
  const funnelSteps = [
    { label: "Leads totales", value: totalLeads },
    { label: "Calificados",   value: tiposTotal },
    { label: "Pitch",         value: pitch + permiso + agendaEnviada + agendado },
    { label: "Permiso",       value: permiso + agendaEnviada + agendado },
    { label: "Ag. enviada",   value: agendaEnviada + agendado },
    { label: "Agendados",     value: agendado },
    { label: "Cerrados",      value: cierresADS },
  ];

  // ── SECTION 3: FMA ────────────────────────────────────────────────────────

  const fmaOrigins = FMA_ORIGINS.map((origen) => {
    const rows    = byCanal(origen);
    const agendas = rows.length;
    const cierres = rows.filter((r) => isClosedStatus(r["Status"])).length;
    const byTipo  = LEAD_TIPOS.map((tipo) => ({
      tipo,
      agendas: rows.filter((r) => matchTipo(r, tipo)).length,
      cierres: rows.filter((r) => matchTipo(r, tipo) && isClosedStatus(r["Status"])).length,
    })).filter((t) => t.agendas > 0 || t.cierres > 0);
    return { origen, agendas, cierres, byTipo };
  });

  // FMA prev period
  const byCanaPrev = (canal: string) =>
    reunionesRaw.filter((r) => r["Prospecto"] && inRPrev(r["Fecha de la agenda"]) && r["Canal"].trim().toLowerCase() === canal.trim().toLowerCase());
  const fmaOriginsPrev = FMA_ORIGINS.map((origen) => ({
    origen,
    agendas: byCanaPrev(origen).length,
    cierres: byCanaPrev(origen).filter((r) => isClosedStatus(r["Status"])).length,
  }));

  // ── SECTION 4: Outbound ───────────────────────────────────────────────────

  const inicios       = sumInt(analisisFMA, "Inicios");
  const tienenNegocio = sumInt(analisisFMA, "Tienen negocio");
  const noNegocio     = sumInt(analisisFMA, "No tienen negocio");
  const neg1          = sumInt(analisisFMA, "Negocio <1 año");
  const neg13         = sumInt(analisisFMA, "Negocio 1-3 años");
  const neg3plus      = sumInt(analisisFMA, "Negocio >3 años");
  const respuestas    = tienenNegocio + noNegocio;

  // Prev period
  const prevInicios       = sumInt(analisisPrev, "Inicios");
  const prevTienenNegocio = sumInt(analisisPrev, "Tienen negocio");

  const reunOut     = byCanal("Outbound");
  const cierresOut  = reunOut.filter((r) => isClosedStatus(r["Status"])).length;
  const neg1Plus    = neg13 + neg3plus; // 1 año o más
  const reunOutPrev = reunionesRaw.filter((r) => r["Prospecto"] && inRPrev(r["Fecha de la agenda"]) && r["Canal"].trim().toLowerCase() === "outbound");
  const cierresOutPrev = reunOutPrev.filter((r) => isClosedStatus(r["Status"])).length;
  const outByTipo  = LEAD_TIPOS.map((tipo) => ({
    tipo,
    agendas: reunOut.filter((r) => matchTipo(r, tipo)).length,
    cierres: reunOut.filter((r) => matchTipo(r, tipo) && isClosedStatus(r["Status"])).length,
  })).filter((t) => t.agendas > 0 || t.cierres > 0);

  // ── SECTION 5: Historias ──────────────────────────────────────────────────

  const reunHist    = byCanal("Historias");
  const cierresHist = reunHist.filter((r) => isClosedStatus(r["Status"])).length;
  const histByTipo  = LEAD_TIPOS.map((tipo) => ({
    tipo,
    agendas: reunHist.filter((r) => matchTipo(r, tipo)).length,
    cierres: reunHist.filter((r) => matchTipo(r, tipo) && isClosedStatus(r["Status"])).length,
  })).filter((t) => t.agendas > 0 || t.cierres > 0);

  const fmtUSD = (n: number | null) =>
    n != null && n > 0 ? `$${Math.round(n).toLocaleString()}` : "—";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Setting"
        description="Generación de leads · Canales · Conversión"
        actions={<SalesPeriodPicker from={sp.from} to={sp.to} />}
      />

      {/* ── 1. RESUMEN TOTAL ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Resumen Total</h2>
      <div className="card mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Estrategia", "Leads", "Agendas", "% Leads→Ag.", "Cierres", "% Ag.→Cierre"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {estrategias.map((e) => (
                <tr key={e.nombre} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                  <td className="px-4 py-3 font-medium text-slate-300">{e.nombre}</td>
                  <td className="px-4 py-3 text-center text-slate-400">{e.leads ?? "—"}</td>
                  <td className="px-4 py-3 text-center font-bold text-white">{e.agendas || "—"}</td>
                  <td className="px-4 py-3 text-center text-brand-400">
                    {e.leads != null ? pct(e.agendas, e.leads) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-400 font-bold">{e.cierres || "—"}</td>
                  <td className="px-4 py-3 text-center text-emerald-400">{pct(e.cierres, e.agendas)}</td>
                </tr>
              ))}
              {/* Total */}
              {(() => {
                const tLeads = estrategias.reduce((s, e) => s + (e.leads ?? 0), 0);
                const tAg    = estrategias.reduce((s, e) => s + e.agendas, 0);
                const tCi    = estrategias.reduce((s, e) => s + e.cierres, 0);
                return (
                  <tr className="bg-surface-800/40 border-t border-surface-600/50">
                    <td className="px-4 py-3 font-bold text-white">TOTAL</td>
                    <td className="px-4 py-3 text-center text-slate-400 font-bold">{tLeads || "—"}</td>
                    <td className="px-4 py-3 text-center font-bold text-white">{tAg}</td>
                    <td className="px-4 py-3 text-center text-brand-400">—</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-400">{tCi}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-400">{pct(tCi, tAg)}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. ADS MJE IG ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">ADS MJE IG</h2>
      <div className="card mb-8 space-y-6">

        {/* Por tipo de lead — FIRST */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Por tipo de lead</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  {["Tipo", "Leads", "% del total", "Agendas", "% Ag/Leads", "Cierres", "% Cierre/Ag."].map((h) => (
                    <th key={h} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase text-center first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leadTypesADS.map((t, i) => {
                  const prev   = leadTypesADSPrev[i];
                  // % del total — current vs prev
                  const pctTot     = tiposTotal > 0 && t.leads > 0 ? (t.leads / tiposTotal) * 100 : null;
                  const pctTotPrev = tiposTotalPrev > 0 && prev.leads > 0 ? (prev.leads / tiposTotalPrev) * 100 : null;
                  const pctTotDiff = pctTot !== null && pctTotPrev !== null ? pctTot - pctTotPrev : null;
                  // % Ag/Leads — threshold coloring + vs prev
                  const agLeadsNum  = t.leads > 0 ? (t.agendas / t.leads) * 100 : null;
                  const agLeadsPrev = prev.leads > 0 ? (prev.agendas / prev.leads) * 100 : null;
                  const agLeadsDiff = agLeadsNum !== null && agLeadsPrev !== null ? agLeadsNum - agLeadsPrev : null;
                  const agLeadsColor = agLeadsNum === null ? "text-slate-500"
                    : agLeadsNum >= 25 ? "text-emerald-400"
                    : agLeadsNum >= 20 ? "text-amber-400"
                    : "text-rose-400";
                  // % Cierre/Ag — threshold coloring
                  const cierreAgNum  = t.agendas > 0 ? (t.cierres / t.agendas) * 100 : null;
                  const cierreAgColor = cierreAgNum === null ? "text-slate-500"
                    : cierreAgNum >= 25 ? "text-emerald-400"
                    : cierreAgNum >= 15 ? "text-amber-400"
                    : "text-rose-400";
                  return (
                    <tr key={t.tipo} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                      <td className="px-4 py-2.5 font-bold text-white">Tipo {t.tipo}</td>
                      <td className="px-4 py-2.5 text-center text-slate-300">{t.leads || "—"}</td>
                      <td className="px-4 py-2.5 text-center text-slate-400">
                        {pctTot !== null ? (
                          <span>
                            {pctTot.toFixed(1)}%
                            {pctTotDiff !== null && Math.abs(pctTotDiff) >= 0.5 && (
                              <span className={`ml-1 text-[10px] ${pctTotDiff > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {pctTotDiff > 0 ? "▲" : "▼"}{Math.abs(pctTotDiff).toFixed(1)}pp
                              </span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-white">{t.agendas || "—"}</td>
                      <td className={`px-4 py-2.5 text-center font-semibold ${agLeadsColor}`}>
                        {agLeadsNum !== null ? (
                          <span>
                            {agLeadsNum.toFixed(1)}%
                            {agLeadsDiff !== null && Math.abs(agLeadsDiff) >= 0.5 && (
                              <span className={`ml-1 text-[10px] ${agLeadsDiff > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {agLeadsDiff > 0 ? "▲" : "▼"}{Math.abs(agLeadsDiff).toFixed(1)}pp
                              </span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-emerald-400">{t.cierres || "—"}</td>
                      <td className={`px-4 py-2.5 text-center font-semibold ${cierreAgColor}`}>
                        {cierreAgNum !== null ? `${cierreAgNum.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {/* Total tipos */}
                <tr className="bg-surface-800/40 border-t border-surface-600/50">
                  <td className="px-4 py-2.5 font-bold text-white">Total calificados</td>
                  <td className="px-4 py-2.5 text-center font-bold text-slate-300">{tiposTotal || "—"}</td>
                  <td className="px-4 py-2.5 text-center text-slate-500">
                    {totalLeads > 0 ? pct(tiposTotal, totalLeads) : "—"}
                    {totalLeads > 0 && tiposTotal < totalLeads && (
                      <span className="ml-1 text-slate-600">de {totalLeads} leads</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center font-bold text-white">{agendado || "—"}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-brand-400">{pct(agendado, tiposTotal)}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-emerald-400">{cierresADS || "—"}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-emerald-400">{pct(cierresADS, agendado)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Inv./Tipo A */}
          {inversionPorTipoA != null && (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <span className="text-amber-400 font-semibold">Inversión / Tipo A:</span>
              <span className="text-amber-300 font-bold">{fmtUSD(inversionPorTipoA)}</span>
              <span>·</span>
              <span>Inversión total: <span className="text-brand-400 font-semibold">{fmtUSD(inversion)}</span></span>
            </div>
          )}
        </div>

        {/* AD de origen — agendas por origen de ad */}
        {adOrigenStats.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">AD de origen — agendas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700">
                    {["AD de origen", "Agendas", "Cierres", "% Cierre"].map((h) => (
                      <th key={h} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase text-center first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {adOrigenStats.map((a) => {
                    const crNum = a.agendas > 0 ? (a.cierres / a.agendas) * 100 : null;
                    const crColor = crNum === null ? "text-slate-500"
                      : crNum >= 25 ? "text-emerald-400"
                      : crNum >= 15 ? "text-amber-400"
                      : "text-rose-400";
                    return (
                      <tr key={a.ad} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                        <td className="px-4 py-2.5 font-medium text-slate-300">{a.ad}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-white">{a.agendas}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-400">{a.cierres || "—"}</td>
                        <td className={`px-4 py-2.5 text-center font-semibold ${crColor}`}>
                          {crNum !== null ? `${crNum.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pie charts — tipos distribution current vs prev */}
        <div>
          <TiposPieCharts
            current={pieDataCurrent}
            previous={pieDataPrev}
          />
        </div>

        {/* Horizontal Funnel — THIRD */}
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
            Embudo de conversión
          </h3>
          <div className="space-y-2">
            {funnelSteps.map((step, i) => {
              const base  = funnelSteps[0].value;
              const width = base > 0 ? Math.max((step.value / base) * 100, 6) : 6;
              const lost  = i > 0 ? funnelSteps[i - 1].value - step.value : null;
              const convPrev = i > 0 && funnelSteps[i - 1].value > 0
                ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(0) + "%"
                : null;

              // Color: green at top, fades to brand blue, emerald for closed
              const barColor = i === 0
                ? "#4A5BBD"
                : i === funnelSteps.length - 1
                ? "#059669"
                : "#2B3990";

              return (
                <div key={step.label} className="flex items-center gap-3 group">
                  {/* Label */}
                  <div className="w-24 text-right shrink-0">
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
                      {step.label}
                    </span>
                  </div>

                  {/* Bar track */}
                  <div className="flex-1 h-8 bg-surface-800/60 rounded overflow-hidden relative">
                    <div
                      className="h-full rounded flex items-center px-3 gap-2 transition-all duration-300"
                      style={{ width: `${width}%`, backgroundColor: barColor }}
                    >
                      <span className="text-sm font-bold text-white tabular-nums whitespace-nowrap">
                        {step.value > 0 ? step.value : "—"}
                      </span>
                      {convPrev && step.value > 0 && (
                        <span className="text-[10px] text-white/60 hidden sm:inline">{convPrev}</span>
                      )}
                    </div>
                  </div>

                  {/* Lost badge */}
                  <div className="w-24 shrink-0">
                    {lost != null && lost > 0 && (
                      <span className="text-xs text-rose-400/80 tabular-nums">
                        −{lost} <span className="text-rose-400/40 text-[10px]">perdidos</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom note */}
          <p className="mt-3 text-[10px] text-slate-600">
            Los valores son acumulativos: cada etapa incluye a todos los que llegaron a esa etapa o más avanzada.
          </p>
        </div>
      </div>

      {/* ── 3. FMA ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">FMA — Follow Me Ads</h2>
      <div className="card mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Origen", "Agendas", "Cierres", "CR%", "Por tipo"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fmaOrigins.map((o, i) => {
                const op = fmaOriginsPrev[i];
                const agDiff  = op.agendas > 0 ? o.agendas - op.agendas : null;
                const ciDiff  = op.cierres > 0 || o.cierres > 0 ? o.cierres - op.cierres : null;
                return (
                  <tr key={o.origen} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                    <td className="px-4 py-3 font-medium text-slate-300">{o.origen}</td>
                    <td className="px-4 py-3 text-center font-bold text-white">
                      {o.agendas || "—"}
                      {agDiff !== null && (
                        <span className={`ml-1.5 text-[10px] font-semibold ${agDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {agDiff >= 0 ? "▲" : "▼"}{Math.abs(agDiff)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-400">
                      {o.cierres || "—"}
                      {ciDiff !== null && (
                        <span className={`ml-1.5 text-[10px] font-semibold ${ciDiff >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {ciDiff >= 0 ? "▲" : "▼"}{Math.abs(ciDiff)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-emerald-400">{pct(o.cierres, o.agendas)}</td>
                    <td className="px-4 py-3 text-center">
                      {o.byTipo.length > 0 ? (
                        <span className="flex gap-1.5 justify-center flex-wrap">
                          {o.byTipo.map((t) => (
                            <span key={t.tipo} className="text-[11px] bg-surface-800 border border-surface-700 rounded px-2 py-0.5">
                              <span className="text-slate-500">T{t.tipo}:</span>
                              <span className="text-white ml-1 font-semibold">{t.agendas}</span>
                              {t.cierres > 0 && <span className="text-emerald-400 ml-1">({t.cierres}✓)</span>}
                            </span>
                          ))}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
              {(() => {
                const tAg  = fmaOrigins.reduce((s, o) => s + o.agendas, 0);
                const tCi  = fmaOrigins.reduce((s, o) => s + o.cierres, 0);
                const tAgP = fmaOriginsPrev.reduce((s, o) => s + o.agendas, 0);
                const tCiP = fmaOriginsPrev.reduce((s, o) => s + o.cierres, 0);
                return (
                  <>
                    <tr className="bg-surface-800/40 border-t border-surface-600/50">
                      <td className="px-4 py-3 font-bold text-white">Total FMA</td>
                      <td className="px-4 py-3 text-center font-bold text-white">{tAg || "—"}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-400">{tCi || "—"}</td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-400">{pct(tCi, tAg)}</td>
                      <td />
                    </tr>
                    {tAgP > 0 && (
                      <tr className="border-t border-surface-700/30 bg-surface-900/40">
                        <td className="px-4 py-2 text-[11px] text-slate-600 italic">Período ant.</td>
                        <td className="px-4 py-2 text-center text-[11px] text-slate-600">{tAgP}</td>
                        <td className="px-4 py-2 text-center text-[11px] text-slate-600">{tCiP || "—"}</td>
                        <td className="px-4 py-2 text-center text-[11px] text-slate-600">{pct(tCiP, tAgP)}</td>
                        <td />
                      </tr>
                    )}
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. OUTBOUND ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Outbound</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">

        {/* Análisis de contactos */}
        <div className="card">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Análisis de contactos</h3>
          <div className="space-y-0">
            {/* Inicios */}
            <div className="flex items-center justify-between py-2.5 border-b border-surface-700/40">
              <div>
                <p className="text-sm text-slate-300">Inicios</p>
                <p className="text-[10px] text-slate-600">vs período anterior: {prevInicios || "—"}</p>
              </div>
              <p className="text-lg font-bold tabular-nums text-white flex items-center">
                {inicios || "—"}
                {prevInicios > 0 && <DiffBadge curr={inicios} prev={prevInicios} />}
              </p>
            </div>

            {/* Respuestas */}
            {inicios > 0 && (
              <div className="flex items-center justify-between py-2.5 border-b border-surface-700/40">
                <div>
                  <p className="text-sm text-slate-400">% respondieron al mje</p>
                  <p className="text-[10px] text-slate-600">{respuestas} respuestas de {inicios} inicios</p>
                </div>
                <p className="text-lg font-bold tabular-nums text-brand-400">{pct(respuestas, inicios)}</p>
              </div>
            )}

            {/* Tienen negocio */}
            <div className="flex items-center justify-between py-2.5 border-b border-surface-700/40">
              <div>
                <p className="text-sm text-slate-300">Tienen negocio</p>
                <p className="text-[10px] text-slate-600">{pct(tienenNegocio, inicios)} de inicios · vs anterior: {prevTienenNegocio || "—"}</p>
              </div>
              <p className="text-lg font-bold tabular-nums text-brand-400 flex items-center">
                {tienenNegocio || "—"}
                {prevTienenNegocio > 0 && <DiffBadge curr={tienenNegocio} prev={prevTienenNegocio} />}
              </p>
            </div>

            {/* No tienen negocio */}
            <div className="flex items-center justify-between py-2.5 last:border-0">
              <div>
                <p className="text-sm text-slate-400">No tienen negocio</p>
                <p className="text-[10px] text-slate-600">{pct(noNegocio, inicios)} de inicios</p>
              </div>
              <p className="text-lg font-bold tabular-nums text-slate-500">{noNegocio || "—"}</p>
            </div>
          </div>

          {/* Negocio breakdown */}
          {tienenNegocio > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-700/40">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Antigüedad del negocio</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "< 1 año",   value: neg1,    color: "text-amber-400" },
                  { label: "1–3 años",  value: neg13,   color: "text-emerald-400" },
                  { label: "> 3 años",  value: neg3plus, color: "text-emerald-400" },
                ].map((item) => (
                  <div key={item.label} className="bg-surface-800/50 rounded-lg p-2.5 text-center border border-surface-700/40">
                    <p className="text-[10px] text-slate-500 mb-0.5">{item.label}</p>
                    <p className={`text-lg font-bold ${item.color}`}>{item.value || "—"}</p>
                    <p className="text-[10px] text-slate-600">{pct(item.value, tienenNegocio)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Agendas y cierres */}
        <div className="card">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Agendas y cierres</h3>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Agendas", value: reunOut.length, prev: reunOutPrev.length, color: "text-white" },
              { label: "Cierres", value: cierresOut, prev: cierresOutPrev, color: "text-emerald-400" },
              { label: "CR%",     value: pct(cierresOut, reunOut.length), prev: pct(cierresOutPrev, reunOutPrev.length), color: "text-emerald-400" },
            ].map((k) => (
              <div key={k.label} className="bg-surface-800/50 rounded-xl p-3 text-center border border-surface-700/40">
                <p className="text-[10px] text-slate-500 uppercase mb-1">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value || "—"}</p>
                {k.prev !== undefined && k.prev !== "—" && (
                  <p className="text-[10px] text-slate-600 mt-0.5">ant: {k.prev}</p>
                )}
              </div>
            ))}
          </div>
          {outByTipo.length > 0 && (
            <>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-2">Por tipo de lead</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700">
                    {["Tipo", "Agendas", "Cierres", "CR%"].map((h) => (
                      <th key={h} className="px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase text-center first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {outByTipo.map((t) => (
                    <tr key={t.tipo} className="border-b border-surface-800/50">
                      <td className="px-3 py-2 font-bold text-white">Tipo {t.tipo}</td>
                      <td className="px-3 py-2 text-center text-white">{t.agendas}</td>
                      <td className="px-3 py-2 text-center text-emerald-400 font-bold">{t.cierres || "—"}</td>
                      <td className="px-3 py-2 text-center text-emerald-400">{pct(t.cierres, t.agendas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {/* Agendas como % de negocios 1yr+ */}
          {neg1Plus > 0 && (
            <div className="mt-4 pt-3 border-t border-surface-700/40">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Conversión sobre negocios ≥1 año</p>
              <p className="text-sm text-slate-300">
                <span className="font-bold text-white">{reunOut.length}</span>
                <span className="text-slate-500 mx-1.5">agendas</span>
                <span className={`font-semibold ${reunOut.length / neg1Plus >= 0.15 ? "text-emerald-400" : "text-amber-400"}`}>
                  ({((reunOut.length / neg1Plus) * 100).toFixed(1)}% de {neg1Plus} con negocio ≥1 año)
                </span>
              </p>
            </div>
          )}
          {outByTipo.length === 0 && reunOut.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">Sin datos en el período</p>
          )}
        </div>
      </div>

      {/* ── 5. HISTORIAS ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Historias</h2>
      <div className="card">
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: "Leads",   value: "—",                    color: "text-slate-500", note: "Próximamente" },
            { label: "Agendas", value: reunHist.length || "—", color: "text-white",     note: null },
            { label: "Cierres", value: cierresHist || "—",     color: "text-emerald-400", note: pct(cierresHist, reunHist.length) + " de ag." },
          ].map((k) => (
            <div key={k.label} className="bg-surface-800/50 rounded-xl p-4 text-center border border-surface-700/50">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              {k.note && <p className="text-[10px] text-slate-600 mt-0.5">{k.note}</p>}
            </div>
          ))}
        </div>

        {histByTipo.length > 0 && (
          <>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Por tipo de lead</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-700">
                    {["Tipo", "Agendas", "Cierres", "CR%"].map((h) => (
                      <th key={h} className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase text-center first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {histByTipo.map((t) => (
                    <tr key={t.tipo} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                      <td className="px-4 py-2.5 font-bold text-white">Tipo {t.tipo}</td>
                      <td className="px-4 py-2.5 text-center text-white">{t.agendas}</td>
                      <td className="px-4 py-2.5 text-center text-emerald-400 font-bold">{t.cierres || "—"}</td>
                      <td className="px-4 py-2.5 text-center text-emerald-400">{pct(t.cierres, t.agendas)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {histByTipo.length === 0 && reunHist.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4">Sin datos en el período</p>
        )}
      </div>
    </div>
  );
}
