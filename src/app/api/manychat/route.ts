import { sql, ensureSchema } from "@/lib/db";

export const dynamic = "force-dynamic";

const ETIQUETAS = ["nuevo_seguidor", "tiene_negocio", "no_tiene_negocio", "click_diagnostico"];

// ManyChat llama acá (Solicitud externa) cuando pone una etiqueta: /api/manychat?e=nuevo_seguidor&k=CLAVE
// con el cuerpo {"contacto": "{{user_id}}"}. La clave vive en la base (sync_estado.manychat_clave), no en el código.
export async function POST(req: Request) {
  const u = new URL(req.url);
  const e = u.searchParams.get("e") ?? "";
  await ensureSchema();
  const [c] = (await sql`SELECT valor FROM sync_estado WHERE clave='manychat_clave'`) as { valor: string }[];
  if (!c || u.searchParams.get("k") !== c.valor) return Response.json({ ok: false }, { status: 401 });
  if (!ETIQUETAS.includes(e)) return Response.json({ ok: false, error: "etiqueta" }, { status: 400 });
  const contacto = String((await req.json().catch(() => ({}))).contacto ?? "").slice(0, 64);
  if (!contacto) return Response.json({ ok: false, error: "contacto" }, { status: 400 });
  await sql`INSERT INTO manychat_eventos (etiqueta, contacto) VALUES (${e}, ${contacto}) ON CONFLICT DO NOTHING`;
  return Response.json({ ok: true });
}
