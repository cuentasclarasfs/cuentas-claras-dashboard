// Ida y vuelta con el Sheets «Equipo Ventas» (pestañas Resumen Reuniones y Downsell) mientras el equipo lo siga usando.
// Regla de Fran (15-11): manda el Sheets. Lo que dice el Sheets pisa a la plataforma; lo que se carga en la plataforma se escribe en el Sheets.
import { google } from "googleapis";
import { sql, CLOSERS } from "@/lib/db";

const ID = "1YnY4XNEK2Diq2yCIIjpnDAQUSSpzFNBCKVLYMWQbeHY";
export const PESTANAS = ["Resumen Reuniones", "Downsell"] as const;
const DIA = 864e5;
// Desde las agendas del 16-11-2026 el setter ya no carga: la plataforma escribe sola reagendas y cancelaciones.
const AUTO_DESDE = new Date("2026-11-16T03:00:00Z");

function hojas() {
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL, private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Las fechas del Sheets son números de serie (días desde 30/12/1899), en hora de Argentina.
const AR = 3 * 3600e3;
export const aSerie = (d: Date) => Math.floor((d.getTime() - AR - Date.UTC(1899, 11, 30)) / DIA);
const deSerie = (n: number) => new Date(Date.UTC(1899, 11, 30) + n * DIA + 15 * 3600e3); // mediodía AR
export const fechaCelda = (v: unknown) => {
  if (typeof v === "number" && v > 30000) return deSerie(v);
  const [d, m, y] = String(v ?? "").trim().split("/").map(Number);
  return d && m && y ? new Date(Date.UTC(y < 100 ? 2000 + y : y, m - 1, d, 15)) : null;
};
export const plata = (v: unknown) => {
  if (typeof v === "number") return v;
  const t = String(v ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return t && !isNaN(Number(t)) ? Number(t) : null;
};

const norm = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
// "Juan Pérez" = "juan perez gomez" (dos primeras palabras) y también el orden invertido («Pinturería Alejandra»).
export function parecido(a: string, b: string) {
  const na = norm(a), nb = norm(b);
  const x = na.split(" ").slice(0, 2).join(" "), y = nb.split(" ").slice(0, 2).join(" ");
  if (!x || !y) return false;
  // «Juan Pablo Lloberas» ≠ «Juan Pablo Debrandi»: si los dos tienen tercera palabra, tiene que coincidir.
  const [ta, tb] = [na.split(" ")[2], nb.split(" ")[2]];
  if (x === y && ta && tb && ta !== tb) return false;
  if (x === y || nb.startsWith(x) || na.startsWith(y)) return true;
  const wa = new Set(na.split(" ").filter((w) => w.length > 2));
  return nb.split(" ").filter((w) => w.length > 2 && wa.has(w)).length >= 2;
}

export type FilaHoja = {
  hoja: string; fila: number; nombre: string; reu: Date; c: unknown[];
  datos: Record<string, string | number | null>; repetidaDe?: FilaHoja; match?: string;
};

export async function leerHojas(): Promise<FilaHoja[]> {
  const s = hojas();
  const filas: FilaHoja[] = [];
  for (const hoja of PESTANAS) {
    const rows = (await s.spreadsheets.values.get({ spreadsheetId: ID, range: `'${hoja}'!A2:Y`, valueRenderOption: "UNFORMATTED_VALUE" })).data.values ?? [];
    rows.forEach((c, n) => {
      const txt = (i: number) => String(c[i] ?? "").trim() || null;
      const reu = fechaCelda(c[13]);
      if (!txt(1) || txt(1) === "Prospecto" || !reu) return;
      const f: FilaHoja = {
        hoja, fila: n + 2, nombre: txt(1)!, reu, c,
        datos: {
          canal: txt(3), ad_origen: txt(4), tipo_lead: txt(11), origen: txt(15), facturacion: txt(16),
          com_set: txt(17), com_closer: txt(18), status: txt(19), metodo_pago: txt(20),
          monto_24h: plata(c[21]), aov: plata(c[22]), comentario: txt(24), closer_nombre: txt(14),
        },
      };
      // El setter copia a los del downsell en las dos pestañas: es la misma agenda.
      if (hoja === "Downsell") f.repetidaDe = filas.find((o) => o.hoja !== "Downsell" &&
        Math.abs(o.reu.getTime() - reu.getTime()) < 7 * DIA && parecido(o.nombre, f.nombre));
      filas.push(f);
    });
  }
  return filas;
}

/** Une filas del Sheets con reuniones de la base: mismo nombre a ±45 días (se reagenda cambiando la fecha), la más cercana primero; una cancelada solo si no hay otra. */
export function cruzar(filas: FilaHoja[], db: { id: string; nombre: string; fecha_reu: string; cancelada: boolean; embudo?: string }[]) {
  const pares: { f: FilaHoja; id: string; costo: number }[] = [];
  for (const f of filas) if (!f.repetidaDe) for (const r of db) {
    const dias = Math.abs(new Date(r.fecha_reu).getTime() - f.reu.getTime()) / DIA;
    // Una agenda del downsell prefiere una fila de la pestaña Downsell (y al revés): la misma persona puede tener las dos reuniones.
    const otraPestana = r.embudo && (r.embudo === "downsell") !== (f.hoja === "Downsell") ? 30 : 0;
    if (dias < 45 && parecido(r.nombre ?? "", f.nombre)) pares.push({ f, id: r.id, costo: dias + (r.cancelada ? 60 : 0) + otraPestana });
  }
  pares.sort((a, b) => a.costo - b.costo);
  const usados = new Set<string>();
  for (const p of pares) if (!p.f.match && !usados.has(p.id)) { p.f.match = p.id; usados.add(p.id); }
}

// 16/11/2026 en hora de Argentina; el Sheets lo toma como fecha.
const dma = (d: Date) => new Date(d.getTime() - AR).toISOString().slice(0, 10).split("-").reverse().join("/");
// Un texto que empieza con = + - @ el Sheets lo tomaría como fórmula.
const seguro = (v: string | number) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v);

// No uso «append»: el Sheets adivina mal dónde empieza la tabla y corre las columnas. Se escribe después de la última fila con nombre.
async function agregarFilas(pestana: string, filas: (string | number)[][]) {
  const s = hojas();
  const col = (await s.spreadsheets.values.get({ spreadsheetId: ID, range: `'${pestana}'!B:B` })).data.values ?? [];
  const desde = col.length + 1;
  await s.spreadsheets.values.update({
    spreadsheetId: ID, range: `'${pestana}'!A${desde}:${String.fromCharCode(64 + filas[0].length)}${desde + filas.length - 1}`, valueInputOption: "USER_ENTERED",
    requestBody: { values: filas.map((f) => f.map(seguro)) },
  });
  await ordenarPorReunion(pestana);
}

/** Ordena toda la pestaña por Fecha de reunión (N), como la ordenó Fran (18-11); las filas se mueven con sus colores. */
export async function ordenarPorReunion(pestana: string) {
  const s = hojas();
  const sheetId = (await s.spreadsheets.get({ spreadsheetId: ID, fields: "sheets.properties" })).data.sheets?.find((h) => h.properties?.title === pestana)?.properties?.sheetId;
  const filas = ((await s.spreadsheets.values.get({ spreadsheetId: ID, range: `'${pestana}'!B:B` })).data.values ?? []).length;
  await s.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests: [{ sortRange: {
    range: { sheetId, startRowIndex: 1, endRowIndex: filas }, sortSpecs: [{ dimensionIndex: 13, sortOrder: "ASCENDING" }] } }] } });
}

