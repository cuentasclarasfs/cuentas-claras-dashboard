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

const letra = (i: number) => (i >= 26 ? String.fromCharCode(64 + Math.floor(i / 26)) : "") + String.fromCharCode(65 + (i % 26));
const limpio = (t: unknown) => String(t ?? "").trim().toLowerCase();

/**
 * Escribe en la fila del día (columna A = fecha), solo en celdas vacías. Si no hay fila para ese día, la agrega al final.
 * Las columnas se buscan por su TÍTULO en la fila 1 (Fran reordena columnas); en fórmulas, «{Título}» = esa celda de esta fila.
 */
async function escribirDia(pestana: string, dia: string, valores: Record<string, string | number>, pisar = false) {
  const s = hojas();
  const v = (await s.spreadsheets.values.get({ spreadsheetId: SETTING, range: `'${pestana}'!A:AZ`, valueRenderOption: "UNFORMATTED_VALUE" })).data.values ?? [];
  const titulos = (v[0] ?? []).map(limpio);
  const idx = (t: string) => titulos.indexOf(limpio(t));
  const serie = aSerie(new Date(dia + "T15:00:00Z"));
  let fila = v.findIndex((r) => { const f = fechaCelda(r[0]); return f && aSerie(f) === serie; }) + 1;
  if (!fila) {
    fila = v.reduce((u, r, i) => (fechaCelda(r[0]) ? i + 1 : u), 1) + 1;
    await s.spreadsheets.values.update({ spreadsheetId: SETTING, range: `'${pestana}'!A${fila}`, valueInputOption: "USER_ENTERED", requestBody: { values: [[dma(dia)]] } });
    v[fila - 1] = [];
  }
  const celda = (t: string) => { const i = idx(t); if (i < 0) throw new Error(`${pestana}: no encuentro la columna «${t}»`); return letra(i) + fila; };
  const data = Object.entries(valores)
    .filter(([t]) => idx(t) >= 0 && (pisar || v[fila - 1]?.[idx(t)] === undefined || v[fila - 1][idx(t)] === ""))
    .map(([t, val]) => ({ range: `'${pestana}'!${celda(t)}`, values: [[typeof val === "string" ? val.replace(/\{([^}]+)\}/g, (_, x) => celda(x)) : val]] }));
  if (data.length) await s.spreadsheets.values.batchUpdate({ spreadsheetId: SETTING, requestBody: { valueInputOption: "USER_ENTERED", data } });
  return data.map((d) => d.range);
}

/**
 * Agendas que trajo el VSL un día, por fecha de agenda. Principal: filas «Publi a VSL» de Resumen Reuniones (lo que contaba Fran).
 * Downsell: agendas del downsell que vinieron del VSL (link con utm vsl-…, un Calendly de VSL derivado, o canal «Publi a VSL»).
 */
export async function agendasVSL(dia: string) {
  const serie = aSerie(new Date(dia + "T15:00:00Z"));
  const principal = (await leerHojas()).filter((f) => f.hoja === "Resumen Reuniones" && f.datos.canal === "Publi a VSL" && fechaCelda(f.c[12]) && aSerie(fechaCelda(f.c[12])!) === serie).length;
  const [{ n }] = (await sql`SELECT count(*)::int n FROM reuniones WHERE embudo='downsell' AND NOT cancelada AND NOT descartada
    AND (utm_source LIKE 'vsl-%' OR evento IN ('TB','FPG','MZ','RMK','V','V1','V2') OR canal='Publi a VSL')
    AND (fecha_agenda AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = ${dia}::date`) as { n: number }[];
  return { principal, downsell: n };
}

/** Diagnósticos completados por campaña ese día (leads de la web, campo «origen»). */
async function diagnosticosDia(dia: string) {
  const r = await fetch(`https://cuentasclarasfs.com/wp-json/cc/v1/leads?t=${Date.now()}` /* LiteSpeed cachea la URL sin parámetro */, {
    headers: { "x-clave": process.env.CC_CLAVE_EQUIPO ?? "", "User-Agent": "cc-crm" }, cache: "no-store",
  });
  const leads: { fecha: string; origen: string }[] = r.ok ? (await r.json()).leads ?? [] : [];
  const delDia = leads.filter((l) => l.fecha.slice(0, 10) === dia); // la web guarda la fecha en hora de Argentina
  const n = (o: string) => delDia.filter((l) => l.origen === o).length;
  return { de: n, directo: ORIGENES_DIRECTO.reduce((s, o) => s + n(o), 0), blog: n("anuncio-plata"), manychat: n("manychat-seguidor") };
}

