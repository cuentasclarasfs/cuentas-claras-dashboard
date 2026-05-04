"use client";

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

type DataPoint = {
  label: string;
  total: number;
  primerPrograma: number;
  renovados: number;
  downsell: number;
};

export function ClientesTrendChart({ data }: { data: DataPoint[] }) {
  if (!data.length) return <p className="text-sm text-slate-500 text-center py-8">Sin datos</p>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8 }}
          labelStyle={{ color: "#e2e8f0" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
        <Line type="monotone" dataKey="total" stroke="#4A5BBD" strokeWidth={2} dot={{ r: 3 }} name="Total activos" />
        <Line type="monotone" dataKey="primerPrograma" stroke="#2B3990" strokeWidth={2} dot={{ r: 3 }} name="1er programa" />
        <Line type="monotone" dataKey="renovados" stroke="#92278F" strokeWidth={2} dot={{ r: 3 }} name="Renovados" />
        <Line type="monotone" dataKey="downsell" stroke="#B85AB6" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="4 2" name="Downsell" />
      </LineChart>
    </ResponsiveContainer>
  );
}
