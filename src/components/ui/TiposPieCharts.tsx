"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface TipoSlice {
  name: string;
  value: number;
  color: string;
}

interface Props {
  current: TipoSlice[];
  previous: TipoSlice[];
  currentLabel?: string;
  previousLabel?: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: TipoSlice }[] }) {
  if (!active || !payload?.length) return null;
  const { name, value, payload: slice } = payload[0];
  const total = (payload[0] as unknown as { total?: number }).total ?? 0;
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-white mb-0.5">{name}</p>
      <p className="text-slate-300">{value} calificados</p>
      <p style={{ color: slice.color }}>{pct}%</p>
    </div>
  );
}

function buildTooltip(total: number) {
  return function TooltipWrapper({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: TipoSlice }[] }) {
    if (!active || !payload?.length) return null;
    const { name, value, payload: slice } = payload[0];
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
    return (
      <div className="bg-surface-900 border border-surface-700 rounded-lg px-3 py-2 text-xs shadow-lg">
        <p className="font-bold text-white mb-0.5">{name}</p>
        <p className="text-slate-300">{value} calificados</p>
        <p style={{ color: slice.color }}>{pct}%</p>
      </div>
    );
  };
}

function SinglePie({ data, label }: { data: TipoSlice[]; label: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const TooltipContent = buildTooltip(total);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest text-center mb-2">{label}</p>
      {total === 0 ? (
        <div className="flex items-center justify-center h-40 text-sm text-slate-600">Sin datos</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<TooltipContent />} />
            <Legend
              formatter={(value) => (
                <span className="text-xs text-slate-400">{value}</span>
              )}
              wrapperStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
      {total > 0 && (
        <p className="text-center text-xs text-slate-600 -mt-1">{total} calificados</p>
      )}
    </div>
  );
}

export function TiposPieCharts({ current, previous, currentLabel = "Este período", previousLabel = "Período anterior" }: Props) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
        Distribución de leads calificados
      </h3>
      <div className="flex gap-6">
        <SinglePie data={current} label={currentLabel} />
        <div className="w-px bg-surface-700/50 self-stretch" />
        <SinglePie data={previous} label={previousLabel} />
      </div>
    </div>
  );
}