// Valores que acepta cada desplegable del Sheets (Fran, 15-11). Lo que no se sabe queda vacío, nunca un valor fuera de la lista.
type Celda = { hoja: string; fila: number; nombre: string; reu: Date; col: string; valores: (string | number)[] };
// Entre que se lee y se escribe alguien puede ordenar la pestaña: antes de escribir se confirma que en esa fila siga
// la misma persona (nombre + fecha de reunión); si se movió, se la busca; si no aparece, no se escribe nada.
async function escribirCeldas(celdas: Celda[]) {
  if (!celdas.length) return;
  const s = hojas();
  const tabla: Record<string, unknown[][]> = {};
  for (const h of new Set(celdas.map((c) => c.hoja)))
    tabla[h] = (await s.spreadsheets.values.get({ spreadsheetId: ID, range: `'${h}'!A1:N`, valueRenderOption: "UNFORMATTED_VALUE" })).data.values ?? [];
  const es = (fila: unknown[] | undefined, c: Celda) => !!fila && norm(String(fila[1] ?? "")) === norm(c.nombre) &&
    fechaCelda(fila[13]) !== null && aSerie(fechaCelda(fila[13])!) === aSerie(c.reu);
  const data = celdas.flatMap((c) => {
    const t = tabla[c.hoja];
    const n = es(t[c.fila - 1], c) ? c.fila : t.findIndex((f) => es(f, c)) + 1;
    return n > 0 ? [{ range: `'${c.hoja}'!${c.col}${n}`, values: [c.valores.map(seguro)] }] : [];
  });
  if (data.length) await s.spreadsheets.values.batchUpdate({ spreadsheetId: ID, requestBody: { valueInputOption: "USER_ENTERED", data } });
  return data.length;
}

