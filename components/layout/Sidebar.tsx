"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { RoleEnum, type RoleEnumType } from "@/lib/constants";
import {
  LayoutDashboard,
  Car,
  Calendar,
  FileText,
  Users,
  Database,
  ArrowLeftRight,
  Building2,
  Plus,
  Send,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navByRole: Record<string, NavItem[]> = {
  [RoleEnum.JEFE_TALLER]: [
    { href: "/dashboard", label: "Inicio", icon: <LayoutDashboard size={18} /> },
    { href: "/dashboard/stock", label: "Stock", icon: <Car size={18} /> },
    { href: "/dashboard/potencial-venta", label: "Potencial de Venta", icon: <TrendingUp size={18} /> },
    { href: "/dashboard/agendamiento", label: "Agendamiento", icon: <Calendar size={18} /> },
    { href: "/dashboard/reportes", label: "Reportes", icon: <FileText size={18} /> },
    { href: "/dashboard/usuarios", label: "Gestión de Usuarios", icon: <Users size={18} /> },
    { href: "/dashboard/catalogs", label: "Gestión de Información", icon: <Database size={18} /> },
  ],
  [RoleEnum.DOCUMENTACION]: [
    { href: "/dashboard", label: "Inicio", icon: <LayoutDashboard size={18} /> },
    { href: "/dashboard/ingreso-contable", label: "Ingreso Contable", icon: <Plus size={18} /> },
    { href: "/dashboard/matriculacion", label: "Matriculación", icon: <Send size={18} /> },
    { href: "/dashboard/stock", label: "Stock", icon: <Car size={18} /> },
    { href: "/dashboard/documentacion", label: "Documentación", icon: <FileText size={18} /> },
    { href: "/dashboard/cambio-sede", label: "Cambio de Sede", icon: <ArrowLeftRight size={18} /> },
    { href: "/dashboard/cambio-concesionario", label: "Cambio de Concesionario", icon: <Building2 size={18} /> },
  ],
  [RoleEnum.SOPORTE]: [
    { href: "/dashboard", label: "Inicio", icon: <LayoutDashboard size={18} /> },
    { href: "/dashboard/stock", label: "Stock", icon: <Car size={18} /> },
    { href: "/dashboard/agendamiento", label: "Agendamiento", icon: <Calendar size={18} /> },
    { href: "/dashboard/reportes", label: "Reportes", icon: <FileText size={18} /> },
    { href: "/dashboard/usuarios", label: "Gestión de Usuarios", icon: <Users size={18} /> },
    { href: "/dashboard/catalogs", label: "Catálogos", icon: <Database size={18} /> },
  ],
  [RoleEnum.BODEGUERO]: [
    { href: "/dashboard/stock", label: "Stock", icon: <Car size={18} /> },
  ],
};

interface SidebarProps {
  role: RoleEnumType;
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ role, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const items = navByRole[role] ?? navByRole[RoleEnum.JEFE_TALLER];

  return (
    <aside
      className={cn(
        "h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
              title={collapsed ? item.label : undefined}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
