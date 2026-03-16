"use client";

import { useEffect, useState, useMemo } from "react";
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
  LineChart,
  Line,
  LabelList,
} from "recharts";
import { X, PackageCheck, AlertTriangle, TrendingUp } from "lucide-react";
import historicoData from "@/data/entregados_historico.json";
import { getEntregadosResumen } from "@/lib/api";

// ─── Brand constants ─────────────────────────────────────────
const KIA_RED = "#e8382f";

// ─── Color map for donut chart ────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  PLOMO:    "#94a3b8",
  PLATEADO: "#cbd5e1",
  plateado: "#cbd5e1",
  BLANCO:   "#f8fafc",
  ROJO:     "#e8382f",
  NEGRO:    "#1e293b",
  CREMA:    "#fef3c7",
  AZUL:     "#3b82f6",
  VERDE:    "#22c55e",
  CELESTE:  "#38bdf8",
};

// ─── TypeScript interfaces ────────────────────────────────────
interface EntregadosMes       { label: string; cantidad: number }
interface EntregadosAño       { año: number;   cantidad: number }
interface EntregadosCategoria { label: string; cantidad: number }

/** Shape of entregados_historico.json (new structure with detalle_anual) */
interface EntregadosJSON {
  metadata: {
    total_registros_filtrados?: number;
    total_registros_sin_2026?: number;
    total_registros?: number;
    rango_fechas?: { inicio: string; fin: string };
  };
  kpis_seguros: { SI: number; NO: number };
  analisis_temporal: {
    por_año: EntregadosAño[];
    /** New JSON uses "por_mes", old used "por_mes_label" — support both */
    por_mes?: EntregadosMes[];
    por_mes_label?: EntregadosMes[];
  };
  analisis_categorico: {
    /** New JSON uses _global suffix */
    por_modelo_global?: EntregadosCategoria[];
    por_color_global?:  EntregadosCategoria[];
    /** Old JSON keys (kept for backwards compat) */
    por_modelo?: EntregadosCategoria[];
    por_color?:  EntregadosCategoria[];
    /** New JSON uses _global suffix; old used "por_sede" */
    por_sede_global?: EntregadosCategoria[];
    por_sede?:        EntregadosCategoria[];
    detalle_anual?: {
      modelos_por_año: Record<string, EntregadosCategoria[]>;
      colores_por_año: Record<string, EntregadosCategoria[]>;
      sedes_por_año:   Record<string, EntregadosCategoria[]>;
    };
  };
}

/** Shape returned by the realtime API (EntregadosResumen endpoint) */
interface EntregadosAPI {
  metadata: {
    total_registros_filtrados?: number;
    total_registros?: number;
  };
  kpis_seguros: { SI: number; NO: number };
  analisis_temporal: {
    por_año:       EntregadosAño[];
    por_mes_label: EntregadosMes[];
  };
  analisis_categorico: {
    por_modelo: EntregadosCategoria[];
    por_color:  EntregadosCategoria[];
    por_sede:   EntregadosCategoria[];
  };
}

interface DatosFusionados {
  totalHistorico: number;
  totalRT:        number | null;   // registros desde la API (tiempo real)
  totalGlobal:    number;
  conSeguro:      number;
  sinSeguro:      number;
  porAño:         EntregadosAño[];
  porMes:         EntregadosMes[];
  porModelo:      EntregadosCategoria[];
  porColor:       EntregadosCategoria[];
  porSede:        EntregadosCategoria[];
}

// ─── Merge helpers ────────────────────────────────────────────
const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function parseMesLabel(l: string) {
  const [m, y] = l.split(" ");
  return parseInt(y) * 12 + MESES.indexOf(m);
}

function mergeAños(a: EntregadosAño[], b: EntregadosAño[]): EntregadosAño[] {
  const map = new Map<number, number>();
  [...a, ...b].forEach(({ año, cantidad }) => map.set(año, (map.get(año) ?? 0) + cantidad));
  return Array.from(map.entries())
    .map(([año, cantidad]) => ({ año, cantidad }))
    .sort((x, y) => x.año - y.año);
}

