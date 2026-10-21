import { parseUSD } from "@/lib/sheets";

type Row = Record<string, string>;

const FMA_CANALES = ["Outbound", "Organico", "Comentarios", "Link Perfil", "VSL Insta", "Historias"];
const isFMA = (canal: string) => FMA_CANALES.some((c) => canal.toLowerCase().includes(c.toLowerCase()));

// El equipo de marketing va 100% a FMA; el setter se reparte por cierres ponderados con el %
// de cierres de cada canal que pasan por setter (se le paga por cierre).
const SETTER_PCT_CIERRES: Record<string, number> = { "FMA": 0.7, "ADS Mje IG": 1, "ADS Mje WAPP": 1 };

function inDateRange(dateStr: string, from: string, to: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.trim().split("/");
  if (parts.length < 2) return false;
  const day = parseInt(parts[0]), month = parseInt(parts[1]) - 1;
  let year = parts.length === 3 ? parseInt(parts[2]) : new Date().getFullYear();
  if (year < 100) year += 2000;
  const d = new Date(year, month, day);
  return d >= new Date(from) && d <= new Date(to + "T23:59:59");
}

function countCcSpa(rows: Row[]): number {
  return rows.filter((r) => {
    const s = (r["Status"] ?? "").toLowerCase();
    return s.includes("cliente confirmado") || s.includes("seña pie adentro") || s.includes("señó pie adentro");
  }).length;
}

export type CacCanalRow = {
  nombre: string;
  ads: number; equipo: number; setter: number; total: number;
  ccSpa: number; cacAds: number | null; cacTotal: number | null;
};

export type CacCompleto = { rows: CacCanalRow[]; total: Omit<CacCanalRow, "nombre"> };

export function calcCacCompleto(input: {
  from: string; to: string;
  reuniones: Row[];
  vsl: Row[]; ig: Row[]; fma: Row[]; form: Row[]; wapp: Row[];
  costos: { marketing: number; setter: number };
}): CacCompleto {
  const { from, to, costos } = input;
  const gasto = (data: Row[], col: string) =>
    data.filter((r) => inDateRange(r["Fecha"] ?? "", from, to)).reduce((s, r) => s + parseUSD(r[col] ?? ""), 0);
  const reuniones = input.reuniones.filter((r) => r["Prospecto"] && inDateRange(r["Fecha de reunion"], from, to));

  const canal = (r: Row) => (r["Canal"] ?? "").trim();
  const defs: { nombre: string; ads: number; match: (r: Row) => boolean }[] = [
    { nombre: "Publi a VSL",  ads: gasto(input.vsl, "Gasto"), match: (r) => canal(r) === "Publi a VSL" },
    { nombre: "ADS Mje IG",   ads: gasto(input.ig, "$"),      match: (r) => canal(r) === "ADS Mje IG" },
    { nombre: "ADS Mje WAPP", ads: gasto(input.wapp, "$"),    match: (r) => canal(r) === "ADS Mje WAPP" },
    { nombre: "FMA",          ads: gasto(input.fma, "$"),     match: (r) => isFMA(canal(r)) },
    { nombre: "Form",         ads: gasto(input.form, "$"),    match: (r) => canal(r).toLowerCase() === "form" },
  ];
  const known = (r: Row) => defs.some((d) => d.match(r));
  defs.push({ nombre: "Otros", ads: 0, match: (r) => canal(r) !== "" && !known(r) });

  const base = defs
    .map((d) => ({ ...d, ccSpa: countCcSpa(reuniones.filter(d.match)) }))
    .filter((d) => d.ads > 0 || d.ccSpa > 0);

  const peso = (nombre: string) => SETTER_PCT_CIERRES[nombre] ?? 0;
  const cierresConSetter = base.reduce((s, d) => s + d.ccSpa * peso(d.nombre), 0);

  const rows: CacCanalRow[] = base.map((d) => {
    const equipo = d.nombre === "FMA" ? costos.marketing : 0;
    const setter = cierresConSetter > 0 ? costos.setter * (d.ccSpa * peso(d.nombre)) / cierresConSetter : 0;
    const total = d.ads + equipo + setter;
    return {
      nombre: d.nombre, ads: d.ads, equipo, setter, total, ccSpa: d.ccSpa,
      cacAds: d.ccSpa > 0 && d.ads > 0 ? d.ads / d.ccSpa : null,
      cacTotal: d.ccSpa > 0 && total > 0 ? total / d.ccSpa : null,
    };
  });

  const sum = (k: "ads" | "equipo" | "setter" | "total" | "ccSpa") => rows.reduce((s, r) => s + r[k], 0);
  const t = { ads: sum("ads"), equipo: sum("equipo"), setter: sum("setter"), total: sum("total"), ccSpa: sum("ccSpa") };
  return {
    rows,
    total: {
      ...t,
      cacAds: t.ccSpa > 0 && t.ads > 0 ? t.ads / t.ccSpa : null,
      cacTotal: t.ccSpa > 0 && t.total > 0 ? t.total / t.ccSpa : null,
    },
  };
}
