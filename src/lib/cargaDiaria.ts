// Carga diaria de METRICAS SETTING (lo que Fran cargaba a mano cada mañana), para el día anterior.
// Regla: solo se completan celdas vacías; lo que ya cargó alguien no se pisa.
import { google } from "googleapis";
import { sql } from "@/lib/db";
import { leerHojas, aSerie, fechaCelda } from "@/lib/hojaVentas";

const SETTING = process.env.SHEET_ID_SETTING!;
const CUENTA = "act_1851658528631747";
export const PESTANA_DIAG = "Diagnóstico ADS";

function hojas() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

type Campana = { nombre: string; gasto: number; visitas: number; seguidores: number; comentarios: number; mensajes: number };

/** Gasto y resultados de cada campaña de Meta en un día (YYYY-MM-DD, hora de Buenos Aires: así está la cuenta). */
export async function metaDia(dia: string): Promise<Campana[]> {
  const u = new URL(`https://graph.facebook.com/v23.0/${CUENTA}/insights`);
  u.search = new URLSearchParams({
    access_token: process.env.META_TOKEN ?? "", level: "campaign", limit: "100",
    time_range: JSON.stringify({ since: dia, until: dia }), fields: "campaign_name,spend,actions,instagram_profile_follow",
  }).toString();
  const r = await fetch(u, { cache: "no-store" });
  const d = await r.json();
  if (d.error) throw new Error("Meta: " + d.error.message);
  return (d.data ?? []).map((c: any) => {
    const a = (t: string) => Number(c.actions?.find((x: any) => x.action_type === t)?.value ?? 0);
    return {
      nombre: c.campaign_name, gasto: Number(c.spend ?? 0), visitas: a("landing_page_view"),
      seguidores: Number(c.instagram_profile_follow ?? 0), comentarios: a("comment"),
      mensajes: a("onsite_conversion.messaging_conversation_started_7d"),
    };
  });
}

const suma = (cs: Campana[], k: keyof Omit<Campana, "nombre">) => Math.round(cs.reduce((s, c) => s + c[k], 0) * 100) / 100;
const dma = (dia: string) => dia.split("-").reverse().map((x, i) => (i < 2 ? String(Number(x)) : x)).join("/");