function mergeCategoria(a: EntregadosCategoria[], b: EntregadosCategoria[]): EntregadosCategoria[] {
  const map = new Map<string, number>();
  [...a, ...b].forEach(({ label, cantidad }) => map.set(label, (map.get(label) ?? 0) + cantidad));
  return Array.from(map.entries())
    .map(([label, cantidad]) => ({ label, cantidad }))
    .sort((x, y) => y.cantidad - x.cantidad);
}

// ─── Pure fusion function ─────────────────────────────────────
function fusionarEntregados(
  historico: EntregadosJSON,
  dataRT:    EntregadosAPI | null
): DatosFusionados {
  const totalHistorico =
    historico.metadata.total_registros_filtrados ??
    historico.metadata.total_registros_sin_2026 ??
    historico.metadata.total_registros ?? 0;

  const totalRT = dataRT
    ? (dataRT.metadata.total_registros_filtrados ?? dataRT.metadata.total_registros ?? null)
    : null;

  const totalGlobal = totalHistorico + (totalRT ?? 0);
  const conSeguro   = historico.kpis_seguros.SI + (dataRT?.kpis_seguros.SI ?? 0);
  const sinSeguro   = historico.kpis_seguros.NO + (dataRT?.kpis_seguros.NO ?? 0);

  const porAño = mergeAños(
    historico.analisis_temporal.por_año,
    dataRT?.analisis_temporal.por_año ?? []
  );

  // Support both key names ("por_mes" new / "por_mes_label" old)
  const mesMes = historico.analisis_temporal.por_mes ?? historico.analisis_temporal.por_mes_label ?? [];
  const porMes = mergeCategoria(mesMes, dataRT?.analisis_temporal.por_mes_label ?? [])
    .sort((a, b) => parseMesLabel(a.label) - parseMesLabel(b.label));

  // Support both key names for global modelo/color
  const histModelo = historico.analisis_categorico.por_modelo_global ?? historico.analisis_categorico.por_modelo ?? [];
  const histColor  = historico.analisis_categorico.por_color_global  ?? historico.analisis_categorico.por_color  ?? [];

  const histSede   = historico.analisis_categorico.por_sede_global ?? historico.analisis_categorico.por_sede ?? [];

  const porModelo = mergeCategoria(histModelo, dataRT?.analisis_categorico.por_modelo ?? []);
  const porColor  = mergeCategoria(histColor,  dataRT?.analisis_categorico.por_color  ?? []);
  const porSede   = mergeCategoria(histSede,   dataRT?.analisis_categorico.por_sede   ?? []);

  return { totalHistorico, totalRT, totalGlobal, conSeguro, sinSeguro, porAño, porMes, porModelo, porColor, porSede };
}

// ─── Sub-components (same design system as DashboardBI) ───────

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
    <div className={`bg-white border border-gray-200 rounded-xl p-5 overflow-hidden ${className}`}>
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
      {label && (
        <p className="font-semibold text-gray-700 mb-1 truncate max-w-[160px]">{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: p.color ?? p.fill ?? KIA_RED }}
          />
          <span className="text-gray-600 truncate max-w-[120px]">{p.name}:</span>
          <span className="font-bold text-gray-900">
            {p.value.toLocaleString("es-EC")}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ h = 220 }: { h?: number }) {
  return (
    <div
      className="w-full rounded-lg bg-gray-100 animate-pulse"
      style={{ height: h }}
    />
  );
}

function FilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur text-white text-xs font-medium rounded-full px-3 py-1 border border-white/20">
      <span className="text-white/50">{label}:</span>
      <span>{value}</span>
      <button
        onClick={onClear}
        className="hover:bg-white/20 rounded-full p-0.5 transition-colors cursor-pointer"
      >
        <X size={10} />
      </button>
    </span>
  );
}

// ─── Custom Pie label ─────────────────────────────────────────
interface PieLabelProps {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}
// We'll use a legend list instead of inline labels for clarity

