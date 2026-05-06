export interface PieSlice { name: string; value: number; color: string; }

const PALETTE = [
  "#6366f1","#10b981","#eab308","#f87171","#8b5cf6",
  "#f59e0b","#3b82f6","#ec4899","#14b8a6","#f97316",
];

export function assignColors(items: { name: string; value: number }[]): PieSlice[] {
  return items.map((it, i) => ({ ...it, color: PALETTE[i % PALETTE.length] }));
}
