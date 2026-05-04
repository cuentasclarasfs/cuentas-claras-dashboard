"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLOR_MAP: Record<string, string> = {
  activo: "#2B3990",
  pausa: "#B85AB6",
  finalizado: "#4A5BBD",
  baja: "#92278F",
  otro: "#475569",
};

function getColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("activ")) return COLOR_MAP.activo;
  if (s.includes("pausa") || s.includes("hold")) return COLOR_MAP.pausa;
  if (s.includes("finaliz") || s.includes("egres")) return COLOR_MAP.finalizado;
  if (s.includes("baja") || s.includes("cancel")) return COLOR_MAP.baja;
  return COLOR_MAP.otro;
}

export function ClientesStatusChart({ data }: { data: Record<string, string>[] }) {
  const counts: Record<string, number> = {};
  data.filter((r) => r["Cliente"]).forEach((r) => {
    const k = r["Status"] || "Sin status";
    counts[k] = (counts[k] || 0) + 1;
  });

  const chartData = Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.name)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 12 }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(v) => <span style={{ color: "#94a3b8", fontSize: 11 }}>{v}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
