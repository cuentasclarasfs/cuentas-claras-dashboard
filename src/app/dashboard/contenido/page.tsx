import { PageHeader } from "@/components/ui/PageHeader";

export const revalidate = 0;

export default function ContenidoPage() {
  return (
    <div>
      <PageHeader
        title="Contenido"
        description="Gestión de contenido y recursos"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Publicaciones</p>
          <p className="text-3xl font-bold text-white">—</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">En revisión</p>
          <p className="text-3xl font-bold text-white">—</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Publicados este mes</p>
          <p className="text-3xl font-bold text-white">—</p>
        </div>
      </div>

      <div className="card">
        <p className="text-sm text-slate-500 text-center py-10">
          Esta sección está en construcción. Próximamente vas a poder ver y gestionar el contenido desde acá.
        </p>
      </div>
    </div>
  );
}
