"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

type Period = "last-week" | "prev-week" | "this-month" | "last-month" | "this-year";

function formatDateInput(d: Date) {
  return d.toISOString().split("T")[0];
}

function getLastSunSat(weeksAgo: number): { from: string; to: string } {
  const today = new Date();
  // Find last Saturday (end of last complete week)
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const daysSinceSat = dayOfWeek === 6 ? 7 : dayOfWeek + 1;
  const lastSat = new Date(today);
  lastSat.setDate(today.getDate() - daysSinceSat - (weeksAgo - 1) * 7);
  const lastSun = new Date(lastSat);
  lastSun.setDate(lastSat.getDate() - 6);
  return { from: formatDateInput(lastSun), to: formatDateInput(lastSat) };
}

function getPeriodDates(period: Period): { from: string; to: string } {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (period) {
    case "last-week":  return getLastSunSat(1);
    case "prev-week":  return getLastSunSat(2);
    case "this-month": {
      const from = new Date(y, m, 1);
      return { from: formatDateInput(from), to: formatDateInput(today) };
    }
    case "last-month": {
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0);
      return { from: formatDateInput(from), to: formatDateInput(to) };
    }
    case "this-year": {
      return { from: `${y}-01-01`, to: formatDateInput(today) };
    }
  }
}

const PERIOD_LABELS: Record<Period, string> = {
  "last-week":   "Última semana",
  "prev-week":   "Ante última semana",
  "this-month":  "Este mes",
  "last-month":  "Mes anterior",
  "this-year":   "Este año",
};

function SalesPeriodPickerInner({ from, to }: { from?: string; to?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState<Period>("this-month");
  const [fromVal, setFromVal] = useState(from ?? getPeriodDates("this-month").from);
  const [toVal, setToVal] = useState(to ?? getPeriodDates("this-month").to);

  // Sync URL → state on mount
  useEffect(() => {
    if (!from && !to) {
      const d = getPeriodDates("this-month");
      navigate(d.from, d.to);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(f: string, t: string) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("from", f);
    p.set("to", t);
    router.push(`?${p.toString()}`);
  }

  function selectPeriod(period: Period) {
    const d = getPeriodDates(period);
    setActivePeriod(period);
    setFromVal(d.from);
    setToVal(d.to);
    navigate(d.from, d.to);
    setOpen(false);
  }

  function applyCustom() {
    navigate(fromVal, toVal);
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Period dropdown */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 bg-surface-900 border border-surface-700 rounded-lg text-sm text-slate-300 hover:border-brand-600 transition-colors min-w-[160px] justify-between"
        >
          <span>{PERIOD_LABELS[activePeriod]}</span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-surface-900 border border-surface-700 rounded-lg shadow-xl z-50 overflow-hidden">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => selectPeriod(p)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-surface-800 ${
                  activePeriod === p ? "text-brand-400 bg-brand-500/10 font-medium" : "text-slate-300"
                }`}
              >
                {p === activePeriod && <span className="mr-2">✓</span>}
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Date inputs */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span>Desde</span>
        <input
          type="date"
          value={fromVal}
          onChange={(e) => setFromVal(e.target.value)}
          onBlur={applyCustom}
          className="bg-surface-900 border border-surface-700 rounded-lg px-2 py-1.5 text-slate-300 text-sm [color-scheme:dark] focus:outline-none focus:border-brand-600"
        />
        <span>Hasta</span>
        <input
          type="date"
          value={toVal}
          onChange={(e) => setToVal(e.target.value)}
          onBlur={applyCustom}
          className="bg-surface-900 border border-surface-700 rounded-lg px-2 py-1.5 text-slate-300 text-sm [color-scheme:dark] focus:outline-none focus:border-brand-600"
        />
      </div>
    </div>
  );
}

export function SalesPeriodPicker({ from, to }: { from?: string; to?: string }) {
  return (
    <Suspense fallback={<div className="h-9 w-72 bg-surface-800 rounded-lg animate-pulse" />}>
      <SalesPeriodPickerInner from={from} to={to} />
    </Suspense>
  );
}
