import { sql } from "@/lib/db";
import { telCorto, type LeadDiag } from "@/lib/diagnostico";

export const dynamic = "force-dynamic";

// La página del equipo (cuentasclarasfs.com/equipo) pregunta qué leads del diagnóstico ya se agendaron en Calendly.
// Con la misma clave del equipo; devuelve solo números de lead, ningún dato personal.
const CORS = { "Access-Control-Allow-Origin": "https://cuentasclarasfs.com", "Access-Control-Allow-Headers": "X-Clave", "Access-Control-Allow-Methods": "GET" };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const clave = req.headers.get("x-clave") ?? "";
  if (!process.env.CC_CLAVE_EQUIPO || clave !== process.env.CC_CLAVE_EQUIPO) return Response.json({ ok: false }, { status: 401, headers: CORS });
  const r = await fetch("https://cuentasclarasfs.com/wp-json/cc/v1/leads", { headers: { "x-clave": clave, "User-Agent": "cc-crm" }, cache: "no-store" });
  const leads: LeadDiag[] = r.ok ? (await r.json()).leads ?? [] : [];
  if (!leads.length) return Response.json({ ok: true, ids: [] }, { headers: CORS });
  const desde = new Date(Math.min(...leads.map((l) => new Date(l.fecha).getTime())) - 7 * 864e5).toISOString();
  const reus = (await sql`SELECT lower(trim(mail)) mail, telefono, fecha_agenda FROM reuniones
      WHERE NOT descartada AND fecha_agenda >= ${desde}`) as { mail: string | null; telefono: string | null; fecha_agenda: string }[];
  // Se agendó = tiene una agenda (principal o downsell) desde una semana antes del diagnóstico en adelante, por mail o teléfono.
  const ids = leads.filter((l) => {
    const t = new Date(l.fecha).getTime() - 7 * 864e5, mail = (l.mail ?? "").toLowerCase().trim(), tel = telCorto(l.wa);
    return reus.some((x) => new Date(x.fecha_agenda).getTime() >= t && ((mail && x.mail === mail) || (tel && telCorto(x.telefono) === tel)));
  }).map((l) => l.id);
  return Response.json({ ok: true, ids }, { headers: CORS });
}
