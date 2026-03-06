"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
} from "recharts";
import { getBIAnalytics } from "@/lib/api";
import type { BIAnalyticsData } from "@/lib/api";
import { VehicleStatusLabel, AccessoryLabel } from "@/lib/constants";
import type { VehicleStatusType, AccessoryKeyType } from "@/lib/constants";
import { RefreshCw, AlertCircle, TrendingUp, X } from "lucide-react";

// ─── Brand constants ─────────────────────────────────────────
const KIA_RED = "#e8382f";
const OBSEQUIADO_COLOR = "#f59e0b";
const SEDE_COLORS = ["#e8382f", "#0f172a", "#3b82f6"];

const STATUS_HEX: Record<string, string> = {
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
};

const MEDAL = ["🥇", "🥈", "🥉"];

// ─── Funnel pipeline order ───────────────────────────────────
const FUNNEL_ORDER: VehicleStatusType[] = [
  "POR_ARRIBAR",
  "ENVIADO_A_MATRICULAR",
  "CERTIFICADO_STOCK",
  "DOCUMENTACION_PENDIENTE",
  "DOCUMENTADO",
  "ORDEN_GENERADA",
  "ASIGNADO",
  "EN_INSTALACION",
  "INSTALACION_COMPLETA",
  "LISTO_PARA_ENTREGA",
  "AGENDADO",
  "ENTREGADO",
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
  const d = new Date();
  d.setDate(d.getDate() - 29);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
  const [data, setData] = useState<BIAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  useEffect(() => {
    fetchBI();
  }, [fetchBI]);

  const handleModelClick = (modelName: string) => {
    setActiveModel((prev) => (prev === modelName ? "" : modelName));
  };

  // ── Derived data ──────────────────────────────────────────
  const funnelData = useMemo(() => {
    if (!data) return [];
    return FUNNEL_ORDER
      .map((key) => ({
        key,
        name: VehicleStatusLabel[key],
        value: data.byStatus[key] ?? 0,
        fill: STATUS_HEX[key] ?? "#94a3b8",
      }))
      .filter((s) => s.value > 0);
  }, [data]);

  const maxFunnel = useMemo(
    () => funnelData.reduce((max, s) => Math.max(max, s.value), 0) || 1,
    [funnelData]
  );

  const deliveryRate = useMemo(() => {
    if (!data || !data.total) return 0;
    return Math.round((data.vehiclesDelivered / data.total) * 100);
  }, [data]);

  const statusData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byStatus)
      .map(([key, value]) => ({
        name: VehicleStatusLabel[key as VehicleStatusType] ?? key,
        value,
        fill: STATUS_HEX[key] ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const modelData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byModel)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
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
    return Object.entries(data.accessories.byKey)
      .map(([key, vals]) => ({
        name: AccessoryLabel[key as AccessoryKeyType] ?? key,
        Vendido: vals.VENDIDO,
        Obsequiado: vals.OBSEQUIADO,
      }))
      .sort((a, b) => b.Vendido - a.Vendido)
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
              <option value="SURMOTOR" className="text-gray-900">SURMOTOR</option>
              <option value="SHYRIS" className="text-gray-900">SHYRIS</option>
              <option value="GRANADAS_CENTENOS" className="text-gray-900">GRANADAS CENTENOS</option>
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

            <button
              onClick={fetchBI}
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
          {activeModel && (
            <>
              <span className="text-white/20 text-[10px]">|</span>
              <FilterChip label="Modelo" value={activeModel} onClear={() => setActiveModel("")} />
              <button
                onClick={() => setActiveModel("")}
                className="text-[10px] text-white/40 hover:text-white/70 underline cursor-pointer"
              >
                Limpiar filtros
              </button>
            </>
          )}
        </div>

        {/* Macro KPIs */}
        {showSkeleton ? (
          <div className="grid grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
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
          <div className="grid grid-cols-3 gap-6">
            <KpiBlock
              label="Total vehículos"
              value={data.total}
              sub="en el período"
            />
            <KpiBlock
              label="Entregados"
              value={data.vehiclesDelivered}
              sub="entregas completadas"
            />
            <KpiBlock
              label="Tasa de entrega"
              value={`${deliveryRate}%`}
              sub="sobre el total"
            />
          </div>
        ) : null}
      </div>

      {/* ── Section 2: Embudo + Sedes ────────────────────── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Embudo de flujo vehicular */}
        <BICard>
          <SectionHeader>Embudo de flujo vehicular</SectionHeader>
          {showSkeleton ? (
            <ChartSkeleton h={320} />
          ) : !funnelData.length ? (
            <p className="text-sm text-gray-400 text-center py-16">Sin datos de flujo</p>
          ) : (
            <div className="space-y-1">
              {funnelData.map((step) => {
                const pct = Math.max((step.value / maxFunnel) * 100, 14);
                return (
                  <div key={step.key} className="flex flex-col items-center">
                    <div
                      className="h-7 rounded-sm flex items-center justify-between px-3 transition-all duration-700"
                      style={{
                        width: `${pct}%`,
                        background: step.fill,
                        minWidth: 140,
                      }}
                      title={`${step.name}: ${step.value}`}
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
                Ingreso → Proceso → Entrega
              </p>
            </div>
          )}
        </BICard>

        {/* Distribución por sede */}
        <BICard>
          <SectionHeader>Distribución por sede</SectionHeader>
          {showSkeleton ? (
            <ChartSkeleton h={200} />
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
                return (
                  <div key={item.name} className="flex items-center gap-2.5 min-w-0">
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
            Haz click en una barra para filtrar todos los datos
          </p>
          {showSkeleton ? (
            <ChartSkeleton h={220} />
          ) : !modelData.length ? (
            <p className="text-sm text-gray-400 text-center py-16">Sin datos</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={modelData}
                margin={{ top: 0, right: 8, left: -24, bottom: 32 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f7fa" }} />
                <Bar
                  dataKey="value"
                  name="Vehículos"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                  cursor="pointer"
                  onClick={(entry) => {
                    if (entry?.name) handleModelClick(entry.name);
                  }}
                >
                  {modelData.map((item, i) => (
                    <Cell key={i} fill={item.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </BICard>
      </div>

      {/* ── Section 4: Accesorios + Top Asesores ─────────── */}
      <div
        className="mt-5 grid grid-cols-1 gap-5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
      >
        {/* Custom grid for the 1.4fr / 1fr split on large screens */}
        <div className="lg:col-span-1" style={{ gridColumn: "span 1" }}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Stacked accesorios — 3 cols of 5 */}
            <div className="lg:col-span-3">
              <BICard className="h-full">
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
                  <ChartSkeleton h={240} />
                ) : !accData.length ? (
                  <p className="text-sm text-gray-400 text-center py-16">Sin accesorios registrados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={accData}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={86}
                        tick={{ fontSize: 10, fill: "#6b7280" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f7fa" }} />
                      <Bar
                        dataKey="Vendido"
                        stackId="a"
                        fill={KIA_RED}
                        radius={[0, 0, 0, 0]}
                        maxBarSize={18}
                      />
                      <Bar
                        dataKey="Obsequiado"
                        stackId="a"
                        fill={OBSEQUIADO_COLOR}
                        radius={[0, 4, 4, 0]}
                        maxBarSize={18}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </BICard>
            </div>

            {/* Top Asesores — 2 cols of 5 */}
            <div className="lg:col-span-2 flex flex-col gap-5">

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

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
