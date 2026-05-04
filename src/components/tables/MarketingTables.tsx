"use client";

import { DataTable } from "@/components/ui/DataTable";

function StatusBadge({ value }: { value: string }) {
  const colorMap: Record<string, string> = {
    Confirmado: "bg-emerald-400/10 text-emerald-400",
    Pendiente: "bg-amber-400/10 text-amber-400",
    Descartado: "bg-rose-400/10 text-rose-400",
  };
  const cls = colorMap[value] ?? "bg-slate-700 text-slate-300";
  return <span className={`badge ${cls}`}>{value || "—"}</span>;
}

type Row = Record<string, unknown>;

export function VSLTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Fecha", header: "Fecha" },
    { key: "Gasto", header: "Gasto ($)" },
    { key: "Agendas", header: "Agendas" },
    {
      key: "CPA",
      header: "CPA",
      render: (r: Row) => (
        <span className="font-mono text-amber-400">${String(r["CPA"] ?? "")}</span>
      ),
    },
  ];
  return <DataTable data={data} columns={columns} />;
}

export function RubrosTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Nombre", header: "Nombre" },
    { key: "Negocio", header: "Negocio" },
    { key: "Tipo", header: "Tipo" },
    { key: "Catgoria del negocio", header: "Categoría" },
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
      searchKeys={["Nombre", "Negocio", "Catgoria del negocio"] as (keyof Row)[]}
    />
  );
}
