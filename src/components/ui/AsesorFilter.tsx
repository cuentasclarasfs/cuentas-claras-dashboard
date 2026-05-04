"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function AsesorFilterInner({ asesores }: { asesores: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const selected = sp.get("asesor") ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString());
    if (e.target.value) params.set("asesor", e.target.value);
    else params.delete("asesor");
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={selected}
      onChange={onChange}
      className="text-xs bg-surface-800 border border-surface-700 text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-500"
    >
      <option value="">Todos los asesores</option>
      {asesores.map((a) => (
        <option key={a} value={a}>{a}</option>
      ))}
    </select>
  );
}

export function AsesorFilter({ asesores }: { asesores: string[] }) {
  return (
    <Suspense fallback={<div className="h-8 w-40 bg-surface-800 rounded-lg animate-pulse" />}>
      <AsesorFilterInner asesores={asesores} />
    </Suspense>
  );
}
