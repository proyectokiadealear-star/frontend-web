"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getVehicles, getSedes, deleteVehicle } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { VehicleCard } from "@/components/vehicles/VehicleCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { RoleEnum, VehicleStatus, VehicleStatusLabel } from "@/lib/constants";
import type { Vehicle, CatalogItem } from "@/types";
import toast from "react-hot-toast";
import { AlertCircle, CheckCircle2, Eye, CalendarRange, X } from "lucide-react";

// ── localStorage key to persist "seen" vehicle IDs for BODEGUERO ──────────────
const SEEN_STORAGE_KEY = "bodeguero_seen_vehicles";

function getSeenVehicles(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function persistSeenVehicles(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

// ── timestamp helpers ─────────────────────────────────────────────────────────
// Uses statusChangedAt (last real pipeline action), falls back to updatedAt for legacy data
function toTimestamp(v: Vehicle): number {
  const u = v.statusChangedAt ?? v.updatedAt;
  if (!u) return 0;
  if (typeof u === "object" && "_seconds" in u) return (u as { _seconds: number })._seconds * 1000;
  const d = new Date(u as string);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

function toDate(v: Vehicle): Date | null {
  const ts = toTimestamp(v);
  return ts ? new Date(ts) : null;
}

// ── sort: unseen first (by updatedAt desc), then seen (by updatedAt desc) ─────
function sortBodeguero(vehicles: Vehicle[], seenIds: Set<string>): Vehicle[] {
  const unseen = vehicles.filter((v) => !seenIds.has(v.id)).sort((a, b) => toTimestamp(b) - toTimestamp(a));
  const seen   = vehicles.filter((v) =>  seenIds.has(v.id)).sort((a, b) => toTimestamp(b) - toTimestamp(a));
  return [...unseen, ...seen];
}

export default function StockPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isBodeguero = user?.role === RoleEnum.BODEGUERO;
  const isJefe =
    user?.role === RoleEnum.JEFE_TALLER || user?.role === RoleEnum.SOPORTE;

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sedes, setSedes] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterSede, setFilterSede] = useState("");
  const [filterStatus, setFilterStatus] = useState(
    isBodeguero ? VehicleStatus.DOCUMENTADO : ""
  );

  // Date range filter (all roles — server-side, applied on statusChangedAt)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Seen IDs — synced with localStorage
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const seenInitialized = useRef(false);

  const limit = 12;

  // Load seen IDs on mount
  useEffect(() => {
    if (!seenInitialized.current) {
      setSeenIds(getSeenVehicles());
      seenInitialized.current = true;
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVehicles({
        chassis: search || undefined,
        sede: filterSede || undefined,
        status: filterStatus || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit,
      });
      const raw: Vehicle[] = res.data.data || [];
      setVehicles(raw);
      setTotal(res.data.total || 0);
    } catch {
      toast.error("Error al cargar el inventario");
    } finally {
      setLoading(false);
    }
  }, [search, filterSede, filterStatus, dateFrom, dateTo, page]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  useEffect(() => {
    getSedes().then((r) => setSedes(r.data)).catch(() => {});
  }, []);

  // ── computed display list ──────────────────────────────────────────────────
  // Sort by statusChangedAt desc (last pipeline action first) for all roles.
  // BODEGUERO additionally splits unseen / seen.
  const displayVehicles = useMemo(() => {
    const list = [...vehicles].sort((a, b) => toTimestamp(b) - toTimestamp(a));

    if (isBodeguero) return sortBodeguero(list, seenIds);
    return list;
  }, [vehicles, seenIds, isBodeguero]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteVehicle(deleteId);
      toast.success("Vehículo eliminado");
      setDeleteId(null);
      fetchVehicles();
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkSeen = useCallback((vehicleId: string) => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      next.add(vehicleId);
      persistSeenVehicles(next);
      return next;
    });
  }, []);

  const handleMarkAllSeen = () => {
    setSeenIds((prev) => {
      const next = new Set(prev);
      displayVehicles.forEach((v) => next.add(v.id));
      persistSeenVehicles(next);
      return next;
    });
    toast.success("Todos los vehículos marcados como vistos");
  };

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  const statusOptions = Object.entries(VehicleStatusLabel).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  const unseenCount = isBodeguero ? displayVehicles.filter((v) => !seenIds.has(v.id)).length : 0;
  const seenCount   = isBodeguero ? displayVehicles.filter((v) =>  seenIds.has(v.id)).length : 0;
  const dateFilterActive = !!(dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        title={isBodeguero ? "Bodega — Documentados" : "Stock de Vehículos"}
        subtitle={
          isBodeguero
            ? "Vehículos documentados · los no revisados aparecen primero"
            : "Inventario activo de todas las sedes"
        }
      />

      {/* ── BODEGUERO: summary bar ─────────────────────────────────────── */}
      {isBodeguero && !loading && displayVehicles.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white border border-gray-200 rounded-xl">
          {unseenCount > 0 ? (
            <div className="flex items-center gap-2 text-red-600 font-medium text-sm">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>
                {unseenCount} vehículo{unseenCount !== 1 ? "s" : ""} sin revisar
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              <span>Todos revisados</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {seenCount > 0 && (
              <span className="text-xs text-gray-400">
                {seenCount} vistos · {unseenCount} nuevos
              </span>
            )}
            {unseenCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleMarkAllSeen}>
                <Eye size={14} className="mr-1" />
                Marcar todos como vistos
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Filters row ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-5">
        <SearchFilterBar
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Buscar por chasis..."
          filters={[
            {
              label: "Sede",
              key: "sede",
              value: filterSede,
              onChange: (v) => { setFilterSede(v); setPage(1); },
              options: sedes.map((s) => ({ value: s.code || s.name, label: s.name })),
            },
            {
              label: "Estado",
              key: "status",
              value: filterStatus,
              onChange: (v) => { setFilterStatus(v); setPage(1); },
              options: statusOptions,
            },
          ]}
        />

        {/* ── Date range filter (all roles — web) ──────────────────────── */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Toggle button */}
          <button
            type="button"
            onClick={() => setShowDateFilter((p) => !p)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showDateFilter || dateFilterActive
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-500 hover:text-gray-900"
            }`}
          >
            <CalendarRange size={15} />
            Filtrar por fecha
            {dateFilterActive && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                activo
              </span>
            )}
          </button>

          {/* Date pickers — shown when expanded */}
          {showDateFilter && (
            <>
              <div className="min-w-[200px]">
                <DateInput
                  label="Desde"
                  value={dateFrom}
                  onChange={(v) => { setDateFrom(v); setPage(1); }}
                  max={dateTo || undefined}
                />
              </div>
              <div className="min-w-[200px]">
                <DateInput
                  label="Hasta"
                  value={dateTo}
                  onChange={(v) => { setDateTo(v); setPage(1); }}
                  min={dateFrom || undefined}
                />
              </div>
              {dateFilterActive && (
                <button
                  type="button"
                  onClick={() => { clearDateFilter(); setPage(1); }}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-500 hover:text-red-600 hover:border-red-300 transition-colors self-end"
                >
                  <X size={13} />
                  Limpiar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonGrid cols={3} rows={2} />
      ) : displayVehicles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <p className="text-sm text-gray-400">
            {dateFilterActive
              ? "Sin vehículos en ese rango de fechas."
              : isBodeguero
                ? "No hay vehículos documentados pendientes."
                : "No se encontraron vehículos."}
          </p>
        </div>
      ) : (
        <>
          {/* Unseen section */}
          {isBodeguero && unseenCount > 0 && (
            <>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Sin revisar — {unseenCount}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                {displayVehicles
                  .filter((v) => !seenIds.has(v.id))
                  .map((v) => (
                    <BodegueroCard
                      key={v.id}
                      vehicle={v}
                      seen={false}
                      onMarkSeen={handleMarkSeen}
                      onClick={() => {
                        handleMarkSeen(v.id);
                        router.push(`/dashboard/stock/${v.id}`);
                      }}
                    />
                  ))}
              </div>
            </>
          )}

          {/* Seen section */}
          {isBodeguero && seenCount > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                Ya revisados — {seenCount}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayVehicles
                  .filter((v) => seenIds.has(v.id))
                  .map((v) => (
                    <BodegueroCard
                      key={v.id}
                      vehicle={v}
                      seen={true}
                      onMarkSeen={handleMarkSeen}
                      onClick={() => router.push(`/dashboard/stock/${v.id}`)}
                    />
                  ))}
              </div>
            </>
          )}

          {/* Normal (non-BODEGUERO) grid */}
          {!isBodeguero && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  onClick={() => router.push(`/dashboard/stock/${v.id}`)}
                  footer={
                    <div className="flex items-center justify-between gap-1">
                      <StatusBadge status={v.status} />
                      <div className="flex gap-1">
                        {(v.status === VehicleStatus.CERTIFICADO_STOCK ||
                          v.status === VehicleStatus.ENVIADO_A_MATRICULAR) &&
                          user?.role === RoleEnum.DOCUMENTACION && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/documentacion/${v.id}`);
                              }}
                            >
                              Documentar
                            </Button>
                          )}
                        {isJefe && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteId(v.id);
                            }}
                            className="text-red-500 hover:bg-red-50"
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    </div>
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      <Pagination page={page} total={total} limit={limit} onChange={setPage} />

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar vehículo"
        description="Esta acción es irreversible. ¿Confirmas la eliminación?"
        confirmLabel="Eliminar"
      />
    </div>
  );
}

// ── Sub-component: card for BODEGUERO mode ────────────────────────────────────
function BodegueroCard({
  vehicle,
  seen,
  onMarkSeen,
  onClick,
}: {
  vehicle: Vehicle;
  seen: boolean;
  onMarkSeen: (id: string) => void;
  onClick: () => void;
}) {
  return (
    <div
      className={`transition-all duration-500 ${seen ? "opacity-60 hover:opacity-100" : ""}`}
    >
      <VehicleCard
        vehicle={vehicle}
        seen={seen}
        showLastModified
        onClick={onClick}
        footer={
          <div className="flex items-center justify-between gap-1">
            <StatusBadge status={vehicle.status} />
            {!seen && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkSeen(vehicle.id);
                }}
                className="text-red-600 border-red-300 hover:bg-red-50 text-xs"
              >
                <Eye size={12} className="mr-1" />
                Visto
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
