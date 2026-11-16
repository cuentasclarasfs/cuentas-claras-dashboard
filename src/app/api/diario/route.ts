import { cargarDia, cargaDiariaSiFalta } from "@/lib/cargaDiaria";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lo llaman GitHub y Vercel cada mañana: carga el día anterior en METRICAS SETTING (solo celdas vacías).
// ?dia=YYYY-MM-DD para recargar uno. shortcut: sin clave, como /api/sync; nunca pisa lo cargado.
export async function GET(req: Request) {
  const pedido = new URL(req.url).searchParams.get("dia");
  if (pedido && /^\d{4}-\d{2}-\d{2}$/.test(pedido)) return Response.json({ dia: pedido, escrito: await cargarDia(pedido) });
  return Response.json((await cargaDiariaSiFalta()) ?? { yaCargado: true });
}
