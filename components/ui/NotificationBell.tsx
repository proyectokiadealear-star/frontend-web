"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bell,
  FileText,
  ArrowRightLeft,
  MapPin,
  Wrench,
  ClipboardCheck,
  Info,
  CheckCheck,
  RotateCcw,
} from "lucide-react";
import { getNotifications, markNotificationRead } from "@/lib/api";
import type { Notification } from "@/types";
import { cn } from "@/lib/utils";

const POLL_INTERVAL = 60_000;

// ── Type metadata ────────────────────────────────────────────
type TypeMeta = {
  icon: React.ElementType;
  bg: string;
  iconColor: string;
  border: string;
};

const TYPE_META: Record<string, TypeMeta> = {
  DOCUMENTACION: {
    icon: FileText,
    bg: "bg-blue-50",
    iconColor: "text-blue-500",
    border: "border-l-blue-400",
  },
  CESION: {
    icon: ArrowRightLeft,
    bg: "bg-orange-50",
    iconColor: "text-orange-500",
    border: "border-l-orange-400",
  },
  CAMBIO_SEDE: {
    icon: MapPin,
    bg: "bg-purple-50",
    iconColor: "text-purple-500",
    border: "border-l-purple-400",
  },
  SERVICIO: {
    icon: Wrench,
    bg: "bg-yellow-50",
    iconColor: "text-yellow-600",
    border: "border-l-yellow-400",
  },
  CERTIFICACION: {
    icon: ClipboardCheck,
    bg: "bg-green-50",
    iconColor: "text-green-500",
    border: "border-l-green-400",
  },
  REAPERTURA: {
    icon: RotateCcw,
    bg: "bg-red-50",
    iconColor: "text-red-500",
    border: "border-l-red-400",
  },
};

const DEFAULT_META: TypeMeta = {
  icon: Info,
  bg: "bg-gray-50",
  iconColor: "text-gray-400",
  border: "border-l-gray-300",
};

function getMeta(type: string): TypeMeta {
  const key = Object.keys(TYPE_META).find((k) =>
    type.toUpperCase().includes(k)
  );
  return key ? TYPE_META[key] : DEFAULT_META;
}

// ── Time helpers ─────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} d`;
}

// ── Skeleton item ────────────────────────────────────────────
function SkeletonItem() {
  return (
    <div className="flex gap-3 px-4 py-3 border-b border-gray-50 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-gray-100 shrink-0" />
      <div className="flex-1 space-y-1.5 py-0.5">
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="h-2.5 bg-gray-100 rounded w-full" />
        <div className="h-2.5 bg-gray-100 rounded w-4/5" />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getNotifications({ limit: 30, read: false });
      setNotifications(res.data ?? []);
    } catch {
      /* silently fail */
    }
  }, []);

  // Initial fetch + background poll
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Refresh when panel opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    const prev = notifications;
    setNotifications((s) => s.filter((n) => n.id !== id));
    try {
      await markNotificationRead(id);
    } catch {
      setNotifications(prev);
    }
  };

  const handleMarkAllRead = async () => {
    const all = notifications;
    setNotifications([]);
    try {
      await Promise.all(all.map((n) => markNotificationRead(n.id)));
    } catch {
      fetchNotifications();
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
          open ? "bg-gray-100" : "hover:bg-gray-100"
        )}
        aria-label="Notificaciones"
      >
        <Bell
          size={17}
          className={cn(
            "transition-colors",
            unreadCount > 0 ? "text-gray-900" : "text-gray-500"
          )}
        />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-gray-200/80 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Notificaciones
                </span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold leading-none">
                    {unreadCount} nueva{unreadCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <CheckCheck size={12} />
                  Marcar todas
                </button>
              )}
            </div>

            <div className="border-b border-gray-100 -mx-4" />
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <>
                <SkeletonItem />
                <SkeletonItem />
                <SkeletonItem />
              </>
            ) : notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                  <Bell size={20} className="text-gray-300" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-400">Sin notificaciones pendientes</p>
                  <p className="text-xs text-gray-300 mt-0.5">Estás al día</p>
                </div>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = getMeta(n.type);
                const Icon = meta.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleMarkRead(n.id)}
                    className={cn(
                      "w-full text-left flex gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 transition-colors",
                      "border-l-[3px]",
                      cn(meta.border, "hover:bg-gray-50 cursor-pointer")
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        meta.bg
                      )}
                    >
                      <Icon size={14} className={meta.iconColor} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs leading-snug truncate font-semibold text-gray-900">
                          {n.title}
                        </p>
                        <span className="text-[10px] text-gray-300 shrink-0 leading-4">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                      {n.chassis && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500 font-mono">
                          {n.chassis}
                        </span>
                      )}
                    </div>

                    {/* Unread dot */}
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {!loading && unreadCount > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-50 bg-gray-50/50">
              <p className="text-[10px] text-gray-300 text-center">
                {unreadCount} sin leer
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
