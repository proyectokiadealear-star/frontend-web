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
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { getBIAnalytics, getSedes } from "@/lib/api";
import type { BIAnalyticsData } from "@/lib/api";
import type { CatalogItem } from "@/types";
import { VehicleStatusLabel, AccessoryLabel } from "@/lib/constants";
import type { VehicleStatusType, AccessoryKeyType } from "@/lib/constants";
import { RefreshCw, AlertCircle, TrendingUp, X } from "lucide-react";

// ─── Brand constants ─────────────────────────────────────────
const KIA_RED = "#e8382f";
const OBSEQUIADO_COLOR = "#f59e0b";
const SEDE_COLORS = ["#e8382f", "#0f172a", "#3b82f6"];

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

const MEDAL = ["🥇", "🥈", "🥉"];

const COLOR_PALETTE = [
  "#e8382f", "#0f172a", "#3b82f6", "#f97316", "#8b5cf6",
  "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#6366f1",
  "#84cc16", "#14b8a6", "#94a3b8", "#eab308", "#9ca3af",
];

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
function defaultFromISO(): string {
  // Tendencia desde el inicio de operaciones: 01 Mar 2026
  return "2026-03-01";
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
function isoToApi(iso: string): string {
  // YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function isoToDisplay(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
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

// ─── Main component ───────────────────────────────────────────
export function DashboardBI() {
  const [sede, setSede] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultFromISO);
  const [dateTo, setDateTo] = useState(todayISO);
  const [activeModel, setActiveModel] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [data, setData] = useState<BIAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // [M6] Dynamic sedes list
  const [sedeOptions, setSedeOptions] = useState<CatalogItem[]>([]);
  // [Me5] Debounce ref for date inputs
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const res = await getBIAnalytics({
        sede: sede || undefined,
        model: activeModel || undefined,
        dateFrom: isoToApi(dateFrom),
        dateTo: isoToApi(dateTo),
      });
      setData(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sede, dateFrom, dateTo, activeModel]);

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

  const handleModelClick = (modelName: string) => {
    setActiveModel((prev) => (prev === modelName ? "" : modelName));
  };

  // REQ-BI-05: clicking a sede slice applies the sede filter (same state as header <select>)
  const handleSedeClick = (sedeName: string) => {
    setSede((prev) => (prev === sedeName ? "" : sedeName));
  };

  // REQ-BI-06: clicking a status row/bar toggles inline drill-down panel (no re-fetch)
  const handleStatusClick = (statusKey: string) => {
    setActiveStatus((prev) => (prev === statusKey ? "" : statusKey));
  };

  // ── Derived data ──────────────────────────────────────────
  // REQ-BI-01: always show all 15 pipeline statuses (including those with 0 vehicles)
  const funnelData = useMemo(() => {
    if (!data) return [];
    return FUNNEL_ORDER
      .map((key) => ({
        key,
        name: VehicleStatusLabel[key],
        value: data.byStatus[key] ?? 0,
        fill: STATUS_HEX[key] ?? "#94a3b8",
      }));
  }, [data]);

  const maxFunnel = useMemo(
    () => funnelData.reduce((max, s) => Math.max(max, s.value), 0) || 1,
    [funnelData]
  );

  const deliveryRate = useMemo(() => {
    if (!data) return 0;
    // REQ-DATE-04: use vehiclesCreatedInPeriod as denominator so both values
    // share the same time window — avoids comparing period deliveries vs historical total
    const denominator = data.vehiclesCreatedInPeriod || 1;
    return Math.round((data.vehiclesDelivered / denominator) * 100);
  }, [data]);

  const statusData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byStatus)
      .map(([key, value]) => ({
        key,
        name: VehicleStatusLabel[key as VehicleStatusType] ?? key,
        value,
        fill: STATUS_HEX[key] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const modelData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byModel)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({
        name: name.replace(/^KIA\s+/i, ""),
        value,
        fill: activeModel && name.replace(/^KIA\s+/i, "") !== activeModel ? "#e5e7eb" : KIA_RED,
      }));
  }, [data, activeModel]);

  const sedeChartData = useMemo(() => {
    if (!data) return [];
    const total = Object.values(data.bySede).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(data.bySede).map(([name, value]) => ({
      name,
      value,
      pct: Math.round((value / total) * 100),
    }));
  }, [data]);

  const accData = useMemo(() => {
    if (!data) return [];
    // Backend stores keys in lowercase (boton_encendido), frontend labels expect UPPERCASE.
    // Normalise to UPPERCASE before looking up AccessoryLabel.
    // Only include rows that have at least 1 unit vendido or obsequiado.
    return Object.entries(data.accessories.byKey)
      .map(([key, vals]) => {
        const normKey = key.toUpperCase() as AccessoryKeyType;
        return {
          name: AccessoryLabel[normKey] ?? key,
          Vendido: vals.VENDIDO,
          Obsequiado: vals.OBSEQUIADO,
        };
      })
      .filter((r) => r.Vendido > 0 || r.Obsequiado > 0)
      .sort((a, b) => (b.Vendido + b.Obsequiado) - (a.Vendido + a.Obsequiado));
  }, [data]);

  const colorChartData = useMemo(() => {
    if (!data?.byColor) return [];
    return Object.entries(data.byColor)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12)
      .map(([name, value]) => ({ name, value }));
  }, [data]);

  const rotationChartData = useMemo(() => {
    if (!data?.byModelRotation) return [];
    return Object.entries(data.byModelRotation)
      .map(([name, val]) => ({ name, avgDays: val.avgDays, count: val.count }))
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 8);
  }, [data]);

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
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
            />
            <span className="text-white/40 text-xs shrink-0">→</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayISO()}
              onChange={(e) => setDateTo(e.target.value)}
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
                  onClick={() => { setDateFrom(daysAgoISO(p.days)); setDateTo(todayISO()); }}
                  className="text-[10px] font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-md px-2 py-1 transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => { setDateFrom(ytdISO()); setDateTo(todayISO()); }}
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
            {sede ? ` · ${sede}` : " · Todas las sedes"}
          </p>
          {(activeModel || activeStatus || sede) && (
            <span className="text-white/20 text-[10px]">|</span>
          )}
          {sede && (
            <FilterChip label="Sede" value={sede} onClear={() => setSede("")} />
          )}
          {activeModel && (
            <FilterChip label="Modelo" value={activeModel} onClear={() => setActiveModel("")} />
          )}
          {activeStatus && (() => {
            const label = VehicleStatusLabel[activeStatus as VehicleStatusType] ?? activeStatus;
            return (
              <FilterChip label="Estado" value={label} onClear={() => setActiveStatus("")} />
            );
          })()}
          {(activeModel || activeStatus || sede) && (
            <button
              onClick={() => { setActiveModel(""); setActiveStatus(""); setSede(""); }}
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
        ) : data ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-6">
            <KpiBlock
              label="Inventario total"
              value={data.total}
              sub="vehículos activos"
            />
            <KpiBlock
              label="Entregados"
              value={data.vehiclesDelivered}
              sub="en el período"
            />
            <KpiBlock
              label="Ingresos al sistema"
              value={data.vehiclesCreatedInPeriod ?? 0}
              sub="ingresados en el período"
            />
            <KpiBlock
              label="Tasa de entrega"
              value={`${deliveryRate}%`}
              sub="entregados / ingresos"
            />
            <KpiBlock
              label="Prom. entrega"
              value={data.avgDaysToDelivery != null ? `${data.avgDaysToDelivery}d` : "—"}
              sub={data.medianDaysToDelivery != null ? `mediana ${data.medianDaysToDelivery}d` : "sin datos"}
            />
          </div>
        ) : null}
      </div>

      {/* ── Section 2: Embudo + Sedes ────────────────────── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Embudo de flujo vehicular */}
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

        {/* Distribución por sede */}
        <BICard>
          <SectionHeader>Distribución por sede</SectionHeader>
          {showSkeleton ? (
            <ChartSkeleton h={200} />
          ) : sede ? (
            /* Cuando hay filtro de sede activo, el gráfico no aporta valor */
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <span className="text-2xl">🏢</span>
              <p className="text-sm font-semibold text-gray-700">{sede}</p>
              <p className="text-xs text-gray-400 text-center">
                Filtrando por sede — la distribución no aplica
              </p>
            </div>
          ) : !sedeChartData.length ? (
            <p className="text-sm text-gray-400 text-center py-16">Sin datos</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="shrink-0">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={sedeChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                      cursor="pointer"
                      onClick={(entry: { name?: string }) => {
                        if (entry?.name) handleSedeClick(entry.name);
                      }}
                    >
                      {sedeChartData.map((_, i) => (
                        <Cell key={i} fill={SEDE_COLORS[i % SEDE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 space-y-2.5 w-full">
                {sedeChartData.map((item, i) => (
                  <div key={item.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-xs font-medium text-gray-700 truncate max-w-[65%]"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <span className="text-xs font-bold text-gray-900 shrink-0">
                        {item.value}{" "}
                        <span className="font-normal text-gray-400">({item.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${item.pct}%`,
                          background: SEDE_COLORS[i % SEDE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </BICard>
      </div>

      {/* ── Section 3: Estados + Modelos ─────────────────── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Estado de flota */}
        <BICard>
          <SectionHeader>Estado de flota</SectionHeader>
          {showSkeleton ? (
            <ChartSkeleton h={280} />
          ) : !statusData.length ? (
            <p className="text-sm text-gray-400 text-center py-16">Sin datos</p>
          ) : (
            <div className="space-y-2">
              {statusData.map((item) => {
                const max = statusData[0]?.value || 1;
                const pct = Math.round((item.value / max) * 100);
                const isActive = activeStatus === item.key;
                return (
                  <div
                    key={item.key}
                    className={`flex items-center gap-2.5 min-w-0 cursor-pointer rounded-md px-1 py-0.5 transition-colors ${isActive ? "bg-gray-100" : "hover:bg-gray-50"}`}
                    onClick={() => handleStatusClick(item.key)}
                    title="Click para ver detalle"
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: item.fill }}
                    />
                    <span
                      className="text-xs text-gray-600 w-36 shrink-0 truncate"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <div className="flex-1 h-4 bg-gray-100 rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-700 flex items-center justify-end pr-2"
                        style={{
                          width: `${Math.max(pct, 4)}%`,
                          background: item.fill,
                        }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-900 w-6 text-right shrink-0">
                      {item.value}
                    </span>
                  </div>
                );
              })}

              {/* REQ-BI-07: inline drill-down panel */}
              {activeStatus && (() => {
                const selected = statusData.find((s) => s.key === activeStatus);
                if (!selected) return null;
                return (
                  <div
                    className="mt-3 rounded-lg border px-4 py-3 flex items-center justify-between gap-3"
                    style={{ borderColor: selected.fill, background: `${selected.fill}12` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selected.fill }} />
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{selected.name}</p>
                        <p className="text-[10px] text-gray-400">{selected.key}</p>
                      </div>
                    </div>
                    <span className="text-2xl font-bold tabular-nums" style={{ color: selected.fill }}>
                      {selected.value}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveStatus(""); }}
                      className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </BICard>

        {/* Top modelos — click para filtrar */}
        <BICard>
          <div className="flex items-center justify-between mb-0">
            <SectionHeader>Top modelos</SectionHeader>
            {activeModel && (
              <span className="text-[10px] text-gray-400 mb-4">
                Click para deseleccionar
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 -mt-3 mb-3">
            Haz click en un modelo para filtrar todos los datos
          </p>
          {showSkeleton ? (
            <div className="space-y-2">
              {[1,2,3,4,5,6].map((i) => (
                <div key={i} className="h-7 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : !modelData.length ? (
            <p className="text-sm text-gray-400 text-center py-16">Sin datos</p>
          ) : (
            <div className="space-y-1">
              {modelData.map((item) => {
                const maxVal = modelData[0]?.value || 1;
                const pct = Math.round((item.value / maxVal) * 100);
                const isActive = activeModel === item.name;
                return (
                  <div
                    key={item.name}
                    onClick={() => handleModelClick(item.name)}
                    className="group py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    style={{ opacity: activeModel && !isActive ? 0.45 : 1 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[11px] font-medium truncate max-w-[75%]"
                        style={{ color: isActive ? KIA_RED : "#374151" }}
                      >
                        {item.name}
                      </span>
                      <span
                        className="text-[11px] font-bold tabular-nums shrink-0"
                        style={{ color: isActive ? KIA_RED : "#6b7280" }}
                      >
                        {item.value}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: isActive || !activeModel ? KIA_RED : "#e5e7eb" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </BICard>
      </div>

      {/* ── Section 4: Accesorios + Top Asesores ─────────── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Accesorios instalados — compact list */}
        <BICard>
          <SectionHeader>Accesorios instalados</SectionHeader>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: KIA_RED }} />
              <span className="text-[11px] text-gray-500">Vendido</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: OBSEQUIADO_COLOR }} />
              <span className="text-[11px] text-gray-500">Obsequiado</span>
            </div>
            {data && (
              <span className="text-[11px] text-gray-400 ml-auto shrink-0">
                Total vendido: <strong className="text-gray-700">{data.accessories.totalVendido}</strong>
              </span>
            )}
          </div>
          {showSkeleton ? (
            <div className="space-y-2">
              {[1,2,3,4,5,6,7,8].map((i) => (
                <div key={i} className="h-7 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : !accData.length ? (
            <p className="text-sm text-gray-400 text-center py-10">Sin accesorios registrados</p>
          ) : (
            <div className="space-y-1">
              {accData.map((item) => {
                const total = item.Vendido + item.Obsequiado;
                const maxTotal = accData.reduce((m, a) => Math.max(m, a.Vendido + a.Obsequiado), 0) || 1;
                const pctV = Math.round((item.Vendido / maxTotal) * 100);
                const pctO = Math.round((item.Obsequiado / maxTotal) * 100);
                return (
                  <div key={item.name} className="group py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-gray-700 truncate max-w-[60%]">{item.name}</span>
                      <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
                        <span className="font-semibold" style={{ color: KIA_RED }}>{item.Vendido}</span>
                        {item.Obsequiado > 0 && (
                          <span className="text-gray-400"> + <span className="font-semibold" style={{ color: OBSEQUIADO_COLOR }}>{item.Obsequiado}</span></span>
                        )}
                        {total > 0 && <span className="text-gray-300 ml-1">({total})</span>}
                      </span>
                    </div>
                    {total > 0 && (
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex">
                        <div className="h-full rounded-l-full transition-all" style={{ width: `${pctV}%`, background: KIA_RED }} />
                        <div className="h-full transition-all" style={{ width: `${pctO}%`, background: OBSEQUIADO_COLOR }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </BICard>

        {/* Top rankings — 3 stacked in the right column */}
        <div className="flex flex-col gap-5">

          {/* Por órdenes */}
          <BICard className="flex-1">
            <SectionHeader>Top asesores · Órdenes</SectionHeader>
            {showSkeleton ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : !data?.topAsesores?.ordenesGeneradas?.length ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {data.topAsesores.ordenesGeneradas.slice(0, 5).map((a, i) => (
                  <div
                    key={a.uid}
                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-base leading-none shrink-0 w-5 text-center">
                      {MEDAL[i] ?? (
                        <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{a.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{a.sede}</p>
                    </div>
                    <span
                      className="text-sm font-bold shrink-0 tabular-nums"
                      style={{ color: KIA_RED }}
                    >
                      {a.ordenes}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </BICard>

          {/* Por entregas */}
          <BICard className="flex-1">
            <SectionHeader>Top asesores · Entregas</SectionHeader>
            {showSkeleton ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : !data?.topAsesores?.entregas?.length ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {data.topAsesores.entregas.slice(0, 5).map((a, i) => (
                  <div
                    key={a.uid}
                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-base leading-none shrink-0 w-5 text-center">
                      {MEDAL[i] ?? (
                        <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{a.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{a.sede}</p>
                    </div>
                    <span
                      className="text-sm font-bold shrink-0 tabular-nums"
                      style={{ color: "#16a34a" }}
                    >
                      {a.entregas}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </BICard>

          {/* Top taller · OTs realizadas */}
          <BICard className="flex-1">
            <SectionHeader>Top taller · OTs realizadas</SectionHeader>
            <p className="text-[10px] text-gray-400 -mt-3 mb-3">
              Órdenes de trabajo asignadas en el período
            </p>
            {showSkeleton ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded-lg bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : !data?.topTaller?.length ? (
              <p className="text-xs text-gray-400 text-center py-6">Sin datos</p>
            ) : (
              <div className="space-y-2">
                {data.topTaller.slice(0, 5).map((t, i) => (
                  <div
                    key={t.uid}
                    className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-base leading-none shrink-0 w-5 text-center">
                      {MEDAL[i] ?? (
                        <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{t.sede}</p>
                    </div>
                    <span
                      className="text-sm font-bold shrink-0 tabular-nums"
                      style={{ color: "#0ea5e9" }}
                    >
                      {t.totalOTs}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </BICard>

        </div>
      </div>
      {/* -- Section 5: Rotation by model + Color distribution */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Rotation rate by model */}
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

        {/* Color distribution */}
        <BICard>
          <SectionHeader>Distribución por color</SectionHeader>
          {showSkeleton ? (
            <ChartSkeleton h={240} />
          ) : !colorChartData.length ? (
            <p className="text-sm text-gray-400 text-center py-16">Sin datos de color</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="shrink-0">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={colorChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {colorChartData.map((_, i) => (
                        <Cell key={i} fill={COLOR_PALETTE[i % COLOR_PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 min-w-0 space-y-2 w-full">
                {colorChartData.map((item, i) => {
                  const total = colorChartData.reduce((s, x) => s + x.value, 0) || 1;
                  const pct = Math.round((item.value / total) * 100);
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: COLOR_PALETTE[i % COLOR_PALETTE.length] }}
                          />
                          <span className="text-xs text-gray-600 truncate max-w-[100px]" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-gray-900 shrink-0">
                          {item.value} <span className="font-normal text-gray-400">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: COLOR_PALETTE[i % COLOR_PALETTE.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </BICard>
      </div>
    </section>
  );
}
