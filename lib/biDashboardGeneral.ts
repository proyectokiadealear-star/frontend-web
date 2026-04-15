export type BIDashboardGeneralPeriod =
  | "day"
  | "week"
  | "month";

export interface BIDashboardGeneralQuery {
  period: BIDashboardGeneralPeriod;
  groupBy?: BIDashboardGeneralPeriod;
  from?: string;
  to?: string;
  timezone?: string;
  compare?: string;
  // fallback support for older caller shape (inbound only)
  compare_mode?: string;
  filters?: {
    branchId?: string;
    channel?: string;
  };
}

export interface BIDashboardGeneralResponse {
  meta?: {
    period?: string;
    range?: {
      from?: string;
      to?: string;
    };
    compare_mode?: string;
    generated_at?: string;
    currency?: string;
    from?: string;
    to?: string;
    timezone?: string;
    compare?: string;
    filters?: Record<string, unknown>;
  };
  kpis?: unknown;
  series?: unknown;
  alerts?: unknown;
  otif_breakdown?: unknown;
  accessories?: BIAccessoriesResponse;
}

export interface BIAccessoryByKeyCounters {
  VENDIDO?: number;
  OBSEQUIADO?: number;
  NO_APLICA?: number;
}

export interface BIAccessoriesResponse {
  byKey: Record<string, BIAccessoryByKeyCounters>;
  topSold: { key: string; vendido: number }[];
  totalVendido: number;
  totalObsequiado: number;
  totalNoAplica: number;
}

export interface BIAnalyticsResponse {
  total: number;
  vehiclesDelivered: number;
  vehiclesCreatedInPeriod?: number;
  byStatus: Record<string, number>;
  bySede: Record<string, number>;
  byModel: Record<string, number>;
  byColor?: Record<string, number>;
  avgDaysToDelivery: number | null;
  medianDaysToDelivery: number | null;
  byModelRotation?: Record<string, { avgDays: number; count: number }>;
  byMonthlyDeliveries: { month: string; count: number }[];
  deliverySeriesGranularity?: BIDashboardGeneralPeriod;
  accessories: {
    byKey: Record<string, BIAccessoryByKeyCounters>;
    topSold: { key: string; vendido: number }[];
    totalVendido: number;
    totalObsequiado: number;
    totalNoAplica?: number;
  };
  topAsesores: {
    ordenesGeneradas: { uid: string; name: string; sede: string; ordenes: number }[];
    entregas: { uid: string; name: string; sede: string; entregas: number }[];
  };
  topTaller: { uid: string; name: string; sede: string; totalOTs: number }[];
  otif?: {
    numerator: number;
    denominator: number;
    valuePct: number | null;
    missingPromisedDate: number;
    insufficientData: number;
    passed?: number;
    failed?: number;
    noEvaluable?: number;
    totalDeliveriesInPeriod?: number;
    totalDeliveriesEvaluable?: number;
    failureReasons?: {
      late: number;
      incomplete_docs: number;
      incomplete_accessories: number;
    };
    definitionVersion: string;
  };
}

export interface BIOtifBreakdown {
  numerator: number;
  denominator: number;
  valuePct: number | null;
  missingPromisedDate: number;
  insufficientData: number;
  passed: number;
  failed: number;
  noEvaluable: number;
  totalDeliveriesInPeriod: number;
  totalDeliveriesEvaluable: number;
  failureReasons: {
    late: number;
    incomplete_docs: number;
    incomplete_accessories: number;
  };
  definitionVersion: string;
}

type DeliveryPoint = { key: string; count: number };

export interface BIDashboardGeneralKpi {
  id: string;
  label: string;
  value: number | null;
  formatted_value: string;
  previous_value?: number | null;
  delta_pct?: number | null;
  last_updated_at?: string;
  subtitle?: string;
  trend?: string;
}

export interface BIDashboardGeneralSeriesPoint {
  t: string;
  value: number;
}

