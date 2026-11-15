import { sql, ensureSchema } from "@/lib/db";
import { sincronizarHoja } from "@/lib/hojaVentas";

const ORG = "https://api.calendly.com/organizations/3c677330-82ae-4fcf-9763-4da41e55d2aa";

async function get(url: string, intento = 0): Promise<any> {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.CALENDLY_TOKEN}`, "User-Agent": "cc-crm" },
    cache: "no-store",
  });
  if (r.status === 429 && intento < 5) {
    await new Promise((ok) => setTimeout(ok, 15_000 * (intento + 1)));
    return get(url, intento + 1);
  }
  if (!r.ok) throw new Error(`Calendly ${r.status} ${url}`);
  return r.json();
}

// "ENTREVISTA GRATUITA CUENTAS CLARAS (DS)" → "DS"
export function codigoEvento(nombre: string) {
  return nombre.match(/\(([^)]+)\)\s*$/)?.[1]?.trim() ?? "";
}

function respuesta(qa: { question: string; answer: string }[], empieza: string) {
  return qa.find((q) => q.question.toLowerCase().startsWith(empieza))?.answer?.trim() ?? null;
}

/**
 * Trae las agendas de Calendly con reunión entre `desde` y `hasta`.
 * Solo pide los invitados de las agendas nuevas: las ya guardadas solo actualizan cancelada/closer/fecha.
 */
export async function syncCalendly(desde: Date, hasta: Date) {
  await ensureSchema();
  const conocidas = new Set(
    ((await sql`SELECT evento_uri FROM reuniones WHERE fecha_reu >= ${desde.toISOString()}`) as { evento_uri: string }[])
      .map((r) => r.evento_uri)
  );
  let url: string | null =
    `https://api.calendly.com/scheduled_events?organization=${ORG}&count=100` +
    `&min_start_time=${desde.toISOString()}&max_start_time=${hasta.toISOString()}`;
  let nuevas = 0, actualizadas = 0;

  while (url) {
    const page = await get(url);
    const nuevosEv: any[] = [];
    for (const ev of page.collection) {
      if (!/ENTREVISTA/i.test(ev.name)) continue; // solo las entrevistas de venta
      const closer = ev.event_memberships?.[0]?.user_email ?? null;
      if (conocidas.has(ev.uri)) {
        await sql`UPDATE reuniones SET cancelada=${ev.status === "canceled"}, closer_mail=${closer}, fecha_reu=${ev.start_time}
                  WHERE evento_uri=${ev.uri}`;
        actualizadas++;
      } else nuevosEv.push(ev);
    }
    // De a 10 en paralelo: con una por vez el histórico tarda horas.
    for (let k = 0; k < nuevosEv.length; k += 10) {
      await Promise.all(nuevosEv.slice(k, k + 10).map(async (ev) => {
        const evento = codigoEvento(ev.name);
        const closer = ev.event_memberships?.[0]?.user_email ?? null;
        const invitados = (await get(`${ev.uri}/invitees?count=100`)).collection;
        for (const i of invitados) {
          const qa = i.questions_and_answers ?? [];
          await sql`INSERT INTO reuniones (id, evento_uri, evento, embudo, nombre, mail, telefono, instagram,
              tipo_negocio, antiguedad, factura_10m, motivo, decisor, utm_source, utm_medium, utm_campaign,
              closer_mail, fecha_agenda, fecha_reu, cancelada)
            VALUES (${i.uri}, ${ev.uri}, ${evento}, ${evento === "DS" ? "downsell" : "principal"}, ${i.name}, ${i.email},
              ${respuesta(qa, "número de teléfono") ?? i.text_reminder_number ?? null}, ${respuesta(qa, "usuario de instagram")},
              ${respuesta(qa, "¿qué tipo de negocio")}, ${respuesta(qa, "hace cuánto")}, ${respuesta(qa, "cuentas claras solo trabaja")},
              ${respuesta(qa, "¿qué te trae")}, ${respuesta(qa, "¿sos la única")},
              ${i.tracking?.utm_source ?? null}, ${i.tracking?.utm_medium ?? null}, ${i.tracking?.utm_campaign ?? null},
              ${closer}, ${i.created_at}, ${ev.start_time}, ${ev.status === "canceled" || i.status === "canceled"})
            ON CONFLICT (id) DO NOTHING`;
          nuevas++;
        }
      }));
    }
    url = page.pagination?.next_page ?? null;
  }
  return { nuevas, actualizadas };
}

/** Sync liviano para llamar al abrir la pantalla: como mucho una vez cada 2 minutos (Calendly y después el Sheets). */
export async function syncSiHaceFalta() {
  await ensureSchema();
  const ahora = Date.now();
  await sql`INSERT INTO sync_estado VALUES ('calendly', '0') ON CONFLICT (clave) DO NOTHING`;
  // Atómico: si dos personas abren la pantalla a la vez, sincroniza una sola (si no, se duplicarían filas en el Sheets).
  const toca = await sql`UPDATE sync_estado SET valor=${String(ahora)} WHERE clave='calendly' AND valor::bigint < ${ahora - 120_000} RETURNING clave`;
  if (!toca.length) return;
  await syncCalendly(new Date(ahora - 30 * 864e5), new Date(ahora + 60 * 864e5));
  await sincronizarHoja(new Date(ahora - 30 * 864e5));
}
