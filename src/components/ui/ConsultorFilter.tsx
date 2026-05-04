"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  consultores: string[];
  paramKey?: string;
  label?: string;
}

export function ConsultorFilter({ consultores, paramKey = "consultor", label }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const current = sp.get(paramKey) ?? "";

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(sp.toString());
    if (e.target.value) {
      params.set(paramKey, e.target.value);
    } else {
      params.delete(paramKey);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
        {label ?? (paramKey === "closer" ? "Filtrar por closer:" : "Filtrar por consultor:")}
      </label>
      <select
        value={current}
        onChange={onChange}
        className="text-sm bg-surface-800 border border-surface-700 text-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-600 min-w-[180px]"
      >
        <option value="">Todos</option>
        {consultores.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    </div>
  );
}
