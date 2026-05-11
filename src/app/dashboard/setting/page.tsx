import {
  getSettingMsgIG, getSettingMsgIGA, getSettingTiposLeads, getSettingAnalisisFMA,
  getVentasReuniones, isClosedStatus, parseUSD,
  getMarketingVSL, getMarketingFMA, getContenidoPosteos, getContenidoHistorias,
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

function VarBadge({ curr, prev, lowerBetter = false }: { curr: number; prev: number; lowerBetter?: boolean }) {
  if (!prev || !curr) return null;
  const d = ((curr - prev) / prev) * 100;
  if (Math.abs(d) < 1) return null;
  const good = lowerBetter ? d < 0 : d > 0;
  return (
    <span className={`text-[10px] font-semibold ${good ? "text-emerald-400" : "text-rose-400"}`}>
      {good ? (lowerBetter ? "▼" : "▲") : (lowerBetter ? "▲" : "▼")}{Math.abs(d).toFixed(0)}%
    </span>
  );
}

const LEAD_TIPOS = ["A", "B", "C", "D"] as const;
const FMA_CANALES_LIST = ["Outbound", "Organico", "Comentarios", "Link Perfil", "VSL Insta"] as const;
const isFMACanal = (canal: string) =>
  FMA_CANALES_LIST.some((c) => canal.toLowerCase().includes(c.toLowerCase()));

// ── page ──────────────────────────────────────────────────────────────────────

export default async function SettingPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.from && sp.to ? { from: sp.from, to: sp.to } : defaultRange();
  const prev  = prevRange(range.from, range.to);

  const [msgIGRaw, msgIGARaw, tiposLeadsRaw, analisisFMARaw, reunionesRaw, vslRaw, fmaRawData] = await Promise.all([
    getSettingMsgIG(),
    getSettingMsgIGA(),
    getSettingTiposLeads(),
    getSettingAnalisisFMA(),
    getVentasReuniones(),
    getMarketingVSL(),
    getMarketingFMA(),
  ]);

  // Contenido sheets (may not be configured)
  let contenidoPosteosRaw: Record<string, string>[] = [];
  let contenidoHistoriasRaw: Record<string, string>[] = [];
  try {
    [contenidoPosteosRaw, contenidoHistoriasRaw] = await Promise.all([
      getContenidoPosteos(),
      getContenidoHistorias(),
    ]);
  } catch (_) { /* SHEET_ID_CONTENIDO might not be set */ }

  // Filter each dataset to selected date range
  const inR     = (dateStr: string) => inDateRange(dateStr, range.from, range.to);
  const inRPrev = (dateStr: string) => inDateRange(dateStr, prev.from, prev.to);

  const msgIG        = msgIGRaw.filter((r) => inR(r["Fecha"]));
  const msgIGA       = msgIGARaw.filter((r) => inR(r["Fecha"]));
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

  // ── GENERACIÓN DE AGENDAS: gastos ─────────────────────────────────────────

  const gastoVSL    = vslRaw.filter((r) => inR(r["Fecha"] ?? "")).reduce((s, r) => s + parseUSD(r["Gasto"] ?? ""), 0);
  const gastoIG     = msgIG.reduce((s, r) => s + parseUSD(r["Gasto"] ?? ""), 0);
  const gastoFMA    = fmaRawData.filter((r) => inR(r["Fecha"] ?? "")).reduce((s, r) => s + parseUSD(r["$"] ?? ""), 0);
  const gastoVSLPrev = vslRaw.filter((r) => inRPrev(r["Fecha"] ?? "")).reduce((s, r) => s + parseUSD(r["Gasto"] ?? ""), 0);
  const gastoIGPrev  = msgIGRaw.filter((r) => inRPrev(r["Fecha"])).reduce((s, r) => s + parseUSD(r["Gasto"] ?? ""), 0);
  const gastoFMAPrev = fmaRawData.filter((r) => inRPrev(r["Fecha"] ?? "")).reduce((s, r) => s + parseUSD(r["$"] ?? ""), 0);
  const gastoTotal   = gastoVSL + gastoIG + gastoFMA;
  const gastoTotalPrev = gastoVSLPrev + gastoIGPrev + gastoFMAPrev;

  // Agendas by channel
  const reunVSL   = reuniones.filter((r) => r["Canal"] === "Publi a VSL");
  const reunIG    = reuniones.filter((r) => r["Canal"] === "ADS Mje IG");
  const reunFMA   = reuniones.filter((r) => isFMACanal(r["Canal"]));
  const reunOtros = reuniones.filter(
    (r) => r["Canal"] !== "Publi a VSL" && r["Canal"] !== "ADS Mje IG" && !isFMACanal(r["Canal"]) && r["Canal"]?.trim()
  );

  // Prev period reuniones
  const reunPrev     = reunionesRaw.filter((r) => r["Prospecto"] && inRPrev(r["Fecha de la agenda"]));
  const reunVSLPrev  = reunPrev.filter((r) => r["Canal"] === "Publi a VSL");
  const reunIGPrev   = reunPrev.filter((r) => r["Canal"] === "ADS Mje IG");
  const reunFMAPrev  = reunPrev.filter((r) => isFMACanal(r["Canal"]));

  const cpa = (gasto: number, ag: number) => ag > 0 && gasto > 0 ? gasto / ag : null;

  // FMA sub-canal breakdown (for mini card)
  const fmaSubBreakdown = (FMA_CANALES_LIST as readonly string[]).map((origen) => ({
    origen,
    agendas: byCanal(origen).length,
    cierres: byCanal(origen).filter((r) => isClosedStatus(r["Status"])).length,
  })).filter((b) => b.agendas > 0);

  // Individual "otros" canals (non-VSL, non-IG, non-FMA)
  const otrasCanalesNames = [...new Set(reunOtros.map((r) => r["Canal"].trim()))].sort();

  // ── Outbound data (needed early for Análisis de Leads) ───────────────────

  const tienenNegocio     = sumInt(analisisFMA,  "Tienen negocio");
  const prevTienenNegocio = sumInt(analisisPrev, "Tienen negocio");

  // ── ANÁLISIS DE LEADS ─────────────────────────────────────────────────────

  // Comentarios: organico (posteos de Facu) + ADS (col Comentarios de FMA sheet)
  const comentariosOrgLeads = contenidoPosteosRaw
    .filter((r) => inR(r["Fecha"] ?? ""))
    .reduce((s, r) => s + (parseInt(r["Comentarios"]) || 0), 0);
  const comentariosADSLeads = fmaRawData
    .filter((r) => inR(r["Fecha"] ?? ""))
    .reduce((s, r) => s + (parseInt(r["Comentarios"]) || 0), 0);
  const comentariosLeads = comentariosOrgLeads + comentariosADSLeads;

  const historiasLeads = contenidoHistoriasRaw
    .filter((r) => inR(r["Fecha"] ?? ""))
    .reduce((s, r) => s + (parseInt(r["Leads"]) || 0), 0);

  // ADS IG leads = solo Tipo A (calificados)
  const tiposALeads = tiposLeads.reduce((s, r) => s + (parseInt(r["Tipo A"]) || 0), 0);

  // tiposTotal (A+B+C+D) se sigue usando en la sección ADS MJE IG
  const tiposTotal = tiposLeads.reduce(
    (s, r) => s + (parseInt(r["Tipo A"]) || 0) + (parseInt(r["Tipo B"]) || 0) +
              (parseInt(r["Tipo C"]) || 0) + (parseInt(r["Tipo D"]) || 0), 0
  );

  const leadsAnalisis = [
    { nombre: "ADS IG",      leads: tiposALeads,      canal: "ADS Mje IG",  tipoA: true,  sub: null as string | null },
    { nombre: "Outbound",    leads: tienenNegocio,    canal: "Outbound",    tipoA: false, sub: null as string | null },
    { nombre: "Comentarios", leads: comentariosLeads, canal: "Comentarios", tipoA: false,
      sub: (comentariosOrgLeads > 0 || comentariosADSLeads > 0)
        ? `org: ${comentariosOrgLeads} · ads: ${comentariosADSLeads}`
        : null as string | null },
    { nombre: "Historias",   leads: historiasLeads,   canal: "Historias",   tipoA: false, sub: null as string | null },
  ].map((e) => {
    let rows = byCanal(e.canal);
    // Para ADS IG solo contamos agendas Tipo A
    if (e.tipoA) rows = rows.filter((r) => matchTipo(r, "A"));
    const agendas = rows.length;
    const cierres = rows.filter((r) => isClosedStatus(r["Status"])).length;
    return { ...e, agendas, cierres };
  });

  // ── VSL METRICS ───────────────────────────────────────────────────────────

  const vslPeriod    = vslRaw.filter((r) => inR(r["Fecha"] ?? ""));
  const vslPrevPer   = vslRaw.filter((r) => inRPrev(r["Fecha"] ?? ""));

  const vslInversion     = gastoVSL;
  const vslInversionPrev = gastoVSLPrev;
  const vslVisitas       = vslPeriod.reduce((s, r) => s + (parseInt(r["Visitas a la pagina"]) || 0), 0);
  const vslVisitasPrev   = vslPrevPer.reduce((s, r) => s + (parseInt(r["Visitas a la pagina"]) || 0), 0);
  const vslAgendasReun   = reunVSL.length;
  const vslAgendasPrevReun = reunVSLPrev.length;
  const vslCierres       = reunVSL.filter((r) => isClosedStatus(r["Status"])).length;
  const vslCierresPrev   = reunVSLPrev.filter((r) => isClosedStatus(r["Status"])).length;
  const vslConversion    = vslVisitas > 0 && vslAgendasReun > 0 ? (vslAgendasReun / vslVisitas) * 100 : null;
  const vslConversionPrev = vslVisitasPrev > 0 && vslAgendasPrevReun > 0 ? (vslAgendasPrevReun / vslVisitasPrev) * 100 : null;
  const vslCostVisita    = vslVisitas > 0 && vslInversion > 0 ? vslInversion / vslVisitas : null;
  const vslCostVisitaPrev = vslVisitasPrev > 0 && vslInversionPrev > 0 ? vslInversionPrev / vslVisitasPrev : null;

  // ── FMA METRICS (redesigned) ───────────────────────────────────────────────

  const fmaMetricasPer  = fmaRawData.filter((r) => inR(r["Fecha"] ?? ""));
  const fmaMetricasPrevP = fmaRawData.filter((r) => inRPrev(r["Fecha"] ?? ""));

  const fmaSeguidores     = fmaMetricasPer.reduce((s, r) => s + (parseInt(r["Seguidores Ads Man"]) || 0) + (parseInt(r["Seguidores Many"]) || 0), 0);
  const fmaSeguidoresPrev = fmaMetricasPrevP.reduce((s, r) => s + (parseInt(r["Seguidores Ads Man"]) || 0) + (parseInt(r["Seguidores Many"]) || 0), 0);
  const fmaCmtLeads       = fmaMetricasPer.reduce((s, r) => s + (parseInt(r["Comentarios"]) || 0), 0);
  // Leads del ecosistema FMA: Comentarios FMA + Outbound + Historias
  const fmaEcoLeads       = fmaCmtLeads + tienenNegocio + historiasLeads;
  const fmaAgendasFMA     = reunFMA.length;
  const fmaCierresFMA     = reunFMA.filter((r) => isClosedStatus(r["Status"])).length;
  const fmaAgendasFMAPrev = reunFMAPrev.length;
  const fmaCierresFMAPrev = reunFMAPrev.filter((r) => isClosedStatus(r["Status"])).length;
  const fmaCostSeguidor   = fmaSeguidores > 0 && gastoFMA > 0 ? gastoFMA / fmaSeguidores : null;
  const fmaCostSegPrev    = fmaSeguidoresPrev > 0 && gastoFMAPrev > 0 ? gastoFMAPrev / fmaSeguidoresPrev : null;
  const fmaCostLead       = fmaEcoLeads > 0 && gastoFMA > 0 ? gastoFMA / fmaEcoLeads : null;

  // ── SECTION ADS MJE IG: existing data ────────────────────────────────────

  const inversion     = msgIG.reduce((s, r) => s + parseUSD(r["Gasto"]), 0);
  const pitch         = sumInt(msgIG, "Pitch");
  const permiso       = sumInt(msgIG, "Permiso");
  const agendaEnviada = sumInt(msgIG, "Agenda enviada");
  const agendado      = sumInt(msgIG, "Agendado");
  const totalLeads    = sumInt(msgIG, "Total leads");

  const reunADS    = byCanal("ADS Mje IG");
  const cierresADS = reunADS.filter((r) => isClosedStatus(r["Status"])).length;

  // Lead type summary — current period
  const leadTypesADS = LEAD_TIPOS.map((tipo) => ({
    tipo,
    leads:   tiposLeads.reduce((s, r) => s + (parseInt(r[`Tipo ${tipo}`]) || 0), 0),
    agendas: reunADS.filter((r) => matchTipo(r, tipo)).length,
    cierres: reunADS.filter((r) => matchTipo(r, tipo) && isClosedStatus(r["Status"])).length,
  }));

  // Lead type summary — previous period
  const tiposLeadsPrev    = tiposLeadsRaw.filter((r) => inRPrev(r["Fecha"]));
  const reunADSPrev       = reunionesRaw.filter((r) => r["Prospecto"] && inRPrev(r["Fecha de la agenda"]) && r["Canal"].trim().toLowerCase() === "ads mje ig");
  const tiposTotalPrev    = tiposLeadsPrev.reduce((s, r) => s + (parseInt(r["Tipo A"]) || 0) + (parseInt(r["Tipo B"]) || 0) + (parseInt(r["Tipo C"]) || 0) + (parseInt(r["Tipo D"]) || 0), 0);
  const leadTypesADSPrev  = LEAD_TIPOS.map((tipo) => ({
    tipo,
    leads:   tiposLeadsPrev.reduce((s, r) => s + (parseInt(r[`Tipo ${tipo}`]) || 0), 0),
    agendas: reunADSPrev.filter((r) => matchTipo(r, tipo)).length,
  }));

  // Promedio histórico Tipo A desde 2026
  const parseYear = (dateStr: string) => {
    const p = dateStr.trim().split("/");
    if (p.length < 3) return 0;
    const y = parseInt(p[2]); return y < 100 ? y + 2000 : y;
  };
  const tiposLeads2026   = tiposLeadsRaw.filter((r) => parseYear(r["Fecha"] ?? "") >= 2026);
  const reunADS2026      = reunionesRaw.filter((r) => r["Prospecto"] && r["Canal"].trim().toLowerCase() === "ads mje ig" && parseYear(r["Fecha de la agenda"] ?? "") >= 2026);
  const tipoALeads2026   = tiposLeads2026.reduce((s, r) => s + (parseInt(r["Tipo A"]) || 0), 0);
  const reunADS2026TipoA = reunADS2026.filter((r) => matchTipo(r, "A"));
  const tipoAAgendas2026 = reunADS2026TipoA.length;
  const tipoACierres2026 = reunADS2026TipoA.filter((r) => isClosedStatus(r["Status"])).length;
  const tipoAHistAvg       = tipoALeads2026 > 0 ? (tipoAAgendas2026 / tipoALeads2026) * 100 : null;
  const tipoAHistCierreAvg = tipoAAgendas2026 > 0 ? (tipoACierres2026 / tipoAAgendas2026) * 100 : null;

  const TIPO_COLORS: Record<string, string> = {
    A: "#10b981", B: "#eab308", C: "#f87171", D: "#9f1239",
  };
  const pieDataCurrent = leadTypesADS.map((t) => ({ name: `Tipo ${t.tipo}`, value: t.leads, color: TIPO_COLORS[t.tipo] }));
  const pieDataPrev    = leadTypesADSPrev.map((t) => ({ name: `Tipo ${t.tipo}`, value: t.leads, color: TIPO_COLORS[t.tipo] }));
  const inversionPorTipoA = leadTypesADS[0].leads > 0 && inversion > 0 ? inversion / leadTypesADS[0].leads : null;

  // AD de origen — agendas ADS Mje IG
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
    return [...mapa.entries()].map(([ad, v]) => ({ ad, ...v })).sort((a, b) => b.agendas - a.agendas);
  })();

  // Funnel Tipo A — datos de MGS IG A (cada columna = personas que quedaron en esa etapa)
  const igaResp     = sumInt(msgIGA, "Respuesta");
  const igaPitch    = sumInt(msgIGA, "Pitch");
  const igaPermiso  = sumInt(msgIGA, "Permiso");
  const igaAgEnv    = sumInt(msgIGA, "Agenda enviada");
  const igaAgendado = sumInt(msgIGA, "Agendado");
  const cierresADSTipoA = reunADS.filter((r) => matchTipo(r, "A") && isClosedStatus(r["Status"])).length;

  const funnelSteps = [
    { label: "Leads Tipo A",  value: tiposALeads },
    { label: "Respondieron",  value: igaResp + igaPitch + igaPermiso + igaAgEnv + igaAgendado },
    { label: "Pitch",         value: igaPitch + igaPermiso + igaAgEnv + igaAgendado },
    { label: "Permiso",       value: igaPermiso + igaAgEnv + igaAgendado },
    { label: "Ag. enviada",   value: igaAgEnv + igaAgendado },
    { label: "Agendados",     value: igaAgendado },
    { label: "Cerrados",      value: cierresADSTipoA },
  ];

  // ── SECTION OUTBOUND ─────────────────────────────────────────────────────

  const inicios       = sumInt(analisisFMA, "Inicios");
  const noNegocio     = sumInt(analisisFMA, "No tienen negocio");
  const neg1          = sumInt(analisisFMA, "Negocio <1 año");
  const neg13         = sumInt(analisisFMA, "Negocio 1-3 años");
  const neg3plus      = sumInt(analisisFMA, "Negocio >3 años");
  const respuestas    = tienenNegocio + noNegocio;

  const prevInicios = sumInt(analisisPrev, "Inicios");

  const reunOut     = byCanal("Outbound");
  const cierresOut  = reunOut.filter((r) => isClosedStatus(r["Status"])).length;
  const neg1Plus    = neg13 + neg3plus;
  const reunOutPrev = reunionesRaw.filter((r) => r["Prospecto"] && inRPrev(r["Fecha de la agenda"]) && r["Canal"].trim().toLowerCase() === "outbound");
  const cierresOutPrev = reunOutPrev.filter((r) => isClosedStatus(r["Status"])).length;
  const outByTipo   = LEAD_TIPOS.map((tipo) => ({
    tipo,
    agendas: reunOut.filter((r) => matchTipo(r, tipo)).length,
    cierres: reunOut.filter((r) => matchTipo(r, tipo) && isClosedStatus(r["Status"])).length,
  })).filter((t) => t.agendas > 0 || t.cierres > 0);

  // ── AD de origen por canal (Comentarios / Historias) ─────────────────────
  function adOrigenByCanal(canalName: string) {
    const rows = reunionesRaw.filter(
      (r) => r["Prospecto"] && inR(r["Fecha de la agenda"]) &&
             r["Canal"].trim().toLowerCase() === canalName.toLowerCase()
    );
    const map: Record<string, { agendas: number; cierres: number }> = {};
    for (const r of rows) {
      const ad = (r["AD de origen"] ?? "").trim() || "(sin AD)";
      if (!map[ad]) map[ad] = { agendas: 0, cierres: 0 };
      map[ad].agendas++;
      if (isClosedStatus(r["Status"])) map[ad].cierres++;
    }
    return Object.entries(map).sort((a, b) => b[1].agendas - a[1].agendas);
  }
  const adOrigenComentarios = adOrigenByCanal("Comentarios");
  const adOrigenHistorias   = adOrigenByCanal("Historias");

  // ── SECTION HISTORIAS ─────────────────────────────────────────────────────

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

      {/* ── 1. GENERACIÓN DE AGENDAS ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Generación de Agendas</h2>
      <div className="card mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Canal", "$ Inversión", "Agendas", "Costo/Agenda"].map((h) => (
                  <th key={h} className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { nombre: "VSL",    gasto: gastoVSL,  gastoPrev: gastoVSLPrev, rows: reunVSL,  rowsPrev: reunVSLPrev },
                { nombre: "MSG IG", gasto: gastoIG,   gastoPrev: gastoIGPrev,  rows: reunIG,   rowsPrev: reunIGPrev  },
                { nombre: "FMA",    gasto: gastoFMA,  gastoPrev: gastoFMAPrev, rows: reunFMA,  rowsPrev: reunFMAPrev },
                ...otrasCanalesNames.map((canal) => ({
                  nombre: canal,
                  gasto: 0, gastoPrev: 0,
                  rows: reuniones.filter((r) => r["Canal"].trim() === canal),
                  rowsPrev: reunPrev.filter((r) => r["Canal"].trim() === canal),
                })),
              ].map(({ nombre, gasto, gastoPrev, rows, rowsPrev }) => {
                const ag   = rows.length;
                const agP  = rowsPrev.length;
                const costAg  = cpa(gasto, ag);
                const costAgP = cpa(gastoPrev, agP);
                const isOtro  = gasto === 0 && gastoPrev === 0 && nombre !== "FMA";
                return (
                  <tr key={nombre} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                    <td className="px-4 py-3 font-medium text-slate-300">{nombre}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-brand-400">{gasto > 0 ? fmtUSD(gasto) : "—"}</span>
                      {gastoPrev > 0 && <p className="text-[10px] text-slate-600 mt-0.5">ant: {fmtUSD(gastoPrev)}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-white font-bold">{ag || "—"}</span>
                      {agP > 0 && <p className="text-[10px] text-slate-600 mt-0.5">ant: {agP}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isOtro ? <span className="text-slate-600">—</span> : (
                        <>
                          <span className="text-amber-400 font-semibold">{fmtUSD(costAg)}</span>
                          {costAgP && <p className="text-[10px] text-slate-600 mt-0.5">ant: {fmtUSD(costAgP)}</p>}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {/* TOTAL */}
              {(() => {
                const ag  = reunVSL.length + reunIG.length + reunFMA.length + reunOtros.length;
                const agP = reunVSLPrev.length + reunIGPrev.length + reunFMAPrev.length;
                const c   = cpa(gastoTotal, ag);
                const cP  = cpa(gastoTotalPrev, agP);
                return (
                  <tr className="bg-surface-800/40 border-t border-surface-600/50">
                    <td className="px-4 py-3 font-bold text-white">TOTAL</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-brand-400 font-bold">{fmtUSD(gastoTotal)}</span>
                      {gastoTotalPrev > 0 && <p className="text-[10px] text-slate-600 mt-0.5">ant: {fmtUSD(gastoTotalPrev)}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-white font-bold">{ag}</span>
                      {agP > 0 && <p className="text-[10px] text-slate-600 mt-0.5">ant: {agP}</p>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-amber-400 font-bold">{fmtUSD(c)}</span>
                      {cP && <p className="text-[10px] text-slate-600 mt-0.5">ant: {fmtUSD(cP)}</p>}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600 mt-3 px-1">Período anterior: {prev.from} → {prev.to}</p>
      </div>

      {/* FMA sub-canal breakdown */}
      {fmaSubBreakdown.length > 0 && (
        <div className="card mb-8">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Composición FMA</p>
          <div className="flex flex-wrap gap-3">
            {fmaSubBreakdown.map((b) => {
              const totalFMAag = fmaSubBreakdown.reduce((s, x) => s + x.agendas, 0);
              const pctAg = totalFMAag > 0 ? ((b.agendas / totalFMAag) * 100).toFixed(0) : "0";
              const crNum = b.agendas > 0 ? (b.cierres / b.agendas) * 100 : null;
              return (
                <div key={b.origen} className="flex-1 min-w-[120px] bg-surface-800/50 border border-surface-700/50 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{b.origen}</p>
                  <p className="text-xl font-bold text-white">{b.agendas}</p>
                  <p className="text-[11px] text-slate-500">{pctAg}% del FMA</p>
                  {crNum !== null && (
                    <p className="text-[11px] text-emerald-400 mt-0.5">{b.cierres} ci. · {crNum.toFixed(0)}% CR</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 2. ANÁLISIS DE LEADS ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Análisis de Leads</h2>
      <div className="card mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-700">
                {["Estrategia", "Leads", "Agendas", "% Leads→Ag.", "Cierres", "% Leads→Cierre"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase text-center first:text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leadsAnalisis.map((e) => (
                <tr key={e.nombre} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                  <td className="px-4 py-3 font-medium text-slate-300">{e.nombre}</td>
                  <td className="px-4 py-3 text-center text-slate-400">
                    {e.leads > 0 ? e.leads : "—"}
                    {e.sub && <p className="text-[10px] text-slate-600 mt-0.5">{e.sub}</p>}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-white">{e.agendas || "—"}</td>
                  <td className="px-4 py-3 text-center text-brand-400">
                    {e.leads > 0 ? pct(e.agendas, e.leads) : "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-400 font-bold">{e.cierres || "—"}</td>
                  <td className="px-4 py-3 text-center text-emerald-400">
                    {e.leads > 0 ? pct(e.cierres, e.leads) : "—"}
                  </td>
                </tr>
              ))}
              {/* TOTAL */}
              {(() => {
                const tL  = leadsAnalisis.reduce((s, e) => s + e.leads,   0);
                const tAg = leadsAnalisis.reduce((s, e) => s + e.agendas, 0);
                const tCi = leadsAnalisis.reduce((s, e) => s + e.cierres, 0);
                return (
                  <tr className="bg-surface-800/40 border-t border-surface-600/50">
                    <td className="px-4 py-3 font-bold text-white">TOTAL</td>
                    <td className="px-4 py-3 text-center text-slate-400 font-bold">{tL > 0 ? tL : "—"}</td>
                    <td className="px-4 py-3 text-center font-bold text-white">{tAg || "—"}</td>
                    <td className="px-4 py-3 text-center text-brand-400">—</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-400">{tCi || "—"}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-400">{tL > 0 ? pct(tCi, tL) : "—"}</td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. VSL ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">VSL — Video Sales Letter</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        {/* Inversión */}
        <div className="card p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Inversión</p>
          <p className="text-xl font-bold text-brand-400">{fmtUSD(vslInversion)}</p>
          {vslInversionPrev > 0 && (
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              ant: {fmtUSD(vslInversionPrev)}
              <VarBadge curr={vslInversion} prev={vslInversionPrev} lowerBetter />
            </p>
          )}
        </div>
        {/* Visitas */}
        <div className="card p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Visitas</p>
          <p className="text-xl font-bold text-white">{vslVisitas > 0 ? vslVisitas.toLocaleString() : "—"}</p>
          {vslCostVisita && (
            <p className="text-[10px] text-amber-400 mt-0.5">{fmtUSD(vslCostVisita)} / visita</p>
          )}
          {vslVisitasPrev > 0 && (
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              ant: {vslVisitasPrev.toLocaleString()}
              <VarBadge curr={vslVisitas} prev={vslVisitasPrev} />
            </p>
          )}
        </div>
        {/* Agendas */}
        <div className="card p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Agendas</p>
          <p className="text-xl font-bold text-white">{vslAgendasReun > 0 ? vslAgendasReun : "—"}</p>
          {vslCierres > 0 && (
            <p className="text-[10px] text-emerald-400 mt-0.5">{vslCierres} ci. · {pct(vslCierres, vslAgendasReun)} CR</p>
          )}
          {vslAgendasPrevReun > 0 && (
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              ant: {vslAgendasPrevReun}
              <VarBadge curr={vslAgendasReun} prev={vslAgendasPrevReun} />
            </p>
          )}
        </div>
        {/* Conversión */}
        <div className="card p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">% Conversión</p>
          <p className="text-xl font-bold text-emerald-400">
            {vslConversion !== null ? `${vslConversion.toFixed(1)}%` : "—"}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">ag / visitas</p>
          {vslConversionPrev !== null && (
            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
              ant: {vslConversionPrev.toFixed(1)}%
              <VarBadge curr={vslConversion ?? 0} prev={vslConversionPrev} />
            </p>
          )}
        </div>
        {/* Costo/Agenda */}
        {(() => {
          const costAg  = vslAgendasReun > 0 && vslInversion > 0 ? vslInversion / vslAgendasReun : null;
          const costAgP = vslAgendasPrevReun > 0 && vslInversionPrev > 0 ? vslInversionPrev / vslAgendasPrevReun : null;
          return (
            <div className="card p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Costo/Agenda</p>
              <p className="text-xl font-bold text-amber-400">{fmtUSD(costAg)}</p>
              {costAgP && (
                <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                  ant: {fmtUSD(costAgP)}
                  <VarBadge curr={costAg ?? 0} prev={costAgP} lowerBetter />
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── 4. FMA ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">FMA — Follow Me Ads</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {/* Inversión */}
        <div className="card">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Inversión FMA</p>
          <p className="text-2xl font-bold text-brand-400">{fmtUSD(gastoFMA)}</p>
          {gastoFMAPrev > 0 && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              ant: {fmtUSD(gastoFMAPrev)}
              <VarBadge curr={gastoFMA} prev={gastoFMAPrev} lowerBetter />
            </p>
          )}
        </div>
        {/* Seguidores */}
        <div className="card">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Nuevos seguidores</p>
          <p className="text-2xl font-bold text-white">{fmaSeguidores > 0 ? fmaSeguidores.toLocaleString() : "—"}</p>
          {fmaCostSeguidor && (
            <p className="text-[11px] text-amber-400 mt-0.5">${fmaCostSeguidor.toFixed(2)} / seguidor</p>
          )}
          <p className="text-[10px] text-slate-600 mt-0.5">Personas que siguieron la cuenta vía ads</p>
          {fmaSeguidoresPrev > 0 && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              ant: {fmaSeguidoresPrev.toLocaleString()}
              <VarBadge curr={fmaSeguidores} prev={fmaSeguidoresPrev} />
            </p>
          )}
        </div>
        {/* Leads totales */}
        <div className="card">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Leads generados</p>
          <p className="text-2xl font-bold text-white">{fmaEcoLeads > 0 ? fmaEcoLeads : "—"}</p>
          {fmaCostLead && (
            <p className="text-[11px] text-amber-400 mt-0.5">${fmaCostLead.toFixed(2)} / lead</p>
          )}
          <p className="text-[10px] text-slate-600 mt-0.5">Personas que levantaron la mano como potenciales clientes</p>
          <p className="text-[10px] text-slate-700 mt-0.5">Cmt FMA ({fmaCmtLeads}) + Outbound ({tienenNegocio}) + Historias ({historiasLeads})</p>
        </div>
        {/* Agendas FMA */}
        <div className="card">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Agendas FMA</p>
          <p className="text-2xl font-bold text-white">{fmaAgendasFMA > 0 ? fmaAgendasFMA : "—"}</p>
          {fmaEcoLeads > 0 && fmaAgendasFMA > 0 && (
            <p className="text-[11px] text-brand-400 mt-0.5">{pct(fmaAgendasFMA, fmaEcoLeads)} de leads</p>
          )}
          {fmaAgendasFMAPrev > 0 && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              ant: {fmaAgendasFMAPrev}
              <VarBadge curr={fmaAgendasFMA} prev={fmaAgendasFMAPrev} />
            </p>
          )}
        </div>
        {/* Cierres FMA */}
        <div className="card">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Cierres FMA</p>
          <p className="text-2xl font-bold text-emerald-400">{fmaCierresFMA > 0 ? fmaCierresFMA : "—"}</p>
          {fmaAgendasFMA > 0 && (
            <p className="text-[11px] text-emerald-400 mt-0.5">{pct(fmaCierresFMA, fmaAgendasFMA)} CR</p>
          )}
          {fmaCierresFMAPrev > 0 && (
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              ant: {fmaCierresFMAPrev}
              <VarBadge curr={fmaCierresFMA} prev={fmaCierresFMAPrev} />
            </p>
          )}
        </div>
      </div>

      {/* ── 5. HISTORIAS ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 mt-8">Historias</h2>
      <div className="card mb-4">
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: "Leads",   value: historiasLeads > 0 ? historiasLeads : "—", color: historiasLeads > 0 ? "text-white" : "text-slate-500", note: null },
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

      {/* ── AD de origen: Comentarios + Historias ── */}
      {(adOrigenComentarios.length > 0 || adOrigenHistorias.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {[
            { label: "Comentarios — por AD", data: adOrigenComentarios },
            { label: "Historias — por AD",   data: adOrigenHistorias   },
          ].map(({ label, data }) => (
            <div key={label} className="card">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">{label}</p>
              {data.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-2">Sin datos en el período</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-surface-700">
                      {["AD de origen", "Ag.", "Ci.", "CR%"].map((h) => (
                        <th key={h} className={`pb-1.5 text-[10px] font-semibold text-slate-500 uppercase ${h === "AD de origen" ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map(([ad, s]) => (
                      <tr key={ad} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                        <td className="py-1.5 text-slate-300">{ad}</td>
                        <td className="py-1.5 text-right text-white font-semibold">{s.agendas}</td>
                        <td className="py-1.5 text-right text-emerald-400 font-semibold">{s.cierres || "—"}</td>
                        <td className="py-1.5 text-right text-slate-400">
                          {s.agendas > 0 ? `${((s.cierres / s.agendas) * 100).toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── 6. OUTBOUND ── */}
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

      {/* ── 7. ADS MJE IG ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">ADS MJE IG</h2>
      <div className="card mb-8 space-y-6">

        {/* Por tipo de lead */}
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
                {leadTypesADS.map((t) => {
                  const isA         = t.tipo === "A";
                  const pctTot      = tiposTotal > 0 && t.leads > 0 ? (t.leads / tiposTotal) * 100 : null;
                  const agLeadsNum  = t.leads > 0 ? (t.agendas / t.leads) * 100 : null;
                  const cierreAgNum = t.agendas > 0 ? (t.cierres / t.agendas) * 100 : null;

                  const agLeadsColor = !isA ? "text-slate-400"
                    : agLeadsNum === null ? "text-slate-500"
                    : agLeadsNum >= 25 ? "text-emerald-400"
                    : agLeadsNum >= 20 ? "text-amber-400"
                    : "text-rose-400";
                  const cierreColor = !isA ? "text-slate-400"
                    : cierreAgNum === null ? "text-slate-500"
                    : cierreAgNum >= 25 ? "text-emerald-400"
                    : cierreAgNum >= 15 ? "text-amber-400"
                    : "text-rose-400";

                  const diffVsHist  = isA && agLeadsNum !== null && tipoAHistAvg !== null ? agLeadsNum - tipoAHistAvg : null;
                  const badgeColor  = diffVsHist === null ? "" : diffVsHist > 5 ? "text-emerald-400" : diffVsHist < -5 ? "text-rose-400" : "text-amber-400";

                  return (
                    <tr key={t.tipo} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                      <td className="px-4 py-2.5 font-bold text-white">Tipo {t.tipo}</td>
                      <td className="px-4 py-2.5 text-center text-slate-300">{t.leads || "—"}</td>
                      <td className="px-4 py-2.5 text-center text-slate-400">
                        {pctTot !== null ? `${pctTot.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-white">{t.agendas || "—"}</td>
                      <td className={`px-4 py-2.5 text-center font-semibold ${agLeadsColor}`}>
                        {agLeadsNum !== null ? (
                          <span className="flex items-center justify-center gap-1.5 flex-wrap">
                            <span>{agLeadsNum.toFixed(1)}%</span>
                            {isA && tipoAHistAvg !== null && (
                              <span className={`text-[10px] font-normal ${badgeColor}`}>
                                prom {tipoAHistAvg.toFixed(1)}%
                              </span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-emerald-400">{t.cierres || "—"}</td>
                      <td className={`px-4 py-2.5 text-center font-semibold ${cierreColor}`}>
                        {cierreAgNum !== null ? (
                          <span className="flex items-center justify-center gap-1.5 flex-wrap">
                            <span>{cierreAgNum.toFixed(1)}%</span>
                            {isA && tipoAHistCierreAvg !== null && (() => {
                              const d = cierreAgNum - tipoAHistCierreAvg;
                              const bc = d > 5 ? "text-emerald-400" : d < -5 ? "text-rose-400" : "text-amber-400";
                              return <span className={`text-[10px] font-normal ${bc}`}>prom {tipoAHistCierreAvg.toFixed(1)}%</span>;
                            })()}
                          </span>
                        ) : "—"}
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
                  <td className="px-4 py-2.5 text-center font-bold text-white">{reunADS.length || "—"}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-brand-400">{pct(reunADS.length, tiposTotal)}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-emerald-400">{cierresADS || "—"}</td>
                  <td className="px-4 py-2.5 text-center font-bold text-emerald-400">{pct(cierresADS, reunADS.length)}</td>
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

        {/* Pie charts */}
        <div>
          <TiposPieCharts current={pieDataCurrent} previous={pieDataPrev} />
        </div>

        {/* AD de origen */}
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

        {/* Embudo de conversión */}
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
              const barColor = i === 0
                ? "#4A5BBD"
                : i === funnelSteps.length - 1
                ? "#059669"
                : "#2B3990";
              return (
                <div key={step.label} className="flex items-center gap-3 group">
                  <div className="w-24 text-right shrink-0">
                    <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
                      {step.label}
                    </span>
                  </div>
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
          <p className="mt-3 text-[10px] text-slate-600">
            Los valores son acumulativos: cada etapa incluye a todos los que llegaron a esa etapa o más avanzada.
          </p>
        </div>
      </div>
    </div>
  );
}
