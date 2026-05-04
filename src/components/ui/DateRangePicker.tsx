"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { Suspense } from "react";

function DateRangePickerInner({ from, to }: { from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = (key: "from" | "to", value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.push(`${pathname}?${sp.toString()}`);
  };

  return (
    <div className="flex items-center gap-3">
      <Calendar size={14} className="text-slate-400 flex-shrink-0" />
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
          className="bg-surface-800 border border-surface-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 [color-scheme:dark]"
        />
        <span className="text-slate-500 text-sm">→</span>
        <input
          type="date"
          value={to ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
          className="bg-surface-800 border border-surface-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 [color-scheme:dark]"
        />
      </div>
      {(from || to) && (
        <button
          onClick={() => {
            const sp = new URLSearchParams(params.toString());
            sp.delete("from");
            sp.delete("to");
            router.push(`${pathname}?${sp.toString()}`);
          }}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}

export function DateRangePicker({ from, to }: { from?: string; to?: string }) {
  return (
    <Suspense fallback={<div className="h-9 w-72 bg-surface-800 rounded-lg animate-pulse" />}>
      <DateRangePickerInner from={from} to={to} />
    </Suspense>
  );
}
