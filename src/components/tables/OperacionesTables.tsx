"use client";

import { DataTable } from "@/components/ui/DataTable";

function ClienteStatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls = v.includes("activ")
    ? "bg-emerald-400/10 text-emerald-400"
    : v.includes("pausa") || v.includes("hold")
    ? "bg-amber-400/10 text-amber-400"
    : v.includes("finaliz") || v.includes("egres")
    ? "bg-blue-400/10 text-blue-400"
    : v.includes("baja") || v.includes("cancel")
    ? "bg-rose-400/10 text-rose-400"
    : "bg-slate-700 text-slate-300";
  return <span className={`badge ${cls}`}>{value || "—"}</span>;
}

type Row = Record<string, unknown>;

export function StatusClientesTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Cliente", header: "Cliente" },
    { key: "Negocio", header: "Negocio" },
    { key: "Coach", header: "Coach" },
    {
      key: "Status",
      header: "Status",
      render: (r: Row) => <ClienteStatusBadge value={String(r["Status"] ?? "")} />,
    },
    { key: "Deep Status", header: "Deep Status" },
    { key: "$", header: "Monto" },
    { key: "Cant pagos", header: "Pagos" },
  ];
  return (
    <DataTable
      data={data}
      columns={columns}
      searchable
      searchKeys={["Cliente", "Coach", "Negocio"] as (keyof Row)[]}
    />
  );
}

export function AnalisisClientesTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Cliente", header: "Cliente" },
    { key: "Coach", header: "Coach" },
    { key: "Tipo de Cliente", header: "Tipo" },
    { key: "Promedio de puntaje al acompañamiento", header: "NPS prom." },
    { key: "Facturacion inicial ($)", header: "Facturación inicial" },
    { key: "Facturacion final primer programa ($)", header: "Facturación final" },
    {
      key: "Variacion Facturacion",
      header: "Variación",
      render: (r: Row) => {
        const val = String(r["Variacion Facturacion"] ?? "");
        const num = parseFloat(val);
        if (isNaN(num)) return <span className="text-slate-500">—</span>;
        return (
          <span className={num >= 0 ? "text-emerald-400 font-medium" : "text-rose-400 font-medium"}>
            {num >= 0 ? "+" : ""}{val}
          </span>
        );
      },
    },
  ];
  return (
    <DataTable
      data={data}
      columns={columns}
      searchable
      searchKeys={["Cliente", "Coach"] as (keyof Row)[]}
    />
  );
}

export function DownsellTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Cliente", header: "Cliente" },
    { key: "Negocio", header: "Negocio" },
    { key: "Status", header: "Status" },
    { key: "Deep Status", header: "Deep Status" },
    { key: "$", header: "Monto" },
    { key: "Fecha prox pago", header: "Próximo pago" },
  ];
  return <DataTable data={data} columns={columns} />;
}
