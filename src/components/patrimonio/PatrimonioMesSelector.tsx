"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function PatrimonioMesSelector({
  meses,
}: {
  meses: { monthKey: string; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("mes") ?? "";

  function select(mk: string) {
    const p = new URLSearchParams(params.toString());
    if (mk === selected) p.delete("mes");
    else p.set("mes", mk);
    router.push(`?${p.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => { const p = new URLSearchParams(params.toString()); p.delete("mes"); router.push(`?${p.toString()}`, { scroll: false }); }}
        className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors flex-shrink-0 ${
          selected === "" ? "bg-brand-600 border-brand-500 text-white font-semibold" : "border-surface-600 text-slate-400 hover:text-slate-200"
        }`}
      >
        Actual
      </button>
      {meses.map((m) => (
        <button
          key={m.monthKey}
          onClick={() => select(m.monthKey)}
          className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors flex-shrink-0 ${
            selected === m.monthKey ? "bg-brand-600 border-brand-500 text-white font-semibold" : "border-surface-600 text-slate-400 hover:text-slate-200"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
