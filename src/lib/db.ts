import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);

// Una fila por agenda de Calendly. Los datos de Calendly se pisan en cada sync;
// los que cargan setter y closer (status, montos, comentario, tipo_lead…) nunca.
export async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS reuniones (
    id            text PRIMARY KEY,           -- uri del invitado en Calendly
    evento_uri    text NOT NULL,
    evento        text,                       -- TB, S, M, MZ, FPG, H, RMK, DS…
    embudo        text NOT NULL,              -- principal | downsell
    nombre        text,
    mail          text,
    telefono      text,
    instagram     text,
    tipo_negocio  text,
    antiguedad    text,
    factura_10m   text,
    motivo        text,
    decisor       text,
    utm_source    text, utm_medium text, utm_campaign text,
    closer_mail   text,
    fecha_agenda  timestamptz,
    fecha_reu     timestamptz,
    cancelada     boolean DEFAULT false,
    -- setter
    canal         text,
    tipo_lead     text,
    -- closer
    status        text,
    metodo_pago   text,
    monto_24h     numeric,
    aov           numeric,
    comentario    text,
    completado_por text,
    completado_en timestamptz
  )`;
  // Columnas que vienen del Sheets histórico (Resumen Reuniones / Downsell).
  await sql`ALTER TABLE reuniones
    ADD COLUMN IF NOT EXISTS ad_origen text, ADD COLUMN IF NOT EXISTS origen text,
    ADD COLUMN IF NOT EXISTS facturacion text, ADD COLUMN IF NOT EXISTS com_set text,
    ADD COLUMN IF NOT EXISTS com_closer text, ADD COLUMN IF NOT EXISTS closer_nombre text,
    ADD COLUMN IF NOT EXISTS hoja text, ADD COLUMN IF NOT EXISTS fuente text DEFAULT 'calendly',
    ADD COLUMN IF NOT EXISTS descartada boolean DEFAULT false`; // agendas viejas de Calendly que nunca pasaron al Sheets
  await sql`CREATE TABLE IF NOT EXISTS sync_estado (clave text PRIMARY KEY, valor text)`;
  // Avisos de ManyChat: una fila por contacto y etiqueta (si ManyChat avisa dos veces, cuenta una).
  await sql`CREATE TABLE IF NOT EXISTS manychat_eventos (etiqueta text, contacto text, fecha timestamptz DEFAULT now(), PRIMARY KEY (etiqueta, contacto))`;
}

export type Reunion = {
  id: string; evento: string; embudo: string; nombre: string; mail: string; telefono: string;
  instagram: string; tipo_negocio: string; antiguedad: string; factura_10m: string; motivo: string;
  decisor: string; utm_source: string | null; closer_mail: string; fecha_agenda: string; fecha_reu: string;
  cancelada: boolean; canal: string | null; tipo_lead: string | null; status: string | null;
  metodo_pago: string | null; monto_24h: string | null; aov: string | null; comentario: string | null;
};

// Opciones iguales a las que ya usan en «Resumen Reuniones», así el dashboard viejo las entiende.
export const STATUS = [
  "Cliente confirmado", "Seña Pie Adentro", "Seña hecha", "Downsell", "Luchando",
  "No cerrado", "Señó y se dió de baja", "No show", "No presentado", "Cancelado",
];

export const CLOSERS: Record<string, string> = {
  "agustin@cuentasclarasfs.com": "Agus",
  "santiago@cuentasclarasfs.com": "Santi",
  "franfolino@cuentasclarasfs.com": "Foli",
  "santibarrio@cuentasclarasfs.com": "Barrio",
};
