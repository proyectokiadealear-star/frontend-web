"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getUserInitials } from "@/lib/utils";
import { RoleLabel } from "@/lib/constants";
import { LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { NotificationBell } from "@/components/ui/NotificationBell";

export function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/login");
    } catch {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-5 flex-shrink-0 z-10">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-gray-900 rounded-sm flex items-center justify-center">
          <span className="text-white text-xs font-bold leading-none">K</span>
        </div>
        <span className="font-bold text-base text-gray-900 tracking-tight">
          KIA Dealer
        </span>
      </div>

      {/* Right: notifications + user menu */}
      <div className="flex items-center gap-2 relative">
        <NotificationBell />

        {/* User menu */}
        <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 hover:bg-gray-50 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {getUserInitials(user?.displayName ?? user?.email ?? "")}
          </div>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-gray-900 max-w-[140px] truncate">
              {user?.displayName || user?.email}
            </span>
            <span className="text-xs text-gray-400">
              {user?.role ? (RoleLabel[user.role] ?? user.role) : ""}
            </span>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.displayName || user?.email}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {user?.sede && user.sede !== "ALL" ? user.sede : "Todas las sedes"}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              >
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          </>
        )}
        </div>{/* /user menu */}
      </div>
    </header>
  );
}
