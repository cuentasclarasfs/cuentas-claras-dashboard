import { after } from "next/server";
import { syncSiHaceFalta } from "@/lib/calendly";
import { cargaDiariaSiFalta } from "@/lib/cargaDiaria";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lo llama GitHub cada 10 minutos para que las agendas lleguen al Sheets aunque nadie abra la pantalla.
// shortcut: sin clave; no devuelve datos y el sync corre como mucho cada 2 minutos. Si se abusa, agregar CRON_SECRET.
export async function GET() {
  await syncSiHaceFalta();
  after(cargaDiariaSiFalta); // si la carga de las 8:30 no corrió, la hace ahora
  return Response.json({ ok: true });
}