// Agendas de un día que vinieron de una campaña del diagnóstico: solo por el link (utm_campaign).
// No se cruza por mail: si después lo agenda el setter, esa agenda es de setting (Fran, 15-11).
async function agendasDiagnostico(dia: string, campanas: string[]) { // la campaña Diagnóstico junta videos (anuncio-directo) y estáticos (anuncio-estatico)
  const r = (await sql`SELECT embudo, count(*)::int n FROM reuniones WHERE fuente='calendly' AND NOT cancelada AND utm_campaign = ANY(${campanas})
    AND (fecha_agenda AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = ${dia}::date GROUP BY 1`) as { embudo: string; n: number }[];
  return { principal: r.find((x) => x.embudo === "principal")?.n ?? 0, downsell: r.find((x) => x.embudo === "downsell")?.n ?? 0 };
}

// Conjuntos de la campaña Diagnóstico con link propio (?o=), para ver cuánto trae cada uno (Fran, 17-11):
// [título de las columnas, origen del link, comienzo del nombre del conjunto en Meta]
const CONJUNTOS_DIAG: [string, string, string][] = [
  ["Históricos", "anuncio-historico", "Históricos FMA"], ["Estáticos", "anuncio-estatico", "Estáticos"], ["Carruseles", "anuncio-carrusel", "Carruseles · videos"], ["Orgánicos", "anuncio-organico", "Carruseles orgánicos"]];
const ORIGENES_DIRECTO = ["anuncio-directo", ...CONJUNTOS_DIAG.map((c) => c[1])]; // todo lo de la campaña Diagnóstico

/** Gasto de cada conjunto de la campaña Diagnóstico ese día. */
async function gastoConjuntosDiag(dia: string) {
  const u = new URL(`https://graph.facebook.com/v23.0/${CUENTA}/insights`);
  u.search = new URLSearchParams({ access_token: process.env.META_TOKEN ?? "", level: "adset", limit: "200",
    time_range: JSON.stringify({ since: dia, until: dia }), fields: "campaign_name,adset_name,spend" }).toString();
  const d = await (await fetch(u, { cache: "no-store" })).json();
  if (d.error) throw new Error("Meta: " + d.error.message);
  const filas = (d.data ?? []).filter((c: any) => /^Diagn[oó]stico/i.test(c.campaign_name));
  return (prefijo: string) => Math.round(filas.filter((c: any) => c.adset_name.startsWith(prefijo)).reduce((s: number, c: any) => s + Number(c.spend ?? 0), 0) * 100) / 100;
}

const ENCABEZADO_DIAG = [
  "Fecha", "$ Directo", "Visitas Directo", "Diagnósticos Directo", "Agendas Directo", "Agendas DS Directo", "$ / Diagnóstico Directo", "$ / Agenda Directo",
  "$ Blog", "Visitas Blog", "Diagnósticos Blog", "Agendas Blog", "Agendas DS Blog", "$ / Diagnóstico Blog", "$ / Agenda Blog",
  "$ / Agenda total Directo (con DS)", "$ / Agenda total Blog (con DS)",
  ...CONJUNTOS_DIAG.flatMap(([k]) => [`$ ${k}`, `Diagnósticos ${k}`, `Agendas ${k}`, `Agendas DS ${k}`, `$ / Agenda ${k}`]),
];

/** Etiquetas que avisó ManyChat ese día (ver /api/manychat). manychatActivo = ya llegó algún aviso alguna vez. */
async function eventosManychat(dia: string) {
  const r = (await sql`SELECT etiqueta, count(*)::int n FROM manychat_eventos
    WHERE (fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date = ${dia}::date GROUP BY 1`) as { etiqueta: string; n: number }[];
  // Solo días completos: el primer aviso tiene que ser de antes de ese día (si no, el día de la activación sale a medias).
  const [{ hay }] = (await sql`SELECT coalesce(min((fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) < ${dia}::date, false) hay FROM manychat_eventos`) as { hay: boolean }[];
  const n = (e: string) => r.find((x) => x.etiqueta === e)?.n ?? 0;
  return { manychatActivo: hay, nuevo_seguidor: n("nuevo_seguidor"), tiene_negocio: n("tiene_negocio"), click_diagnostico: n("click_diagnostico"), no_tiene_negocio: n("no_tiene_negocio") };
}