const siNo = (s: string | null) => (s ? (/^s[ií]/i.test(s) ? "SI" : /^no/i.test(s) ? "NO" : "") : "");
// Principal: siempre SI (ya no se pregunta). Downsell: lo que contestó, y si no contestó NO.
export const ingresos = (r: { embudo: string; factura_10m: string | null }) => (r.embudo === "principal" ? "SI" : siNo(r.factura_10m) || "NO");
export const antiguedad = (s: string | null) =>
  /m[aá]s de 3/i.test(s ?? "") ? "Mas de 3 años" : /menos de 1/i.test(s ?? "") ? "Menos de 1 año" : /entre 1 y 3/i.test(s ?? "") ? "Entre 1 y 3 años" : "";
/** Canal (D) y Origen (P) según de dónde vino la agenda: primero el utm del link, después el evento de Calendly (historial desde ago-26). */
/** Columna «AD de origen» para lo que llega por un anuncio del diagnóstico: de qué conjunto vino (Fran, 17-11). */
const AD_DIAG: Record<string, string> = { "anuncio-directo": "Diag Video", "anuncio-estatico": "Diag Estatico", "anuncio-carrusel": "Diag Carrusel", "anuncio-organico": "Diag Organico", "anuncio-historico": "Diag Historico" };
export function adOrigen(r: { utm_source: string | null; utm_campaign?: string | null }): string {
  const camp = r.utm_campaign ?? "";
  if (r.utm_source !== "diagnostico") return "";
  return /^anuncio-plata/.test(camp) ? "Diag Blog" : AD_DIAG[camp.replace(/-cal$/, "")] ?? ""; // -cal = campaña calificado
}