export interface BIDashboardGeneralSeries {
  kpi_id: string;
  granularity: string;
  label: string;
  points: BIDashboardGeneralSeriesPoint[];
}

export interface BIDashboardGeneralAlert {
  id: string;
  severity: "info" | "warning" | "critical" | "success";
  title: string;
  message: string;
  recommended_action?: string;
  detected_at?: string;
}

export interface BIDashboardGeneralVM {
  meta: {
    period: string;
    range: {
      from?: string;
      to?: string;
    };
    compare_mode?: string;
    generated_at?: string;
    currency: string;
    timezone: string;
    filters: {
      branchId?: string;
      channel?: string;
    };
  };
  kpis: BIDashboardGeneralKpi[];
  series: BIDashboardGeneralSeries[];
  alerts: BIDashboardGeneralAlert[];
  otifBreakdown?: BIOtifBreakdown;
  accessories: BIAccessoriesResponse;
}

function safeString(input: unknown): string {
  return typeof input === "string" ? input : "";
}

function safeNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string" && input.trim() !== "") {
    const n = Number(input);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const PIPELINE_STATUS_ORDER = [
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
] as const;

function formatISODateToAnalyticsDate(input?: string): string | undefined {
  if (!input) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return input;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function asRecordPoints(record?: Record<string, number>): BIDashboardGeneralSeriesPoint[] {
  if (!record) return [];
  return Object.entries(record)
    .filter(([, value]) => Number.isFinite(value))
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ t: key, value }));
}

