import { cargarDia } from "@/lib/cargaDiaria";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lo llama GitHub cada mañana: carga el día anterior en METRICAS SETTING (solo celdas vacías).
// ?dia=YYYY-MM-DD para recargar uno. shortcut: sin clave, como /api/sync; nunca pisa lo cargado.
export async function GET(req: Request) {
  const pedido = new URL(req.url).searchParams.get("dia");
  const ayer = new Date(Date.now() - 3 * 3600e3 - 864e5).toISOString().slice(0, 10); // ayer en hora de Argentina
  const dia = pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido) ? pedido : ayer;
  return Response.json({ dia, escrito: await cargarDia(dia) });
}
