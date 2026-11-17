import { currentUser } from "@clerk/nextjs/server";
import { sql, CLOSERS, STATUS, type Reunion } from "@/lib/db";
import { after } from "next/server";
import { syncSiHaceFalta } from "@/lib/calendly";
import { cargaDiariaSiFalta } from "@/lib/cargaDiaria";
import { PageHeader } from "@/components/ui/PageHeader";
import { guardarReunion, reagendarReunion, pasarADownsell } from "./actions";
import { StatusSelect } from "./StatusSelect";
import { leadsDiagnostico, type LeadDiag } from "@/lib/diagnostico";

export const dynamic = "force-dynamic";

// "+54 2281 49-1517" → 5492281491517 (WhatsApp necesita el 9 en celulares de Argentina)
function whatsapp(tel: string | null) {
  let d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 10) d = "54" + d;
  if (d.startsWith("54") && d[2] !== "9") d = "549" + d.slice(2);
  return d.length >= 11 ? `https://wa.me/${d}` : null;
}

const fecha = (d: string) =>
  new Date(d).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function Reuniones({ searchParams }: { searchParams: Promise<{ closer?: string; q?: string; st?: string }> }) {
  await syncSiHaceFalta();
  after(cargaDiariaSiFalta); // por si los relojes fallaron: la carga diaria la dispara también quien abre la pantalla
  const user = await currentUser();
  const yo = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? "";
  const { closer: elegido, q = "", st: stPedido = "" } = await searchParams;
  const st = STATUS.includes(stPedido) ? stPedido : "";
  const buscando = !!(q || st);
  // El closer ve lo suyo; el resto ve todo y puede filtrar por closer.
  const closer = CLOSERS[yo] ? yo : elegido ?? "";

  const rows = (await sql`SELECT * FROM reuniones
      WHERE (${closer} = '' OR closer_mail = ${closer}) AND NOT descartada
        AND fecha_reu > now() - interval '30 days' AND fecha_reu < now() + interval '14 days'
      ORDER BY fecha_reu`) as Reunion[];

  // Señas grandes que todavía no son clientes: que cada closer las tenga presentes (fecha de reunión sin límite).
  const senas = (await sql`SELECT * FROM reuniones WHERE status='Seña Pie Adentro' AND NOT descartada
      AND (${closer} = '' OR closer_mail = ${closer}) ORDER BY fecha_reu DESC`) as Reunion[];
  // Anteriores (más de 30 días): por nombre si buscan; si no, las últimas 20, para corregir algo viejo.
  const viejas = (await sql`SELECT * FROM reuniones WHERE NOT descartada AND (${closer} = '' OR closer_mail = ${closer})
      AND fecha_reu <= now() - interval '30 days' AND (${q} = '' OR nombre ILIKE ${"%" + q + "%"} OR mail ILIKE ${"%" + q + "%"})
      AND (${st} = '' OR status = ${st})
      ORDER BY fecha_reu DESC LIMIT ${st ? 300 : q ? 50 : 20}`) as Reunion[];
  const diag = await leadsDiagnostico();
  const d = (r: Reunion) => ({ lead: diag.buscar(r.mail, r.telefono), sabe: new Date(r.fecha_agenda ?? r.fecha_reu).getTime() >= diag.desde });
  const ahora = Date.now();
  const pendientes = rows.filter((r) => !r.cancelada && !r.status && new Date(r.fecha_reu).getTime() < ahora);
  const proximas = rows.filter((r) => !r.cancelada && new Date(r.fecha_reu).getTime() >= ahora);
  const busca = (r: Reunion) => (!q || `${r.nombre} ${r.mail ?? ""}`.toLowerCase().includes(q.toLowerCase())) && (!st || r.status === st);
  const hechas = rows.filter((r) => r.status && busca(r)).reverse();
  // Un solo buscador (nombre o mail, y status: p. ej. todos los «Luchando» para volver a contactarlos) para Completadas y Anteriores.
  const buscador = (
    <form className="flex flex-wrap gap-2 mb-3">
      {!CLOSERS[yo] && closer && <input type="hidden" name="closer" value={closer} />}
      <input name="q" defaultValue={q} placeholder="Buscar por nombre o mail" className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-slate-200 w-full max-w-sm" />
      <select name="st" defaultValue={st} className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-slate-200">
        <option value="">Todos los status</option>
        {STATUS.map((x) => <option key={x}>{x}</option>)}
      </select>
      <button className="bg-brand-600 text-white text-sm rounded-lg px-3 py-2">Buscar</button>
      {buscando && <a href={closer && !CLOSERS[yo] ? `?closer=${closer}` : "?"} className="text-sm text-slate-400 self-center underline">Limpiar</a>}
    </form>
  );

  return (
    <div>
      <PageHeader
        title={CLOSERS[yo] ? `Mis reuniones · ${CLOSERS[yo]}` : "Reuniones"}
        description="Las agendas entran solas desde Calendly. Completá cada reunión apenas termina."
        actions={!CLOSERS[yo] && (
          <form className="flex gap-2">
            <select name="closer" defaultValue={closer} className="bg-surface-800 text-slate-200 text-sm rounded-lg px-3 py-2">
              <option value="">Todos los closers</option>
              {Object.entries(CLOSERS).map(([m, n]) => <option key={m} value={m}>{n}</option>)}
            </select>
            <button className="bg-brand-600 text-white text-sm rounded-lg px-3 py-2">Ver</button>
          </form>
        )}
      />

      <Seccion titulo={`Seña Pie Adentro${CLOSERS[yo] ? " a tu nombre" : ""} (${senas.length})`} vacio="Nadie en Seña Pie Adentro.">
        {senas.map((r) => <Tarjeta key={r.id} r={r} diag={d(r)} conForm verCloser={!CLOSERS[yo]} />)}
      </Seccion>
      <Seccion titulo={`Pendientes de completar (${pendientes.length})`} vacio="Nada pendiente.">
        {pendientes.map((r) => <Tarjeta key={r.id} r={r} diag={d(r)} conForm reagendar verCloser={!CLOSERS[yo]} />)}
      </Seccion>
      <Seccion titulo={`Próximas (${proximas.length})`} vacio="No hay reuniones agendadas.">
        {proximas.map((r) => <Tarjeta key={r.id} r={r} diag={d(r)} reagendar verCloser={!CLOSERS[yo]} />)}
      </Seccion>
      <Seccion titulo={`Completadas · últimos 30 días (${hechas.length})`} vacio={buscando ? "No encontré ninguna con esa búsqueda." : "Todavía no hay reuniones completadas."} abierta={buscando} arriba={buscador}>
        {hechas.map((r) => <Tarjeta key={r.id} r={r} diag={d(r)} conForm verCloser={!CLOSERS[yo]} />)}
      </Seccion>
      <Seccion titulo={`Anteriores${st ? ` (${viejas.length === 300 ? "las 300 más recientes" : viejas.length})` : ""}`} vacio={buscando ? "No encontré ninguna con esa búsqueda." : "No hay reuniones anteriores."} abierta={buscando} arriba={buscador}>
        {viejas.map((r) => <Tarjeta key={r.id} r={r} diag={d(r)} conForm verCloser={!CLOSERS[yo]} />)}
      </Seccion>
    </div>
  );
}

