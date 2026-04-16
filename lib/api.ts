import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";
import type {
  Vehicle,
  VehicleFilters,
  PaginatedResponse,
  StatusHistoryEntry,
  Certification,
  Documentation,
  DeliveryCeremony,
  ServiceOrder,
  Appointment,
  CatalogItem,
  UserProfile,
  Notification,
  SalePotential,
} from "@/types";
import type {
  BIAnalyticsResponse,
  BIDashboardGeneralQuery,
  BIDashboardGeneralResponse,
} from "@/lib/biDashboardGeneral";
import {
  buildBIDashboardGeneralParams,
  mapBIAnalyticsToBIDashboardGeneralResponse,
} from "@/lib/biDashboardGeneral";

type ApiResult<T> = { data: T };

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;

type CursorPageOptions = {
  params?: QueryParams;
  limit?: number;
  legacyArrayFallback?: boolean;
  signal?: AbortSignal;
};

type FetchAllPagesCursorOptions = CursorPageOptions & {
  maxPages?: number;
};

type FetchAllPagesCursorMeta = {
  pageNumber: number;
  accumulated: number;
};

type FetchAllPagesCursorOptionsWithCallback<T> = FetchAllPagesCursorOptions & {
  onPage?: (
    page: PaginatedResponse<T>,
    meta: FetchAllPagesCursorMeta,
  ) => void | Promise<void>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toPositiveNumberOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;

const cleanParams = (params?: QueryParams): QueryParams => {
  if (!params) return {};
  const cleaned: QueryParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    cleaned[key] = value;
  }
  return cleaned;
};

const normalizePaginatedResponse = <T>(
  payload: unknown,
  options?: CursorPageOptions,
): PaginatedResponse<T> => {
  if (Array.isArray(payload) && options?.legacyArrayFallback) {
    const limit = options.limit ?? payload.length;
    return {
      data: payload as T[],
      total: payload.length,
      page: 1,
      limit,
      totalPages: limit > 0 ? Math.max(1, Math.ceil(payload.length / limit)) : 1,
      nextCursor: null,
    };
  }

  if (!isPlainObject(payload)) {
    const fallbackLimit = options?.limit ?? 0;
    return {
      data: [],
      total: 0,
      page: 1,
      limit: fallbackLimit,
      totalPages: 1,
      nextCursor: null,
    };
  }

  const rows = Array.isArray(payload.data) ? (payload.data as T[]) : [];
  const limit = toPositiveNumberOr(payload.limit, options?.limit ?? (rows.length || 1));
  const total = toPositiveNumberOr(payload.total, rows.length);
  const page = toPositiveNumberOr(payload.page, 1);
  const totalPages = toPositiveNumberOr(
    payload.totalPages,
    limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1,
  );
  const nextCursor =
    typeof payload.nextCursor === "string"
      ? payload.nextCursor
      : payload.nextCursor === null
        ? null
        : null;

  return {
    data: rows,
    total,
    page,
    limit,
    totalPages,
    nextCursor,
  };
};

export const getFirstPage = async <T>(
  endpoint: string,
  options?: CursorPageOptions,
): Promise<PaginatedResponse<T>> => {
  const params: QueryParams = {
    ...cleanParams(options?.params),
    ...(options?.limit ? { limit: options.limit } : {}),
  };
  const response = await api.get(endpoint, { params, signal: options?.signal });
  return normalizePaginatedResponse<T>(response.data, options);
};

export const getNextPage = async <T>(
  endpoint: string,
  nextCursor: string,
  options?: CursorPageOptions,
): Promise<PaginatedResponse<T>> => {
  const params: QueryParams = {
    ...cleanParams(options?.params),
    cursor: nextCursor,
    ...(options?.limit ? { limit: options.limit } : {}),
  };
  const response = await api.get(endpoint, { params, signal: options?.signal });
  return normalizePaginatedResponse<T>(response.data, options);
};

export const isRequestAborted = (error: unknown): boolean => {
  if (axios.isCancel(error)) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (typeof error === "object" && error !== null) {
    const maybe = error as { name?: string; code?: string };
    return maybe.name === "CanceledError" || maybe.code === "ERR_CANCELED";
  }
  return false;
};

