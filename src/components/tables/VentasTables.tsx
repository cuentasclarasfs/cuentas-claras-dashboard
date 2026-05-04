"use client";

import { DataTable } from "@/components/ui/DataTable";

function StatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls = v.includes("confirmado") || v.includes("seña")
    ? "bg-emerald-400/10 text-emerald-400"
    : v.includes("no show") || v.includes("cancelado") || v.includes("no presentado")
    ? "bg-rose-400/10 text-rose-400"
    : v.includes("luchando")
    ? "bg-amber-400/10 text-amber-400"
    : "bg-slate-400/10 text-slate-400";
  return <span className={`badge ${cls}`}>{value || "—"}</span>;
}

type Row = Record<string, unknown>;

export function ReunionesTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Prospecto", header: "Prospecto" },
    { key: "Fecha de reunion", header: "Fecha reunión" },
    { key: "Closer", header: "Closer" },
    { key: "Canal", header: "Canal" },
    { key: "Ingresos Mensuales", header: "Ingresos" },
    {
      key: "Status",
      header: "Status",
      render: (r: Row) => <StatusBadge value={String(r["Status"] ?? "")} />,
    },
  ];
  return (
    <DataTable
      data={data}
      columns={columns}
      searchable
      searchKeys={["Prospecto", "Tipo de Negocio", "Canal"] as (keyof Row)[]}
    />
  );
}