async function asegurarPestanaDiag() {
  const s = hojas();
  const meta = await s.spreadsheets.get({ spreadsheetId: SETTING, fields: "sheets.properties(title,sheetId,gridProperties.columnCount)" });
  if (meta.data.sheets!.some((x) => x.properties!.title === PESTANA_DIAG)) {
    // Columnas nuevas (los conjuntos): se agregan al final, sin mover las que ya están.
    const fila = (await s.spreadsheets.values.get({ spreadsheetId: SETTING, range: `'${PESTANA_DIAG}'!1:1` })).data.values?.[0] ?? [];
    const faltan = ENCABEZADO_DIAG.filter((t) => !fila.map(limpio).includes(limpio(t)));
    const hoja = meta.data.sheets!.find((x) => x.properties!.title === PESTANA_DIAG)!.properties!;
    const sobran = fila.length + faltan.length - (hoja.gridProperties?.columnCount ?? 0); // la pestaña tiene un ancho fijo: se agranda si hace falta
    if (faltan.length && sobran > 0) await s.spreadsheets.batchUpdate({ spreadsheetId: SETTING, requestBody: { requests: [{ appendDimension: { sheetId: hoja.sheetId, dimension: "COLUMNS", length: sobran } }] } });
    if (faltan.length) await s.spreadsheets.values.update({ spreadsheetId: SETTING, range: `'${PESTANA_DIAG}'!${letra(fila.length)}1`, valueInputOption: "RAW", requestBody: { values: [faltan] } });
    return;
  }
  await s.spreadsheets.batchUpdate({ spreadsheetId: SETTING, requestBody: { requests: [{ addSheet: { properties: { title: PESTANA_DIAG, gridProperties: { frozenRowCount: 1 } } } }] } });
  await s.spreadsheets.values.update({ spreadsheetId: SETTING, range: `'${PESTANA_DIAG}'!A1`, valueInputOption: "RAW", requestBody: { values: [ENCABEZADO_DIAG] } });
}

