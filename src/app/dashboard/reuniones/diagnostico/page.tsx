import { leadsDiagnostico } from "@/lib/diagnostico";
import { PageHeader } from "@/components/ui/PageHeader";
import niveles from "@/lib/niveles-diagnostico.json";

export const dynamic = "force-dynamic";

// El diagnóstico completo de un lead (lo mismo que le llegó por mail), para que el closer lo lea antes de la llamada.
export default async function Diagnostico({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const l = (await leadsDiagnostico()).porId(Number(id));
  if (!l) return <PageHeader title="Diagnóstico" description="No encontré ese diagnóstico." />;
  const n = (niveles as Record<string, { titulo: string; color: string; sit: string; reunion: string; critico: string }>)[l.nivel.split(" · ")[0]];
  const bloque = "bg-surface-800 rounded-xl p-4 border border-surface-700 mb-3";
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Diagnóstico · ${l.nombre}`}
        description={`${new Date(l.fecha).toLocaleDateString("es-AR")} · ${l.factura ? "Factura +10 M" : "Factura menos de 10 M"} · ${[l.mail, l.instagram && `IG ${l.instagram}`].filter(Boolean).join(" · ")}`} />
      <div className={bloque} style={n ? { borderColor: n.color } : undefined}>
        <p className="text-lg font-bold text-white">{l.nivel}</p>
        <p className="text-sm text-slate-400">{l.sintomas} síntomas</p>
        {n && <p className="text-sm text-slate-300 mt-2">{n.sit}</p>}
      </div>
      {l.objetivo && <div className={bloque}><p className="text-xs uppercase text-slate-500 mb-1">Qué quiere lograr</p><p className="text-white">{l.objetivo}</p></div>}
      {l.frases.length > 0 && (
        <div className={bloque}>
          <p className="text-xs uppercase text-slate-500 mb-2">Lo que marcó en el diagnóstico</p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-200">{l.frases.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      {n && (
        <div className={bloque}>
          <p className="text-xs uppercase text-slate-500 mb-1">Lo que le dijimos de la entrevista</p>
          <p className="text-sm text-slate-300">{n.reunion}</p>
          <p className="text-xs uppercase text-slate-500 mt-3 mb-1">Si no hace nada</p>
          <p className="text-sm text-slate-300">{n.critico}</p>
        </div>
      )}
      <a href="/dashboard/reuniones" className="text-sm text-brand-400 underline">← Volver a reuniones</a>
    </div>
  );
}
