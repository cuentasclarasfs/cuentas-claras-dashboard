import {
  getEstadisticasCobranzas, getStatusPagoAdmin,
  getVentasComisiones,
  parseNumES, formatARS,
} from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { CobranzasTrendChart } from "@/components/charts/CobranzasTrendChart";
import { currentUser } from "@clerk/nextjs/server";
import type { Role } from "@/lib/roles";

export const revalidate = 0;

function isPaid(val: string): boolean {
  const v = val.trim().toUpperCase();
  return v === "TRUE" || v === "VERDADERO";
}

export default async function AdministracionPage() {
  const user = await currentUser();
  const role = ((user?.publicMetadata?.role as Role) ?? "ops") as Role;
  const isAdmin = role === "admin";

  const [estadisticas, statusRows, comisionesRows] = await Promise.all([
    getEstadisticasCobranzas(),
    getStatusPagoAdmin(),
    isAdmin ? getVentasComisiones() : Promise.resolve([]),
  ]);

  // Past-month debtors: col P has a value
  const deudoresAnteriores = statusRows.filter((r) => r["DeudaAnterior"].trim() !== "");
  const totalDeudaAnterior = deudoresAnteriores.reduce((s, r) => s + parseNumES(r["DeudaAnterior"]), 0);

  // Current-month debtors: col Q = "No" AND col P is empty
  const deudoresMesActual = statusRows.filter((r) =>
    r["PagoMesActual"].trim().toLowerCase() === "no" && r["DeudaAnterior"].trim() === ""
  );

  // Comisiones
  type ComisionRow = Record<string, string> & { pendiente: string };
  const comisionesPendientes: ComisionRow[] = comisionesRows
    .filter((r) => {
      if (!r["Prospecto"]) return false;
      if (r["Status"].toLowerCase().trim() !== "cliente confirmado") return false;
      const closerPending = !isPaid(r["Com Closer"]);
      const setterPending = r["Origen"]?.trim() === "Setting" && !isPaid(r["Com Set"]);
      return closerPending || setterPending;
    })
    .map((r) => {
      const closerPending = !isPaid(r["Com Closer"]);
      const setterPending = r["Origen"]?.trim() === "Setting" && !isPaid(r["Com Set"]);
      const pendiente = closerPending && setterPending
        ? "Closer + Setter"
        : closerPending ? "Closer" : "Setter";
      return { ...r, pendiente } as ComisionRow;
    });
  const totalTickets = comisionesPendientes.reduce((s, r) => s + parseNumES(r["Facturacion"]), 0);

  return (
    <div>
      <PageHeader title="Admin" description="Cobros · Comisiones" />

      {/* ── ESTADÍSTICAS HISTÓRICAS ── */}
      {estadisticas.length > 0 && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Estadísticas de cobros
          </h2>
          <div className="card mb-6">
            <CobranzasTrendChart data={estadisticas} />
          </div>
          <div className="card mb-8 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  {["Mes", "Total", "Pagaron", "No pagaron", "Tarde/Parcial", "% Cobrado"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estadisticas.map((row, i) => {
                  const pctColor = row.porcentajeNum >= 80 ? "text-emerald-400"
                    : row.porcentajeNum >= 60 ? "text-amber-400"
                    : row.porcentajeNum > 0 ? "text-rose-400"
                    : "text-slate-400";
                  return (
                    <tr key={i} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                      <td className="px-4 py-2.5 font-medium text-white">{row.mes}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-300">{row.total > 0 ? formatARS(row.total) : "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums text-emerald-400 font-semibold">{row.si > 0 ? formatARS(row.si) : "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums text-rose-400 font-semibold">{row.no > 0 ? formatARS(row.no) : "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums text-amber-400">{row.tardeParcial > 0 ? formatARS(row.tardeParcial) : "—"}</td>
                      <td className={`px-4 py-2.5 tabular-nums font-bold ${pctColor}`}>
                        {row.porcentaje || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── DEUDORES MESES ANTERIORES ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        Deuda de meses anteriores
      </h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className={`card text-center ${deudoresAnteriores.length > 0 ? "border-rose-900/50" : ""}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Cantidad</p>
          <p className="text-3xl font-bold tabular-nums text-rose-400">{deudoresAnteriores.length}</p>
          <p className="text-xs text-slate-600 mt-1">deudores meses anteriores</p>
        </div>
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Monto total</p>
          <p className="text-3xl font-bold tabular-nums text-amber-400">
            {totalDeudaAnterior > 0 ? formatARS(totalDeudaAnterior) : "—"}
          </p>
          <p className="text-xs text-slate-600 mt-1">adeudado</p>
        </div>
      </div>

      {/* ── DEUDORES MES ACTUAL ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
        No pagaron este mes
      </h2>
      <div className="card mb-8">
        {deudoresMesActual.length === 0 ? (
          <p className="text-sm text-emerald-400 text-center py-6">✓ Sin deudores en el mes actual</p>
        ) : (
          <div className="overflow-x-auto">
            <p className="text-xs text-slate-500 mb-3">
              {deudoresMesActual.length} {deudoresMesActual.length === 1 ? "cliente" : "clientes"} sin pagar este mes
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  {["Cliente", "Consultor", "Closer", "Próx. pago", "Días restantes", "Comentario"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deudoresMesActual.map((d, i) => {
                  const dias = parseFloat(d["DiasProxPago"] ?? "");
                  const diasNum = isFinite(dias) ? dias : null;
                  const diasColor = diasNum === null
                    ? "text-slate-400"
                    : diasNum < 0 ? "text-rose-400"
                    : diasNum <= 5 ? "text-amber-400"
                    : "text-slate-300";
                  return (
                    <tr key={i} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                      <td className="px-4 py-2.5 font-medium text-white">{d["Cliente"] || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-400">{d["Consultor"] || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-400">{d["Closer"] || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-400">{d["FechaProxPago"] || "—"}</td>
                      <td className={`px-4 py-2.5 tabular-nums font-semibold ${diasColor}`}>
                        {diasNum !== null
                          ? diasNum < 0
                            ? `${Math.abs(Math.round(diasNum))} días vencido`
                            : `${Math.round(diasNum)} días`
                          : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{d["Comentario"] || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── COMISIONES A PAGAR — solo admin ── */}
      {isAdmin && (
        <>
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Comisiones a pagar
          </h2>
          <div className="card">
            <div className="flex items-center gap-6 mb-5 pb-4 border-b border-surface-700/40">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Pendientes</p>
                <p className="text-2xl font-bold text-rose-400 tabular-nums">{comisionesPendientes.length}</p>
              </div>
              {totalTickets > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Facturación involucrada</p>
                  <p className="text-2xl font-bold text-brand-400 tabular-nums">{formatARS(totalTickets)}</p>
                </div>
              )}
            </div>

            {comisionesPendientes.length === 0 ? (
              <p className="text-sm text-emerald-400 text-center py-6">✓ Todas las comisiones están al día</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-700">
                      {["Prospecto", "Ticket", "Setting", "Closer", "A pagar"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comisionesPendientes.map((r, i) => {
                      const factura = parseNumES(r["Facturacion"]);
                      const isSetting = r["Origen"]?.trim() === "Setting";
                      return (
                        <tr key={i} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                          <td className="px-4 py-2.5 font-medium text-white">{r["Prospecto"]}</td>
                          <td className="px-4 py-2.5 tabular-nums text-brand-400 font-semibold">
                            {factura > 0 ? formatARS(factura) : "—"}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                              isSetting
                                ? "bg-emerald-900/40 text-emerald-400 border border-emerald-800/50"
                                : "bg-surface-800 text-slate-500 border border-surface-700"
                            }`}>
                              {isSetting ? "SÍ" : "NO"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-300 font-medium">{r["Closer"] || "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs font-semibold text-rose-400">{r.pendiente}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
