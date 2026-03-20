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
}) => api.get<UserProfile[]>("/users", { params });

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
  api.get<PaginatedResponse<Vehicle>>("/vehicles", { params: filters });

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
}) => api.get<Appointment[]>("/appointments", { params });

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

export const getBIAnalytics = (params: {
  sede?: string;
  model?: string;
  dateFrom: string;
  dateTo: string;
}) =>
  api.get<BIAnalyticsData>("/reports/analytics", {
    params: {
      ...(params.sede ? { sede: params.sede } : {}),
      ...(params.model ? { model: params.model } : {}),
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    },
  });

export type BIAnalyticsData = {
  total: number;
  vehiclesDelivered: number;
  byStatus: Record<string, number>;
  bySede: Record<string, number>;
  byModel: Record<string, number>;
  accessories: {
    byKey: Record<
      string,
      { VENDIDO: number; OBSEQUIADO: number; NO_APLICA: number }
    >;
    topSold: { key: string; vendido: number }[];
    totalVendido: number;
    totalObsequiado: number;
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
  propietario: {
    nombre: string;
    cedula: string;
    telefono: string;
    celular: string;
  };
  accessories: Array<{ key: string; classification: string | null }>;
}

export const getVehiclesCallCenter = (page = 1, limit = 100) =>
  api.get<PaginatedResponse<CallCenterVehicleRaw>>("/vehicles/call-center", {
    params: { page, limit },
  });

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

export const getSedes = () => api.get<CatalogItem[]>("/catalogs/sedes");
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

export const getAccessories = () =>
  api.get<CatalogItem[]>("/catalogs/accessories");
export const createAccessory = (data: Partial<CatalogItem>) =>
  api.post("/catalogs/accessories", data);
export const updateAccessory = (id: string, data: Partial<CatalogItem>) =>
  api.patch(`/catalogs/accessories/${id}`, data);
export const deleteAccessory = (id: string) =>
  api.delete(`/catalogs/accessories/${id}`);

export default api;