// ─── Main component ───────────────────────────────────────────
export function DashboardEntregados() {
  const [data2026, setData2026]         = useState<EntregadosAPI | null>(null);
  const [loading2026, setLoading2026]   = useState(true);
  const [errorRT, setErrorRT]           = useState(false);

  // Filters
  const [activeAño,    setActiveAño]    = useState<number | null>(null);
  const [activeSede,   setActiveSede]   = useState<string>("");
  const [activeModelo, setActiveModelo] = useState<string>("");

  // fechaDesde: día siguiente al último día cubierto por el JSON histórico
  const fechaDesdeAPI = useMemo(() => {
    const hist = historicoData as unknown as EntregadosJSON;
    const fin = hist.metadata.rango_fechas?.fin;
    if (!fin) return undefined;
    const d = new Date(fin + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().split("T")[0]; // "YYYY-MM-DD"
  }, []);

  // Fetch tiempo real — solo trae entregas POSTERIORES al JSON histórico
  useEffect(() => {
    let cancelled = false;
    setLoading2026(true);
    setErrorRT(false);

    getEntregadosResumen({ fechaDesde: fechaDesdeAPI })
      .then((res) => {
        if (!cancelled) {
          setData2026(res.data as unknown as EntregadosAPI);
          setErrorRT(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData2026(null);
          setErrorRT(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading2026(false);
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesdeAPI]);

  // Fused data (memoized) — uses JSON historico + RT data
  const datos = useMemo(
    () => fusionarEntregados(historicoData as unknown as EntregadosJSON, data2026),
    [data2026]
  );

  // ── desglose por año: leer de detalle_anual del JSON (sin fetch adicional)
  const hist = historicoData as unknown as EntregadosJSON;
  const detalleAnual = hist.analisis_categorico.detalle_anual;

  // ── Año "en curso" del JSON: el año de rango_fechas.fin (ej: 2026)
  // Para ese año, los datos del JSON son parciales → hay que sumar el RT
  const añoEnCursoJSON = useMemo(() => {
    const fin = hist.metadata.rango_fechas?.fin;
    return fin ? new Date(fin + "T00:00:00Z").getUTCFullYear() : null;
  }, [hist]);

  // ── Fuente de modelo/color/sede: año activo (JSON detalle_anual) o global (fusionado)
  // Para el año en curso, mergear JSON parcial + datos RT
  const modeloSource: EntregadosCategoria[] = useMemo(() => {
    if (activeAño === null) return datos.porModelo;
    const jsonAño = detalleAnual?.modelos_por_año[String(activeAño)] ?? [];
    if (activeAño === añoEnCursoJSON && data2026) {
      return mergeCategoria(jsonAño, data2026.analisis_categorico.por_modelo);
    }
    return jsonAño;
  }, [activeAño, detalleAnual, datos.porModelo, añoEnCursoJSON, data2026]);

  const colorSource: EntregadosCategoria[] = useMemo(() => {
    if (activeAño === null) return datos.porColor;
    const jsonAño = detalleAnual?.colores_por_año[String(activeAño)] ?? [];
    if (activeAño === añoEnCursoJSON && data2026) {
      return mergeCategoria(jsonAño, data2026.analisis_categorico.por_color);
    }
    return jsonAño;
  }, [activeAño, detalleAnual, datos.porColor, añoEnCursoJSON, data2026]);

  const sedeSource: EntregadosCategoria[] = useMemo(() => {
    if (activeAño === null) return datos.porSede;
    const jsonAño = detalleAnual?.sedes_por_año[String(activeAño)] ?? [];
    if (activeAño === añoEnCursoJSON && data2026) {
      return mergeCategoria(jsonAño, data2026.analisis_categorico.por_sede);
    }
    return jsonAño;
  }, [activeAño, detalleAnual, datos.porSede, añoEnCursoJSON, data2026]);

  // ── Derived: filtered month data
  const mesesVisibles = useMemo(() => {
    if (activeAño === null) return datos.porMes;
    const añoStr = String(activeAño);
    return datos.porMes.filter((m) => m.label.includes(añoStr));
  }, [datos.porMes, activeAño]);

  // ── XAxis tick interval for global view (every 6 months)
  const xAxisInterval = activeAño !== null ? 0 : 5;

  // ── porAño with highlight fill (año activo resaltado en rojo)
  const porAñoConColor = useMemo(
    () =>
      datos.porAño.map((d) => ({
        ...d,
        fill: activeAño !== null
          ? d.año === activeAño ? KIA_RED : "#e5e7eb"
          : d.año === 2026 ? KIA_RED : "#cbd5e1",
      })),
    [datos.porAño, activeAño]
  );

  // ── porModelo with active highlight
  const modeloConColor = useMemo(
    () =>
      modeloSource.slice(0, 10).map((d) => ({
        ...d,
        fill:
          activeModelo === ""
            ? KIA_RED
            : d.label === activeModelo
            ? KIA_RED
            : "#e5e7eb",
      })),
    [modeloSource, activeModelo]
  );

  // ── porSede totals
  const totalSede = useMemo(
    () => sedeSource.reduce((s, d) => s + d.cantidad, 0) || 1,
    [sedeSource]
  );

  // ── Pie color data
  const colorPieData = useMemo(
    () =>
      colorSource.map((d) => ({
        ...d,
        fill: COLOR_MAP[d.label] ?? "#94a3b8",
      })),
    [colorSource]
  );

  const totalColor = useMemo(
    () => colorPieData.reduce((s, d) => s + d.cantidad, 0) || 1,
    [colorPieData]
  );

  // ── Handlers
  const handleAñoClick = (entry: { año: number }) => {
    setActiveAño((prev) => (prev === entry.año ? null : entry.año));
  };

  const handleModeloClick = (entry: { label: string }) => {
    setActiveModelo((prev) => (prev === entry.label ? "" : entry.label));
  };

  const handleSedeClick = (label: string) => {
    setActiveSede((prev) => (prev === label ? "" : label));
  };

  const clearAllFilters = () => {
    setActiveAño(null);
    setActiveSede("");
    setActiveModelo("");
  };

  const hasFilters = activeAño !== null || activeSede !== "" || activeModelo !== "";

  // ── KPI "en tiempo real": entregas posteriores al JSON histórico
  const kpiTempoReal =
    loading2026
      ? "..."
      : errorRT || datos.totalRT === null
      ? "—"
      : datos.totalRT.toLocaleString("es-EC");

  // Sub-label dinámico basado en fechaDesde
  const labelTempoReal = fechaDesdeAPI
    ? `Desde ${fechaDesdeAPI}`
    : "En tiempo real";

  // ── Render ─────────────────────────────────────────────────
  return (
    <section className="mt-4">
      {/* ── Dark banner ──────────────────────────────────── */}
      <div className="rounded-2xl px-6 py-6" style={{ background: "#0f172a" }}>
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <PackageCheck size={18} className="text-white/60 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                Análisis Histórico
              </p>
              <h2 className="text-base font-bold text-white leading-tight">
                Vehículos Entregados
              </h2>
            </div>
          </div>

          {/* Tiempo real status badge */}
          {!loading2026 && errorRT && (
            <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-400/30 rounded-lg px-3 py-1.5">
              <AlertTriangle size={12} className="text-yellow-400 shrink-0" />
              <span className="text-[11px] font-medium text-yellow-300">
                Solo histórico — tiempo real no disponible
              </span>
            </div>
          )}
          {!loading2026 && !errorRT && data2026 && (
            <div className="flex items-center gap-1.5 bg-green-500/20 border border-green-400/30 rounded-lg px-3 py-1.5">
              <TrendingUp size={12} className="text-green-400 shrink-0" />
              <span className="text-[11px] font-medium text-green-300">
                Tiempo real activo
              </span>
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 mb-5 -mt-2">
            {activeAño !== null && (
              <FilterChip
                label="Año"
                value={String(activeAño)}
                onClear={() => setActiveAño(null)}
              />
            )}
            {activeSede && (
              <FilterChip
                label="Sede"
                value={activeSede}
                onClear={() => setActiveSede("")}
              />
            )}
            {activeModelo && (
              <FilterChip
                label="Modelo"
                value={activeModelo}
                onClear={() => setActiveModelo("")}
              />
            )}
            <button
              onClick={clearAllFilters}
              className="text-[10px] text-white/40 hover:text-white/70 underline cursor-pointer"
            >
              Limpiar todos
            </button>
          </div>
        )}

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <KpiBlock
            label="Total histórico"
            value={datos.totalHistorico.toLocaleString("es-EC")}
            sub="Mar 2021 – Feb 2026"
          />
          <KpiBlock
            label="Tiempo real"
            value={kpiTempoReal}
            sub={loading2026 ? "Cargando..." : errorRT ? "No disponible" : labelTempoReal}
          />
          <KpiBlock
            label="Con seguro"
            value={datos.conSeguro.toLocaleString("es-EC")}
            sub={`${Math.round((datos.conSeguro / datos.totalGlobal) * 100)}% del total`}
          />
          <KpiBlock
            label="Sin seguro"
            value={datos.sinSeguro.toLocaleString("es-EC")}
            sub={`${Math.round((datos.sinSeguro / datos.totalGlobal) * 100)}% del total`}
          />
        </div>
      </div>

      {/* ── Fila 1: Entregas por año + Tendencia mensual ── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Entregas por año */}
        <BICard>
          <SectionHeader>Entregas por año</SectionHeader>
          <p className="text-[10px] text-gray-400 -mt-3 mb-3">
            Click en una barra para filtrar la tendencia mensual
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={porAñoConColor}
              margin={{ top: 8, right: 8, left: -20, bottom: 4 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="año"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={(v: number) => v.toLocaleString("es-EC")}
              />
              <Tooltip
                content={<ChartTooltip />}
                cursor={{ fill: "#f5f7fa" }}
              />
              <Bar
                dataKey="cantidad"
                name="Entregas"
                radius={[4, 4, 0, 0]}
                maxBarSize={56}
                cursor="pointer"
                animationDuration={600}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(entry: any) => {
                  if (entry?.año !== undefined) handleAñoClick(entry as { año: number });
                }}
              >
                {porAñoConColor.map((item, i) => (
                  <Cell
                    key={i}
                    fill={
                      activeAño !== null && item.año !== activeAño
                        ? "#e5e7eb"
                        : item.fill
                    }
                    stroke={item.año === activeAño ? "#0f172a" : "none"}
                    strokeWidth={item.año === activeAño ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </BICard>

        {/* Tendencia mensual */}
        <BICard>
          <SectionHeader>
            {activeAño !== null
              ? `Tendencia ${activeAño}`
              : "Tendencia histórica"}
          </SectionHeader>
          <p className="text-[10px] text-gray-400 -mt-3 mb-3">
            {activeAño !== null
              ? `Mostrando los ${mesesVisibles.length} meses de ${activeAño}`
              : "Mar 2021 → Feb 2026 + tiempo real"}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart
              data={mesesVisibles}
              margin={{ top: 8, right: 8, left: -20, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                interval={xAxisInterval}
                angle={activeAño !== null ? -30 : 0}
                textAnchor={activeAño !== null ? "end" : "middle"}
                height={activeAño !== null ? 40 : 20}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={(v: number) => v.toLocaleString("es-EC")}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="cantidad"
                name="Entregas"
                stroke={KIA_RED}
                strokeWidth={2}
                dot={{ r: 3, fill: KIA_RED, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        </BICard>
      </div>

      {/* ── Fila 2: Por modelo + Por color ─────────────── */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Por modelo — horizontal BarChart */}
        <BICard>
          <div className="flex items-start justify-between mb-0">
            <SectionHeader>
              {activeAño !== null ? `Por modelo — ${activeAño}` : "Por modelo"}
            </SectionHeader>
            {activeModelo && (
              <span className="text-[10px] text-gray-400 mb-4">
                Click para deseleccionar
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 -mt-3 mb-3">
            Top 10 modelos · Click para resaltar
          </p>
          <ResponsiveContainer width="100%" height={280}>            <BarChart
              data={modeloConColor}
              layout="vertical"
              margin={{ top: 0, right: 52, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                tickFormatter={(v: number) => v.toLocaleString("es-EC")}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={72}
                tick={{ fontSize: 10, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f5f7fa" }} />
              <Bar
                dataKey="cantidad"
                name="Entregas"
                radius={[0, 4, 4, 0]}
                maxBarSize={22}
                cursor="pointer"
                animationDuration={600}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={(entry: any) => {
                  if (entry?.label) handleModeloClick(entry as { label: string });
                }}
              >
                <LabelList
                  dataKey="cantidad"
                  position="right"
                  style={{ fontSize: 10, fill: "#374151", fontWeight: 600 }}
                  formatter={(v: unknown) =>
                    typeof v === "number" ? v.toLocaleString("es-EC") : String(v)
                  }
                />
                {modeloConColor.map((item, i) => (
                  <Cell key={i} fill={item.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </BICard>

        {/* Por color — donut PieChart con leyenda lateral */}
        <BICard>
          <SectionHeader>
            {activeAño !== null ? `Por color — ${activeAño}` : "Por color"}
          </SectionHeader>
          <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
            {/* Donut */}
            <div className="shrink-0">
              <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie
                      data={colorPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={82}
                      paddingAngle={2}
                      dataKey="cantidad"
                      animationDuration={600}
                    >
                      {colorPieData.map((item, i) => (
                        <Cell
                          key={i}
                          fill={item.fill}
                          stroke={item.label === "BLANCO" ? "#e2e8f0" : item.fill}
                          strokeWidth={item.label === "BLANCO" ? 1 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex-1 min-w-0 space-y-2 w-full">
              {colorPieData.map((item) => {
                const pct = Math.round((item.cantidad / totalColor) * 100);
                return (
                  <div key={item.label} className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0 border"
                      style={{
                        background: item.fill,
                        borderColor:
                          item.label === "BLANCO" ? "#e2e8f0" : item.fill,
                      }}
                    />
                    <span className="text-xs text-gray-600 w-20 shrink-0 capitalize">
                      {item.label.charAt(0) + item.label.slice(1).toLowerCase()}
                    </span>
                    <span className="text-xs font-bold text-gray-900 shrink-0">
                      {item.cantidad.toLocaleString("es-EC")}
                    </span>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </BICard>
      </div>

      {/* ── Fila 3: Distribución por sede ───────────────── */}
      <div className="mt-5">
        <BICard>
          <SectionHeader>Distribución por sede</SectionHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {sedeSource.map((sede) => {
              const pct = Math.round((sede.cantidad / totalSede) * 100);
              const isActive = activeSede === sede.label;
              return (
                <button
                  key={sede.label}
                  onClick={() => handleSedeClick(sede.label)}
                  className={`
                    text-left rounded-xl p-5 border-2 transition-all duration-200 cursor-pointer
                    ${isActive
                      ? "border-[#e8382f] bg-red-50"
                      : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white"}
                  `}
                >
                  {/* Sede name */}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Sede
                  </p>
                  <p
                    className="text-xl font-bold text-gray-900 mb-3 tracking-tight"
                    style={isActive ? { color: KIA_RED } : {}}
                  >
                    {sede.label}
                  </p>

                  {/* Big number */}
                  <p
                    className="text-4xl font-bold leading-none mb-1"
                    style={{ color: KIA_RED, fontFamily: "var(--font-bebas, sans-serif)", letterSpacing: "0.04em" }}
                  >
                    {sede.cantidad.toLocaleString("es-EC")}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">vehículos entregados</p>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: KIA_RED }}
                    />
                  </div>
                  <p className="text-right text-[11px] font-semibold text-gray-500 mt-1">
                    {pct}% del total
                  </p>
                </button>
              );
            })}
          </div>
        </BICard>
      </div>

      {/* ── Nota de fuente ───────────────────────────────── */}
      <p className="mt-4 text-center text-[10px] text-gray-400 leading-relaxed">
        Histórico: Mar 2021 – Feb 2026 ({datos.totalHistorico.toLocaleString("es-EC")} registros)
        {" · "}
        {fechaDesdeAPI ? `Tiempo real desde ${fechaDesdeAPI}` : "Tiempo real desde Firebase"}
      </p>
    </section>
  );
}