/** Carga un día completo (por defecto, ayer). Devuelve qué celdas escribió. */
export async function cargarDia(dia: string, pisar = false) {
  const aMano = dia < "2026-11-15"; // hasta el sábado 14, VSL / MSG WAPP / FMA los carga Fran a mano (pedido del 15-11)
  const camp = await metaDia(dia);
  const de = (re: RegExp) => camp.filter((c) => re.test(c.nombre));
  const vsl = de(/^VSL/i), fma = de(/^FMA/i), directo = de(/^Diagn[oó]stico/i), blog = de(/^Plata/i), wapp = de(/^MSG-Ventas/i);
  const ag = await agendasVSL(dia);
  const escrito: string[] = [];

  if (!aMano) escrito.push(...await escribirDia("VSL", dia, { "Gasto": suma(vsl, "gasto"), "Agendas": ag.principal, "Visitas a la pagina": suma(vsl, "visitas"), "Agendas DS": ag.downsell,
    "Costo c/DS": '=IFERROR({Gasto}/({Agendas}+N({Agendas DS}));"")' }));
  if (!aMano) escrito.push(...await escribirDia("MSG WAPP", dia, { "$": suma(wapp, "gasto"), "Ads Manager": suma(wapp, "mensajes") }));
  // FMA: lo de Meta + lo que avisa ManyChat (etiquetas) + diagnósticos y agendas que vinieron del link de ManyChat.
  const mc = await eventosManychat(dia);
  const agMc = await agendasDiagnostico(dia, ["manychat-seguidor"]);
  const diagMc = (await diagnosticosDia(dia)).manychat;
  if (!aMano) escrito.push(...await escribirDia("FMA", dia, {
    "$": suma(fma, "gasto"), "Comentarios": suma(fma, "comentarios"), "Seguidores Ads Man": suma(fma, "seguidores"),
    ...(mc.manychatActivo ? { "Seguidores Many": mc.nuevo_seguidor, "Tienen negocio": mc.tiene_negocio, "No tiene Negocio": mc.no_tiene_negocio, "Clic diagnóstico (Many)": mc.click_diagnostico } : {}),
    "Diagnósticos (Many)": diagMc, "Agendas (Many)": agMc.principal, "Agendas DS (Many)": agMc.downsell,
    // Fórmulas de la fila (columnas que armó Fran el 16-11); se buscan por título, como todo lo demás.
    "Respondieron": "={Tienen negocio}+{No tiene Negocio}", "%": '=IFERROR({Respondieron}/{Seguidores Many};"")',
    "$ Tiene un Neg": '=IFERROR({$}/{Tienen negocio};"")', "Costo Agenda Ppal": '=IFERROR({$}/{Agendas (Many)};"")',
    "Costo agenda Final": '=IFERROR({$}/({Agendas (Many)}+{Agendas DS (Many)});"")',
  }));

  if (directo.length || blog.length) {
    await asegurarPestanaDiag();
    const diag = await diagnosticosDia(dia);
    const [aD, aB] = await Promise.all([agendasDiagnostico(dia, ORIGENES_DIRECTO), agendasDiagnostico(dia, ["anuncio-plata"])]);
    const div = (a: string, b: string) => `=IFERROR(${a}/${b};"")`;
    const H = ENCABEZADO_DIAG;
    escrito.push(...await escribirDia(PESTANA_DIAG, dia, {
      [H[1]]: suma(directo, "gasto"), [H[2]]: suma(directo, "visitas"), [H[3]]: diag.directo, [H[4]]: aD.principal, [H[5]]: aD.downsell,
      [H[6]]: div(`{${H[1]}}`, `{${H[3]}}`), [H[7]]: div(`{${H[1]}}`, `{${H[4]}}`), [H[15]]: div(`{${H[1]}}`, `({${H[4]}}+{${H[5]}})`),
      // Blog solo los días que Plata gastó (se pausó el 17-11: el 17 es el último día con métricas de Blog).
      ...(blog.length ? {
        [H[8]]: suma(blog, "gasto"), [H[9]]: suma(blog, "visitas"), [H[10]]: diag.blog, [H[11]]: aB.principal, [H[12]]: aB.downsell,
        [H[13]]: div(`{${H[8]}}`, `{${H[10]}}`), [H[14]]: div(`{${H[8]}}`, `{${H[11]}}`), [H[16]]: div(`{${H[8]}}`, `({${H[11]}}+{${H[12]}})`),
      } : {}),
    }, pisar));
    // Por conjunto (estáticos, carruseles, orgánicos): gasto de Meta + diagnósticos y agendas de su link.
    const gasto = await gastoConjuntosDiag(dia);
    for (const [k, origen, prefijo] of CONJUNTOS_DIAG) {
      const ag = await agendasDiagnostico(dia, [origen]);
      escrito.push(...await escribirDia(PESTANA_DIAG, dia, {
        [`$ ${k}`]: gasto(prefijo), [`Diagnósticos ${k}`]: diag.de(origen), [`Agendas ${k}`]: ag.principal, [`Agendas DS ${k}`]: ag.downsell,
        [`$ / Agenda ${k}`]: div(`{$ ${k}}`, `{Agendas ${k}}`),
      }, pisar));
    }
  }
  return escrito;
}

/** Carga el día de ayer una sola vez, a partir de las 8:30 de Argentina. La llaman los relojes y las pantallas:
 *  si GitHub se saltea la hora, carga el primero que llegue después. Atómico, así no corre dos veces a la vez. */
export async function cargaDiariaSiFalta() {
  const ar = new Date(Date.now() - 3 * 3600e3);
  if (ar.getUTCHours() * 60 + ar.getUTCMinutes() < 8 * 60 + 30) return null;
  const ayer = new Date(ar.getTime() - 864e5).toISOString().slice(0, 10);
  await sql`INSERT INTO sync_estado VALUES ('diario', '') ON CONFLICT (clave) DO NOTHING`;
  const toca = await sql`UPDATE sync_estado SET valor=${ayer} WHERE clave='diario' AND valor < ${ayer} RETURNING clave`;
  if (!toca.length) return null;
  try {
    return { dia: ayer, escrito: await cargarDia(ayer) };
  } catch (e) {
    await sql`UPDATE sync_estado SET valor='' WHERE clave='diario'`; // que lo reintente el próximo
    throw e;
  }
}
