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
// Instancia Axios
// ============================================================
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Token se inyecta antes de cada request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("kia_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Manejo global de errores
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (typeof window !== "undefined") {
      const status = error?.response?.status;
      const url: string = error?.config?.url ?? "";
      // Si recibe 401 en cualquier llamada que no sea el login, el token expiró → forzar logout
      if (status === 401 && !url.includes("/auth/login")) {
        localStorage.removeItem("kia_token");
        localStorage.removeItem("kia_user");
        window.location.href = "/login?expired=1";
      }
    }
    return Promise.reject(error);
  }
);

// ============================================================
// AUTH
// ============================================================
export const authLogin = (email: string, password: string) =>
  api.post<Record<string, string>>("/auth/login", { email, password });

// ============================================================
// USERS
// ============================================================
export const getUsers = (params?: { role?: string; sede?: string; active?: boolean }) =>
  api.get<UserProfile[]>("/users", { params });

export const getUser = (uid: string) => api.get<UserProfile>(`/users/${uid}`);

export const createUser = (data: {
  displayName: string;
  email: string;
  role: string;
  sede: string;
}) => api.post<UserProfile & { resetLink?: string }>("/users", data);

export const updateUser = (
  uid: string,
  data: Partial<{ displayName: string; role: string; sede: string; active: boolean }>
) => api.patch<UserProfile>(`/users/${uid}`, data);

export const deleteUser = (uid: string) => api.delete(`/users/${uid}`);

export const resetPassword = (uid: string) =>
  api.post(`/users/${uid}/reset-password`);

// ============================================================
// VEHICLES
// ============================================================
export const getVehicles = (filters?: VehicleFilters) =>
  api.get<PaginatedResponse<Vehicle>>("/vehicles", { params: filters });

export const getVehicle = (id: string) =>
  api.get<Vehicle>(`/vehicles/${id}`);

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
}) => api.post<Vehicle>("/vehicles", data);

export const sendToRegistration = (vehicleId: string, registrationSentDate: string) =>
  api.patch(`/documentation/${vehicleId}/send-to-registration`, { registrationSentDate });

export const receiveRegistration = (vehicleId: string, registrationReceivedDate: string) =>
  api.patch(`/documentation/${vehicleId}/receive-registration`, { registrationReceivedDate });

export const getSalePotential = (vehicleId: string) =>
  api.get<SalePotential>(`/vehicles/${vehicleId}/sale-potential`);

export const getSalePotentialBatch = (vehicleIds: string[]) =>
  api.post<SalePotential[]>("/vehicles/sale-potential-batch", { vehicleIds });

export const getVehicleStatsBySede = () =>
  api.get("/vehicles/stats/by-sede");

export const getTodayDeliveries = () =>
  api.get<Vehicle[]>("/vehicles/stats/today-deliveries");

// ============================================================
// CERTIFICATIONS
// ============================================================
export const getCertification = (vehicleId: string) =>
  api.get<Certification>(`/certifications/${vehicleId}`);

export const updateCertification = (vehicleId: string, data: Partial<Certification>) =>
  api.patch<Certification>(`/certifications/${vehicleId}`, data);

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

export const deleteDocumentFile = (vehicleId: string, fileType: string, index?: number) =>
  api.delete(`/documentation/${vehicleId}/files/${fileType}`, {
    params: index !== undefined ? { index } : undefined,
  });

// ============================================================
// SERVICE ORDERS
// ============================================================
export const getServiceOrders = (params?: { vehicleId?: string; status?: string; sede?: string }) =>
  api.get<ServiceOrder[]>("/service-orders", { params });

export const getServiceOrder = (id: string) =>
  api.get<ServiceOrder>(`/service-orders/${id}`);

export const createServiceOrder = (vehicleId: string, orderNumber: string) =>
  api.post<ServiceOrder>("/service-orders", { vehicleId, orderNumber });

// ============================================================
// APPOINTMENTS
// ============================================================
export const getAppointments = (params?: { vehicleId?: string; date?: string; advisorUid?: string }) =>
  api.get<Appointment[]>("/appointments", { params });

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

export const getAnalytics = (params?: { sede?: string; from?: string; to?: string }) =>
  api.get("/reports/analytics", { params });

export const getBIAnalytics = (params: {
  sede?: string;
  model?: string;
  dateFrom: string;
  dateTo: string;
}) => api.get<BIAnalyticsData>("/reports/analytics", { params: {
  ...(params.sede ? { sede: params.sede } : {}),
  ...(params.model ? { model: params.model } : {}),
  dateFrom: params.dateFrom,
  dateTo: params.dateTo,
} });

export type BIAnalyticsData = {
  total: number;
  vehiclesDelivered: number;
  byStatus: Record<string, number>;
  bySede: Record<string, number>;
  byModel: Record<string, number>;
  accessories: {
    byKey: Record<string, { VENDIDO: number; OBSEQUIADO: number; NO_APLICA: number }>;
    topSold: { key: string; vendido: number }[];
    totalVendido: number;
    totalObsequiado: number;
  };
  topAsesores: {
    ordenesGeneradas: { uid: string; name: string; sede: string; ordenes: number }[];
    entregas: { uid: string; name: string; sede: string; entregas: number }[];
  };
};

export const getTechnicianPerformance = (uid: string) =>
  api.get(`/reports/technician-performance/${uid}`);

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

export const getConcessionaires = () => api.get<CatalogItem[]>("/catalogs/concessionaires");
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

export const getAccessories = () => api.get<CatalogItem[]>("/catalogs/accessories");
export const createAccessory = (data: Partial<CatalogItem>) =>
  api.post("/catalogs/accessories", data);
export const updateAccessory = (id: string, data: Partial<CatalogItem>) =>
  api.patch(`/catalogs/accessories/${id}`, data);
export const deleteAccessory = (id: string) => api.delete(`/catalogs/accessories/${id}`);

export default api;
