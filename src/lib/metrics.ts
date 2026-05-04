// Shared metric calculations used across multiple modules

import { monthKey, parseDate } from "./sheets";

export interface MonthlyRevenue {
  month: string;       // "2026-03"
  cobrado: number;     // cash received
  primerPrograma: number;
  renovados: number;
}

export interface AlertItem {
  level: "red" | "yellow";
  message: string;
}

// Categorías que son ingresos de Cuentas Claras
const CC_CATEGORIES = ["cuentas claras", "primer programa", "renovad"];

function isCCIngreso(categoria: string): boolean {
  const c = categoria.toLowerCase();
  return CC_CATEGORIES.some((k) => c.includes(k));
}

function isPrimerPrograma(categoria: string): boolean {
  const c = categoria.toLowerCase();
  return c.includes("primer") || (c.includes("cuentas claras") && !c.includes("renov"));
}

function isRenovado(categoria: string): boolean {
  return categoria.toLowerCase().includes("renov");
}

export function calcRevenueByMonth(
  ingresos: Record<string, string>[]
): MonthlyRevenue[] {
  const map = new Map<string, MonthlyRevenue>();

  ingresos.forEach((row) => {
    const cat = row["Categoría"] ?? row["Categoria"] ?? "";
    if (!isCCIngreso(cat)) return;

    const date = parseDate(row["Marca temporal"]);
    if (!date) return;

    const mk = monthKey(date);
    const monto = parseFloat(row["Monto"]) || 0;

    if (!map.has(mk)) {
      map.set(mk, { month: mk, cobrado: 0, primerPrograma: 0, renovados: 0 });
    }
    const entry = map.get(mk)!;
    entry.cobrado += monto;
    if (isPrimerPrograma(cat)) entry.primerPrograma += monto;
    if (isRenovado(cat)) entry.renovados += monto;
  });

  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function calcEgresosByMonth(
  egresos: Record<string, string>[]
): Map<string, number> {
  const map = new Map<string, number>();
  egresos.forEach((row) => {
    const date = parseDate(row["Marca temporal"]);
    if (!date) return;
    const mk = monthKey(date);
    const monto = parseFloat(row["Monto"]) || 0;
    map.set(mk, (map.get(mk) ?? 0) + monto);
  });
  return map;
}

export function buildAlerts(params: {
  showRate: number | null;
  tasaCierre: number | null;
  churnCount: number;
  prevChurnCount: number;
  margenBruto: number | null;
  prevMargenBruto: number | null;
  noShowRate: number | null;
}): AlertItem[] {
  const alerts: AlertItem[] = [];
  const { showRate, tasaCierre, churnCount, prevChurnCount, margenBruto, prevMargenBruto, noShowRate } = params;

  if (showRate !== null && showRate < 0.6) {
    alerts.push({ level: "red", message: `Show rate en ${(showRate * 100).toFixed(0)}% — por debajo del mínimo (60%)` });
  }
  if (tasaCierre !== null && tasaCierre < 0.2) {
    alerts.push({ level: "red", message: `Tasa de cierre en ${(tasaCierre * 100).toFixed(0)}% — revisar pitch` });
  }
  if (churnCount > prevChurnCount && prevChurnCount > 0) {
    alerts.push({ level: "red", message: `Churn subió: ${churnCount} bajas este mes vs ${prevChurnCount} el anterior` });
  }
  if (margenBruto !== null && prevMargenBruto !== null && prevMargenBruto > 0) {
    const drop = (prevMargenBruto - margenBruto) / prevMargenBruto;
    if (drop > 0.05) {
      alerts.push({ level: "red", message: `Margen bajó ${(drop * 100).toFixed(1)}% vs mes anterior` });
    }
  }
  if (noShowRate !== null && noShowRate > 0.35) {
    alerts.push({ level: "yellow", message: `No show + cancelados en ${(noShowRate * 100).toFixed(0)}% — supera el 35%` });
  }

  return alerts;
}
