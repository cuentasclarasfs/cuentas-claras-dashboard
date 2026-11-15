// Cruza «Resumen Reuniones» y «Downsell» del Sheets Equipo Ventas con las agendas de Calendly ya guardadas.
// Coincide por nombre + fecha de reunión (±3 días, por reprogramaciones). Lo que no está en Calendly
// (agendas a mano) entra igual, con fuente='sheets'. Uso: npx tsx --env-file=.env.local scripts/historico-sheets.ts
import { google } from "googleapis";
import { sql, ensureSchema } from "../src/lib/db";

const ID = "1YnY4XNEK2Diq2yCIIjpnDAQUSSpzFNBCKVLYMWQbeHY";
const norm = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").trim();
const fecha = (s = "") => {
  const [d, m, y] = s.trim().split("/").map(Number);
  return d && m && y ? new Date(Date.UTC(y < 100 ? 2000 + y : y, m - 1, d, 12)) : null;
};
const plata = (s = "") => {
  const t = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return t && !isNaN(Number(t)) ? Number(t) : null;
};
// "Juan Pérez" vs "juan perez gomez": alcanza con que coincidan las dos primeras palabras.
// También vale el orden invertido («Pinturería Alejandra» = «Alejandra Pinturería»).
const parecido = (a: string, b: string) => {
  const [x, y] = [norm(a).split(" ").slice(0, 2).join(" "), norm(b).split(" ").slice(0, 2).join(" ")];
  if (!x || !y) return false;
  if (x === y || norm(b).startsWith(x) || norm(a).startsWith(y)) return true;
  const wa = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  return norm(b).split(" ").filter((w) => w.length > 2 && wa.has(w)).length >= 2;
};

(async () => {
  await ensureSchema();
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const db = ((await sql`SELECT id, nombre, fecha_reu, cancelada FROM reuniones WHERE fuente='calendly'`) as
    { id: string; nombre: string; fecha_reu: string; cancelada: boolean }[]).map((r) => ({ ...r, t: new Date(r.fecha_reu).getTime() }));
  let cruzadas = 0, soloSheets = 0, sinFecha = 0, repetidas = 0;

  // Filas de las dos pestañas. Las del Downsell que ya están en Resumen (mismo nombre, ±7 días) son la misma agenda.
  type Fila = { hoja: string; n: number; c: string[]; reu: Date; repetidaDe?: Fila; match?: string };
  const filas: Fila[] = [];
  for (const hoja of ["Resumen Reuniones", "Downsell"]) {
    const rows = (await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${hoja}'!A2:Y` })).data.values ?? [];
    for (let n = 0; n < rows.length; n++) {
      const c = rows[n].map((v) => String(v ?? "").trim());
      if (!c[1] || c[1] === "Prospecto") continue;
      const reu = fecha(c[13]);
      if (!reu) { sinFecha++; continue; }
      const f: Fila = { hoja, n, c, reu };
      if (hoja === "Downsell") f.repetidaDe = filas.find((o) => o.hoja !== "Downsell" &&
        Math.abs(o.reu.getTime() - reu.getTime()) < 7 * 864e5 && parecido(o.c[1], c[1]));
      filas.push(f);
    }
  }

  // Cruce global: todos los pares nombre parecido a ±45 días (el setter a veces anota otra fecha o reprograma),
  // del más cercano al más lejano; una agenda cancelada solo gana si no hay otra.
  const pares: { f: Fila; id: string; costo: number }[] = [];
  for (const f of filas) if (!f.repetidaDe) for (const r of db) {
    const dias = Math.abs(r.t - f.reu.getTime()) / 864e5;
    if (dias < 45 && parecido(r.nombre, f.c[1])) pares.push({ f, id: r.id, costo: dias + (r.cancelada ? 60 : 0) });
  }
  pares.sort((a, b) => a.costo - b.costo);
  const usados = new Set<string>();
  for (const p of pares) if (!p.f.match && !usados.has(p.id)) { p.f.match = p.id; usados.add(p.id); }

  for (const f of filas) {
    const { hoja, n, c, reu } = f;
    const datos = {
      canal: c[3] || null, ad_origen: c[4] || null, tipo_lead: c[11] || null, origen: c[15] || null,
      facturacion: c[16] || null, com_set: c[17] || null, com_closer: c[18] || null,
      status: c[19] || null, metodo_pago: c[20] || null, monto_24h: plata(c[21]), aov: plata(c[22]),
      comentario: c[24] || null, closer_nombre: c[14] || null, hoja,
    };
    if (f.repetidaDe) {
      // El setter copia a los del downsell en las dos pestañas: vale lo que dice la pestaña Downsell.
      const id = f.repetidaDe.match;
      if (id) await sql`UPDATE reuniones SET hoja='Downsell',
        status=COALESCE(${datos.status}, status), aov=COALESCE(${datos.aov}, aov), monto_24h=COALESCE(${datos.monto_24h}, monto_24h),
        comentario=COALESCE(${datos.comentario}, comentario) WHERE id=${id}`;
      repetidas++;
      continue;
    }
    if (f.match) {
      await sql`UPDATE reuniones SET canal=${datos.canal}, ad_origen=${datos.ad_origen}, tipo_lead=${datos.tipo_lead},
        origen=${datos.origen}, facturacion=${datos.facturacion}, com_set=${datos.com_set}, com_closer=${datos.com_closer},
        status=COALESCE(status, ${datos.status}), metodo_pago=COALESCE(metodo_pago, ${datos.metodo_pago}),
        monto_24h=COALESCE(monto_24h, ${datos.monto_24h}), aov=COALESCE(aov, ${datos.aov}),
        comentario=COALESCE(comentario, ${datos.comentario}), closer_nombre=${datos.closer_nombre}, hoja=${hoja}
        WHERE id=${f.match}`;
      cruzadas++;
    } else {
      await sql`INSERT INTO reuniones (id, evento_uri, evento, embudo, nombre, mail, tipo_negocio, factura_10m, antiguedad,
          fecha_agenda, fecha_reu, fuente, canal, ad_origen, tipo_lead, origen, facturacion, com_set, com_closer,
          status, metodo_pago, monto_24h, aov, comentario, closer_nombre, hoja)
        VALUES (${`sheets:${hoja}:${n + 2}`}, '', '', ${hoja === "Downsell" ? "downsell" : "principal"}, ${c[1]}, ${c[2] || null},
          ${c[7] || null}, ${c[8] || null}, ${c[10] || null}, ${fecha(c[12])?.toISOString() ?? null}, ${reu.toISOString()},
          'sheets', ${datos.canal}, ${datos.ad_origen}, ${datos.tipo_lead}, ${datos.origen}, ${datos.facturacion},
          ${datos.com_set}, ${datos.com_closer}, ${datos.status}, ${datos.metodo_pago}, ${datos.monto_24h}, ${datos.aov},
          ${datos.comentario}, ${datos.closer_nombre}, ${hoja})
        ON CONFLICT (id) DO NOTHING`;
      soloSheets++;
    }
  }
  console.log({ cruzadas, soloSheets, repetidas, sinFecha });
})();