export const fetchAllPagesCursor = async <T>(
  endpoint: string,
  options?: FetchAllPagesCursorOptionsWithCallback<T>,
): Promise<{
  items: T[];
  pagesFetched: number;
  lastPage: PaginatedResponse<T>;
}> => {
  const safeMaxPages = toPositiveNumberOr(options?.maxPages, 50);
  let current = await getFirstPage<T>(endpoint, options);
  const items: T[] = [...current.data];
  let pagesFetched = 1;

  if (options?.onPage) {
    await options.onPage(current, {
      pageNumber: pagesFetched,
      accumulated: items.length,
    });
  }

  while (current.nextCursor && pagesFetched < safeMaxPages) {
    current = await getNextPage<T>(endpoint, current.nextCursor, options);
    items.push(...current.data);
    pagesFetched++;

    if (options?.onPage) {
      await options.onPage(current, {
        pageNumber: pagesFetched,
        accumulated: items.length,
      });
    }
  }

  return {
    items,
    pagesFetched,
    lastPage: current,
  };
};

const getCursorPageByNumber = async <T>(
  endpoint: string,
  page = 1,
  options?: CursorPageOptions,
): Promise<PaginatedResponse<T>> => {
  const targetPage = Math.max(1, page || 1);
  let current = await getFirstPage<T>(endpoint, options);

  for (let currentPage = 2; currentPage <= targetPage; currentPage++) {
    if (!current.nextCursor) break;
    current = await getNextPage<T>(endpoint, current.nextCursor, options);
  }

  return {
    ...current,
    page: targetPage,
  };
};

// ============================================================
// Storage keys — single source of truth used by AuthContext too
// ============================================================
export const STORAGE_TOKEN_KEY = "kia_token";
export const STORAGE_REFRESH_KEY = "kia_refresh_token";
export const STORAGE_USER_KEY = "kia_user";

// ============================================================
// Instancia Axios
// ============================================================
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Token se inyecta antes de cada request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Refresh-queue: evita que múltiples 401 simultáneos disparen
// múltiples renovaciones de token al mismo tiempo.
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token!);
  });
  failedQueue = [];
};

const clearSession = () => {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_REFRESH_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
  window.location.href = "/login?expired=1";
};

