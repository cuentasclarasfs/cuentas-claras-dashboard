"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function PatrimonioMesSelector({
  meses,
}: {
  meses: { monthKey: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("mes") ?? "";

  // meses[0] = más reciente; "" = Actual (more recent than any historia month)
  const options = [{ monthKey: "", label: "Actual" }, ...meses];
  const idx = options.findIndex((m) => m.monthKey === selected);
  const prev = options[idx + 1]; // older
  const next = idx > 0 ? options[idx - 1] : undefined; // newer

  const go = (mk: string) => {
    const p = new URLSearchParams(params.toString());
    if (mk === "") p.delete("mes"); else p.set("mes", mk);
    router.push(`?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="flex items-center gap-2 mb-6">
      <button onClick={() => prev && go(prev.monthKey)} disabled={!prev}
        className="p-1.5 rounded-lg hover:bg-surface-800 disabled:opacity-30 text-slate-400 transition-colors">
        <ChevronLeft size={15} />
      </button>
      <select value={selected} onChange={(e) => go(e.target.value)}
        className="bg-surface-800 border border-surface-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500 cursor-pointer">
        {options.map((m) => (
          <option key={m.monthKey} value={m.monthKey}>{m.label}</option>
        ))}
      </select>
      <button onClick={() => next && go(next.monthKey)} disabled={!next}
        className="p-1.5 rounded-lg hover:bg-surface-800 disabled:opacity-30 text-slate-400 transition-colors">
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
