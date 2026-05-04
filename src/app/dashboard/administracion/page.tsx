import {
  getStatusPago, getStatusPagoFecha, getVentasComisiones, getClientesActivosForMonth,
  parseNumES, formatARS, currentMonthKey,
} from "@/lib/sheets";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConsultorFilter } from "@/components/ui/ConsultorFilter";
import { CopyDeudoresButton } from "@/components/ui/CopyDeudoresButton";
import { Suspense } from "react";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { Role } from "@/lib/roles";

export const revalidate = 0;

// ── helpers ───────────────────────────────────────────────────────────────────

function isPaid(val: string): boolean {
  const v = val.trim().toUpperCase();
  return v === "TRUE" || v === "VERDADERO";
}

function pct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "—";
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function AdministracionPage({
  searchParams,
}: {
  searchParams: Promise<{ consultor?: string; closer?: string; sinMonto?: string }>;
}) {
  const sp = await searchParams;
  const selectedConsultor = sp.consultor ?? "";
  const selectedCloser    = sp.closer    ?? "";
  const ocultarSinMonto   = sp.sinMonto === "ocultar";

  const user = await currentUser();
  const role = ((user?.publicMetadata?.role as Role) ?? "ops") as Role;
  const isAdmin = role === "admin";

  // Always use the previous (completed) month for active clients count
  const currMonth = currentMonthKey();
  const [cy, cm] = currMonth.split("-").map(Number);
  const prevMonth = cm === 1 ? `${cy - 1}-12` : `${cy}-${String(cm - 1).padStart(2, "0")}`;

  const [statusRows, comisionesRows, activosCount, fechaActualizacion] = await Promise.all([
    getStatusPago(),
    isAdmin ? getVentasComisiones() : Promise.resolve([]),
    getClientesActivosForMonth(prevMonth),
    getStatusPagoFecha(),
  ]);

  // ── COBROS ────────────────────────────────────────────────────────────────

  const deudores = statusRows.filter((r) => {
    const dias = parseFloat(r["Dias"]);
    return !isNaN(dias) && dias < 0;
  });

  const totalDeuda       = deudores.reduce((s, r) => s + parseNumES(r["Monto"]), 0);
  const deudoresConMonto = deudores.filter((r) => parseNumES(r["Monto"]) > 0);
  const deudoresSinMonto = deudores.filter((r) => parseNumES(r["Monto"]) === 0);
  const deudoresPct      = activosCount && activosCount > 0
    ? (deudoresConMonto.length / activosCount) * 100 : null;

  // Group by consultant
  const byCount: Record<string, number> = {};
  const byDebt:  Record<string, number> = {};
  for (const d of deudores) {
    const c = d["Consultor"] || "Sin asignar";
    byCount[c] = (byCount[c] ?? 0) + 1;
    byDebt[c]  = (byDebt[c]  ?? 0) + parseNumES(d["Monto"]);
  }
  const topByCount = Object.entries(byCount).sort((a, b) => b[1] - a[1])[0] ?? null;
  const topByDebt  = Object.entries(byDebt).sort((a, b)  => b[1] - a[1])[0] ?? null;

  // Group by closer
  const byCountCloser: Record<string, number> = {};
  const byDebtCloser:  Record<string, number> = {};
  for (const d of deudores) {
    const c = d["Closer"] || "Sin asignar";
    byCountCloser[c] = (byCountCloser[c] ?? 0) + 1;
    byDebtCloser[c]  = (byDebtCloser[c]  ?? 0) + parseNumES(d["Monto"]);
  }
  const topCloserByCount = Object.entries(byCountCloser).sort((a, b) => b[1] - a[1])[0] ?? null;
  const topCloserByDebt  = Object.entries(byDebtCloser).sort((a, b)  => b[1] - a[1])[0] ?? null;

  // All unique values for filters
  const allConsultores = [...new Set(deudores.map((d) => d["Consultor"]).filter(Boolean))].sort();
  const allClosers     = [...new Set(deudores.map((d) => d["Closer"]).filter(Boolean))].sort();

  // Filtered debtor list (all filters apply together)
  const filteredDeudores = deudores.filter((d) => {
    if (selectedConsultor && d["Consultor"] !== selectedConsultor) return false;
    if (selectedCloser    && d["Closer"]    !== selectedCloser)    return false;
    if (ocultarSinMonto   && parseNumES(d["Monto"]) === 0)        return false;
    return true;
  });
  const filteredTotal    = filteredDeudores.reduce((s, r) => s + parseNumES(r["Monto"]), 0);
  // Count sin-monto after consultor/closer filters (ignoring sinMonto toggle) — for the toggle label
  const sinMontoCount    = deudores.filter((d) => {
    if (selectedConsultor && d["Consultor"] !== selectedConsultor) return false;
    if (selectedCloser    && d["Closer"]    !== selectedCloser)    return false;
    return parseNumES(d["Monto"]) === 0;
  }).length;

  // ── COMISIONES ────────────────────────────────────────────────────────────

  type ComisionRow = Record<string, string> & { pendiente: string };
  const comisionesPendientes: ComisionRow[] = comisionesRows
    .filter((r) => {
      if (!r["Prospecto"]) return false;
      // Only "Cliente confirmado" — not "Seña Pie Adentro" or other statuses
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

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="Admin"
        description="Cobros · Comisiones"
      />

      {/* ── COBROS ── */}
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Cobros</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Clientes activos</p>
          <p className="text-3xl font-bold text-white tabular-nums">
            {activosCount != null ? activosCount : "—"}
          </p>
          <p className="text-xs text-slate-600 mt-1">mes actual</p>
        </div>

        <div className={`card text-center ${deudoresConMonto.length > 0 ? "border-rose-900/50" : ""}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Deudores c/ monto</p>
          <p className="text-3xl font-bold tabular-nums text-rose-400">
            {deudoresConMonto.length}
          </p>
          {deudoresPct != null && (
            <p className="text-xs text-rose-400/60 mt-1">{deudoresPct.toFixed(1)}% de activos</p>
          )}
          {deudoresSinMonto.length > 0 && (
            <p className="text-xs text-slate-600 mt-1">+ {deudoresSinMonto.length} sin monto aún</p>
          )}
        </div>

        <div className="card text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Monto adeudado</p>
          <p className="text-3xl font-bold tabular-nums text-amber-400">
            {totalDeuda > 0 ? formatARS(totalDeuda) : "—"}
          </p>
          {deudores.length > 0 && totalDeuda === 0 && (
            <p className="text-xs text-slate-600 mt-1">Montos sin registrar</p>
          )}
        </div>
      </div>

      {/* Top stats — consultores y closers */}
      {deudores.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Consultor stats */}
          {topByCount && (
            <div className="card border-rose-900/40 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Asesor c/ más deudores</p>
              <p className="text-xl font-bold text-white">{topByCount[0]}</p>
              <p className="text-sm text-rose-400 font-semibold mt-1">
                {topByCount[1]} {topByCount[1] === 1 ? "deudor" : "deudores"}
              </p>
            </div>
          )}
          {topByDebt && topByDebt[1] > 0 && (
            <div className="card border-amber-900/40 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Asesor c/ mayor deuda</p>
              <p className="text-xl font-bold text-white">{topByDebt[0]}</p>
              <p className="text-sm text-amber-400 font-semibold mt-1">{formatARS(topByDebt[1])} adeudado</p>
            </div>
          )}
          {/* Closer stats */}
          {topCloserByCount && (
            <div className="card border-rose-900/40 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Closer c/ más deudores</p>
              <p className="text-xl font-bold text-white">{topCloserByCount[0]}</p>
              <p className="text-sm text-rose-400 font-semibold mt-1">
                {topCloserByCount[1]} {topCloserByCount[1] === 1 ? "deudor" : "deudores"}
              </p>
            </div>
          )}
          {topCloserByDebt && topCloserByDebt[1] > 0 && (
            <div className="card border-amber-900/40 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Closer c/ mayor deuda</p>
              <p className="text-xl font-bold text-white">{topCloserByDebt[0]}</p>
              <p className="text-sm text-amber-400 font-semibold mt-1">{formatARS(topCloserByDebt[1])} adeudado</p>
            </div>
          )}
        </div>
      )}

      {/* Filter + Detail Table */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Detalle de deudores
              {selectedConsultor && (
                <span className="ml-2 normal-case text-brand-400">— {selectedConsultor}</span>
              )}
            </h3>
            {fechaActualizacion && (
              <p className="text-[10px] text-slate-600 mt-0.5">
                Actualizado al <span className="text-slate-500 font-medium">{fechaActualizacion}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle sin monto */}
            {sinMontoCount > 0 && (() => {
              const params = new URLSearchParams();
              if (selectedConsultor) params.set("consultor", selectedConsultor);
              if (selectedCloser)    params.set("closer",    selectedCloser);
              if (!ocultarSinMonto)  params.set("sinMonto",  "ocultar");
              const href = `/dashboard/administracion?${params.toString()}`;
              return (
                <Link
                  href={href}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    ocultarSinMonto
                      ? "bg-brand-600/20 border-brand-600/50 text-brand-400"
                      : "bg-surface-700 border-surface-600 text-slate-400 hover:text-white"
                  }`}
                >
                  <span className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                    ocultarSinMonto ? "bg-brand-600 border-brand-600" : "border-slate-500"
                  }`}>
                    {ocultarSinMonto && <span className="text-white text-[8px] leading-none">✓</span>}
                  </span>
                  Ocultar sin monto ({sinMontoCount})
                </Link>
              );
            })()}
            {allConsultores.length > 0 && (
              <Suspense fallback={null}>
                <ConsultorFilter consultores={allConsultores} />
              </Suspense>
            )}
            {allClosers.length > 0 && (
              <Suspense fallback={null}>
                <ConsultorFilter consultores={allClosers} paramKey="closer" />
              </Suspense>
            )}
          </div>
        </div>

        {filteredDeudores.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            {selectedConsultor ? `No hay deudores para ${selectedConsultor}` : "Sin deudores en el período ✓"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-700">
                  {["Cliente", "Consultor", "Closer", "Días atrasado", "Monto adeudado"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase text-left first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDeudores
                  .sort((a, b) => parseFloat(a["Dias"]) - parseFloat(b["Dias"])) // most overdue first
                  .map((d, i) => {
                    const diasNum = Math.abs(parseFloat(d["Dias"]) || 0);
                    const monto   = parseNumES(d["Monto"]);
                    const urgency = diasNum > 90 ? "text-rose-400" : diasNum > 30 ? "text-amber-400" : "text-slate-300";
                    return (
                      <tr key={i} className="border-b border-surface-800/50 hover:bg-surface-800/30">
                        <td className="px-4 py-2.5 font-medium text-white">{d["Cliente"]}</td>
                        <td className="px-4 py-2.5 text-slate-400">{d["Consultor"] || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-400">{d["Closer"] || "—"}</td>
                        <td className={`px-4 py-2.5 tabular-nums font-semibold ${urgency}`}>
                          {diasNum} días
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-amber-400 font-semibold">
                          {monto > 0 ? formatARS(monto) : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              {/* Total row */}
              <tfoot>
                <tr className="border-t border-surface-600/60 bg-surface-800/40">
                  <td className="px-4 py-2.5 font-bold text-white" colSpan={3}>
                    Total
                    {selectedConsultor && <span className="ml-1 font-normal text-slate-400">— {selectedConsultor}</span>}
                    {selectedCloser    && <span className="ml-1 font-normal text-slate-400">— {selectedCloser}</span>}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      ({filteredDeudores.length} {filteredDeudores.length === 1 ? "deudor" : "deudores"})
                    </span>
                  </td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 font-bold tabular-nums text-amber-400">
                    {filteredTotal > 0 ? formatARS(filteredTotal) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Copy for WhatsApp */}
        {filteredDeudores.length > 0 && (
          <div className="mt-4 pt-4 border-t border-surface-700/40 flex justify-end">
            <CopyDeudoresButton
              deudores={filteredDeudores
                .sort((a, b) => parseFloat(a["Dias"]) - parseFloat(b["Dias"]))
                .map((d) => ({
                  cliente:   d["Cliente"],
                  consultor: d["Consultor"] || "",
                  closer:    d["Closer"]    || "",
                  dias:      Math.abs(parseFloat(d["Dias"]) || 0),
                  monto:     parseNumES(d["Monto"]),
                }))}
              totalDeuda={filteredTotal}
              fechaActualizacion={fechaActualizacion}
            />
          </div>
        )}
      </div>

      {/* ── COMISIONES A PAGAR — solo admin ── */}
      {isAdmin && (
      <><h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Comisiones a pagar</h2>
      <div className="card">
        {/* Summary */}
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
                        <span className="text-xs font-semibold text-rose-400">
                          {r.pendiente}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
