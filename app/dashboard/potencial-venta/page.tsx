"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { getVehicles, getSalePotential, getSalePotentialBatch, getSedes } from "@/lib/api";
import type { CatalogItem } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Modal } from "@/components/ui/Modal";
import { VehicleStatus, AccessoryLabel, type AccessoryKeyType } from "@/lib/constants";
import type { Vehicle, SalePotential } from "@/types";
import {
  TrendingUp,
  DollarSign,
  ChevronRight,
  Sparkles,
  Target,
  X,
  BarChart3,
  Zap,
  ArrowUpRight,
  Package,
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
  const [filterSede, setFilterSede] = useState("");
  const [sedeOptions, setSedeOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const PAGE_SIZE = 7;

  // Potencial bruto per vehicle
  const [rateMap, setRateMap] = useState<Record<string, number | null>>({});

  // Detail modal
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [potential, setPotential] = useState<SalePotential | null>(null);
  const [loadingPotential, setLoadingPotential] = useState(false);

  // Load sedes catalog once
  useEffect(() => {
    getSedes()
      .then((res) =>
        setSedeOptions((res.data ?? []).map((s: CatalogItem) => ({ value: s.code || s.name, label: s.name })))
      )
      .catch(() => {});
  }, []);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVehicles({
        chassis: search || undefined,
        status: filterStatus || DEFAULT_STATUSES,
        sede: filterSede || undefined,
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
  }, [search, filterStatus, filterSede, page]);

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

  // Compute sales-relevant KPIs from the rateMap
  const kpis = useMemo(() => {
    const rates = Object.values(rateMap).filter((r): r is number => r != null);
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
    const highOpportunity = rates.filter((r) => r >= 40).length;
    const lowCoverage = rates.filter((r) => r < 20).length;
    return { avgRate, highOpportunity, lowCoverage, totalAnalyzed: rates.length };
  }, [rateMap]);

  return (
    <div>
      <PageHeader
        title="Potencial de Venta"
        subtitle="Identifica oportunidades de venta cruzada de accesorios por vehículo"
      />

      {/* KPIs — focused on sales opportunity insights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg flex-shrink-0 bg-blue-100 text-blue-600">
            <BarChart3 size={18} />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Vehículos analizados
            </span>
            <span className="text-2xl font-bold text-gray-900">{total}</span>
            <span className="text-xs text-gray-400">en esta página: {vehicles.length}</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg flex-shrink-0 bg-amber-100 text-amber-600">
            <TrendingUp size={18} />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Potencial promedio
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {kpis.avgRate.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-400">tasa bruta de oportunidad</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg flex-shrink-0 bg-green-100 text-green-600">
            <Zap size={18} />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Alta oportunidad
            </span>
            <span className="text-2xl font-bold text-gray-900">{kpis.highOpportunity}</span>
            <span className="text-xs text-gray-400">vehículos con ≥ 40% potencial</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-start gap-4">
          <div className="p-2.5 rounded-lg flex-shrink-0 bg-red-100 text-red-600">
            <Target size={18} />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Baja cobertura
            </span>
            <span className="text-2xl font-bold text-gray-900">{kpis.lowCoverage}</span>
            <span className="text-xs text-gray-400">vehículos con &lt; 20% — priorizar</span>
          </div>
        </div>
      </div>

      <SearchFilterBar
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Buscar por chasis, modelo o cliente..."
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
          {
            label: "Sede",
            key: "sede",
            value: filterSede,
            onChange: (v) => {
              setFilterSede(v);
              setPage(1);
            },
            options: sedeOptions,
          },
        ]}
      />

      {/* Vehicle table */}
      {loading ? (
        <SkeletonGrid cols={1} rows={4} />
      ) : vehicles.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-600 mb-1">
            Sin vehículos elegibles
          </p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            No hay vehículos que coincidan con los filtros actuales para analizar potencial de venta.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Vehículo
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
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide min-w-[160px]">
                  Potencial bruto
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map((v) => {
                const rate = rateMap[v.id];
                return (
                  <tr
                    key={v.id}
                    className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    onClick={() => openDetail(v)}
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-gray-900 leading-tight">
                        {v.model}{" "}
                        <span className="text-gray-400 font-normal">· {v.color}</span>
                      </p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                        {v.chassis}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {v.clientName || (
                        <span className="text-gray-300 italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadgeInline status={v.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {v.sede}
                    </td>
                    <td className="px-4 py-3">
                      {rate != null ? (
                        <RateBarInline value={rate} />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 animate-pulse rounded-full max-w-[100px]" />
                          <span className="w-8 h-4 bg-gray-100 animate-pulse rounded" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<ArrowUpRight size={13} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(v);
                        }}
                      >
                        Ver detalle
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} total={total} limit={PAGE_SIZE} onChange={setPage} />

      {/* ─── Detail Modal ──────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={closeDetail}
        title="Análisis de Potencial"
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
            <div className="bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {selected.model}
                  <span className="text-gray-400 font-normal text-base ml-2">
                    {selected.color}
                  </span>
                </p>
                <p className="text-xs text-gray-400 font-mono mt-1">
                  {selected.chassis}
                </p>
                {selected.clientName && (
                  <p className="text-sm text-gray-600 mt-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {selected.clientName}
                  </p>
                )}
              </div>
              <StatusBadgeInline status={selected.status} />
            </div>

            {loadingPotential ? (
              <div className="space-y-3">
                <div className="h-28 bg-gray-100 animate-pulse rounded-xl" />
                <div className="h-44 bg-gray-100 animate-pulse rounded-xl" />
              </div>
            ) : potential ? (
              <>
                {/* Circular gauge + rate cards */}
                <div className="grid grid-cols-[auto_1fr] gap-5">
                  {/* Circular gauge */}
                  <div className="flex flex-col items-center justify-center">
                    <PotentialGauge value={potential.weightedPotentialRate} />
                    <p className="text-[10px] text-gray-400 mt-1.5 text-center font-medium uppercase tracking-wide">
                      Potencial ponderado
                    </p>
                  </div>
                  {/* Rate cards */}
                  <div className="grid grid-rows-3 gap-2.5">
                    <RateCard
                      label="Tasa actual de venta"
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
                </div>

                {/* Accessory distribution bar */}
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Distribución de accesorios
                    <span className="ml-1.5 text-gray-400 normal-case font-normal">
                      ({potential.totalAccessories} en total)
                    </span>
                  </h4>
                  <div className="flex items-center gap-3 mb-4">
                    <BarSegment
                      sold={potential.sold}
                      gifted={potential.gifted}
                      na={potential.notApplicable}
                      total={potential.totalAccessories}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 bg-blue-50/50 rounded-lg px-3 py-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-blue-700">{potential.sold}</p>
                        <p className="text-[10px] text-blue-500">Vendidos</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-violet-50/50 rounded-lg px-3 py-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-violet-700">{potential.gifted}</p>
                        <p className="text-[10px] text-violet-500">Obsequiados</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-gray-600">{potential.notApplicable}</p>
                        <p className="text-[10px] text-gray-400">Sin asignar</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* High potential items */}
                {potential.highPotentialItems.length > 0 ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      Oportunidades detectadas
                      <span className="ml-auto text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-[10px] font-bold normal-case">
                        {potential.highPotentialItems.length} accesorio{potential.highPotentialItems.length > 1 ? "s" : ""}
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {potential.highPotentialItems.map((item) => {
                        const label =
                          AccessoryLabel[item.key.toUpperCase() as AccessoryKeyType] ||
                          item.key;
                        const probColor =
                          item.probability >= 70
                            ? "bg-green-100 text-green-700 border-green-200"
                            : item.probability >= 40
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : "bg-red-50 text-red-600 border-red-200";
                        return (
                          <div
                            key={item.key}
                            className="flex items-center gap-3 p-3.5 rounded-xl bg-gradient-to-r from-amber-50/40 via-white to-white border border-amber-100/80 hover:border-amber-200 transition-colors"
                          >
                            <div
                              className={`flex-shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${probColor}`}
                            >
                              <span className="text-xs font-bold">
                                {item.probability}%
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {label}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                {item.reason}
                              </p>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-1 text-[10px] text-amber-600 font-medium uppercase tracking-wide">
                              <DollarSign size={11} />
                              Oportunidad
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <Sparkles size={18} className="text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-500 font-medium">
                      Sin oportunidades adicionales
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Este vehículo tiene buena cobertura de accesorios.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                <X size={24} className="mx-auto text-red-400 mb-2" />
                <p className="text-sm text-red-600 font-medium">
                  No se pudo cargar el potencial de venta.
                </p>
                <p className="text-xs text-red-400 mt-1">Intenta nuevamente más tarde.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

/** Inline bar + percentage shown in the main table */
function RateBarInline({ value }: { value: number }) {
  const pct = Math.round(value);
  const barColor =
    pct >= 50
      ? "bg-green-500"
      : pct >= 25
      ? "bg-amber-400"
      : "bg-red-400";
  const textColor =
    pct >= 50
      ? "text-green-700"
      : pct >= 25
      ? "text-amber-700"
      : "text-red-600";
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden max-w-[100px]">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums w-8 text-right ${textColor}`}>
        {pct}%
      </span>
    </div>
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

/** SVG circular gauge for the modal */
function PotentialGauge({ value }: { value: number }) {
  const pct = Math.min(Math.round(value), 100);
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  const color =
    pct >= 50 ? "stroke-green-500" : pct >= 25 ? "stroke-amber-400" : "stroke-red-400";

  return (
    <div className="relative w-28 h-28">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          className={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-gray-900">{pct}%</span>
      </div>
    </div>
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
  const styles = {
    blue: "border-blue-100 bg-blue-50/50 text-blue-700",
    amber: "border-amber-100 bg-amber-50/50 text-amber-700",
    green: "border-green-100 bg-green-50/50 text-green-700",
  }[color];

  return (
    <div className={`rounded-lg border ${styles} px-4 py-2.5 flex items-center justify-between`}>
      <div>
        <p className="text-xs font-medium opacity-80">{label}</p>
        <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>
      </div>
      <p className="text-lg font-bold ml-3">{value.toFixed(1)}%</p>
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
    <div className="w-full h-3.5 rounded-full bg-gray-100 overflow-hidden flex">
      {pSold > 0 && (
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${pSold}%` }}
        />
      )}
      {pGifted > 0 && (
        <div
          className="h-full bg-violet-500 transition-all duration-500"
          style={{ width: `${pGifted}%` }}
        />
      )}
      {pNa > 0 && (
        <div
          className="h-full bg-gray-200 transition-all duration-500"
          style={{ width: `${pNa}%` }}
        />
      )}
    </div>
  );
}
