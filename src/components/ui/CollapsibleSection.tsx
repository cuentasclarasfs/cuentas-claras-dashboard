"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  variant = "primary",
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (variant === "primary") {
    return (
      <div className="mb-10">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 w-full text-left group mb-3"
        >
          {open
            ? <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />
            : <ChevronRight size={13} className="text-slate-400 flex-shrink-0" />}
          <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">
            {title}
          </span>
        </button>
        {open && <div>{children}</div>}
      </div>
    );
  }

  // secondary — used for each chart sub-section
  return (
    <div className="card mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left group"
      >
        {open
          ? <ChevronDown size={12} className="text-slate-500 flex-shrink-0" />
          : <ChevronRight size={12} className="text-slate-500 flex-shrink-0" />}
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors flex-1">
          {title}
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
