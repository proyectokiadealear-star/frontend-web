"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import { getBIDashboardGeneral, getSedes } from "@/lib/api";
import { mapBIDashboardGeneralResponse } from "@/lib/biDashboardGeneral";
import type {
  BIOtifBreakdown,
  BIDashboardGeneralPeriod,
  BIDashboardGeneralSeries,
  BIDashboardGeneralSeriesPoint,
  BIDashboardGeneralVM,
} from "@/lib/biDashboardGeneral";
import type { CatalogItem } from "@/types";
import { VehicleStatusLabel, AccessoryLabel } from "@/lib/constants";
import type { VehicleStatusType, AccessoryKeyType } from "@/lib/constants";
import { RefreshCw, AlertCircle, TrendingUp, X } from "lucide-react";

// ─── Brand constants ─────────────────────────────────────────
const KIA_RED = "#e8382f";
const OBSEQUIADO_COLOR = "#f59e0b";
const OTIF_PASS_COLOR = "#16a34a";
const OTIF_FAIL_COLOR = "#dc2626";
const OTIF_NON_EVALUABLE_COLOR = "#94a3b8";
const TOP_MODELS_LIMIT = 10;

const STATUS_HEX: Record<string, string> = {
  NO_FACTURADO: "#eab308",
  POR_ARRIBAR: "#94a3b8",
  ENVIADO_A_MATRICULAR: "#6366f1",
  CERTIFICADO_STOCK: "#3b82f6",
  DOCUMENTACION_PENDIENTE: "#d97706",
  DOCUMENTADO: "#7c3aed",
  ORDEN_GENERADA: "#0ea5e9",
  ASIGNADO: "#0284c7",
  EN_INSTALACION: "#f97316",
  INSTALACION_COMPLETA: "#22c55e",
  REAPERTURA_OT: "#ef4444",
  LISTO_PARA_ENTREGA: "#16a34a",
  AGENDADO: "#10b981",
  ENTREGADO: "#171717",
  CEDIDO: "#9ca3af",
};

const FALLBACK_NEUTRAL_COLOR = "#94a3b8";

type DashboardBIKpi = { key: string; label: string; value: string; sub?: string };
type TopModelDriverDimension = "sede" | "estado" | "color";

function normalizeModelName(modelName: string): string {
  return modelName.replace(/^KIA\s+/i, "").trim().replace(/\s+/g, " ").toUpperCase();
}


function getSeriesPointsByKeys(
  vm: BIDashboardGeneralVM | null,
  keys: string[],
): BIDashboardGeneralSeriesPoint[] {
  if (!vm?.series?.length) return [];
  const lowerKeys = keys.map((k) => k.toLowerCase());
  for (const item of vm.series) {
    if (lowerKeys.includes(item.kpi_id.toLowerCase()) && item.points?.length) {
      return item.points;
    }
  }
  return [];
}

function getStatusLabel(statusKey: string): string {
  return VehicleStatusLabel[statusKey as VehicleStatusType] ?? statusKey;
}

function getStatusColor(statusKey: string): string {
  return STATUS_HEX[statusKey] ?? FALLBACK_NEUTRAL_COLOR;
}

