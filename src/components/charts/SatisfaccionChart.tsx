"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export function SatisfaccionChart({ data }: { data: Record<string, string>[] }) {
  const byMonth: Record<string, { sum: number; count: number }> = {};

  data.forEach((r) => {
    const fecha = r["Marca temporal"];
    if (!fecha) return;
    const month = String(fecha).slice(0, 7);
    const puntaje = parseFloat(r["¿Qué puntaje le darías al acompañamiento?"]) || 0;
    if (!puntaje) return;
    if (!byMonth[month]) byMonth[month] = { sum: 0, count: 0 };
    byMonth[month].sum += puntaje;
    byMonth[month].count += 1;
  });

  const chartData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { sum, count }]) => ({
      mes: month,
      promedio: parseFloat((sum / count).toFixed(2)),
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 10]} tick={{ fill: "#64748b", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
          formatter={(v: number) => [v, "Puntaje prom."]}
        />
        <Line
          type="monotone"
          dataKey="promedio"
          stroke="#4A5BBD"
          strokeWidth={2.5}
          dot={{ fill: "#4A5BBD", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
