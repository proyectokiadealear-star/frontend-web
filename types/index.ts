import type { VehicleStatusType, RoleEnumType, AccessoryKeyType, AccessoryClassificationType } from "@/lib/constants";

// ============================================================
// USUARIOS
// ============================================================
export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: RoleEnumType;
  sede: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================
// ============================================================
// SHARED
// ============================================================
export type FirestoreTimestamp = { _seconds: number; _nanoseconds: number };
export type DateField = string | FirestoreTimestamp;

// ============================================================
// VEHÍCULOS
// ============================================================
export interface Vehicle {
  id: string;
  chassis: string;
  model: string;
  year: number;
  color: string;
  originConcessionaire: string;
  photoUrl?: string;
  sede: string;
  status: VehicleStatusType;
  receptionDate: DateField;
  certificationDate?: DateField;
  documentationDate?: DateField;
  installationCompleteDate?: DateField;
  deliveryDate?: DateField;
  receivedBy?: string;
  certifiedBy?: string;
  documentedBy?: string;
  installedBy?: string;
  deliveredBy?: string;
  createdAt: DateField;
  updatedAt: DateField;
  // Fields pre-populated from Excel import
  clientName?: string;
  clientId?: string;
  clientPhone?: string;
  paymentMethod?: string;
}

export interface StatusHistoryEntry {
  id?: string;
  status: VehicleStatusType;
  changedAt: string;
  changedBy: string;
  changedByName?: string;
  sede?: string;
  notes?: string;
}

// ============================================================
// CERTIFICACIÓN
// ============================================================
export interface Certification {
  vehicleId: string;
  mileage: number;
  radio: string;
  rims: {
    status: string;
    photoUrl?: string;
  };
  seatType: string;
  hasImprints: boolean;
  certifiedBy?: string;
  certifiedAt?: string;
  notes?: string;
}

// ============================================================
// DOCUMENTACIÓN
// ============================================================
export interface AccessoryItem {
  key: AccessoryKeyType;
  classification: AccessoryClassificationType;
  notes?: string;
}

export interface Documentation {
  vehicleId: string;
  clientName: string;
  clientId: string;
  clientPhone: string;
  registrationType?: string;
  paymentMethod?: string;
  targetConcessionaire?: string;
  vehicleInvoiceUrl?: string;
  giftEmailUrl?: string;
  accessoryInvoiceUrl?: string;
  accessories: AccessoryItem[];
  documentedBy?: string;
  documentedAt?: string;
  saveAsPending?: boolean;
}

// ============================================================
// ÓRDENES DE TRABAJO
// ============================================================
export interface ChecklistItem {
  accessoryKey: AccessoryKeyType;
  installed: boolean;
  installedAt?: string;
  installedBy?: string;
}

export interface ServiceOrder {
  id: string;
  vehicleId: string;
  orderNumber: string;
  status: string;
  technicianUid?: string;
  technicianName?: string;
  checklist: ChecklistItem[];
  sede?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// AGENDAMIENTO
// ============================================================
export interface Appointment {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  scheduledDate: string;
  scheduledTime: string;
  assignedAdvisorUid: string;
  assignedAdvisorName: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CEREMONIA DE ENTREGA
// ============================================================
export interface DeliveryCeremony {
  vehicleId: string;
  deliveryPhotoUrl?: string;
  signedActaUrl?: string;
  advisorUid?: string;
  advisorName?: string;
  clientName?: string;
  deliveredAt?: string;
  notes?: string;
}

// ============================================================
// NOTIFICACIONES
// ============================================================
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  vehicleId?: string;
  chassis?: string;
  read: boolean;
  createdAt: string;
}

// ============================================================
// CATÁLOGOS
// ============================================================
export interface CatalogItem {
  id: string;
  name: string;
  code?: string;
  key?: string;
}

// ============================================================
// PAGINACIÓN
// ============================================================
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================
// QUERY PARAMS COMUNES
// ============================================================
export interface VehicleFilters {
  chassis?: string;
  sede?: string;
  status?: string;
  clientId?: string;
  page?: number;
  limit?: number;
}