/** Escribe valores en la fila del día (columna A = fecha), solo en celdas vacías. Si no hay fila para ese día, la agrega al final. */
async function escribirDia(pestana: string, dia: string, valores: Record<string, string | number>) {
  const s = hojas();
  const v = (await s.spreadsheets.values.get({ spreadsheetId: SETTING, range: `'${pestana}'!A:Z`, valueRenderOption: "UNFORMATTED_VALUE" })).data.values ?? [];
  const serie = aSerie(new Date(dia + "T15:00:00Z"));
  let fila = v.findIndex((r) => { const f = fechaCelda(r[0]); return f && aSerie(f) === serie; }) + 1;
  if (!fila) {
    fila = v.reduce((u, r, i) => (fechaCelda(r[0]) ? i + 1 : u), 1) + 1;
    await s.spreadsheets.values.update({ spreadsheetId: SETTING, range: `'${pestana}'!A${fila}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[dma(dia)]] } });
    v[fila - 1] = [];
  }
  const col = (l: string) => l.charCodeAt(0) - 65;
  const data = Object.entries(valores)
    .filter(([l]) => v[fila - 1]?.[col(l)] === undefined || v[fila - 1][col(l)] === "")
    .map(([l, val]) => ({ range: `'${pestana}'!${l}${fila}`, values: [[typeof val === "string" ? val.replace(/#/g, String(fila)) : val]] })); // «B#» = celda B de esta fila
  if (data.length) await s.spreadsheets.values.batchUpdate({ spreadsheetId: SETTING, requestBody: { valueInputOption: "USER_ENTERED", data } });
  return data.map((d) => d.range);
}

/** Agendas «Publi a VSL» de un día según el Sheets Equipo Ventas (Resumen = principal, Downsell = downsell), por fecha de agenda. */
async function agendasVSL(dia: string) {
  const serie = aSerie(new Date(dia + "T15:00:00Z"));
  const filas = (await leerHojas()).filter((f) => f.datos.canal === "Publi a VSL" && fechaCelda(f.c[12]) && aSerie(fechaCelda(f.c[12])!) === serie);
  return { principal: filas.filter((f) => f.hoja === "Resumen Reuniones").length, downsell: filas.filter((f) => f.hoja === "Downsell").length };
}

/** Diagnósticos completados por campaña ese día (leads de la web, campo «origen»). */
async function diagnosticosDia(dia: string) {
  const r = await fetch("https://cuentasclarasfs.com/wp-json/cc/v1/leads", {
    headers: { "x-clave": process.env.CC_CLAVE_EQUIPO ?? "", "User-Agent": "cc-crm" }, cache: "no-store",
  });
  const leads: { fecha: string; origen: string }[] = r.ok ? (await r.json()).leads ?? [] : [];
  const delDia = leads.filter((l) => l.fecha.slice(0, 10) === dia); // la web guarda la fecha en hora de Argentina
  const n = (o: string) => delDia.filter((l) => l.origen === o).length;
  return { directo: n("anuncio-directo"), blog: n("anuncio-plata"), manychat: n("manychat-seguidor") };
}

async function agendasDiagnostico(dia: string, campana: string) {
  const r = (await sql`SELECT embudo, count(*)::int n FROM reuniones WHERE fuente='calendly' AND utm_source='diagnostico' AND utm_campaign=${campana}
    AND (fecha_agenda AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = ${dia}::date GROUP BY 1`) as { embudo: string; n: number }[];
  return { principal: r.find((x) => x.embudo === "principal")?.n ?? 0, downsell: r.find((x) => x.embudo === "downsell")?.n ?? 0 };
}

const ENCABEZADO_DIAG = [
  "Fecha", "$ Directo", "Visitas Directo", "Diagnósticos Directo", "Agendas Directo", "Agendas DS Directo", "$ / Diagnóstico Directo", "$ / Agenda Directo",
  "$ Blog", "Visitas Blog", "Diagnósticos Blog", "Agendas Blog", "Agendas DS Blog", "$ / Diagnóstico Blog", "$ / Agenda Blog",
  "$ / Agenda total Directo (con DS)", "$ / Agenda total Blog (con DS)",
];

/** Etiquetas que avisó ManyChat ese día (ver /api/manychat). manychatActivo = ya llegó algún aviso alguna vez. */
async function eventosManychat(dia: string) {
  const r = (await sql`SELECT etiqueta, count(*)::int n FROM manychat_eventos
    WHERE (fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = ${dia}::date GROUP BY 1`) as { etiqueta: string; n: number }[];
  const [{ hay }] = (await sql`SELECT count(*) > 0 hay FROM manychat_eventos`) as { hay: boolean }[];
  const n = (e: string) => r.find((x) => x.etiqueta === e)?.n ?? 0;
  return { manychatActivo: hay, nuevo_seguidor: n("nuevo_seguidor"), tiene_negocio: n("tiene_negocio"), click_diagnostico: n("click_diagnostico") };
}

async function asegurarEncabezado(pestana: string, cols: Record<string, string>) {
  const s = hojas();
  // Si la pestaña tiene menos columnas que las que se van a usar, se agregan al final.
  const prop = (await s.spreadsheets.get({ spreadsheetId: SETTING, fields: "sheets.properties" })).data.sheets!.find((x) => x.properties!.title === pestana)!.properties!;
  const falta = Math.max(...Object.keys(cols).map((l) => l.charCodeAt(0) - 64)) - (prop.gridProperties?.columnCount ?? 26);
  if (falta > 0) await s.spreadsheets.batchUpdate({ spreadsheetId: SETTING, requestBody: { requests: [{ appendDimension: { sheetId: prop.sheetId, dimension: "COLUMNS", length: falta } }] } });
  const fila1 = (await s.spreadsheets.values.get({ spreadsheetId: SETTING, range: `'${pestana}'!A1:Z1` })).data.values?.[0] ?? [];
  const data = Object.entries(cols).filter(([l]) => !fila1[l.charCodeAt(0) - 65]).map(([l, t]) => ({ range: `'${pestana}'!${l}1`, values: [[t]] }));
  if (data.length) await s.spreadsheets.values.batchUpdate({ spreadsheetId: SETTING, requestBody: { valueInputOption: "RAW", data } });
}

async function asegurarPestanaDiag() {
  const s = hojas();
  const meta = await s.spreadsheets.get({ spreadsheetId: SETTING, fields: "sheets.properties.title" });
  if (meta.data.sheets!.some((x) => x.properties!.title === PESTANA_DIAG)) return asegurarEncabezado(PESTANA_DIAG, { P: ENCABEZADO_DIAG[15], Q: ENCABEZADO_DIAG[16] });
  await s.spreadsheets.batchUpdate({ spreadsheetId: SETTING, requestBody: { requests: [{ addSheet: { properties: { title: PESTANA_DIAG, gridProperties: { frozenRowCount: 1 } } } }] } });
  await s.spreadsheets.values.update({ spreadsheetId: SETTING, range: `'${PESTANA_DIAG}'!A1`, valueInputOption: "RAW", requestBody: { values: [ENCABEZADO_DIAG] } });
}

/** Carga un día completo (por defecto, ayer). Devuelve qué celdas escribió. */
export async function cargarDia(dia: string) {
  const camp = await metaDia(dia);
  const de = (re: RegExp) => camp.filter((c) => re.test(c.nombre));
  const vsl = de(/^VSL/i), fma = de(/^FMA/i), directo = de(/^Diagn[oó]stico/i), blog = de(/^Plata/i), wapp = de(/^MSG-Ventas/i);
  const ag = await agendasVSL(dia);
  const escrito: string[] = [];

  escrito.push(...await escribirDia("VSL", dia, { B: suma(vsl, "gasto"), C: ag.principal, E: suma(vsl, "visitas"), G: ag.downsell, H: '=IFERROR(B#/(C#+N(G#));"")' }));
  escrito.push(...await escribirDia("MSG WAPP", dia, { B: suma(wapp, "gasto"), C: suma(wapp, "mensajes") }));
  // FMA: lo de Meta + lo que avisa ManyChat (etiquetas) + diagnósticos y agendas que vinieron del link de ManyChat.
  const mc = await eventosManychat(dia);
  const agMc = await agendasDiagnostico(dia, "manychat-seguidor");
  const diagMc = (await diagnosticosDia(dia)).manychat;
  await asegurarEncabezado("FMA", { P: "Clic diagnóstico (Many)", Q: "Diagnósticos (Many)", R: "Agendas (Many)", S: "Agendas DS (Many)" });
  escrito.push(...await escribirDia("FMA", dia, {
    B: suma(fma, "gasto"), C: suma(fma, "comentarios"), D: suma(fma, "seguidores"),
    ...(mc.manychatActivo ? { E: mc.nuevo_seguidor, F: mc.tiene_negocio, P: mc.click_diagnostico } : {}),
    Q: diagMc, R: agMc.principal, S: agMc.downsell,
  }));

  if (directo.length || blog.length) {
    await asegurarPestanaDiag();
    const diag = await diagnosticosDia(dia);
    const [aD, aB] = await Promise.all([agendasDiagnostico(dia, "anuncio-directo"), agendasDiagnostico(dia, "anuncio-plata")]);
    const div = (a: string, b: string) => `=IFERROR(${a}/${b};"")`;
    escrito.push(...await escribirDia(PESTANA_DIAG, dia, {
      B: suma(directo, "gasto"), C: suma(directo, "visitas"), D: diag.directo, E: aD.principal, F: aD.downsell, G: div("B#", "D#"), H: div("B#", "E#"),
      I: suma(blog, "gasto"), J: suma(blog, "visitas"), K: diag.blog, L: aB.principal, M: aB.downsell, N: div("I#", "K#"), O: div("I#", "L#"),
      P: div("B#", "(E#+F#)"), Q: div("I#", "(L#+M#)"),
    }));
  }
  return escrito;
}