export function canalOrigen(r: { evento: string; utm_source: string | null; utm_campaign?: string | null; embudo: string }): [string, string] {
  const u = r.utm_source ?? "", e = r.evento ?? "", camp = r.utm_campaign ?? "";
  // Desde el diagnóstico, utm_campaign dice por dónde entró. El Canal se compara con lo invertido:
  // Blog Diagnostico = solo anuncios pagos al artículo (anuncio-plata…); guías y recursos sin anuncio = Organico.
  if (u === "diagnostico") {
    if (/^anuncio-plata/.test(camp)) return ["Blog Diagnostico", "Organico"]; // anuncio-directo y anuncio-estatico = Diagnostico Directo
    if (/^manychat/.test(camp)) return ["Outbound", "Setting"]; // ManyChat a seguidores nuevos = Outbound, como el resto del outbound
    if (/^(guia-|recurso-)|instagram|portada|testimonios/.test(camp)) return ["Organico", "Organico"];
    return ["Diagnostico Directo", "Organico"];
  }
  if (u.startsWith("vsl-")) return ["Publi a VSL", "Publi a VSL"];
  if (u === "perfil") return ["Link perfil", "Organico"];
  if (u.startsWith("web-")) return ["Organico", "Organico"];
  if (["TB", "FPG", "MZ", "RMK", "V", "V1", "V2"].includes(e)) return ["Publi a VSL", "Publi a VSL"];
  if (e === "D") return ["Diagnostico Directo", "Organico"]; // Calendly del diagnóstico (desde el 15-11 todos entran por la D)
  if (e === "H") return ["Link perfil", "Organico"];
  if (e === "M") return ["Outbound", "Setting"];
  if (e === "R") return ["Referido", "Referido"];
  if (e === "YT") return ["Organico", "Organico"];
  if (e === "S") return ["", "Setting"]; // el link del setter: el canal (historias, ads, comentarios…) lo sabe Busta
  return ["", ""];
}

/**
 * Sincroniza las reuniones desde `desde`:
 * 1) lo que dice el Sheets (status, montos, canal…) pasa a la plataforma;
 * 2) las agendas cargadas a mano en el Sheets entran a la plataforma;
 * 3) las agendas de Calendly que no están en el Sheets se agregan solas al final de su pestaña (y se corrigen reagendas y cancelaciones).
 */
