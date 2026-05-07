"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { keyToLabel } from "./mesUtils";
export { keyToLabel } from "./mesUtils";

interface Props {
  meses: string[];        // sorted "YYYY-MM" keys
  selectedDesde: string;
  selectedHasta: string;
}

export function MesComienzFilter({ meses, selectedDesde, selectedHasta }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(desde: string, hasta: string) {
    const params = new URLSearchParams(sp.toString());
    if (desde) params.set("mesDesde", desde); else params.delete("mesDesde");
    if (hasta) params.set("mesHasta", hasta); else params.delete("mesHasta");
    router.push(`?${params.toString()}`);
  }

  const selectClass =
    "text-sm bg-surface-800 border border-surface-700 text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-600";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
        Comienzo:
      </span>
      <select
        value={selectedDesde}
        onChange={(e) => update(e.target.value, selectedHasta)}
        className={selectClass}
      >
        <option value="">Desde siempre</option>
        {meses.map((k) => (
          <option key={k} value={k}>{keyToLabel(k)}</option>
        ))}
      </select>
      <span className="text-xs text-slate-600">—</span>
      <select
        value={selectedHasta}
        onChange={(e) => update(selectedDesde, e.target.value)}
        className={selectClass}
      >
        <option value="">Hasta hoy</option>
        {meses.map((k) => (
          <option key={k} value={k}>{keyToLabel(k)}</option>
        ))}
      </select>
    </div>
  );
}
