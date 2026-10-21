import type { CacCompleto } from "@/lib/cac";

const fmtUSD = (n: number | null) => n != null && n > 0 ? `$${Math.round(n).toLocaleString()}` : "—";

export function CacCompletoTable({ data, costosOk }: { data: CacCompleto; costosOk: boolean }) {
  const { rows, total } = data;
  return (
    <div className="card mb-8">
      {!costosOk && (
        <p className="text-xs text-amber-400 mb-3 px-1">No se pudieron leer los costos de Cashflow: equipo marketing y setter figuran en $0.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-700">
              {["Canal", "Ads", "Equipo mkt", "Setter", "Costo total", "CC/SPA", "CAC ads", "CAC total"].map((h) => (
                <th key={h} className="px-3 py-3 text-xs font-semibold text-slate-500 uppercase text-center whitespace-nowrap first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nombre} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                <td className="px-3 py-3 font-medium text-slate-300 whitespace-nowrap">{r.nombre}</td>
                <td className="px-3 py-3 text-center text-brand-400">{fmtUSD(r.ads)}</td>
                <td className="px-3 py-3 text-center text-slate-300">{fmtUSD(r.equipo)}</td>
                <td className="px-3 py-3 text-center text-slate-300">{fmtUSD(r.setter)}</td>
                <td className="px-3 py-3 text-center font-bold text-white">{fmtUSD(r.total)}</td>
                <td className="px-3 py-3 text-center font-bold text-emerald-400">{r.ccSpa || "—"}</td>
                <td className="px-3 py-3 text-center text-slate-400">{fmtUSD(r.cacAds)}</td>
                <td className="px-3 py-3 text-center font-bold text-amber-300">{fmtUSD(r.cacTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-800/40 border-t border-surface-600/50">
              <td className="px-3 py-3 font-bold text-white">Total</td>
              <td className="px-3 py-3 text-center font-bold text-brand-400">{fmtUSD(total.ads)}</td>
              <td className="px-3 py-3 text-center font-bold text-slate-300">{fmtUSD(total.equipo)}</td>
              <td className="px-3 py-3 text-center font-bold text-slate-300">{fmtUSD(total.setter)}</td>
              <td className="px-3 py-3 text-center font-bold text-white">{fmtUSD(total.total)}</td>
              <td className="px-3 py-3 text-center font-bold text-emerald-400">{total.ccSpa || "—"}</td>
              <td className="px-3 py-3 text-center font-bold text-slate-400">{fmtUSD(total.cacAds)}</td>
              <td className="px-3 py-3 text-center font-bold text-amber-300">{fmtUSD(total.cacTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[10px] text-slate-600 mt-2 px-1">
        Equipo marketing 100% a FMA · Setter repartido por cierres CC+SPA (FMA 70%, ADS Mje IG y WAPP 100%, resto 0) · Costos de Cashflow del mes · Closers no incluidos · CAC = Costo / (CC + SPA)
      </p>
    </div>
  );
}