export async function sincronizarHoja(desde: Date) {
  const filas = (await leerHojas()).filter((f) => f.reu.getTime() >= desde.getTime() - 45 * DIA);
  const db = (await sql`SELECT * FROM reuniones WHERE fecha_reu >= ${new Date(desde.getTime() - 45 * DIA).toISOString()} AND NOT descartada`) as any[];
  cruzar(filas, db);
  const porId = new Map(db.map((r) => [r.id, r]));
  const CAMPOS = ["canal", "ad_origen", "tipo_lead", "origen", "facturacion", "com_set", "com_closer", "status", "metodo_pago", "monto_24h", "aov", "comentario", "closer_nombre"];
  let actualizadas = 0, nuevas = 0, agregadas = 0;
  const celdas: Celda[] = [];

  for (const f of filas) {
    const id = f.repetidaDe ? f.repetidaDe.match : f.match;
    if (id) {
      const r = porId.get(id);
      const d0 = f.datos;
      if (!f.repetidaDe && r.fuente === "calendly" && new Date(r.fecha_reu) >= AUTO_DESDE) {
        // Reagendó en Calendly: se corrige la fecha en su fila. Canceló (sin reagendar): status «Cancelado».
        // Si alguien cambió la fecha en el Sheets (distinta de la última que vimos), manda el Sheets: no se la devuelve a la de Calendly.
        const hoja = aSerie(f.reu), plat = aSerie(new Date(r.fecha_reu));
        if (!r.cancelada && r.fecha_hoja != null && hoja !== r.fecha_hoja) {
          const nueva = new Date(new Date(r.fecha_reu).getTime() + (hoja - plat) * DIA); // mismo horario, el día del Sheets
          await sql`UPDATE reuniones SET fecha_reu=${nueva.toISOString()}, fecha_manual=true, fecha_hoja=${hoja} WHERE id=${id}`;
        } else if (!r.cancelada && plat !== hoja) {
          celdas.push({ hoja: f.hoja, fila: f.fila, nombre: f.nombre, reu: f.reu, col: "N", valores: [dma(new Date(r.fecha_reu))] });
          await sql`UPDATE reuniones SET fecha_hoja=${plat} WHERE id=${id}`;
        } else if (r.fecha_hoja !== hoja) await sql`UPDATE reuniones SET fecha_hoja=${hoja} WHERE id=${id}`;
        if (r.cancelada && !d0.status) { celdas.push({ hoja: f.hoja, fila: f.fila, nombre: f.nombre, reu: f.reu, col: "T", valores: ["Cancelado"] }); d0.status = "Cancelado"; }
      }
      // Campo vacío en el Sheets no borra lo cargado en la plataforma.
      const cambia = CAMPOS.some((k) => d0[k] != null && (typeof d0[k] === "number" ? Number(r[k]) !== d0[k] : r[k] !== d0[k]));
      if (cambia || !r.hoja) {
        const d = f.datos;
        await sql`UPDATE reuniones SET hoja=COALESCE(hoja, ${f.hoja}),
          canal=COALESCE(${d.canal}, canal), ad_origen=COALESCE(${d.ad_origen}, ad_origen), tipo_lead=COALESCE(${d.tipo_lead}, tipo_lead),
          origen=COALESCE(${d.origen}, origen), facturacion=COALESCE(${d.facturacion}, facturacion), com_set=COALESCE(${d.com_set}, com_set),
          com_closer=COALESCE(${d.com_closer}, com_closer), status=COALESCE(${d.status}, status), metodo_pago=COALESCE(${d.metodo_pago}, metodo_pago),
          monto_24h=COALESCE(${d.monto_24h}, monto_24h), aov=COALESCE(${d.aov}, aov), comentario=COALESCE(${d.comentario}, comentario),
          closer_nombre=COALESCE(${d.closer_nombre}, closer_nombre) WHERE id=${id}`;
        actualizadas++;
      }
    } else if (!f.repetidaDe && f.reu >= desde) {
      const d = f.datos, c = f.c, txt = (i: number) => String(c[i] ?? "").trim() || null;
      await sql`INSERT INTO reuniones (id, evento_uri, evento, embudo, nombre, mail, tipo_negocio, factura_10m, antiguedad,
          fecha_agenda, fecha_reu, fuente, canal, ad_origen, tipo_lead, origen, facturacion, com_set, com_closer,
          status, metodo_pago, monto_24h, aov, comentario, closer_nombre, hoja, closer_mail)
        VALUES (${`sheets:${f.hoja}:${norm(f.nombre)}:${aSerie(f.reu)}`}, '', '', ${f.hoja === "Downsell" ? "downsell" : "principal"}, ${f.nombre}, ${txt(2)},
          ${txt(7)}, ${txt(8)}, ${txt(10)}, ${fechaCelda(c[12])?.toISOString() ?? null}, ${f.reu.toISOString()}, 'sheets',
          ${d.canal}, ${d.ad_origen}, ${d.tipo_lead}, ${d.origen}, ${d.facturacion}, ${d.com_set}, ${d.com_closer}, ${d.status},
          ${d.metodo_pago}, ${d.monto_24h}, ${d.aov}, ${d.comentario}, ${d.closer_nombre}, ${f.hoja},
          ${Object.entries(CLOSERS).find(([, n]) => n.toLowerCase() === String(d.closer_nombre ?? "").trim().toLowerCase())?.[0] ?? null})
        ON CONFLICT (id) DO NOTHING`;
      nuevas++;
    }
  }

  await escribirCeldas(celdas);

  // 3) Toda agenda de Calendly tiene su fila: la que no está en el Sheets se agrega al final de su pestaña.
  const faltan = db.filter((r) => r.fuente === "calendly" && !r.cancelada && !r.hoja && !filas.some((f) => f.match === r.id) &&
    new Date(r.fecha_reu) >= desde);
  for (const pestana of PESTANAS) {
    const lote = faltan.filter((r) => (r.embudo === "downsell") === (pestana === "Downsell"));
    if (!lote.length) continue;
    await agregarFilas(pestana, lote.map((r) => { const [canal, origen] = canalOrigen(r); return ["", r.nombre ?? "", r.mail ?? "", canal, adOrigen(r), "", "", r.tipo_negocio ?? "", ingresos(r), "",
      antiguedad(r.antiguedad), "", r.fecha_agenda ? dma(new Date(r.fecha_agenda)) : "", dma(new Date(r.fecha_reu)), CLOSERS[r.closer_mail] ?? "", origen]; }));
    for (const r of lote) await sql`UPDATE reuniones SET hoja=${pestana} WHERE id=${r.id}`;
    agregadas += lote.length;
  }
  return { actualizadas, nuevas, agregadas };
}

