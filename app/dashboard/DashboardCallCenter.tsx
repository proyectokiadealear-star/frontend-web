"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
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
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Phone,
  CheckCircle2,
  RefreshCw,
  CalendarDays,
} from "lucide-react";
import { fetchAllPagesCursor, getSalePotential, isRequestAborted } from "@/lib/api";
import { AccessoryKey, VehicleStatusLabel, VehicleStatusColor } from "@/lib/constants";
import type { VehicleStatusType } from "@/lib/constants";
import type { SalePotential } from "@/types";
import type { CallCenterVehicle, ClassifiedVehicle, Prioridad, Oportunidad } from "@/types";

// ─── Constants ────────────────────────────────────────────────
const SEGURO_KEY = AccessoryKey.SEGURO;
const TELEMETRIA_KEY = AccessoryKey.TELEMETRIA;
const PAGE_SIZE = 8;

const PRIORITY_ORDER: Record<Prioridad, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

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

function isoToDisplay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Classification logic ─────────────────────────────────────
function clasificarVehiculo(raw: CallCenterVehicle): ClassifiedVehicle {
  const tieneSeguro = raw.accessories.some(
    (a) =>
      a.key === SEGURO_KEY &&
      a.classification !== "NO_APLICA" &&
      a.classification != null
  );
  const tieneTelemetria = raw.accessories.some(
    (a) =>
      a.key === TELEMETRIA_KEY &&
      a.classification !== "NO_APLICA" &&
      a.classification != null
  );

  const prioridad: Prioridad =
    !tieneSeguro && !tieneTelemetria
      ? "ALTA"
      : tieneSeguro && tieneTelemetria
        ? "BAJA"
        : "MEDIA";

  const oportunidad: Oportunidad =
    !tieneSeguro && !tieneTelemetria
      ? "AMBOS"
      : !tieneSeguro && tieneTelemetria
        ? "SOLO_SEGURO"
        : tieneSeguro && !tieneTelemetria
          ? "SOLO_TELEMETRIA"
          : "NINGUNA";

  return { ...raw, tieneSeguro, tieneTelemetria, prioridad, oportunidad };
}

// ─── Badge helpers ────────────────────────────────────────────
function getSeguroBadge(v: ClassifiedVehicle) {
  const acc = v.accessories.find((a) => a.key === SEGURO_KEY);
  if (!acc || acc.classification === "NO_APLICA" || !acc.classification)
    return { label: "Sin seguro", cls: "bg-red-100 text-red-700" };
  if (acc.classification === "OBSEQUIADO")
    return { label: "Obsequiado", cls: "bg-blue-100 text-blue-700" };
  return { label: "Vendido", cls: "bg-green-100 text-green-700" };
}

function getTelemetriaBadge(v: ClassifiedVehicle) {
  const acc = v.accessories.find((a) => a.key === TELEMETRIA_KEY);
  if (!acc || acc.classification === "NO_APLICA" || !acc.classification)
    return { label: "Sin telemetría", cls: "bg-amber-100 text-amber-700" };
  if (acc.classification === "OBSEQUIADO")
    return { label: "Obsequiado", cls: "bg-blue-100 text-blue-700" };
  return { label: "Vendido", cls: "bg-green-100 text-green-700" };
}

// ─── KPI Block sub-component ──────────────────────────────────
function KpiBlock({
  label,
  value,
  sub,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[110px]">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-medium">
        {label}
      </span>
      <span className={`font-bebas text-3xl leading-none ${color}`}>{value}</span>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
  );
}

// ─── BICard sub-component ─────────────────────────────────────
function BICard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Chart skeleton ───────────────────────────────────────────
function ChartSkeleton() {
  return (
    <div className="h-40 rounded-xl bg-slate-100 animate-pulse" />
  );
}

