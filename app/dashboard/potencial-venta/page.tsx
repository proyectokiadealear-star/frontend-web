"use client";

import { useEffect, useState, useCallback } from "react";
import { getVehicles, getSalePotential, getSalePotentialBatch } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatsCard } from "@/components/ui/StatsCard";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { VehicleStatus, AccessoryLabel, type AccessoryKeyType } from "@/lib/constants";
import type { Vehicle, SalePotential } from "@/types";
import {
  TrendingUp,
  DollarSign,
  Gift,
  ShoppingCart,
  ChevronRight,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [
  { value: VehicleStatus.DOCUMENTADO, label: "Documentado" },
  { value: VehicleStatus.ORDEN_GENERADA, label: "OT Generada" },
  { value: VehicleStatus.ASIGNADO, label: "Asignado" },
  { value: VehicleStatus.EN_INSTALACION, label: "En Instalación" },
  { value: VehicleStatus.INSTALACION_COMPLETA, label: "Instal. Completa" },
  { value: VehicleStatus.REAPERTURA_OT, label: "Reapertura OT" },
  { value: VehicleStatus.LISTO_PARA_ENTREGA, label: "Listo para Entrega" },
  { value: VehicleStatus.AGENDADO, label: "Agendado" },
];

// Default: ORDEN_GENERADA en adelante
const DEFAULT_STATUSES = [
  VehicleStatus.ORDEN_GENERADA,
  VehicleStatus.ASIGNADO,
  VehicleStatus.EN_INSTALACION,
  VehicleStatus.INSTALACION_COMPLETA,
  VehicleStatus.REAPERTURA_OT,
  VehicleStatus.LISTO_PARA_ENTREGA,
  VehicleStatus.AGENDADO,
].join(",");

export default function PotencialVentaPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState(DEFAULT_STATUSES);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 7;

  // Potencial bruto per vehicle
  const [rateMap, setRateMap] = useState<Record<string, number | null>>({});

  // Detail modal
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [potential, setPotential] = useState<SalePotential | null>(null);
  const [loadingPotential, setLoadingPotential] = useState(false);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVehicles({
        chassis: search || undefined,
        status: filterStatus || DEFAULT_STATUSES,
        page,
        limit: PAGE_SIZE,
      });
      const list: Vehicle[] = res.data.data || [];
      setVehicles(list);
      setTotal(res.data.total || 0);

      // Fetch potentialSaleRate in a single batch call (1 scan instead of N)
      if (list.length > 0) {
        try {
          const batchRes = await getSalePotentialBatch(list.map((v) => v.id));
          const map: Record<string, number | null> = {};
          for (const item of batchRes.data) {
            map[item.vehicleId] = item.potentialSaleRate;
          }
          setRateMap(map);
        } catch {
          setRateMap({});
        }
      } else {
        setRateMap({});
      }
    } catch {
      toast.error("Error al cargar vehículos");
    } finally {
      setLoading(false);
    }
  }, [search, filterStatus, page]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const openDetail = async (v: Vehicle) => {
    setSelected(v);
    setPotential(null);
    setLoadingPotential(true);
    try {
      const res = await getSalePotential(v.id);
      setPotential(res.data);
    } catch {
      toast.error("Error al cargar potencial de venta");
    } finally {
      setLoadingPotential(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setPotential(null);
  };

  // Aggregate simple stats from visible vehicles
  const documented = vehicles.filter(
    (v) => v.status === VehicleStatus.DOCUMENTADO || v.status === VehicleStatus.ORDEN_GENERADA
  ).length;
  const inInstallation = vehicles.filter(
    (v) =>
      v.status === VehicleStatus.ASIGNADO ||
      v.status === VehicleStatus.EN_INSTALACION ||
      v.status === VehicleStatus.INSTALACION_COMPLETA ||
      v.status === VehicleStatus.REAPERTURA_OT
  ).length;
  const ready = vehicles.filter(
    (v) =>
      v.status === VehicleStatus.LISTO_PARA_ENTREGA ||
      v.status === VehicleStatus.AGENDADO
  ).length;

  return (
    <div>
      <PageHeader
        title="Potencial de Venta"
        subtitle="Identifica oportunidades de venta cruzada de accesorios por vehículo"
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatsCard
          label="En documentación / OT"
          value={documented}
          icon={<ShoppingCart size={18} />}
          color="blue"
        />
        <StatsCard
          label="En instalación"
          value={inInstallation}
          icon={<Target size={18} />}
          color="amber"
        />
        <StatsCard
          label="Listos / Agendados"
          value={ready}
          icon={<TrendingUp size={18} />}
          color="green"
        />
      </div>

      <SearchFilterBar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por chasis..."
        filters={[
          {
            label: "Estado",
            key: "status",
            value: filterStatus,
            onChange: (v) => {
              setFilterStatus(v);
              setPage(1);
            },
            options: STATUS_OPTIONS,
          },
        ]}
      />

      {/* Vehicle table */}
      {loading ? (
        <SkeletonGrid cols={1} rows={4} />
      ) : vehicles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Sparkles size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">
            No hay vehículos elegibles para análisis de potencial de venta.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Chasis
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Modelo
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Color
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Cliente
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Estado
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Sede
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  % Bruto
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map((v) => (
                <tr
                  key={v.id}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openDetail(v)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {v.chassis}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {v.model}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.color}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {v.clientName || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadgeInline status={v.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {v.sede}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {rateMap[v.id] != null ? (
                      <RatePill value={rateMap[v.id]!} />
                    ) : (
                      <span className="inline-block w-10 h-4 bg-gray-100 animate-pulse rounded" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<TrendingUp size={13} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(v);
                      }}
                    >
                      Analizar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />

      {/* ─── Detail Modal ──────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={closeDetail}
        title="Potencial de Venta"
        size="lg"
        footer={
          <div className="flex justify-end">
            <Button variant="outline" onClick={closeDetail}>
              Cerrar
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="space-y-6">
            {/* Vehicle header */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-gray-900">
                  {selected.model} — {selected.color}
                </p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {selected.chassis}
                </p>
                {selected.clientName && (
                  <p className="text-xs text-gray-500 mt-1">
                    Cliente: {selected.clientName}
                  </p>
                )}
              </div>
              <StatusBadgeInline status={selected.status} />
            </div>

            {loadingPotential ? (
              <div className="space-y-3">
                <div className="h-24 bg-gray-100 animate-pulse rounded-xl" />
                <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
              </div>
            ) : potential ? (
              <>
                {/* Rate gauges */}
                <div className="grid grid-cols-3 gap-4">
                  <RateCard
                    label="Tasa actual"
                    value={potential.currentSaleRate}
                    sub={`${potential.sold} vendidos + ${potential.gifted} obsequiados`}
                    color="blue"
                  />
                  <RateCard
                    label="Potencial bruto"
                    value={potential.potentialSaleRate}
                    sub={`${potential.notApplicable} accesorios sin asignar`}
                    color="amber"
                  />
                  <RateCard
                    label="Potencial ponderado"
                    value={potential.weightedPotentialRate}
                    sub="Basado en patrones históricos"
                    color="green"
                  />
                </div>

                {/* Donut-style summary */}
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Distribución de accesorios ({potential.totalAccessories} base)
                  </h4>
                  <div className="flex items-center gap-3 mb-3">
                    <BarSegment
                      sold={potential.sold}
                      gifted={potential.gifted}
                      na={potential.notApplicable}
                      total={potential.totalAccessories}
                    />
                  </div>
                  <div className="flex items-center gap-6 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      Vendidos ({potential.sold})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-500" />
                      Obsequiados ({potential.gifted})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                      Sin asignar ({potential.notApplicable})
                    </span>
                  </div>
                </div>

                {/* High potential items */}
                {potential.highPotentialItems.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-4">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      Oportunidades de venta
                    </h4>
                    <div className="space-y-2">
                      {potential.highPotentialItems.map((item) => {
                        const label =
                          AccessoryLabel[item.key.toUpperCase() as AccessoryKeyType] ||
                          item.key;
                        return (
                          <div
                            key={item.key}
                            className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50/60 to-transparent border border-amber-100"
                          >
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                              <span className="text-sm font-bold text-amber-700">
                                {item.probability}%
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {label}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {item.reason}
                              </p>
                            </div>
                            <ChevronRight
                              size={14}
                              className="text-gray-300 flex-shrink-0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-400">
                      No se identificaron oportunidades de venta adicionales para este
                      vehículo.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <X size={24} className="mx-auto text-red-400 mb-2" />
                <p className="text-sm text-red-600">
                  No se pudo cargar el potencial de venta.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function RatePill({ value }: { value: number }) {
  const pct = Math.round(value);
  const color =
    pct >= 50
      ? "bg-green-50 text-green-700"
      : pct >= 25
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
  return (
    <span
      className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}
    >
      {pct}%
    </span>
  );
}

function StatusBadgeInline({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    DOCUMENTADO: "bg-violet-50 text-violet-700",
    ORDEN_GENERADA: "bg-sky-50 text-sky-700",
    ASIGNADO: "bg-sky-100 text-sky-800",
    EN_INSTALACION: "bg-orange-50 text-orange-700",
    INSTALACION_COMPLETA: "bg-green-50 text-green-700",
    REAPERTURA_OT: "bg-red-50 text-red-700",
    LISTO_PARA_ENTREGA: "bg-green-100 text-green-800",
    AGENDADO: "bg-emerald-50 text-emerald-700",
  };
  const labelMap: Record<string, string> = {
    DOCUMENTADO: "Documentado",
    ORDEN_GENERADA: "OT Generada",
    ASIGNADO: "Asignado",
    EN_INSTALACION: "En Instalación",
    INSTALACION_COMPLETA: "Instal. Completa",
    REAPERTURA_OT: "Reapertura",
    LISTO_PARA_ENTREGA: "Listo",
    AGENDADO: "Agendado",
  };
  return (
    <span
      className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${
        colorMap[status] || "bg-gray-100 text-gray-600"
      }`}
    >
      {labelMap[status] || status}
    </span>
  );
}

function RateCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: number;
  sub: string;
  color: "blue" | "amber" | "green";
}) {
  const ring = {
    blue: "border-blue-200 text-blue-700",
    amber: "border-amber-200 text-amber-700",
    green: "border-green-200 text-green-700",
  }[color];
  const bg = {
    blue: "bg-blue-50",
    amber: "bg-amber-50",
    green: "bg-green-50",
  }[color];

  return (
    <div className={`rounded-xl border ${ring} ${bg} p-4 text-center`}>
      <p className="text-2xl font-bold">{value.toFixed(1)}%</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
      <p className="text-[10px] mt-1 opacity-60">{sub}</p>
    </div>
  );
}

function BarSegment({
  sold,
  gifted,
  na,
  total,
}: {
  sold: number;
  gifted: number;
  na: number;
  total: number;
}) {
  const pSold = total > 0 ? (sold / total) * 100 : 0;
  const pGifted = total > 0 ? (gifted / total) * 100 : 0;
  const pNa = total > 0 ? (na / total) * 100 : 0;

  return (
    <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden flex">
      {pSold > 0 && (
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${pSold}%` }}
        />
      )}
      {pGifted > 0 && (
        <div
          className="h-full bg-violet-500 transition-all"
          style={{ width: `${pGifted}%` }}
        />
      )}
      {pNa > 0 && (
        <div
          className="h-full bg-gray-200 transition-all"
          style={{ width: `${pNa}%` }}
        />
      )}
    </div>
  );
}