// Cada sección se puede minimizar (tocando el título); el navegador recuerda si estaba abierta mientras no recarguen.
function Seccion({ titulo, vacio, children, abierta = true, arriba }: { titulo: string; vacio: string; children: React.ReactNode[]; abierta?: boolean; arriba?: React.ReactNode }) {
  return (
    <details open={abierta} className="mb-8 group">
      <summary className="cursor-pointer list-none text-lg font-semibold text-white mb-3 select-none">
        <span className="inline-block w-5 text-slate-500 group-open:rotate-90 transition-transform">›</span>{titulo}
      </summary>
      {arriba}
      {children.length ? <div className="space-y-3">{children}</div> : <p className="text-sm text-slate-500">{vacio}</p>}
    </details>
  );
}

function Tarjeta({ r, diag, conForm, reagendar, verCloser }: { r: Reunion; diag: { lead: LeadDiag | null; sabe: boolean }; conForm?: boolean; reagendar?: boolean; verCloser: boolean }) {
  const input = "bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-sm text-slate-200";
  return (
    <div className="bg-surface-800 rounded-xl p-4 border border-surface-700">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold text-white">{r.nombre}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${r.embudo === "downsell" ? "bg-cc-purple/30 text-cc-purple-lt" : "bg-brand-600/40 text-brand-400"}`}>
          {r.embudo === "downsell" ? "Downsell" : "Principal"} · {r.evento}
        </span>
        <span className="text-sm text-slate-400">{fecha(r.fecha_reu)}</span>
        {verCloser && <span className="text-sm text-slate-400">· {CLOSERS[r.closer_mail] ?? r.closer_nombre ?? r.closer_mail}</span>}
        {r.status && <span className="text-sm text-emerald-400">· {r.status}</span>}
      </div>
      <p className="text-sm text-slate-400 mt-1">
        {[r.tipo_negocio, r.antiguedad, r.factura_10m && `+10 M: ${r.factura_10m}`, r.telefono, r.instagram && `IG ${r.instagram}`, r.mail]
          .filter(Boolean).join(" · ")}
      </p>
      {r.motivo && <p className="text-sm text-slate-300 mt-1">Quiere: {r.motivo}</p>}
      {diag.lead ? (
        <p className="text-sm mt-1 text-emerald-400">
          Diagnóstico hecho ✓ · {diag.lead.nivel} · {diag.lead.sintomas} síntomas · {new Date(diag.lead.fecha).toLocaleDateString("es-AR")} · no hace falta pedírselo
          {" · "}<a href={`/dashboard/reuniones/diagnostico?id=${diag.lead.id}`} className="underline hover:text-emerald-300">Ver diagnóstico completo</a>
        </p>
      ) : diag.sabe && <p className="text-sm mt-1 text-amber-400">Todavía no hizo el diagnóstico</p>}
      {whatsapp(r.telefono) && (
        <a href={whatsapp(r.telefono)!} target="_blank" rel="noopener noreferrer"
           className="inline-block mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg px-3 py-1.5">
          Hablar por WhatsApp
        </a>
      )}

      {reagendar && (
        <details className="mt-2">
          <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-200">Reagendar (cambiar fecha)</summary>
          <form action={reagendarReunion} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={r.id} />
            <input type="datetime-local" name="fecha" required className={input} />
            <button className="bg-surface-700 hover:bg-surface-600 text-white rounded-lg px-3 py-2 text-sm font-medium">Guardar nueva fecha</button>
          </form>
        </details>
      )}

      {conForm && (
        <form action={guardarReunion} className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2">
          <input type="hidden" name="id" value={r.id} />
          <StatusSelect opciones={STATUS} defaultValue={r.status ?? ""} className={`${input} col-span-2`} />
          <input name="metodo_pago" placeholder="Método de pago" defaultValue={r.metodo_pago ?? ""} className={input} />
          <input name="monto_24h" placeholder="$ 24 hs" inputMode="decimal" defaultValue={r.monto_24h ?? ""} className={input} />
          <input name="aov" placeholder="Monto del trato" inputMode="decimal" defaultValue={r.aov ?? ""} className={input} />
          <button className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg px-3 py-2 text-sm font-medium">Guardar</button>
          <textarea name="comentario" placeholder="Comentario" defaultValue={r.comentario ?? ""} rows={2} className={`${input} col-span-2 md:col-span-6`} />
        </form>
      )}
      {conForm && r.embudo === "principal" && (
        <details className="mt-2">
          <summary className="text-sm text-slate-400 cursor-pointer hover:text-slate-200">No le daba para el principal: pasar al downsell</summary>
          <form action={pasarADownsell} className="mt-2 flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={r.id} />
            <input name="motivo" required minLength={5} placeholder="¿Por qué lo pasás? (ej.: factura cerca de 10 M, no le da)" className={`${input} flex-1 min-w-64`} />
            <button className="bg-cc-purple/40 hover:bg-cc-purple/60 text-white rounded-lg px-3 py-2 text-sm font-medium">Pasar al downsell</button>
          </form>
          <p className="text-xs text-slate-500 mt-1">Se mueve a la pestaña Downsell del Sheets sin status: después completás ahí cómo salió.</p>
        </details>
      )}
    </div>
  );
}
