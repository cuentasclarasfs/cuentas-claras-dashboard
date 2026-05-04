"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Suspense } from "react";

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function MonthSelectorInner({ selected }: { selected: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setMonth = (m: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("month", m);
    router.push(`${pathname}?${sp.toString()}`);
  };

  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
    months.push({ key, label });
  }

  const idx = months.findIndex((m) => m.key === selected);
  const prev = months[idx + 1];
  const next = idx > 0 ? months[idx - 1] : undefined;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => prev && setMonth(prev.key)}
        disabled={!prev}
        className="p-1.5 rounded-lg hover:bg-surface-800 disabled:opacity-30 text-slate-400 transition-colors"
      >
        <ChevronLeft size={15} />
      </button>
      <select
        value={selected}
        onChange={(e) => setMonth(e.target.value)}
        className="bg-surface-800 border border-surface-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 cursor-pointer"
      >
        {months.map((m) => (
          <option key={m.key} value={m.key}>{m.label}</option>
        ))}
      </select>
      <button
        onClick={() => next && setMonth(next.key)}
        disabled={!next}
        className="p-1.5 rounded-lg hover:bg-surface-800 disabled:opacity-30 text-slate-400 transition-colors"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

export function MonthSelector({ selected }: { selected: string }) {
  return (
    <Suspense fallback={<div className="h-9 w-40 bg-surface-800 rounded-lg animate-pulse" />}>
      <MonthSelectorInner selected={selected} />
    </Suspense>
  );
}
