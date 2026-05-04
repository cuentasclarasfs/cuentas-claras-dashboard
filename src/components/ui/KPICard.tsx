import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  trend?: { value: number; label?: string };
  color?: "blue" | "green" | "amber" | "rose" | "purple";
}

const COLOR_MAP = {
  blue: "text-brand-500 bg-brand-500/10",
  green: "text-emerald-400 bg-emerald-400/10",
  amber: "text-amber-400 bg-amber-400/10",
  rose: "text-rose-400 bg-rose-400/10",
  purple: "text-purple-400 bg-purple-400/10",
};

export function KPICard({ label, value, sub, icon: Icon, trend, color = "blue" }: KPICardProps) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <p className="text-sm text-slate-400 font-medium">{label}</p>
        {Icon && (
          <span className={clsx("p-2 rounded-lg", COLOR_MAP[color])}>
            <Icon size={16} />
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div
          className={clsx(
            "text-xs font-medium flex items-center gap-1",
            trend.value >= 0 ? "text-emerald-400" : "text-rose-400"
          )}
        >
          <span>{trend.value >= 0 ? "▲" : "▼"}</span>
          <span>
            {Math.abs(trend.value)}% {trend.label ?? "vs mes anterior"}
          </span>
        </div>
      )}
    </div>
  );
}