function formatMetricValue(value: number | null, suffix = ""): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toLocaleString("es-EC")}${suffix}`;
}

function createAnalyticsAlerts(data: BIAnalyticsResponse): BIDashboardGeneralAlert[] {
  const alerts: BIDashboardGeneralAlert[] = [];
  const periodBase = data.vehiclesCreatedInPeriod ?? 0;
  const deliveryRate = periodBase > 0 ? (data.vehiclesDelivered / periodBase) * 100 : null;
  const deliveredBase = data.vehiclesDelivered > 0 ? data.vehiclesDelivered : 0;
  const otifMissing = data.otif?.missingPromisedDate ?? 0;
  const otifInsufficient = data.otif?.insufficientData ?? 0;
  const otifDataIssues = otifMissing + otifInsufficient;

  if (data.total === 0) {
    alerts.push({
      id: "sin_datos",
      severity: "info",
      title: "Sin datos en el rango seleccionado",
      message: "No se encontraron registros para los filtros aplicados.",
    });
  }

  if (deliveryRate != null && deliveryRate < 40) {
    alerts.push({
      id: "ritmo_entrega_bajo",
      severity: "warning",
      title: "Ritmo de entrega por debajo del objetivo",
      message: `La tasa actual es ${deliveryRate.toFixed(1)}% en el periodo seleccionado.`,
    });
  }

  if (deliveredBase > 0 && otifDataIssues / deliveredBase >= 0.2) {
    alerts.push({
      id: "otif_data_quality",
      severity: "warning",
      title: "Calidad de datos OTIF requiere atención",
      message: `${otifDataIssues} entregas no se evaluaron en OTIF (sin fecha pactada: ${otifMissing}, datos incompletos: ${otifInsufficient}).`,
      recommended_action: "Completar fecha pactada en agendamientos y documentación/checklist de accesorios.",
    });
  }

  if (typeof data.avgDaysToDelivery === "number" && data.avgDaysToDelivery > 45) {
    alerts.push({
      id: "rotacion_lenta",
      severity: "warning",
      title: "Rotacion promedio alta",
      message: `El tiempo promedio de entrega es ${data.avgDaysToDelivery.toFixed(1)} dias.`,
    });
  }

  return alerts;
}

function resolveSeriesGranularity(
  data: BIAnalyticsResponse,
  query: BIDashboardGeneralQuery,
): BIDashboardGeneralPeriod {
  return data.deliverySeriesGranularity ?? query.groupBy ?? query.period ?? "month";
}

function formatGranularityLabel(granularity: BIDashboardGeneralPeriod): string {
  if (granularity === "day") return "diario";
  if (granularity === "week") return "semanal";
  return "mensual";
}

function getDaysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function parseIsoWeekKey(key: string): { year: number; week: number } | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) return null;
  return { year: Number(match[1]), week: Number(match[2]) };
}

function getIsoWeekStartUTC(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function toISODateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toISOMonthUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getISOWeekPartsUTC(date: Date): { year: number; week: number } {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: utc.getUTCFullYear(), week };
}

function expandDeliveryPointToDaily(
  point: DeliveryPoint,
  sourceGranularity: BIDashboardGeneralPeriod,
): Array<{ date: string; value: number }> {
  if (sourceGranularity === "day") {
    return [{ date: point.key, value: point.count }];
  }

  if (sourceGranularity === "week") {
    const parsed = parseIsoWeekKey(point.key);
    if (!parsed) return [];
    const start = getIsoWeekStartUTC(parsed.year, parsed.week);
    const chunk = point.count / 7;
    const days: Array<{ date: string; value: number }> = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      days.push({ date: toISODateUTC(d), value: chunk });
    }
    return days;
  }

  const match = /^(\d{4})-(\d{2})$/.exec(point.key);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const daysInMonth = getDaysInMonth(year, month);
  const chunk = point.count / daysInMonth;
  const days: Array<{ date: string; value: number }> = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const d = new Date(Date.UTC(year, month - 1, day));
    days.push({ date: toISODateUTC(d), value: chunk });
  }
  return days;
}

function reaggregateDailyPoints(
  daily: Array<{ date: string; value: number }>,
  targetGranularity: BIDashboardGeneralPeriod,
): BIDashboardGeneralSeriesPoint[] {
  const buckets = new Map<string, number>();

  for (const row of daily) {
    if (!row.date) continue;
    const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(row.date);
    if (!parsed) continue;
    const date = new Date(Date.UTC(Number(parsed[1]), Number(parsed[2]) - 1, Number(parsed[3])));

    let key = row.date;
    if (targetGranularity === "week") {
      const iso = getISOWeekPartsUTC(date);
      key = `${iso.year}-W${String(iso.week).padStart(2, "0")}`;
    } else if (targetGranularity === "month") {
      key = toISOMonthUTC(date);
    }

    buckets.set(key, (buckets.get(key) ?? 0) + row.value);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([t, value]) => ({ t, value: Math.round(value * 10) / 10 }));
}

function buildDeliveryTrendPoints(
  data: BIAnalyticsResponse,
  targetGranularity: BIDashboardGeneralPeriod,
): BIDashboardGeneralSeriesPoint[] {
  const raw = (data.byMonthlyDeliveries ?? []).map((item) => ({
    key: item.month,
    count: item.count,
  }));
  const sourceGranularity = data.deliverySeriesGranularity ?? "month";

  if (sourceGranularity === targetGranularity) {
    return raw.map((item) => ({ t: item.key, value: item.count }));
  }

  const daily = raw.flatMap((point) => expandDeliveryPointToDaily(point, sourceGranularity));
  return reaggregateDailyPoints(daily, targetGranularity);
}

function buildExecutiveKpis(
  data: BIAnalyticsResponse,
  granularity: BIDashboardGeneralPeriod,
): BIDashboardGeneralKpi[] {
  const otifValue = data.otif?.valuePct ?? null;
  const labelSuffix = formatGranularityLabel(granularity);

  return [
    {
      id: "inventario_activo",
      label: "Inventario activo",
      value: data.total,
      formatted_value: formatMetricValue(data.total),
      subtitle: "Stock actual filtrado",
    },
    {
      id: "entregas_periodo",
      label: "Entregas periodo",
      value: data.vehiclesDelivered,
      formatted_value: formatMetricValue(data.vehiclesDelivered),
      subtitle: `Corte ${labelSuffix}`,
    },
    {
      id: "ingresos_periodo",
      label: "Ingresos periodo",
      value: data.vehiclesCreatedInPeriod ?? 0,
      formatted_value: formatMetricValue(data.vehiclesCreatedInPeriod ?? 0),
      subtitle: `Base ${labelSuffix}`,
    },
    {
      id: "otif_v1",
      label: "OTIF v1",
      value: otifValue,
      formatted_value:
        otifValue == null || !Number.isFinite(otifValue)
          ? "-"
          : `${otifValue.toFixed(1)}%`,
      subtitle:
        data.otif && data.otif.denominator > 0
          ? `Entregas OTIF ${data.otif.numerator} de ${data.otif.denominator} evaluadas`
          : "Sin datos suficientes",
      trend: otifValue != null && otifValue >= 90 ? "favorable" : "atencion",
    },
    {
      id: "dias_promedio_entrega",
      label: "Dias prom. entrega",
      value: data.avgDaysToDelivery,
      formatted_value: formatMetricValue(data.avgDaysToDelivery, " d"),
      subtitle: data.medianDaysToDelivery != null ? `Mediana ${data.medianDaysToDelivery} d` : undefined,
    },
  ];
}

function buildMeta(data: BIAnalyticsResponse, query: BIDashboardGeneralQuery): BIDashboardGeneralResponse["meta"] {
  const granularity = resolveSeriesGranularity(data, query);
  return {
    period: granularity,
    range: {
      from: query.from,
      to: query.to,
    },
    compare_mode: query.compare ?? query.compare_mode,
    generated_at: new Date().toISOString(),
    currency: "USD",
    timezone: query.timezone ?? "UTC",
    filters: {
      branchId: query.filters?.branchId,
      channel: query.filters?.channel,
    },
  };
}

function buildAccessories(data: BIAnalyticsResponse): BIAccessoriesResponse {
  const byKey = data.accessories?.byKey ?? {};
  const topSold = data.accessories?.topSold ?? [];
  const computedNoAplica = Object.values(byKey).reduce(
    (sum, item) => sum + (item?.NO_APLICA ?? 0),
    0,
  );

  return {
    byKey,
    topSold,
    totalVendido: data.accessories?.totalVendido ?? 0,
    totalObsequiado: data.accessories?.totalObsequiado ?? 0,
    totalNoAplica: data.accessories?.totalNoAplica ?? computedNoAplica,
  };
}

function buildPipelineSeries(data: BIAnalyticsResponse): BIDashboardGeneralSeries {
  return {
    kpi_id: "pipeline_status",
    granularity: "snapshot",
    label: "Embudo de flujo",
    points: PIPELINE_STATUS_ORDER.map((statusKey) => ({
      t: statusKey,
      value: data.byStatus?.[statusKey] ?? 0,
    })),
  };
}

function buildTopSeries(data: BIAnalyticsResponse): BIDashboardGeneralSeries[] {
  const topOrdersPoints = (data.topAsesores?.ordenesGeneradas ?? []).map((item) => ({
    t: item.sede ? `${item.name} (${item.sede})` : item.name,
    value: item.ordenes,
  }));
  const topDeliveriesPoints = (data.topAsesores?.entregas ?? []).map((item) => ({
    t: item.sede ? `${item.name} (${item.sede})` : item.name,
    value: item.entregas,
  }));
  const topWorkshopPoints = (data.topTaller ?? []).map((item) => ({
    t: item.sede ? `${item.name} (${item.sede})` : item.name,
    value: item.totalOTs,
  }));

  return [
    {
      kpi_id: "topasesores_ordenes",
      granularity: "snapshot",
      label: "Top asesores por ordenes",
      points: topOrdersPoints,
    },
    {
      kpi_id: "topasesores_entregas",
      granularity: "snapshot",
      label: "Top asesores por entregas",
      points: topDeliveriesPoints,
    },
    {
      kpi_id: "toptaller",
      granularity: "snapshot",
      label: "Top taller",
      points: topWorkshopPoints,
    },
  ];
}

function buildDistributionSeries(data: BIAnalyticsResponse): BIDashboardGeneralSeries[] {
  const modelRotationPoints = Object.entries(data.byModelRotation ?? {})
    .filter(([, value]) => Number.isFinite(value?.avgDays))
    .sort((a, b) => b[1].avgDays - a[1].avgDays)
    .map(([key, value]) => ({ t: key, value: value.avgDays }));

  const accessoriesTopSoldPoints = data.accessories?.topSold
    ? [...data.accessories.topSold]
        .sort((a, b) => b.vendido - a.vendido)
        .map((item) => ({ t: item.key, value: item.vendido }))
    : [];

  return [
    {
      kpi_id: "by_model",
      granularity: "snapshot",
      label: "Modelos",
      points: asRecordPoints(data.byModel),
    },
    {
      kpi_id: "by_sede",
      granularity: "snapshot",
      label: "Sedes",
      points: asRecordPoints(data.bySede),
    },
    {
      kpi_id: "accessories_top_sold",
      granularity: "snapshot",
      label: "Accesorios vendidos",
      points: accessoriesTopSoldPoints,
    },
    {
      kpi_id: "by_color",
      granularity: "snapshot",
      label: "Colores",
      points: asRecordPoints(data.byColor),
    },
    {
      kpi_id: "model_rotation_avg_days",
      granularity: "snapshot",
      label: "Rotacion por modelo",
      points: modelRotationPoints,
    },
  ];
}

function buildDeliverySeries(
  data: BIAnalyticsResponse,
  granularity: BIDashboardGeneralPeriod,
): BIDashboardGeneralSeries {
  return {
    kpi_id: "monthly_deliveries",
    granularity,
    label: `Entregas ${formatGranularityLabel(granularity)}`,
    points: buildDeliveryTrendPoints(data, granularity),
  };
}

function buildSeries(data: BIAnalyticsResponse, query: BIDashboardGeneralQuery): BIDashboardGeneralSeries[] {
  const granularity = resolveSeriesGranularity(data, query);
  return [
    buildPipelineSeries(data),
    ...buildDistributionSeries(data),
    buildDeliverySeries(data, granularity),
    ...buildTopSeries(data),
  ];
}

function buildOtifBreakdown(data: BIAnalyticsResponse): BIOtifBreakdown | undefined {
  if (!data.otif) return undefined;

  const numerator = data.otif.numerator ?? 0;
  const denominator = data.otif.denominator ?? 0;
  const missingPromisedDate = data.otif.missingPromisedDate ?? 0;
  const insufficientData = data.otif.insufficientData ?? 0;
  const passed = data.otif.passed ?? numerator;
  const failed = data.otif.failed ?? Math.max(denominator - passed, 0);
  const noEvaluable = data.otif.noEvaluable ?? missingPromisedDate + insufficientData;

  return {
    numerator,
    denominator,
    valuePct: data.otif.valuePct ?? null,
    missingPromisedDate,
    insufficientData,
    passed,
    failed,
    noEvaluable,
    totalDeliveriesInPeriod: data.otif.totalDeliveriesInPeriod ?? data.vehiclesDelivered ?? 0,
    totalDeliveriesEvaluable: data.otif.totalDeliveriesEvaluable ?? denominator,
    failureReasons: {
      late: data.otif.failureReasons?.late ?? 0,
      incomplete_docs: data.otif.failureReasons?.incomplete_docs ?? 0,
      incomplete_accessories: data.otif.failureReasons?.incomplete_accessories ?? 0,
    },
    definitionVersion: data.otif.definitionVersion,
  };
}

export function mapBIAnalyticsToBIDashboardGeneralResponse(
  data: BIAnalyticsResponse,
  query: BIDashboardGeneralQuery,
): BIDashboardGeneralResponse {
  const granularity = resolveSeriesGranularity(data, query);
  return {
    meta: buildMeta(data, query),
    kpis: buildExecutiveKpis(data, granularity),
    series: buildSeries(data, query),
    alerts: createAnalyticsAlerts(data),
    otif_breakdown: buildOtifBreakdown(data),
    accessories: buildAccessories(data),
  };
}

function parseKpis(input: unknown): BIDashboardGeneralKpi[] {
  if (!input) return [];

  const fromEntry = (key: string, value: unknown): BIDashboardGeneralKpi => {
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      const numeric = safeNumber(obj.value);
      return {
        id: safeString(obj.id) || safeString(obj.kpi_id) || key,
        label: safeString(obj.label) || key,
        value: numeric,
        formatted_value:
          safeString(obj.formatted_value) ||
          safeString(obj.formattedValue) ||
          (numeric != null ? String(numeric) : "—"),
        previous_value:
          safeNumber(obj.previous_value) ?? safeNumber(obj.previousValue),
        delta_pct: safeNumber(obj.delta_pct) ?? safeNumber(obj.deltaPct),
        last_updated_at:
          safeString(obj.last_updated_at) || safeString(obj.lastUpdatedAt) || undefined,
        subtitle: safeString(obj.subtitle) || undefined,
        trend: safeString(obj.trend) || undefined,
      };
    }

    const numeric = safeNumber(value);
    return {
      id: key,
      label: key,
      value: numeric,
      formatted_value: numeric != null ? String(numeric) : "—",
    };
  };

  if (Array.isArray(input)) {
    return input
      .map((item, idx) => {
        if (typeof item !== "object" || item === null) {
          return fromEntry(`kpi_${idx + 1}`, item);
        }
        const obj = item as Record<string, unknown>;
        const id =
          safeString(obj.id) ||
          safeString(obj.kpi_id) ||
          safeString(obj.key) ||
          `kpi_${idx + 1}`;
        const numeric = safeNumber(obj.value);
        return {
          id,
          label: safeString(obj.label) || id,
          value: numeric,
          formatted_value:
            safeString(obj.formatted_value) ||
            safeString(obj.formattedValue) ||
            (numeric != null ? String(numeric) : "—"),
          previous_value:
            safeNumber(obj.previous_value) ?? safeNumber(obj.previousValue),
          delta_pct: safeNumber(obj.delta_pct) ?? safeNumber(obj.deltaPct),
          last_updated_at:
            safeString(obj.last_updated_at) || safeString(obj.lastUpdatedAt) || undefined,
          subtitle: safeString(obj.subtitle) || undefined,
          trend: safeString(obj.trend) || undefined,
        };
      })
      .filter((kpi) => kpi.label);
  }

  if (typeof input === "object") {
    return Object.entries(input as Record<string, unknown>).map(([key, value]) =>
      fromEntry(key, value),
    );
  }

  return [];
}

function parseSeriesPoints(input: unknown): BIDashboardGeneralSeriesPoint[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, idx) => {
      if (typeof item === "number") {
        return { t: String(idx + 1), value: item };
      }
      if (typeof item !== "object" || item === null) return null;

      const obj = item as Record<string, unknown>;
      const x =
        safeString(obj.t) ||
        safeString(obj.x) ||
        safeString(obj.label) ||
        safeString(obj.date) ||
        safeString(obj.period) ||
        String(idx + 1);
      const y =
        safeNumber(obj.value) ??
        safeNumber(obj.y) ??
        safeNumber(obj.count) ??
        0;

      return { t: x, value: y };
    })
    .filter((point): point is BIDashboardGeneralSeriesPoint => point !== null);
}

function parseSeries(input: unknown): BIDashboardGeneralSeries[] {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .map((item, idx) => {
        if (typeof item !== "object" || item === null) return null;
        const obj = item as Record<string, unknown>;
        const kpiId = safeString(obj.kpi_id) || safeString(obj.key) || `series_${idx + 1}`;
        const label = safeString(obj.label) || kpiId;
        const granularity = safeString(obj.granularity) || safeString(obj.group_by) || "day";
        const points = parseSeriesPoints(obj.points ?? obj.data ?? obj.values);
        return { kpi_id: kpiId, granularity, label, points };
      })
      .filter((s): s is BIDashboardGeneralSeries => !!s);
  }

  if (typeof input === "object") {
    return Object.entries(input as Record<string, unknown>).map(([kpiId, value]) => {
      if (Array.isArray(value)) {
        return {
          kpi_id: kpiId,
          label: kpiId,
          granularity: "day",
          points: parseSeriesPoints(value),
        };
      }

      if (typeof value === "object" && value !== null) {
        const obj = value as Record<string, unknown>;
        return {
          kpi_id: safeString(obj.kpi_id) || kpiId,
          label: safeString(obj.label) || kpiId,
          granularity: safeString(obj.granularity) || safeString(obj.group_by) || "day",
          points: parseSeriesPoints(obj.points ?? obj.data ?? obj.values),
        };
      }

      return { kpi_id: kpiId, label: kpiId, granularity: "day", points: [] };
    });
  }

  return [];
}

function parseAlerts(input: unknown): BIDashboardGeneralAlert[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, idx) => {
      if (typeof item !== "object" || item === null) return null;
      const obj = item as Record<string, unknown>;
      const rawSeverity = safeString(obj.severity || obj.level || obj.type).toLowerCase();
      const severity: BIDashboardGeneralAlert["severity"] =
        rawSeverity === "warning" ||
        rawSeverity === "critical" ||
        rawSeverity === "success"
          ? rawSeverity
          : "info";

      const title = safeString(obj.title) || safeString(obj.label) || `Alerta ${idx + 1}`;
      const message = safeString(obj.message) || safeString(obj.description) || "";

      const alert: BIDashboardGeneralAlert = {
        id: safeString(obj.id) || `${severity}_${idx + 1}`,
        severity,
        title,
        message,
        recommended_action:
          safeString(obj.recommended_action) || safeString(obj.recommendedAction) || undefined,
        detected_at: safeString(obj.detected_at) || safeString(obj.detectedAt) || undefined,
      };
      return alert;
    })
    .filter((a): a is BIDashboardGeneralAlert => !!a);
}

function parseOtifBreakdown(input: unknown): BIOtifBreakdown | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;

  const numerator = safeNumber(raw.numerator) ?? 0;
  const denominator = safeNumber(raw.denominator) ?? 0;
  const missingPromisedDate = safeNumber(raw.missingPromisedDate) ?? 0;
  const insufficientData = safeNumber(raw.insufficientData) ?? 0;
  const passed = safeNumber(raw.passed) ?? numerator;
  const failed = safeNumber(raw.failed) ?? Math.max(denominator - passed, 0);
  const noEvaluable = safeNumber(raw.noEvaluable) ?? missingPromisedDate + insufficientData;
  const totalDeliveriesInPeriod =
    safeNumber(raw.totalDeliveriesInPeriod) ?? safeNumber(raw.totalDeliveries) ?? denominator + noEvaluable;
  const totalDeliveriesEvaluable = safeNumber(raw.totalDeliveriesEvaluable) ?? denominator;
  const failureReasonsRaw = (raw.failureReasons ?? {}) as Record<string, unknown>;

  return {
    numerator,
    denominator,
    valuePct: safeNumber(raw.valuePct),
    missingPromisedDate,
    insufficientData,
    passed,
    failed,
    noEvaluable,
    totalDeliveriesInPeriod,
    totalDeliveriesEvaluable,
    failureReasons: {
      late: safeNumber(failureReasonsRaw.late) ?? 0,
      incomplete_docs: safeNumber(failureReasonsRaw.incomplete_docs) ?? 0,
      incomplete_accessories: safeNumber(failureReasonsRaw.incomplete_accessories) ?? 0,
    },
    definitionVersion: safeString(raw.definitionVersion) || "v1",
  };
}

function parseAccessories(input: unknown): BIAccessoriesResponse {
  if (!input || typeof input !== "object") {
    return {
      byKey: {},
      topSold: [],
      totalVendido: 0,
      totalObsequiado: 0,
      totalNoAplica: 0,
    };
  }

  const raw = input as Record<string, unknown>;
  const byKeyRaw =
    raw.byKey && typeof raw.byKey === "object"
      ? (raw.byKey as Record<string, unknown>)
      : {};
  const byKey: Record<string, BIAccessoryByKeyCounters> = Object.entries(byKeyRaw).reduce(
    (acc, [key, value]) => {
      if (!value || typeof value !== "object") {
        acc[key] = { VENDIDO: 0, OBSEQUIADO: 0, NO_APLICA: 0 };
        return acc;
      }

      const row = value as Record<string, unknown>;
      acc[key] = {
        VENDIDO: safeNumber(row.VENDIDO) ?? 0,
        OBSEQUIADO: safeNumber(row.OBSEQUIADO) ?? 0,
        NO_APLICA: safeNumber(row.NO_APLICA) ?? 0,
      };
      return acc;
    },
    {} as Record<string, BIAccessoryByKeyCounters>,
  );

  const topSoldRaw = Array.isArray(raw.topSold) ? raw.topSold : [];
  const topSold = topSoldRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        key: safeString(row.key),
        vendido: safeNumber(row.vendido) ?? 0,
      };
    })
    .filter((row): row is { key: string; vendido: number } => !!row && !!row.key);

  const computedNoAplica = Object.values(byKey).reduce(
    (sum, item) => sum + (item.NO_APLICA ?? 0),
    0,
  );

  return {
    byKey,
    topSold,
    totalVendido: safeNumber(raw.totalVendido) ?? 0,
    totalObsequiado: safeNumber(raw.totalObsequiado) ?? 0,
    totalNoAplica: safeNumber(raw.totalNoAplica) ?? computedNoAplica,
  };
}

export function mapBIDashboardGeneralResponse(
  response: BIDashboardGeneralResponse,
): BIDashboardGeneralVM {
  const meta = response.meta ?? {};
  const filters = (meta.filters ?? {}) as Record<string, unknown>;
  const range = (meta.range ?? {}) as Record<string, unknown>;
  const period = safeString(meta.period);

  return {
    meta: {
      period: period === "day" || period === "week" || period === "month" ? period : "day",
      range: {
        from: safeString(range.from) || safeString(meta.from) || undefined,
        to: safeString(range.to) || safeString(meta.to) || undefined,
      },
      compare_mode: safeString(meta.compare_mode) || safeString(meta.compare) || undefined,
      generated_at: safeString(meta.generated_at) || undefined,
      currency: safeString(meta.currency) || "USD",
      timezone: safeString(meta.timezone) || "UTC",
      filters: {
        branchId: safeString(filters.branchId) || undefined,
        channel: safeString(filters.channel) || undefined,
      },
    },
    kpis: parseKpis(response.kpis),
    series: parseSeries(response.series),
    alerts: parseAlerts(response.alerts),
    otifBreakdown: parseOtifBreakdown(response.otif_breakdown),
    accessories: parseAccessories(response.accessories),
  };
}

export function buildBIDashboardGeneralParams(query: BIDashboardGeneralQuery): Record<string, string> {
  const params: Record<string, string> = {};
  const dateFrom = formatISODateToAnalyticsDate(query.from);
  const dateTo = formatISODateToAnalyticsDate(query.to);
  const sede = query.filters?.branchId?.trim();
  const model = query.filters?.channel?.trim();
  const groupBy = query.groupBy ?? query.period;

  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  if (sede) params.sede = sede;
  if (model) params.model = model;
  if (groupBy) params.groupBy = groupBy;

  return params;
}