// ─── Main component ───────────────────────────────────────────
export function DashboardCallCenter() {
  // ── State ──────────────────────────────────────────────────
  const [rawVehicles, setRawVehicles] = useState<CallCenterVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagesFetched, setPagesFetched] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);

  const [search, setSearch] = useState("");
  const [filterPrioridad, setFilterPrioridad] = useState<Prioridad | "">("");
  const [filterOportunidad, setFilterOportunidad] = useState<string>("");
  const [filterSede, setFilterSede] = useState("");
  const [filterModelo, setFilterModelo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [periodFrom, setPeriodFrom] = useState(startOfCurrentMonthISO);
  const [periodTo, setPeriodTo] = useState(todayISO);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, SalePotential>>({});
  const [predictionsLoading, setPredictionsLoading] = useState<Record<string, boolean>>({});
  const [predictionsError, setPredictionsError] = useState<Record<string, string>>({});

  const [contacted, setContacted] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("cc_contacted_"));
    return new Set(keys.map((k) => k.replace("cc_contacted_", "")));
  });

  const [page, setPage] = useState(1);
  const fetchControllerRef = React.useRef<AbortController | null>(null);

  const fetchCallCenter = useCallback(async () => {
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    if (periodFrom > periodTo) {
      setError('Rango de fechas inválido.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPagesFetched(0);
    setLoadedCount(0);
    setRawVehicles([]);

    try {
      const filters = {
        sede: filterSede || undefined,
        model: filterModelo || undefined,
        status: filterStatus || undefined,
        dateFrom: periodFrom || undefined,
        dateTo: periodTo || undefined,
      };

      const { items: allVehicles } = await fetchAllPagesCursor<CallCenterVehicle>(
        "/vehicles/call-center",
        {
          params: filters,
          limit: 100,
          maxPages: 100,
          signal: controller.signal,
          onPage: async (pageData, meta) => {
            setPagesFetched(meta.pageNumber);
            setLoadedCount(meta.accumulated);
            setRawVehicles((prev) =>
              meta.pageNumber === 1 ? [...pageData.data] : [...prev, ...pageData.data],
            );
          },
        },
      );

      setRawVehicles(allVehicles);
    } catch (error) {
      if (isRequestAborted(error)) return;
      setError("No se pudo cargar la lista de vehículos.");
    } finally {
      if (fetchControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [filterSede, filterModelo, filterStatus, periodFrom, periodTo]);

  // ── Data fetch (all pages accumulated) ─────────────────────
  useEffect(() => {
    fetchCallCenter();
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [fetchCallCenter]);

  const hasPeriodError = useMemo(() => periodFrom > periodTo, [periodFrom, periodTo]);

  const resetServerFilters = useCallback(() => {
    setFilterSede("");
    setFilterModelo("");
    setFilterStatus("");
    setPeriodFrom(startOfCurrentMonthISO());
    setPeriodTo(todayISO());
  }, []);

  const periodLabel = useMemo(
    () => `${isoToDisplay(periodFrom)} - ${isoToDisplay(periodTo)}`,
    [periodFrom, periodTo]
  );

  const serverFiltersLabel = useMemo(() => {
    const bits: string[] = [];
    bits.push(filterSede ? `Sede: ${filterSede}` : "Todas las sedes");
    bits.push(filterModelo ? `Modelo: ${filterModelo}` : "Todos los modelos");
    bits.push(filterStatus ? `Estado: ${VehicleStatusLabel[filterStatus as VehicleStatusType] ?? filterStatus}` : "Todos los estados");
    return bits.join(" · ");
  }, [filterSede, filterModelo, filterStatus]);

  // ── Classification ─────────────────────────────────────────
  const clasificados = useMemo(
    () => rawVehicles.map(clasificarVehiculo),
    [rawVehicles]
  );

  const documentationCoverage = useMemo(() => {
    if (!clasificados.length) return { found: 0, missing: 0, pct: 0 };
    const found = clasificados.filter((v) => v.documentationFound !== false).length;
    const missing = clasificados.length - found;
    const pct = Math.round((found / clasificados.length) * 100);
    return { found, missing, pct };
  }, [clasificados]);

  // ── Filtered list ──────────────────────────────────────────
  const filteredList = useMemo(() => {
    const q = search.toLowerCase();
    let list = clasificados.filter((v) => {
      if (q) {
        const match =
          v.chasis.toLowerCase().includes(q) ||
          v.propietario.nombre.toLowerCase().includes(q) ||
          v.propietario.cedula.toLowerCase().includes(q) ||
          v.propietario.telefono.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (filterPrioridad && v.prioridad !== filterPrioridad) return false;
      if (filterOportunidad) {
        if (filterOportunidad === "sinAmbos" && v.oportunidad !== "AMBOS") return false;
        if (filterOportunidad === "sinSeguro" && v.oportunidad !== "SOLO_SEGURO" && v.oportunidad !== "AMBOS") return false;
        if (filterOportunidad === "sinTelemetria" && v.oportunidad !== "SOLO_TELEMETRIA" && v.oportunidad !== "AMBOS") return false;
        if (filterOportunidad === "completos" && v.oportunidad !== "NINGUNA") return false;
      }
      return true;
    });

    list = [...list].sort(
      (a, b) => PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad]
    );
    return list;
  }, [clasificados, search, filterPrioridad, filterOportunidad]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [search, filterPrioridad, filterOportunidad, filterSede, filterModelo, filterStatus, periodFrom, periodTo]);

  // ── KPIs ───────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = clasificados.length;
    const sinSeguro = clasificados.filter((v) => !v.tieneSeguro).length;
    const sinTelemetria = clasificados.filter((v) => !v.tieneTelemetria).length;
    const conSeguro = total - sinSeguro;
    const conTelemetria = total - sinTelemetria;
    const prioridadAlta = clasificados.filter((v) => v.prioridad === "ALTA").length;
    const conAmbos = clasificados.filter((v) => v.oportunidad === "NINGUNA").length;
    const pendientesActivacion = clasificados.filter((v) => v.oportunidad === "SOLO_SEGURO" || v.oportunidad === "SOLO_TELEMETRIA").length;
    const sinCoberturaPostventa = clasificados.filter((v) => v.oportunidad === "AMBOS").length;
    const contactados = contacted.size;
    const pctSinSeguro = total > 0 ? Math.round((sinSeguro / total) * 100) : 0;
    const pctSinTelemetria = total > 0 ? Math.round((sinTelemetria / total) * 100) : 0;
    const tasaSeguro = total > 0 ? Math.round((conSeguro / total) * 100) : 0;
    const tasaTelemetria = total > 0 ? Math.round((conTelemetria / total) * 100) : 0;
    const tasaCoberturaPostventa = total > 0 ? Math.round((conAmbos / total) * 100) : 0;
    return {
      total,
      sinSeguro,
      pctSinSeguro,
      sinTelemetria,
      pctSinTelemetria,
      conSeguro,
      conTelemetria,
      tasaSeguro,
      tasaTelemetria,
      prioridadAlta,
      conAmbos,
      pendientesActivacion,
      sinCoberturaPostventa,
      tasaCoberturaPostventa,
      contactados,
    };
  }, [clasificados, contacted]);

  // ── Chart data ─────────────────────────────────────────────
  const chartOportunidad = useMemo(() => [
    { name: "Sin ambos", value: clasificados.filter((v) => v.oportunidad === "AMBOS").length, color: "#ef4444" },
    { name: "Solo seguro", value: clasificados.filter((v) => v.oportunidad === "SOLO_SEGURO").length, color: "#f97316" },
    { name: "Solo telemtría", value: clasificados.filter((v) => v.oportunidad === "SOLO_TELEMETRIA").length, color: "#f59e0b" },
    { name: "Completos", value: clasificados.filter((v) => v.oportunidad === "NINGUNA").length, color: "#22c55e" },
  ], [clasificados]);

  const chartSede = useMemo(() => {
    const sedeMap: Record<string, { name: string; sinSeguro: number; sinTelemetria: number; conAmbos: number }> = {};
    clasificados.forEach((v) => {
      if (!sedeMap[v.sede]) sedeMap[v.sede] = { name: v.sede, sinSeguro: 0, sinTelemetria: 0, conAmbos: 0 };
      if (!v.tieneSeguro) sedeMap[v.sede].sinSeguro++;
      if (!v.tieneTelemetria) sedeMap[v.sede].sinTelemetria++;
      if (v.oportunidad === "NINGUNA") sedeMap[v.sede].conAmbos++;
    });
    return Object.values(sedeMap);
  }, [clasificados]);

  const chartModelo = useMemo(() => {
    const modeloMap: Record<string, number> = {};
    clasificados.filter((v) => v.oportunidad !== "NINGUNA").forEach((v) => {
      modeloMap[v.modelo] = (modeloMap[v.modelo] ?? 0) + 1;
    });
    return Object.entries(modeloMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [clasificados]);

  const chartPrioridad = useMemo(() => [
    { name: "ALTA", value: clasificados.filter((v) => v.prioridad === "ALTA").length, color: "#ef4444" },
    { name: "MEDIA", value: clasificados.filter((v) => v.prioridad === "MEDIA").length, color: "#f97316" },
    { name: "BAJA", value: clasificados.filter((v) => v.prioridad === "BAJA").length, color: "#22c55e" },
  ], [clasificados]);

  const prioridadPorContactar = useMemo(
    () => clasificados.filter((v) => v.prioridad !== "BAJA").length,
    [clasificados]
  );

  // ── Insight ────────────────────────────────────────────────
  const insight = useMemo(() => {
    if (clasificados.length === 0) return null;
    const pctSinSeguro = Math.round((clasificados.filter((v) => !v.tieneSeguro).length / clasificados.length) * 100);

    const modeloMap: Record<string, number> = {};
    clasificados.filter((v) => v.oportunidad !== "NINGUNA").forEach((v) => {
      modeloMap[v.modelo] = (modeloMap[v.modelo] ?? 0) + 1;
    });
    const modeloConMasOportunidad = Object.entries(modeloMap).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "N/A";

    const sedeMap: Record<string, number> = {};
    clasificados.filter((v) => !v.tieneSeguro || !v.tieneTelemetria).forEach((v) => {
      sedeMap[v.sede] = (sedeMap[v.sede] ?? 0) + 1;
    });
    const sedeConMasOportunidad = Object.entries(sedeMap).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "N/A";

    return `El ${pctSinSeguro}% de los vehículos entregados aún no tiene seguro. El modelo con más oportunidades es ${modeloConMasOportunidad} y la sede con mayor potencial de venta es ${sedeConMasOportunidad}.`;
  }, [clasificados]);

  // ── Unique filter options ──────────────────────────────────
  const uniqueSedes = useMemo(
    () => Array.from(new Set(clasificados.map((v) => v.sede))).sort(),
    [clasificados]
  );
  const uniqueModelos = useMemo(
    () => Array.from(new Set(clasificados.map((v) => v.modelo))).sort(),
    [clasificados]
  );
  const uniqueStatuses = useMemo(
    () => Array.from(new Set(clasificados.map((v) => v.status))).sort(),
    [clasificados]
  );

  // ── Paginated list ─────────────────────────────────────────
  const pagedList = useMemo(
    () => filteredList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredList, page]
  );
  const totalPages = Math.ceil(filteredList.length / PAGE_SIZE);

  // ── Row expand & predictions ───────────────────────────────
  const handleRowClick = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    if (!expandedId) return;
    if (predictions[expandedId] || predictionsLoading[expandedId]) return;
    setPredictionsLoading((prev) => ({ ...prev, [expandedId]: true }));
    getSalePotential(expandedId)
      .then((res) =>
        setPredictions((prev) => ({ ...prev, [expandedId]: res.data }))
      )
      .catch(() =>
        setPredictionsError((prev) => ({ ...prev, [expandedId]: "No se pudo cargar las predicciones." }))
      )
      .finally(() =>
        setPredictionsLoading((prev) => ({ ...prev, [expandedId]: false }))
      );
  }, [expandedId, predictions, predictionsLoading]);

  // ── Contactado toggle ──────────────────────────────────────
  const toggleContactado = useCallback((id: string) => {
    setContacted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        localStorage.removeItem(`cc_contacted_${id}`);
      } else {
        next.add(id);
        localStorage.setItem(`cc_contacted_${id}`, "1");
      }
      return next;
    });
  }, []);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── KPI Banner ─────────────────────────────────────── */}
      <div className="rounded-2xl bg-[#0f172a] px-6 py-5 flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div className="flex-1 min-w-0">
          <h2 className="font-bebas text-2xl text-white tracking-wide">
            Call Center · Cobertura Postventa
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pipeline documentado a entregado con foco en Seguro y Telemetría
          </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-300 bg-white/10 border border-white/15 rounded-lg px-3 py-2">
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{periodLabel}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-5">
          <KpiBlock
            label="Vehículos en gestión"
            value={loading ? "—" : kpis.total}
          />
          <KpiBlock
            label="Cobertura seguro"
            value={loading ? "—" : `${kpis.tasaSeguro}%`}
            sub={loading ? "" : `${kpis.conSeguro} con seguro`}
            color="text-emerald-400"
          />
          <KpiBlock
            label="Cobertura telemetría"
            value={loading ? "—" : `${kpis.tasaTelemetria}%`}
            sub={loading ? "" : `${kpis.conTelemetria} con telemetría`}
            color="text-cyan-400"
          />
          <KpiBlock
            label="Cobertura postventa"
            value={loading ? "—" : `${kpis.tasaCoberturaPostventa}%`}
            sub={loading ? "" : `${kpis.conAmbos} con ambos`}
            color="text-green-400"
          />
          <KpiBlock
            label="Pendientes activación"
            value={loading ? "—" : kpis.pendientesActivacion}
            sub={loading ? "" : "solo uno activo"}
            color="text-amber-400"
          />
          <KpiBlock
            label="Brecha sin cobertura"
            value={loading ? "—" : kpis.sinCoberturaPostventa}
            sub={loading ? "" : "sin seguro ni telemetría"}
            color="text-red-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
          <span>{serverFiltersLabel}</span>
          <span className="text-slate-500">|</span>
          <span>
            Cobertura documental: {documentationCoverage.pct}% ({documentationCoverage.found}/{kpis.total || 0})
          </span>
          {loading && pagesFetched > 0 && (
            <span className="text-slate-400">
              Cargando {loadedCount} registros ({pagesFetched} página{pagesFetched !== 1 ? "s" : ""})
            </span>
          )}
          {documentationCoverage.missing > 0 && (
            <span className="text-amber-300">{documentationCoverage.missing} sin documentación enlazada</span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Chart 1: Oportunidad de venta */}
        <BICard title="Oportunidad de venta">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartOportunidad} margin={{ top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartOportunidad.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </BICard>

        {/* Chart 2: Por sede */}
        <BICard title="Por sede">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartSede} margin={{ top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Bar dataKey="sinSeguro" stackId="a" fill="#ef4444" name="Sin seguro" />
                <Bar dataKey="sinTelemetria" stackId="a" fill="#f59e0b" name="Sin telemetría" />
                <Bar dataKey="conAmbos" stackId="a" fill="#22c55e" name="Con ambos" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </BICard>

        {/* Chart 3: Por modelo */}
        <BICard title="Por modelo (sin ambos)">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={chartModelo}
                layout="vertical"
                margin={{ top: 4, left: 4, right: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={60} />
                <Tooltip />
                <Bar dataKey="value" fill="#e8382f" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </BICard>

        {/* Chart 4: Distribución prioridad */}
        <BICard title="Distribución prioridad">
          {loading ? (
            <ChartSkeleton />
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={chartPrioridad}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {chartPrioridad.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-bebas text-2xl text-slate-700 leading-none">
                  {prioridadPorContactar}
                </span>
                <span className="text-[9px] text-slate-500 uppercase tracking-wide">
                  por contactar
                </span>
              </div>
            </div>
          )}
        </BICard>
      </div>

      {/* ── Insight Card ───────────────────────────────────── */}
      {!loading && clasificados.length > 0 && insight && (
        <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 flex gap-3 items-start">
          <Lightbulb className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
          <p className="text-sm text-sky-800">{insight}</p>
        </div>
      )}

      {/* ── Filters ────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs text-slate-500">
            Desde
            <input
              type="date"
              value={periodFrom}
              max={periodTo}
              onChange={(e) => setPeriodFrom(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none"
            />
          </label>
          <label className="text-xs text-slate-500">
            Hasta
            <input
              type="date"
              value={periodTo}
              min={periodFrom}
              max={todayISO()}
              onChange={(e) => setPeriodTo(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none"
            />
          </label>
          <button
            onClick={() => fetchCallCenter()}
            disabled={loading || hasPeriodError}
            className="h-[33px] px-3 rounded-lg text-xs font-medium bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          <button
            onClick={resetServerFilters}
            className="h-[33px] px-3 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
          >
            Restablecer filtros superiores
          </button>
          {hasPeriodError && (
            <span className="text-xs text-red-600">Rango inválido: "Desde" debe ser menor o igual a "Hasta".</span>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Buscar por chasis, cédula, nombre o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300"
        />

        <div className="flex flex-wrap gap-3 items-center">
          {/* Priority pills */}
          <div className="flex gap-1">
            {(["", "ALTA", "MEDIA", "BAJA"] as const).map((p) => (
              <button
                key={p || "todos"}
                onClick={() => setFilterPrioridad(p)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterPrioridad === p
                    ? p === "ALTA"
                      ? "bg-red-500 text-white"
                      : p === "MEDIA"
                        ? "bg-orange-400 text-white"
                        : p === "BAJA"
                          ? "bg-green-500 text-white"
                          : "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p || "Todos"}
              </button>
            ))}
          </div>

          {/* Oportunidad pills */}
          <div className="flex gap-1 flex-wrap">
            {[
              { key: "", label: "Todos" },
              { key: "sinAmbos", label: "Sin ambos" },
              { key: "sinSeguro", label: "Sin seguro" },
              { key: "sinTelemetria", label: "Sin telemetría" },
              { key: "completos", label: "Completos" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilterOportunidad(key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filterOportunidad === key
                    ? "bg-slate-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Filtros superiores (servidor) */}
          <select
            value={filterSede}
            onChange={(e) => setFilterSede(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none"
          >
            <option value="">Todas las sedes</option>
            {uniqueSedes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filterModelo}
            onChange={(e) => setFilterModelo(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none"
          >
            <option value="">Todos los modelos</option>
            {uniqueModelos.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs outline-none"
          >
            <option value="">Todos los estados</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>
                {VehicleStatusLabel[s as VehicleStatusType] ?? s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Prioridad</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Teléfono</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Chasis</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Modelo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Seguro</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Telemetría</th>
                <th className="px-4 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && pagedList.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">
                    No se encontraron resultados
                  </td>
                </tr>
              )}
              {!loading &&
                pagedList.map((v) => {
                  const isExpanded = expandedId === v.id;
                  const isContacted = contacted.has(v.id);
                  const seguroBadge = getSeguroBadge(v);
                  const telemetriaBadge = getTelemetriaBadge(v);

                  return (
                    <React.Fragment key={v.id}>
                      <tr
                        onClick={() => handleRowClick(v.id)}
                        className={`border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${isContacted ? "opacity-50" : ""}`}
                      >
                        {/* Prioridad */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                v.prioridad === "ALTA"
                                  ? "bg-red-500 animate-pulse"
                                  : v.prioridad === "MEDIA"
                                    ? "bg-orange-400"
                                    : "bg-green-500"
                              }`}
                            />
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                v.prioridad === "ALTA"
                                  ? "bg-red-100 text-red-700"
                                  : v.prioridad === "MEDIA"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-green-100 text-green-700"
                              }`}
                            >
                              {v.prioridad}
                            </span>
                          </div>
                        </td>

                        {/* Estado */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              VehicleStatusColor[v.status as VehicleStatusType] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {VehicleStatusLabel[v.status as VehicleStatusType] ?? v.status}
                          </span>
                        </td>

                        {/* Cliente */}
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800 text-sm leading-tight">
                            {v.propietario.nombre || "—"}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {v.propietario.cedula || "—"}
                          </div>
                        </td>

                        {/* Teléfono */}
                        <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                          {v.propietario.telefono || "—"}
                        </td>

                        {/* Chasis */}
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-medium text-slate-700 leading-tight">
                            {v.chasis}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {v.sede} · {v.año}
                          </div>
                        </td>

                        {/* Modelo */}
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-slate-700 leading-tight">
                            {v.modelo}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">{v.color}</div>
                        </td>

                        {/* Seguro badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${seguroBadge.cls}`}>
                            {seguroBadge.label}
                          </span>
                        </td>

                        {/* Telemetría badge */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${telemetriaBadge.cls}`}>
                            {telemetriaBadge.label}
                          </span>
                        </td>

                        {/* Expand chevron */}
                        <td className="px-4 py-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </td>
                      </tr>

                      {/* Expanded row */}
                      {isExpanded && (
                        <tr className="bg-slate-50">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="flex flex-col gap-3">
                              {predictionsLoading[v.id] && (
                                <div className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                              )}

                              {predictionsError[v.id] && (
                                <p className="text-sm text-red-600">
                                  {predictionsError[v.id]}
                                </p>
                              )}

                              {!predictionsLoading[v.id] && predictions[v.id] && (
                                <div>
                                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                    Predicciones de venta
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {predictions[v.id].highPotentialItems
                                      .filter(
                                        (item) =>
                                          item.key === SEGURO_KEY ||
                                          item.key === TELEMETRIA_KEY
                                      )
                                      .map((item) => (
                                        <div
                                          key={item.key}
                                          className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs shadow-sm min-w-[140px]"
                                        >
                                          <p className="font-semibold text-slate-700 mb-0.5 capitalize">
                                            {item.key.toLowerCase()}
                                          </p>
                                          <p className="text-green-600 font-bold text-sm">
                                            {item.probability}%
                                          </p>
                                          <p className="text-slate-400 text-[10px] mt-0.5 leading-tight">
                                            {item.reason}
                                          </p>
                                        </div>
                                      ))}
                                    {predictions[v.id].highPotentialItems.filter(
                                      (i) => i.key === SEGURO_KEY || i.key === TELEMETRIA_KEY
                                    ).length === 0 && (
                                      <p className="text-xs text-slate-400 italic">
                                        Sin predicciones de seguro o telemetría disponibles.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Marcar contactado */}
                              <div className="flex items-center gap-3 pt-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleContactado(v.id);
                                  }}
                                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                    contacted.has(v.id)
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : "bg-slate-700 text-white hover:bg-slate-800"
                                  }`}
                                >
                                  {contacted.has(v.id) ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Contactado ✓
                                    </>
                                  ) : (
                                    <>
                                      <Phone className="w-3.5 h-3.5" />
                                      Marcar como contactado
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredList.length > PAGE_SIZE && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-slate-100">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-xs text-slate-500">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
