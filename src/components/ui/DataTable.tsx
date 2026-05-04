"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = false,
  searchKeys = [],
  emptyMessage = "Sin datos",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");

  const filtered =
    searchable && search
      ? data.filter((row) =>
          searchKeys.some((key) =>
            String(row[key] ?? "")
              .toLowerCase()
              .includes(search.toLowerCase())
          )
        )
      : data;

  return (
    <div className="card p-0 overflow-hidden">
      {searchable && (
        <div className="p-4 border-b border-surface-800">
          <div className="relative max-w-sm">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 text-sm bg-surface-800 border border-surface-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-800">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${col.className ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-surface-800/60 hover:bg-surface-800/40 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`px-4 py-3 text-slate-300 ${col.className ?? ""}`}
                    >
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
