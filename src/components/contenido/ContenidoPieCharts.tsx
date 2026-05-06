"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface PieSlice { name: string; value: number; color: string; }

const PALETTE = [
  "#6366f1","#10b981","#eab308","#f87171","#8b5cf6",
  "#f59e0b","#3b82f6","#ec4899","#14b8a6","#f97316",
];

export function assignColors(items: { name: string; value: number }[]): PieSlice[] {
  return items.map((it, i) => ({ ...it, color: PALETTE[i % PALETTE.length] }));
}

function MiniTooltip({ active, payload, unit = "posts" }: { active?: boolean; payload?: { name: string; value: number; payload: PieSlice }[]; unit?: string }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: sl } = payload[0];
  const total = payload.reduce((s: number, p: { value: number }) => s + p.value, 0);
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-white mb-0.5">{name}</p>
      <p className="text-slate-300">{value} {unit}</p>
      <p style={{ color: sl.color }} className="font-semibold">{pct}%</p>
    </div>
  );
}

interface Props {
  data: PieSlice[];
  title: string;
  unit?: string;
}

export function MiniPie({ data, title, unit = "posts" }: Props) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{title}</p>
      <p className="text-slate-600 text-xs">Sin datos</p>
    </div>
  );
  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<MiniTooltip unit={unit} />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span className="text-[11px] text-slate-400">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-slate-600 mt-1">{total} {unit} total</p>
    </div>
  );
}