function getAccessoryDisplayName(rawKey: string): string {
  const normalized = rawKey.toUpperCase() as AccessoryKeyType;
  if (AccessoryLabel[normalized]) return AccessoryLabel[normalized];
  return rawKey
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// ─── Funnel pipeline order ───────────────────────────────────
const FUNNEL_ORDER: VehicleStatusType[] = [
  "NO_FACTURADO",
  "POR_ARRIBAR",
  "ENVIADO_A_MATRICULAR",
  "CERTIFICADO_STOCK",
  "DOCUMENTACION_PENDIENTE",
  "DOCUMENTADO",
  "ORDEN_GENERADA",
  "ASIGNADO",
  "EN_INSTALACION",
  "INSTALACION_COMPLETA",
  "REAPERTURA_OT",
  "LISTO_PARA_ENTREGA",
  "AGENDADO",
  "ENTREGADO",
  "CEDIDO",
];

// ─── Date helpers ────────────────────────────────────────────
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function startOfCurrentMonthISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function ytdISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-01-01`;
}
function isoToDisplay(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTrendLabel(label: string, granularity: string): string {
  if (granularity === "day") {
    const d = new Date(`${label}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
    }
    return label;
  }

  if (granularity === "month") {
    const d = new Date(`${label}-01T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("es-EC", { month: "short", year: "2-digit" });
    }
    return label;
  }

  if (granularity === "week") {
    const match = /^(\d{4})-W(\d{2})$/.exec(label);
    if (!match) return label;
    return `S${match[2]} ${match[1]}`;
  }

  return label;
}

function granularityToText(period: BIDashboardGeneralPeriod): string {
  if (period === "day") return "Diario";
  if (period === "week") return "Semanal";
  return "Mensual";
}

// ─── Sub-components ──────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="w-1 h-4 rounded-full shrink-0" style={{ background: KIA_RED }} />
      <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
        {children}
      </span>
    </div>
  );
}

function BICard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-5 overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

function KpiBlock({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50 truncate">
        {label}
      </span>
      <span
        className="font-bebas text-5xl leading-none text-white mt-1"
        style={{ letterSpacing: "0.03em" }}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-white/50 mt-1 truncate">{sub}</span>}
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; fill?: string }[];
  label?: string;
}
function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs">
      {label && <p className="font-semibold text-gray-700 mb-1 truncate max-w-[160px]">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: p.color ?? p.fill ?? KIA_RED }}
          />
          <span className="text-gray-600 truncate max-w-[120px]">{p.name}:</span>
          <span className="font-bold text-gray-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton placeholder ─────────────────────────────────────
function ChartSkeleton({ h = 220 }: { h?: number }) {
  return (
    <div
      className="w-full rounded-lg bg-gray-100 animate-pulse"
      style={{ height: h }}
    />
  );
}

function FilterChip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur text-white text-xs font-medium rounded-full px-3 py-1 border border-white/20">
      <span className="text-white/50">{label}:</span>
      <span>{value}</span>
      <button onClick={onClear} className="hover:bg-white/20 rounded-full p-0.5 transition-colors cursor-pointer">
        <X size={10} />
      </button>
    </span>
  );
}

function OtifBreakdownCard({ otif }: { otif: BIOtifBreakdown }) {
  const total = Math.max(otif.totalDeliveriesInPeriod, 1);
  const passPct = (otif.passed / total) * 100;
  const failPct = (otif.failed / total) * 100;
  const nonEvaluablePct = (otif.noEvaluable / total) * 100;
  const reasons = [
    { key: "late", label: "Entrega fuera de fecha pactada", value: otif.failureReasons.late },
    { key: "incomplete_docs", label: "Documentación incompleta", value: otif.failureReasons.incomplete_docs },
    { key: "incomplete_accessories", label: "Accesorios pendientes", value: otif.failureReasons.incomplete_accessories },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">OTIF</p>
          <p className="text-2xl font-bold text-gray-900">{otif.valuePct == null ? "-" : `${otif.valuePct.toFixed(1)}%`}</p>
        </div>
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Entregas OTIF / Entregas evaluadas</p>
          <p className="text-base font-semibold text-gray-900">{otif.numerator}/{otif.denominator}</p>
        </div>
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Entregas en período</p>
          <p className="text-base font-semibold text-gray-900">{otif.totalDeliveriesInPeriod}</p>
        </div>
        <div className="rounded-lg border border-gray-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Sin datos suficientes</p>
          <p className="text-base font-semibold text-gray-900">{otif.noEvaluable}</p>
        </div>
      </div>

      <div>
        <p className="text-[11px] text-gray-500 mb-2">Composición OTIF sobre entregas del período</p>
        <div className="h-3 w-full rounded-full overflow-hidden bg-gray-100 flex">
          <div style={{ width: `${passPct}%`, background: OTIF_PASS_COLOR }} title={`Cumple OTIF: ${otif.passed}`} />
          <div style={{ width: `${failPct}%`, background: OTIF_FAIL_COLOR }} title={`No cumple OTIF: ${otif.failed}`} />
          <div style={{ width: `${nonEvaluablePct}%`, background: OTIF_NON_EVALUABLE_COLOR }} title={`Sin datos suficientes: ${otif.noEvaluable}`} />
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: OTIF_PASS_COLOR }} />Cumple: {otif.passed}</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: OTIF_FAIL_COLOR }} />No cumple: {otif.failed}</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: OTIF_NON_EVALUABLE_COLOR }} />Sin datos suficientes: {otif.noEvaluable}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 px-3 py-3">
          <p className="text-xs font-semibold text-gray-800 mb-2">Cobertura de datos</p>
          <p className="text-xs text-gray-600">Sin fecha pactada: <span className="font-semibold text-gray-900">{otif.missingPromisedDate}</span></p>
          <p className="text-xs text-gray-600 mt-1">Datos insuficientes (docs/checklist): <span className="font-semibold text-gray-900">{otif.insufficientData}</span></p>
          <p className="text-xs text-gray-400 mt-2">Evaluables: {otif.totalDeliveriesEvaluable} de {otif.totalDeliveriesInPeriod}</p>
        </div>
        <div className="rounded-lg border border-gray-200 px-3 py-3">
          <p className="text-xs font-semibold text-gray-800 mb-2">Causas principales de no cumplimiento</p>
          {!reasons.length ? (
            <p className="text-xs text-gray-500">Sin causas de fail en el período.</p>
          ) : (
            <div className="space-y-2">
              {reasons.map((reason) => {
                const width = otif.failed > 0 ? Math.max((reason.value / otif.failed) * 100, 8) : 0;
                return (
                  <div key={reason.key}>
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-0.5">
                      <span>{reason.label}</span>
                      <span className="font-semibold text-gray-900">{reason.value}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${width}%`, background: OTIF_FAIL_COLOR }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────
export function DashboardBI() {
  const [sede, setSede] = useState("");
  const [dateFrom, setDateFrom] = useState(startOfCurrentMonthISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [granularity, setGranularity] = useState<BIDashboardGeneralPeriod>("day");
  const [activeModel, setActiveModel] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [data, setData] = useState<BIDashboardGeneralVM | null>(null);
  const [topModelInsights, setTopModelInsights] = useState<BIDashboardGeneralVM | null>(null);
  const [topModelInsightsLoading, setTopModelInsightsLoading] = useState(false);
  const [topModelDriverDimension, setTopModelDriverDimension] = useState<TopModelDriverDimension>("sede");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // [M6] Dynamic sedes list
  const [sedeOptions, setSedeOptions] = useState<CatalogItem[]>([]);
  // [Me5] Debounce ref for date inputs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userModifiedDatesRef = useRef(false);
  const currentMonthRef = useRef(monthKey(new Date()));

  // Load sedes catalog once on mount [M6]
  useEffect(() => {
    getSedes()
      .then((res) => setSedeOptions(res.data))
      .catch(() => {
        // Fallback to static list if catalog endpoint fails
        setSedeOptions([
          { id: "SURMOTOR", name: "SURMOTOR", code: "SURMOTOR" },
          { id: "SHYRIS", name: "SHYRIS", code: "SHYRIS" },
          { id: "GRANADAS_CENTENOS", name: "GRANADAS CENTENOS", code: "GRANADAS_CENTENOS" },
        ]);
      });
  }, []);

  const fetchBI = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getBIDashboardGeneral({
        period: granularity,
        groupBy: granularity,
        from: dateFrom,
        to: dateTo,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        filters: {
          branchId: sede || undefined,
        },
      });
      setData(mapBIDashboardGeneralResponse(res.data));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sede, dateFrom, dateTo, granularity]);

  // [Me5] Debounce: only trigger fetchBI 600ms after the last state change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchBI();
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchBI]);

  useEffect(() => {
    const syncDefaultDateRange = () => {
      const now = new Date();
      const detectedMonth = monthKey(now);
      if (detectedMonth === currentMonthRef.current) return;
      currentMonthRef.current = detectedMonth;
      if (userModifiedDatesRef.current) return;
      setDateFrom(startOfCurrentMonthISO());
      setDateTo(todayISO());
    };

    const intervalId = setInterval(syncDefaultDateRange, 60000);
    syncDefaultDateRange();

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleModelClick = (modelName: string) => {
    setActiveModel((prev) => (prev === modelName ? "" : modelName));
  };

  // REQ-BI-06: clicking a status row/bar toggles inline drill-down panel (no re-fetch)
  const handleStatusClick = (statusKey: string) => {
    setActiveStatus((prev) => (prev === statusKey ? "" : statusKey));
  };

  const normalizedData = data;

  const dashboardKpis = useMemo<DashboardBIKpi[]>(() => {
    if (!normalizedData?.kpis?.length) return [];
    return normalizedData.kpis.slice(0, 5).map((kpi) => ({
      key: kpi.id,
      label: kpi.label,
      value: kpi.formatted_value,
      sub: kpi.subtitle,
    }));
  }, [normalizedData]);

  const seriesByKey = useMemo<Map<string, BIDashboardGeneralSeries>>(() => {
    const entries: Array<[string, BIDashboardGeneralSeries]> =
      normalizedData?.series?.map((s) => [s.kpi_id.toLowerCase(), s]) ?? [];
    return new Map<string, BIDashboardGeneralSeries>(entries);
  }, [normalizedData]);

  const getPointsBySeriesKeys = useCallback((keys: string[]): BIDashboardGeneralSeriesPoint[] => {
    for (const key of keys) {
      const points = seriesByKey.get(key)?.points;
      if (points?.length) return points;
    }
    return [];
  }, [seriesByKey]);

  const getSeriesByKeys = useCallback((keys: string[]): BIDashboardGeneralSeries | null => {
    for (const key of keys) {
      const found = seriesByKey.get(key);
      if (found) return found;
    }
    return null;
  }, [seriesByKey]);

  const mainSeries = useMemo<BIDashboardGeneralSeriesPoint[]>(() => {
    return getPointsBySeriesKeys(["pipeline_status", "pipeline"]);
  }, [getPointsBySeriesKeys]);

  // ── Derived data ──────────────────────────────────────────
  // REQ-BI-01: always show all 15 pipeline statuses (including those with 0 vehicles)
  const funnelData = useMemo(() => {
    if (!mainSeries.length) return [];
    return mainSeries
      .map((point, idx) => {
        const fallbackKey = FUNNEL_ORDER[idx] ?? point.t;
        return {
          key: fallbackKey,
          name: point.t,
          value: point.value,
          fill: getStatusColor(fallbackKey),
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [mainSeries]);

  const maxFunnel = useMemo(
    () => funnelData.reduce((max, s) => Math.max(max, s.value), 0) || 1,
    [funnelData]
  );

  const modelData = useMemo(() => {
    const points = getPointsBySeriesKeys(["by_model", "models"]);
    if (!points.length) return [];
    const sanitized = points
      .filter((point) => point.value > 0)
      .map((point) => ({
        name: point.t.replace(/^KIA\s+/i, "").trim(),
        value: point.value,
      }))
      .sort((a, b) => b.value - a.value);

    const total = sanitized.reduce((sum, item) => sum + item.value, 0);
    const max = sanitized[0]?.value ?? 1;

    return sanitized.slice(0, TOP_MODELS_LIMIT).map((item, index) => {
      const isActive = activeModel === item.name;
      return {
        rank: index + 1,
        name: item.name,
        value: item.value,
        sharePct: total > 0 ? (item.value / total) * 100 : 0,
        widthPct: max > 0 ? Math.round((item.value / max) * 100) : 0,
        fill: activeModel && !isActive ? "#e5e7eb" : KIA_RED,
      };
    });
  }, [getPointsBySeriesKeys, activeModel]);

  const topModelTotalVolume = useMemo(() => {
    return modelData.reduce((sum, item) => sum + item.value, 0);
  }, [modelData]);

  const topModelOptions = useMemo(() => modelData.map((item) => item.name), [modelData]);

  const modelFilterOptions = useMemo(() => {
    if (!activeModel || topModelOptions.includes(activeModel)) return topModelOptions;
    return [activeModel, ...topModelOptions];
  }, [activeModel, topModelOptions]);

  const selectedTopModel = useMemo(() => {
    if (!modelData.length) return null;
    return modelData.find((item) => item.name === activeModel) ?? modelData[0];
  }, [modelData, activeModel]);

  const topModelName = selectedTopModel?.name ?? "";
  const focusedModelName = activeModel || topModelName;

  const accessoryOverview = useMemo(() => {
    const accessories = normalizedData?.accessories;
    if (!accessories) {
      return {
        list: [] as Array<{
          key: string;
          name: string;
          Vendido: number;
          Obsequiado: number;
          NoAplica: number;
        }>,
        totalAccessories: 0,
        rankedAccessories: 0,
        totalVendido: 0,
        totalObsequiado: 0,
        totalNoAplica: 0,
      };
    }

    const byKeyEntries = Object.entries(accessories.byKey ?? {}).map(([rawKey, counters]) => {
      return {
        key: rawKey,
        name: getAccessoryDisplayName(rawKey),
        Vendido: counters?.VENDIDO ?? 0,
        Obsequiado: counters?.OBSEQUIADO ?? 0,
        NoAplica: counters?.NO_APLICA ?? 0,
      };
    });

    const list = [...byKeyEntries].sort((a, b) => {
      const totalA = a.Vendido + a.Obsequiado + a.NoAplica;
      const totalB = b.Vendido + b.Obsequiado + b.NoAplica;
      if (totalB !== totalA) return totalB - totalA;
      return a.name.localeCompare(b.name, "es");
    });

    const computedTotalVendido = byKeyEntries.reduce((sum, item) => sum + item.Vendido, 0);
    const computedTotalObsequiado = byKeyEntries.reduce((sum, item) => sum + item.Obsequiado, 0);
    const computedTotalNoAplica = byKeyEntries.reduce((sum, item) => sum + item.NoAplica, 0);

    return {
      list,
      totalAccessories: byKeyEntries.length,
      rankedAccessories: list.length,
      totalVendido: accessories.totalVendido ?? computedTotalVendido,
      totalObsequiado: accessories.totalObsequiado ?? computedTotalObsequiado,
      totalNoAplica: accessories.totalNoAplica ?? computedTotalNoAplica,
    };
  }, [normalizedData]);

  const rotationChartData = useMemo(() => {
    const points = getPointsBySeriesKeys(["model_rotation_avg_days", "rotation"]);
    if (!points.length) return [];
    return points
      .map((p) => ({ name: p.t, avgDays: p.value, count: 0 }))
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 8);
  }, [getPointsBySeriesKeys]);

  const trendSeries = useMemo(() => {
    return getSeriesByKeys(["monthly_deliveries", "deliveries_trend"]);
  }, [getSeriesByKeys]);

  useEffect(() => {
    if (!focusedModelName) {
      setTopModelInsights(null);
      return;
    }

    let alive = true;

    const loadTopModelInsights = async () => {
      setTopModelInsightsLoading(true);
      try {
        const response = await getBIDashboardGeneral({
          period: granularity,
          groupBy: granularity,
          from: dateFrom,
          to: dateTo,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          filters: {
            branchId: sede || undefined,
            channel: focusedModelName,
          },
        });

        if (!alive) return;
        setTopModelInsights(mapBIDashboardGeneralResponse(response.data));
      } catch {
        if (!alive) return;
        setTopModelInsights(null);
      } finally {
        if (alive) setTopModelInsightsLoading(false);
      }
    };

    loadTopModelInsights();

    return () => {
      alive = false;
    };
  }, [focusedModelName, dateFrom, dateTo, granularity, sede]);

  const topModelDrivers = useMemo(() => {
    if (!topModelInsights) return [];

    if (topModelDriverDimension === "sede") {
      return getSeriesPointsByKeys(topModelInsights, ["by_sede", "sedes"]).map((point) => ({
        key: point.t,
        label: point.t,
        value: point.value,
      })).sort((a, b) => b.value - a.value).slice(0, 8);
    }

    if (topModelDriverDimension === "estado") {
      return getSeriesPointsByKeys(topModelInsights, ["pipeline_status", "pipeline"]).map((point) => ({
        key: point.t,
        label: getStatusLabel(point.t),
        value: point.value,
      })).sort((a, b) => b.value - a.value).slice(0, 8);
    }

    return getSeriesPointsByKeys(topModelInsights, ["by_color", "colors"]).map((point) => ({
      key: point.t,
      label: point.t,
      value: point.value,
    })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [topModelInsights, topModelDriverDimension]);

  const topModelDeliveryPeriods = useMemo(() => {
    if (!topModelInsights) return [];
    const points = getSeriesPointsByKeys(topModelInsights, ["monthly_deliveries", "deliveries_trend"]);
    if (!points.length) return [];

    return points
      .filter((point) => point.value > 0)
      .slice(-8)
      .map((point) => ({
        key: point.t,
        periodLabel: formatTrendLabel(point.t, granularity),
        value: point.value,
      }));
  }, [topModelInsights, granularity]);

  const otifBreakdown = normalizedData?.otifBreakdown;

  const registrationBacklog = useMemo(() => {
    const pendingReception = normalizedData?.registrationBacklog?.pendingReception ?? 0;
    const porArribar = normalizedData?.registrationBacklog?.porArribar ?? 0;
    const pendingToRegister = normalizedData?.registrationBacklog?.pendingToRegister
      ?? (pendingReception + porArribar);

    return {
      pendingToRegister,
      porArribar,
      pendingReception,
    };
  }, [normalizedData]);

  const trendChartData = useMemo(() => {
    if (!trendSeries?.points?.length) return [];
    return trendSeries.points.map((point) => ({
      t: point.t,
      label: formatTrendLabel(point.t, trendSeries.granularity),
      value: point.value,
    }));
  }, [trendSeries]);

  // ── Loading / Error ────────────────────────────────────────
  const showSkeleton = loading || error;

  // ── Render ─────────────────────────────────────────────────
  return (
    <section className="mt-4">
      {/* ── Dark banner ──────────────────────────────────── */}
      <div
        className="rounded-2xl px-6 py-6"
        style={{ background: "#0f172a" }}
      >
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={18} className="text-white/60 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Business Intelligence
              </p>
              <h2 className="text-base font-bold text-white leading-tight">
                Análisis de Rendimiento
              </h2>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as BIDashboardGeneralPeriod)}
              className="text-xs bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
            >
              <option value="day" className="text-gray-900">Diario</option>
              <option value="week" className="text-gray-900">Semanal</option>
              <option value="month" className="text-gray-900">Mensual</option>
            </select>

            <select
              value={sede}
              onChange={(e) => setSede(e.target.value)}
              className="text-xs bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
            >
              <option value="" className="text-gray-900">Todas las sedes</option>
              {sedeOptions.map((s) => (
                <option key={s.code ?? s.id} value={s.code ?? s.id} className="text-gray-900">
                  {s.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => {
                userModifiedDatesRef.current = true;
                setDateFrom(e.target.value);
              }}
              className="text-xs bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
            />
            <span className="text-white/40 text-xs shrink-0">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayISO()}
              onChange={(e) => {
                userModifiedDatesRef.current = true;
                setDateTo(e.target.value);
              }}
              className="text-xs bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
            />

            {/* Date preset pills */}
            <div className="flex items-center gap-1">
              {([
                { label: "7d", days: 7 },
                { label: "30d", days: 30 },
                { label: "90d", days: 90 },
              ] as const).map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    userModifiedDatesRef.current = true;
                    setDateFrom(daysAgoISO(p.days));
                    setDateTo(todayISO());
                  }}
                  className="text-[10px] font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-md px-2 py-1 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => {
                  userModifiedDatesRef.current = true;
                  setDateFrom(ytdISO());
                  setDateTo(todayISO());
                }}
                className="text-[10px] font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-md px-2 py-1 transition-colors cursor-pointer"
              >
                YTD
              </button>
            </div>

            <button
              onClick={() => {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                fetchBI();
              }}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Range label + active filters */}
        <div className="flex flex-wrap items-center gap-2 mb-5 -mt-2">
          <p className="text-[10px] text-white/30">
            {isoToDisplay(dateFrom)} — {isoToDisplay(dateTo)}
            {` · ${granularityToText(granularity)}`}
            {sede ? ` · ${sede}` : " · Todas las sedes"}
          </p>
          {(activeStatus || sede) && (
            <span className="text-white/20 text-[10px]">|</span>
          )}
          {sede && (
            <FilterChip label="Sede" value={sede} onClear={() => setSede("")} />
          )}
          {activeStatus && (() => {
            const label = getStatusLabel(activeStatus);
            return (
              <FilterChip label="Estado" value={label} onClear={() => setActiveStatus("")} />
            );
          })()}
          {(activeStatus || sede) && (
            <button
              onClick={() => { setActiveStatus(""); setSede(""); }}
              className="text-[10px] text-white/40 hover:text-white/70 underline cursor-pointer"
            >
              Limpiar todos
            </button>
          )}
        </div>

        {/* Macro KPIs */}
        {showSkeleton ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                <div className="h-10 w-16 rounded bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-white/60">
            <AlertCircle size={16} />
            <span className="text-sm">Error al cargar los datos.</span>
            <button
              onClick={fetchBI}
              className="text-xs underline cursor-pointer hover:text-white"
            >
              Reintentar
            </button>
          </div>
          ) : normalizedData ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
              {dashboardKpis.length > 0 ? (
                dashboardKpis.map((kpi) => (
                  <KpiBlock key={kpi.key} label={kpi.label} value={kpi.value} sub={kpi.sub} />
                ))
              ) : (
                <>
                  <KpiBlock label="Sin KPIs" value="—" sub="Respuesta sin KPIs" />
                  <KpiBlock label="—" value="—" />
                  <KpiBlock label="—" value="—" />
                  <KpiBlock label="—" value="—" />
                  <KpiBlock label="—" value="—" />
                </>
              )}
            </div>
          ) : null}
      </div>

      {/* Matriculacion */}
      {!showSkeleton && (
        <div className="mt-5">
          <BICard>
            <SectionHeader>Matriculacion</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Pendientes</p>
                <p className="text-3xl leading-none font-semibold text-amber-900 mt-1 tabular-nums">
                  {registrationBacklog.pendingToRegister.toLocaleString("es-EC")}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Por matricular</p>
                <p className="text-3xl leading-none font-semibold text-slate-900 mt-1 tabular-nums">
                  {registrationBacklog.porArribar.toLocaleString("es-EC")}
                </p>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-700">Recepcion matr.</p>
                <p className="text-3xl leading-none font-semibold text-sky-900 mt-1 tabular-nums">
                  {registrationBacklog.pendingReception.toLocaleString("es-EC")}
                </p>
              </div>
            </div>
          </BICard>
        </div>
      )}

      {!showSkeleton && !!otifBreakdown && (
        <div className="mt-5">
          <BICard>
            <SectionHeader>Desglose OTIF</SectionHeader>
            <p className="text-[10px] text-gray-400 -mt-3 mb-3">
              OTIF muestra el porcentaje de entregas que se realizaron en fecha pactada y completas.
            </p>
            <OtifBreakdownCard otif={otifBreakdown} />
          </BICard>
        </div>
      )}

      {/* Tendencia entregas */}
      <div className="mt-5">
        <BICard>
          <SectionHeader>Tendencia de entregas</SectionHeader>
          <p className="text-[10px] text-gray-400 -mt-3 mb-3">
            Serie {trendSeries ? granularityToText(trendSeries.granularity as BIDashboardGeneralPeriod).toLowerCase() : granularityToText(granularity).toLowerCase()} en el periodo filtrado
          </p>
          {showSkeleton ? (
            <ChartSkeleton h={220} />
          ) : !trendChartData.length ? (
            <p className="text-sm text-gray-400 text-center py-12">Sin tendencia disponible</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendChartData} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} labelFormatter={(_, payload) => payload?.[0]?.payload?.t ?? ""} />
                <Bar dataKey="value" name="Entregas" fill={KIA_RED} radius={[4, 4, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </BICard>
      </div>

      {/* ── Section 2: Embudo ─────────────────────────────── */}
      <div className="mt-5">
        <BICard>
          <SectionHeader>Embudo de flujo vehicular</SectionHeader>
          {/* REQ-DATE-06: explain that the funnel shows active inventory, not period activity */}
          <p className="text-[10px] text-gray-400 -mt-3 mb-3">
            Muestra todos los vehículos activos en inventario (sin filtro de fecha).
            Las métricas de entrega sí aplican el rango seleccionado.
          </p>
          {showSkeleton ? (
            <ChartSkeleton h={320} />
          ) : !funnelData.length ? (
            <p className="text-sm text-gray-400 text-center py-16">Sin datos de flujo</p>
          ) : (
            <div className="space-y-1">
              {funnelData.map((step) => {
                const pct = Math.max((step.value / maxFunnel) * 100, 14);
                const isActive = activeStatus === step.key;
                return (
                  <div key={step.key} className="flex flex-col items-center">
                    <div
                      className="h-7 rounded-sm flex items-center justify-between px-3 transition-all duration-700 cursor-pointer"
                      style={{
                        width: `${pct}%`,
                        background: step.fill,
                        minWidth: 140,
                        opacity: activeStatus && !isActive ? 0.45 : 1,
                        outline: isActive ? "2px solid white" : "none",
                      }}
                      title={`${step.name}: ${step.value} — click para drill-down`}
                      onClick={() => handleStatusClick(step.key)}
                    >
                      <span className="text-[10px] font-medium text-white truncate">
                        {step.name}
                      </span>
                      <span className="text-[11px] font-bold text-white ml-2 shrink-0 tabular-nums">
                        {step.value}
                      </span>
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-gray-400 text-center mt-3">
                Ingreso → Proceso → Entrega · Click para filtrar
              </p>
            </div>
          )}
        </BICard>
      </div>

      {/* ── Section 3: Top modelos ────────────────────────── */}
      <div className="mt-5">
        <BICard>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4">
              <SectionHeader>Top modelos</SectionHeader>
              <p className="text-[10px] text-gray-400 -mt-3 mb-4">
                Ranking de modelos por entregas y participación en el período seleccionado.
              </p>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">Modelo</span>
                <select
                  value={activeModel}
                  onChange={(e) => setActiveModel(e.target.value)}
                  disabled={showSkeleton || !modelData.length}
                  className="text-[11px] bg-white border border-gray-200 text-gray-700 rounded-md px-2 py-1 focus:outline-none disabled:opacity-60"
                >
                  <option value="">Todos los modelos</option>
                  {modelFilterOptions.map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
                {activeModel && (
                  <button
                    onClick={() => setActiveModel("")}
                    className="text-[10px] text-gray-500 hover:text-gray-700 underline cursor-pointer"
                  >
                    Quitar
                  </button>
                )}
              </div>

              {showSkeleton ? (
                <div className="space-y-2">
                  <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                </div>
              ) : !modelData.length ? (
                <p className="text-sm text-gray-400 py-6">Sin datos comparables</p>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500">Insight principal</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1">
                    #{selectedTopModel?.rank ?? 1} {selectedTopModel?.name}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 leading-none mt-1">
                    {selectedTopModel?.value ?? 0}
                    <span className="text-sm font-medium text-gray-500 ml-1">entregas</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Participación: {(selectedTopModel?.sharePct ?? 0).toFixed(1)}% del total del ranking ({topModelTotalVolume.toLocaleString("es-EC")})
                  </p>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500">
                      Días con entregas de este modelo (en el período filtrado)
                    </p>
                    {showSkeleton || topModelInsightsLoading ? (
                      <p className="text-xs text-gray-400 mt-1">Cargando detalle...</p>
                    ) : !topModelDeliveryPeriods.length ? (
                      <p className="text-xs text-gray-500 mt-1">No hay días con entregas registradas para este modelo.</p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {topModelDeliveryPeriods.map((item) => (
                          <div key={item.key} className="flex items-center justify-between text-[11px] text-gray-600">
                            <span>{item.periodLabel}</span>
                            <span className="font-semibold text-gray-900">{item.value} entregas</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-8">
              {showSkeleton ? (
                <div className="space-y-2 mt-3 lg:mt-0">
                  {[1,2,3,4,5,6,7,8].map((i) => (
                    <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : !modelData.length ? (
                <p className="text-sm text-gray-400 text-center py-16">Sin datos</p>
              ) : (
                <div className="space-y-1.5 mt-2 lg:mt-0">
                  {modelData.map((item) => {
                    const isActive = activeModel === item.name;
                    return (
                      <div
                        key={item.name}
                        onClick={() => handleModelClick(item.name)}
                        className="group py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        style={{ opacity: activeModel && !isActive ? 0.45 : 1 }}
                      >
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span
                            className="text-[11px] font-medium truncate"
                            style={{ color: isActive ? KIA_RED : "#374151" }}
                          >
                            #{item.rank} {item.name}
                          </span>
                          <span className="text-[11px] text-gray-500 tabular-nums shrink-0">
                            <span className="font-bold text-gray-800">{item.value}</span>
                            <span className="text-gray-400 ml-1">({item.sharePct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(item.widthPct, 8)}%`, background: item.fill }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="max-w-3xl">
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-[11px] font-semibold text-gray-700">
                  Factores de desempeño del modelo {focusedModelName || "líder"}
                </p>
                <select
                  value={topModelDriverDimension}
                  onChange={(e) => setTopModelDriverDimension(e.target.value as TopModelDriverDimension)}
                  className="text-[11px] bg-white border border-gray-200 text-gray-700 rounded-md px-2 py-1 focus:outline-none"
                >
                  <option value="sede">Sede / Región</option>
                  <option value="estado">Etapa del proceso</option>
                  <option value="color">Preferencia de color</option>
                </select>
              </div>

              {showSkeleton || topModelInsightsLoading ? (
                <div className="space-y-2">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="h-7 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : !topModelDrivers.length ? (
                <p className="text-sm text-gray-400 text-center py-12">Sin drivers disponibles</p>
              ) : (
                <div className="space-y-1.5">
                  {topModelDrivers.map((item) => {
                    const max = topModelDrivers[0]?.value || 1;
                    const pct = Math.round((item.value / max) * 100);
                    return (
                      <div key={item.key} className="py-1 px-2 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <span className="text-[11px] text-gray-700 truncate">{item.label}</span>
                          <span className="text-[11px] font-semibold text-gray-800 tabular-nums">{item.value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 8)}%`, background: "#0f172a" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </BICard>
      </div>

      {/* ── Section 4: Accesorios ─────────────────────────── */}
      <div className="mt-5">
        <BICard>
          <SectionHeader>Accesorios documentados</SectionHeader>
          <p className="text-[10px] text-gray-400 -mt-3 mb-3">
            Datos filtrados por el rango superior y calculados solo sobre vehículos entregados.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 space-y-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Resumen del período</p>
                <p className="text-xs text-gray-600 mt-2 flex items-center justify-between">
                  <span>Vendido</span>
                  <strong className="text-gray-900">{accessoryOverview.totalVendido.toLocaleString("es-EC")}</strong>
                </p>
                <p className="text-xs text-gray-600 mt-1 flex items-center justify-between">
                  <span>Obsequiado</span>
                  <strong className="text-gray-900">{accessoryOverview.totalObsequiado.toLocaleString("es-EC")}</strong>
                </p>
                {accessoryOverview.totalNoAplica > 0 && (
                  <p className="text-xs text-gray-600 mt-1 flex items-center justify-between">
                    <span>No aplica</span>
                    <strong className="text-gray-900">{accessoryOverview.totalNoAplica.toLocaleString("es-EC")}</strong>
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 px-3 py-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Cobertura del catálogo</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">
                  {accessoryOverview.rankedAccessories} de {accessoryOverview.totalAccessories} accesorios
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Se muestra la lista completa del catálogo en el período filtrado.
                </p>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: KIA_RED }} />
                  <span className="text-[11px] text-gray-500">Vendido</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: OBSEQUIADO_COLOR }} />
                  <span className="text-[11px] text-gray-500">Obsequiado</span>
                </div>
                {accessoryOverview.totalNoAplica > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-gray-400" />
                    <span className="text-[11px] text-gray-500">No aplica</span>
                  </div>
                )}
                <span className="text-[11px] text-gray-400 ml-auto shrink-0">
                  Lista completa: {accessoryOverview.rankedAccessories}
                </span>
              </div>

              {showSkeleton ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-7 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : !accessoryOverview.list.length ? (
                <p className="text-sm text-gray-400 text-center py-10">Sin accesorios registrados</p>
              ) : (
                <div className="space-y-1">
                  {accessoryOverview.list.map((item) => {
                    const total = item.Vendido + item.Obsequiado + item.NoAplica;
                    const maxTotal =
                      accessoryOverview.list.reduce(
                        (max, row) => Math.max(max, row.Vendido + row.Obsequiado + row.NoAplica),
                        0,
                      ) || 1;
                    const pctV = Math.round((item.Vendido / maxTotal) * 100);
                    const pctO = Math.round((item.Obsequiado / maxTotal) * 100);
                    const pctN = Math.round((item.NoAplica / maxTotal) * 100);

                    return (
                      <div key={item.key} className="group py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-medium text-gray-700 truncate max-w-[60%]">{item.name}</span>
                          <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                            <span className="font-semibold" style={{ color: KIA_RED }}>{item.Vendido}</span>
                            {item.Obsequiado > 0 && (
                              <span className="text-gray-400">
                                {" + "}
                                <span className="font-semibold" style={{ color: OBSEQUIADO_COLOR }}>{item.Obsequiado}</span>
                              </span>
                            )}
                            {item.NoAplica > 0 && (
                              <span className="text-gray-400">
                                {" + "}
                                <span className="font-semibold text-gray-500">{item.NoAplica}</span>
                              </span>
                            )}
                            {total > 0 && <span className="text-gray-300 ml-1">({total})</span>}
                          </span>
                        </div>

                        {total > 0 && (
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                            <div className="h-full rounded-l-full transition-all" style={{ width: `${pctV}%`, background: KIA_RED }} />
                            <div className="h-full transition-all" style={{ width: `${pctO}%`, background: OBSEQUIADO_COLOR }} />
                            {item.NoAplica > 0 && (
                              <div className="h-full rounded-r-full transition-all bg-gray-400" style={{ width: `${pctN}%` }} />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </BICard>
      </div>
      {/* -- Section 5: Rotation by model */}
      <div className="mt-5">
        <BICard>
          <SectionHeader>Rotación por modelo · días prom. entrega</SectionHeader>
          <p className="text-[10px] text-gray-400 -mt-3 mb-3">
            Días promedio desde ingreso hasta entrega, por modelo
          </p>
          {showSkeleton ? (
            <ChartSkeleton h={240} />
          ) : !rotationChartData.length ? (
            <p className="text-sm text-gray-400 text-center py-16">Sin datos de rotación</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={rotationChartData}
                layout="vertical"
                margin={{ top: 0, right: 40, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  unit="d"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={72}
                  tick={{ fontSize: 10, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ fill: "#f5f7fa" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any, _name: any, props: any) =>
                    [`${val ?? 0}d (n=${props?.payload?.count ?? 0})`, "Prom. entrega"] as [string, string]
                  }
                />
                <Bar
                  dataKey="avgDays"
                  name="Días prom."
                  fill={KIA_RED}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                >
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <LabelList dataKey="avgDays" position="right" style={{ fontSize: 10, fill: "#6b7280" }} formatter={(v: any) => `${v ?? 0}d`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </BICard>
      </div>
    </section>
  );
}
