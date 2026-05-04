"use client";

import { DataTable } from "@/components/ui/DataTable";

type Row = Record<string, unknown>;

function StatusBadge({ value }: { value: string }) {
  const v = value.toLowerCase();
  const cls = v.includes("deveng") || v.includes("activ") ? "bg-emerald-400/10 text-emerald-400"
    : v.includes("pausa") || v.includes("pend") ? "bg-amber-400/10 text-amber-400"
    : v.includes("baja") || v.includes("cancel") || v.includes("inactiv") ? "bg-rose-400/10 text-rose-400"
    : v.includes("finaliz") || v.includes("egres") ? "bg-blue-400/10 text-blue-400"
    : "bg-slate-700 text-slate-300";
  return <span className={`badge ${cls}`}>{value || "—"}</span>;
}

function ScoreBadge({ value }: { value: string }) {
  const n = parseInt(value);
  const colors = ["", "bg-rose-500/20 text-rose-300", "bg-orange-500/20 text-orange-300", "bg-amber-500/20 text-amber-300", "bg-brand-500/20 text-brand-300", "bg-emerald-500/20 text-emerald-300"];
  const cls = colors[n] ?? "bg-slate-700 text-slate-400";
  return <span className={`badge ${cls}`}>{value || "—"}</span>;
}

export function ClientesPipelineTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Cliente", header: "Cliente" },
    { key: "Negocio", header: "Negocio" },
    { key: "Coach", header: "Coach" },
    { key: "Status", header: "Status", render: (r: Row) => <StatusBadge value={String(r["Status"] ?? "")} /> },
    { key: "Deep Status", header: "Deep Status" },
    { key: "Score", header: "Score", render: (r: Row) => <ScoreBadge value={String(r["Score"] ?? "")} /> },
    { key: "_feedbackCount", header: "Feedbacks" },
    { key: "_avgNPS", header: "NPS prom." },
    { key: "$", header: "Monto" },
    { key: "Mes de comienzo", header: "Inicio" },
  ];
  return <DataTable data={data} columns={columns} searchable searchKeys={["Cliente", "Coach", "Negocio"] as (keyof Row)[]} />;
}

export function NuevosClientesTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Prospecto", header: "Prospecto" },
    { key: "Tipo de Negocio", header: "Negocio" },
    { key: "Canal", header: "Canal" },
    { key: "Tipo de Lead", header: "Status", render: (r: Row) => <span className="badge bg-emerald-400/10 text-emerald-400">{String(r["Tipo de Lead"] ?? "")}</span> },
    { key: "Ingresos Mensuales", header: "Facturación" },
  ];
  return <DataTable data={data} columns={columns} />;
}

export function DownsellClientesTable({ data }: { data: Row[] }) {
  const columns = [
    { key: "Cliente", header: "Cliente" },
    { key: "Negocio", header: "Negocio" },
    { key: "Status", header: "Status", render: (r: Row) => <StatusBadge value={String(r["Status"] ?? "")} /> },
    { key: "Deep Status", header: "Deep Status" },
    { key: "$", header: "Monto" },
    { key: "Fecha prox pago", header: "Próximo pago" },
  ];
  return <DataTable data={data} columns={columns} />;
}
