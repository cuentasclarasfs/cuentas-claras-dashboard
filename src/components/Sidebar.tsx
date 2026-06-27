"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  DollarSign,
  Users,
  TrendingUp,
  Megaphone,
  ClipboardList,
  Wallet,
  FileText,
  ChevronRight,
  Gauge,
} from "lucide-react";
import type { Role } from "@/lib/roles";
import { canAccess } from "@/lib/roles";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/dashboard/home",      label: "Dashboard",  icon: LayoutDashboard, section: "home" },
  { href: "/dashboard/resumen",   label: "Resumen",    icon: Gauge,           section: "resumen" },
  { href: "/dashboard/finanzas",  label: "Finanzas",   icon: DollarSign,      section: "finanzas" },
  { href: "/dashboard/clientes",  label: "Clientes",   icon: Users,           section: "clientes" },
  { href: "/dashboard/contenido",      label: "Contenido",      icon: FileText,      section: "contenido"      },
  { href: "/dashboard/setting",        label: "Setting",        icon: Megaphone,     section: "marketing"      },
  { href: "/dashboard/ventas",    label: "Closing",    icon: TrendingUp,      section: "ventas" },
  { href: "/dashboard/administracion", label: "Admin",          icon: ClipboardList, section: "administracion" },
  { href: "/dashboard/patrimonio",     label: "Patrimonio",     icon: Wallet,        section: "patrimonio"     },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => canAccess(role, item.section));

  return (
    <aside className="fixed inset-y-0 left-0 w-[var(--sidebar-width)] bg-surface-900 border-r border-surface-800 flex flex-col z-30">
      <div className="px-5 py-5 border-b border-surface-800">
        <span className="font-heading font-bold text-white text-lg tracking-tight">Cuentas Claras</span>
        <p className="text-xs text-slate-500 mt-0.5">Dashboard interno</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map(({ href, label, icon: Icon, section }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-brand-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-surface-800"
              )}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={13} className="opacity-50" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-surface-800 flex items-center gap-3">
        <UserButton appearance={{ variables: { colorPrimary: "#2B3990" } }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-300 truncate">Mi cuenta</p>
          <p className="text-xs text-slate-500 capitalize">{role}</p>
        </div>
      </div>
    </aside>
  );
}