// Manejo global de errores con renovación automática de token
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (typeof window === "undefined") return Promise.reject(error);

    const originalRequest = error.config;
    const status: number = error?.response?.status;
    const url: string = originalRequest?.url ?? "";

    // No intentar renovar en endpoints de autenticación
    if (status !== 401 || url.includes("/auth/")) {
      return Promise.reject(error);
    }

    // Si otra petición ya está renovando el token, encolar esta
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api.request(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    // Marcar para no reintentar este request de nuevo si el refresh también falla
    originalRequest._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem(STORAGE_REFRESH_KEY);
    if (!refreshToken) {
      isRefreshing = false;
      clearSession();
      return Promise.reject(error);
    }

    try {
      // Llamada directa (sin api) para no pasar por este mismo interceptor
      const { data } = await axios.post<{ idToken: string }>(
        `${API_BASE_URL}/auth/refresh`,
        { refreshToken },
      );
      const newToken = data.idToken;
      localStorage.setItem(STORAGE_TOKEN_KEY, newToken);
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api.request(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearSession();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

// ============================================================
// AUTH
// ============================================================
export const authLogin = (email: string, password: string) =>
  api.post<Record<string, string>>("/auth/login", { email, password });

export const authRefresh = (refreshToken: string) =>
  api.post<{ idToken: string; expiresIn: number }>("/auth/refresh", { refreshToken });

// Logout: usa axios directo para evitar loop si el idToken ya expiró
export const authLogout = (refreshToken: string) =>
  axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken });

export const authLogoutAll = () => api.post("/auth/logout-all");

// ============================================================
// USERS
// ============================================================
export const getUsers = (params?: {
  role?: string;
  sede?: string;
  active?: boolean;
}, options?: { signal?: AbortSignal }) => api.get<UserProfile[]>("/users", { params, signal: options?.signal });

export const getUser = (uid: string) => api.get<UserProfile>(`/users/${uid}`);

export const createUser = (data: {
  displayName: string;
  email: string;
  role: string;
  sede: string;
}) => api.post<UserProfile & { resetLink?: string }>("/users", data);

export const updateUser = (
  uid: string,
  data: Partial<{
    displayName: string;
    role: string;
    sede: string;
    active: boolean;
  }>,
) => api.patch<UserProfile>(`/users/${uid}`, data);

export const deleteUser = (uid: string) => api.delete(`/users/${uid}`);

export const resetPassword = (uid: string) =>
  api.post(`/users/${uid}/reset-password`);

// ============================================================
// VEHICLES
// ============================================================
export const getVehicles = (filters?: VehicleFilters) =>
  (async (): Promise<ApiResult<PaginatedResponse<Vehicle>>> => {
    const { page = 1, limit, ...rest } = filters ?? {};
    const data = await getCursorPageByNumber<Vehicle>("/vehicles", page, {
      params: rest,
      limit,
    });
    return { data };
  })();

export const getVehicle = (id: string) => api.get<Vehicle>(`/vehicles/${id}`);

export const updateVehicle = (id: string, data: Partial<Vehicle>) =>
  api.patch<Vehicle>(`/vehicles/${id}`, data);

export const deleteVehicle = (id: string) => api.delete(`/vehicles/${id}`);

export const getStatusHistory = (vehicleId: string) =>
  api.get<StatusHistoryEntry[]>(`/vehicles/${vehicleId}/status-history`);

export const createVehicle = (data: {
  chassis: string;
  model: string;
  year: number;
  color: string;
  sede?: string;
  isFacturado?: boolean;
}) => api.post<Vehicle>("/vehicles", data);

export const sendToRegistration = (
  vehicleId: string,
  registrationSentDate: string,
) =>
  api.patch(`/documentation/${vehicleId}/send-to-registration`, {
    registrationSentDate,
  });

export const receiveRegistration = (
  vehicleId: string,
  registrationReceivedDate: string,
) =>
  api.patch(`/documentation/${vehicleId}/receive-registration`, {
    registrationReceivedDate,
  });

export const billVehicle = (vehicleId: string) =>
  api.patch(`/documentation/${vehicleId}/bill`);

export const getSalePotential = (vehicleId: string) =>
  api.get<SalePotential>(`/vehicles/${vehicleId}/sale-potential`);

export const getSalePotentialBatch = (vehicleIds: string[]) =>
  api.post<SalePotential[]>("/vehicles/sale-potential-batch", { vehicleIds });

export const getVehicleStatsBySede = () => api.get("/vehicles/stats/by-sede");

export const getTodayDeliveries = () =>
  api.get<Vehicle[]>("/vehicles/stats/today-deliveries");

export interface EtlRow {
  sede: string | null;
  chassis: string | null;
  status: string | null;
  deliveryDate: string | null;
  createdAt: string | null;
  year: number | null;
  model: string | null;
  color: string | null;
  clientName: string | null;
  clientId: string | null;
  clientPhone: string | null;
}

export async function previewExcel(file: File): Promise<{ total: number; data: EtlRow[] }> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/vehicles/preview-excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function cargarExcel(file: File): Promise<{
  total: number;
  insertados: number;
  actualizados: number;
  ignorados: number;
}> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post('/vehicles/cargar-excel', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

// ============================================================
// CERTIFICATIONS
// ============================================================
export const getCertification = (vehicleId: string) =>
  api.get<Certification>(`/certifications/${vehicleId}`);

export const createCertification = (
  vehicleId: string,
  data: Partial<Certification>,
) => api.post<Certification>(`/certifications/${vehicleId}`, data);

export const updateCertification = (
  vehicleId: string,
  data: Partial<Certification>,
) => api.patch<Certification>(`/certifications/${vehicleId}`, data);

// ============================================================
// DOCUMENTATION
// ============================================================
export const getDocumentation = (vehicleId: string) =>
  api.get<Documentation>(`/documentation/${vehicleId}`);

export const createDocumentation = (vehicleId: string, formData: FormData) =>
  api.post<Documentation>(`/documentation/${vehicleId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updateDocumentation = (vehicleId: string, formData: FormData) =>
  api.patch<Documentation>(`/documentation/${vehicleId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const changeVehicleSede = (vehicleId: string, newSede: string) =>
  api.patch(`/documentation/${vehicleId}/sede`, { newSede });

export const transferVehicle = (vehicleId: string, data: FormData) =>
  api.patch(`/documentation/${vehicleId}/transfer`, data, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteDocumentation = (vehicleId: string) =>
  api.delete(`/documentation/${vehicleId}`);

export const deleteDocumentFile = (
  vehicleId: string,
  fileType: string,
  index?: number,
) =>
  api.delete(`/documentation/${vehicleId}/files/${fileType}`, {
    params: index !== undefined ? { index } : undefined,
  });

// ============================================================
// SERVICE ORDERS
// ============================================================
export const getServiceOrders = (params?: {
  vehicleId?: string;
  status?: string;
  sede?: string;
}) => api.get<ServiceOrder[]>("/service-orders", { params });

export const getServiceOrder = (id: string) =>
  api.get<ServiceOrder>(`/service-orders/${id}`);

export const createServiceOrder = (vehicleId: string, orderNumber: string) =>
  api.post<ServiceOrder>("/service-orders", { vehicleId, orderNumber });

// ============================================================
// APPOINTMENTS
// ============================================================
export const getAppointments = (params?: {
  vehicleId?: string;
  date?: string;
  advisorUid?: string;
  limit?: number;
  cursor?: string;
}, options?: { signal?: AbortSignal }) =>
  (async (): Promise<ApiResult<PaginatedResponse<Appointment>>> => {
    const limit = params?.limit;
    const { cursor, ...rest } = params ?? {};
    const data = cursor
      ? await getNextPage<Appointment>("/appointments", cursor, {
          params: rest,
          limit,
          legacyArrayFallback: true,
          signal: options?.signal,
        })
      : await getFirstPage<Appointment>("/appointments", {
          params: rest,
          limit,
          legacyArrayFallback: true,
          signal: options?.signal,
        });
    return { data };
  })();

export const createAppointment = (data: {
  vehicleId: string;
  scheduledDate: string;
  scheduledTime: string;
  assignedAdvisorId: string;
  assignedAdvisorName: string;
}) => api.post<Appointment>("/appointments", data);

export const updateAppointment = (id: string, data: Partial<Appointment>) =>
  api.patch<Appointment>(`/appointments/${id}`, data);

// ============================================================
// DELIVERY CEREMONY
// ============================================================
export const getDeliveryCeremony = (vehicleId: string) =>
  api.get<DeliveryCeremony>(`/delivery/ceremony/${vehicleId}`);

// ============================================================
// REPORTS
// ============================================================
export const getVehicleReport = (vehicleId: string) =>
  api.get(`/reports/vehicle/${vehicleId}`);

export const getAnalytics = (params?: {
  sede?: string;
  from?: string;
  to?: string;
}) => api.get("/reports/analytics", { params });

export const getBIDashboardGeneral = async (
  query: BIDashboardGeneralQuery,
) => {
  const response = await api.get<BIAnalyticsResponse>("/reports/analytics", {
    params: buildBIDashboardGeneralParams(query),
  });

  return {
    ...response,
    data: mapBIAnalyticsToBIDashboardGeneralResponse(response.data, query),
  } as typeof response & { data: BIDashboardGeneralResponse };
};

export type BIAnalyticsQuery = {
  sede?: string;
  model?: string;
  dateFrom: string;
  dateTo: string;
};

export const getBIAnalytics = (params: BIAnalyticsQuery) =>
  api.get<BIAnalyticsData>("/reports/analytics", {
    params: {
      ...(params.sede?.trim() ? { sede: params.sede } : {}),
      ...(params.model?.trim() ? { model: params.model } : {}),
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    },
  });

export type BIAnalyticsData = {
  total: number;
  vehiclesDelivered: number;
  // Period-bound denominator for delivery rate (entregados / ingresos del período)
  vehiclesCreatedInPeriod?: number;
  registrationBacklog?: {
    pendingReception: number;
    porArribar: number;
    pendingToRegister: number;
  };
  byStatus: Record<string, number>;
  bySede: Record<string, number>;
  byModel: Record<string, number>;
  // Optional depending on backend aggregation availability / data volume
  byColor?: Record<string, number>;
  avgDaysToDelivery: number | null;
  medianDaysToDelivery: number | null;
  // Optional depending on backend aggregation availability / data volume
  byModelRotation?: Record<string, { avgDays: number; count: number }>;
  byMonthlyDeliveries: { month: string; count: number }[];
  accessories: {
    byKey: Record<
      string,
      { VENDIDO?: number; OBSEQUIADO?: number; NO_APLICA?: number }
    >;
    topSold: { key: string; vendido: number }[];
    totalVendido: number;
    totalObsequiado: number;
    totalNoAplica?: number;
  };
  topAsesores: {
    ordenesGeneradas: {
      uid: string;
      name: string;
      sede: string;
      ordenes: number;
    }[];
    entregas: { uid: string; name: string; sede: string; entregas: number }[];
  };
  topTaller: {
    uid: string;
    name: string;
    sede: string;
    totalOTs: number;
  }[];
};

export const getTechnicianPerformance = (uid: string) =>
  api.get(`/reports/technician-performance/${uid}`);

// ============================================================
// ENTREGADOS — resumen histórico por año
// ============================================================
export const getEntregadosResumen = (params: {
  año?: number;
  fechaDesde?: string; // "YYYY-MM-DD"
  sede?: string;
  modelo?: string;
}) =>
  api.get("/vehicles/entregados/resumen", { params });

// ============================================================
// CALL CENTER — lista de ENTREGADO con accesorios seguro/telemetría
// ============================================================
export interface CallCenterVehicleRaw {
  id: string;
  chasis: string;
  modelo: string;
  color: string;
  año: number;
  sede: string;
  status: string;
  referenceDate?: string | null;
  documentationFound?: boolean;
  propietario: {
    nombre: string;
    cedula: string;
    telefono: string;
    celular: string;
  };
  accessories: Array<{ key: string; classification: string | null }>;
}

export const getVehiclesCallCenter = (
  page = 1,
  limit = 100,
  filters?: {
    sede?: string;
    model?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  options?: { signal?: AbortSignal },
) =>
  (async (): Promise<ApiResult<PaginatedResponse<CallCenterVehicleRaw>>> => {
    const data = await getCursorPageByNumber<CallCenterVehicleRaw>(
      "/vehicles/call-center",
      page,
      {
        params: filters,
        limit,
        signal: options?.signal,
      },
    );
    return { data };
  })();

// ============================================================
// CATALOGS
// ============================================================
export const getColors = () => api.get<CatalogItem[]>("/catalogs/colors");
export const createColor = (data: Partial<CatalogItem>) =>
  api.post("/catalogs/colors", data);
export const updateColor = (id: string, data: Partial<CatalogItem>) =>
  api.patch(`/catalogs/colors/${id}`, data);
export const deleteColor = (id: string) => api.delete(`/catalogs/colors/${id}`);

export const getModels = () => api.get<CatalogItem[]>("/catalogs/models");
export const createModel = (data: Partial<CatalogItem>) =>
  api.post("/catalogs/models", data);
export const updateModel = (id: string, data: Partial<CatalogItem>) =>
  api.patch(`/catalogs/models/${id}`, data);
export const deleteModel = (id: string) => api.delete(`/catalogs/models/${id}`);

export const getConcessionaires = () =>
  api.get<CatalogItem[]>("/catalogs/concessionaires");
export const createConcessionaire = (data: Partial<CatalogItem>) =>
  api.post("/catalogs/concessionaires", data);
export const updateConcessionaire = (id: string, data: Partial<CatalogItem>) =>
  api.patch(`/catalogs/concessionaires/${id}`, data);
export const deleteConcessionaire = (id: string) =>
  api.delete(`/catalogs/concessionaires/${id}`);

export const getSedes = (options?: { signal?: AbortSignal }) =>
  api.get<CatalogItem[]>("/catalogs/sedes", { signal: options?.signal });
export const createSede = (data: Partial<CatalogItem>) =>
  api.post("/catalogs/sedes", data);
export const updateSede = (id: string, data: Partial<CatalogItem>) =>
  api.patch(`/catalogs/sedes/${id}`, data);
export const deleteSede = (id: string) => api.delete(`/catalogs/sedes/${id}`);

// ============================================================
// NOTIFICATIONS
// ============================================================
export const getNotifications = (params?: { read?: boolean; limit?: number }) =>
  api.get<Notification[]>("/notifications", { params });

export const markNotificationRead = (id: string) =>
  api.patch(`/notifications/${id}/read`);

export const registerFcmToken = (token: string) =>
  api.post("/users/fcm-token", { token });

export const getAccessories = () =>
  api.get<CatalogItem[]>("/catalogs/accessories");
export const createAccessory = (data: Partial<CatalogItem>) =>
  api.post("/catalogs/accessories", data);
export const updateAccessory = (id: string, data: Partial<CatalogItem>) =>
  api.patch(`/catalogs/accessories/${id}`, data);
export const deleteAccessory = (id: string) =>
  api.delete(`/catalogs/accessories/${id}`);

export default api;