/** Lo que guarda el closer en la plataforma se escribe en su fila del Sheets (Status, Método, $ 24 hs, AOV y Comentario). */
export async function escribirEnHoja(r: { nombre: string; fecha_reu: string; status: string; metodo_pago: string | null; monto_24h: number | null; aov: number | null; comentario: string | null }) {
  const celdas = (await filasDe(r)).flatMap((base) => [
    { ...base, col: "T", valores: [r.status, r.metodo_pago ?? "", r.monto_24h ?? "", r.aov ?? ""] }, { ...base, col: "Y", valores: [r.comentario ?? ""] }]);
  return celdas.length > 0 && (await escribirCeldas(celdas));
}

/** El closer reagendó a mano: la nueva fecha va a la columna N («Fecha de reunión») de su fila. */
export async function reagendarEnHoja(r: { nombre: string; fecha_reu: string }, nueva: Date) {
  const celdas = (await filasDe(r)).map((base) => ({ ...base, col: "N", valores: [dma(nueva)] }));
  return celdas.length > 0 && (await escribirCeldas(celdas));
}

/**
 * Agenda del principal que no daba para el programa: su fila se mueve de «Resumen Reuniones» a «Downsell»,
 * con el resultado (T-W) vacío para completarlo ahí y el motivo del pase en el Comentario.
 */
export async function moverADownsellEnHoja(r: { nombre: string; fecha_reu: string }, motivo: string) {
  const base = (await filasDe(r)).find((f) => f.hoja === "Resumen Reuniones");
  if (!base) return false;
  const s = hojas();
  const leer = async () => (await s.spreadsheets.values.get({ spreadsheetId: ID, range: `'Resumen Reuniones'!A${base.fila}:Y${base.fila}` })).data.values?.[0] ?? [];
  const fila = await leer();
  if (!parecido(String(fila[1] ?? ""), base.nombre)) return false; // alguien ordenó la pestaña recién: que lo reintente
  const comentario = [`Pasó del principal: ${motivo}`, String(fila[24] ?? "")].filter(Boolean).join(" · ");
  const copia = Array.from({ length: 25 }, (_, i) => (i === 24 ? comentario : i >= 19 && i <= 22 ? "" : String(fila[i] ?? "")));
  await agregarFilas("Downsell", [copia]);
  // Primero se copia y recién después se borra la original, confirmando que en esa fila siga la misma persona.
  if (!parecido(String((await leer())[1] ?? ""), base.nombre)) return true;
  const props = (await s.spreadsheets.get({ spreadsheetId: ID, fields: "sheets.properties" })).data.sheets ?? [];
  const sheetId = props.find((h) => h.properties?.title === "Resumen Reuniones")?.properties?.sheetId;
  await s.spreadsheets.batchUpdate({ spreadsheetId: ID, requestBody: { requests: [{ deleteDimension: {
    range: { sheetId, dimension: "ROWS", startIndex: base.fila - 1, endIndex: base.fila } } }] } });
  return true;
}

// La fila de esta reunión en cada pestaña: mismo nombre y la fecha más cercana (±45 días).
async function filasDe(r: { nombre: string; fecha_reu: string }) {
  const filas = await leerHojas(), t = new Date(r.fecha_reu).getTime();
  return PESTANAS.flatMap((pestana) => {
    const f = filas.filter((x) => x.hoja === pestana && Math.abs(x.reu.getTime() - t) < 45 * DIA && parecido(x.nombre, r.nombre))
      .sort((a, b) => Math.abs(a.reu.getTime() - t) - Math.abs(b.reu.getTime() - t))[0];
    return f ? [{ hoja: pestana, fila: f.fila, nombre: f.nombre, reu: f.reu }] : [];
  });
}
