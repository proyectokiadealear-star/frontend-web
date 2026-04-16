import type {
  VehicleStatusType,
  RoleEnumType,
  AccessoryKeyType,
  AccessoryClassificationType,
} from "@/lib/constants";

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
  originConcessionaire?: string;
  photoUrl?: string;
  sede: string;
  status: VehicleStatusType;
  registeredDate?: DateField;
  registeredBy?: string;
  registrationSentDate?: DateField;
  registrationReceivedDate?: DateField;
  receptionDate?: DateField;
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
  statusChangedAt?: DateField;
  // Fields pre-populated from Excel import
  clientName?: string;
  clientId?: string;
  clientPhone?: string;
  paymentMethod?: string;
  // Reapertura
  isReopening?: boolean;
  reopenRequestedByName?: string;
  reopenReason?: string;
  reopenAccessories?: string[];
  // NO_FACTURADO
  certifiedWhileNoFacturado?: boolean;
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
  rimsStatus: string;
  rims?: {
    status: string;
    photoUrl?: string;
  };
  seatType: string;
  antenna: string;
  trunkCover: string;
  imprints: string;
  hasImprints?: boolean;
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
  giftEmailUrls?: string[];
  accessoryInvoiceUrls?: string[];
  accessories: AccessoryItem[];
  documentedBy?: string;
  documentedAt?: string;
  saveAsPending?: boolean;
  registrationReceivedDate?: string;
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
  // Campos planos populados por el API
  chassis?: string;
  model?: string;
  color?: string;
  sede?: string;
  clientName?: string;
  clientId?: string;
  status?: string;
  // Asesor
  assignedAdvisorId: string;
  assignedAdvisorName: string;
  // Fechas
  scheduledDate: string;
  scheduledTime: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: DateField;
  updatedAt: DateField;
  // Retrocompatibilidad (algunas partes del código usan vehicle?)
  vehicle?: Vehicle;
  assignedAdvisorUid?: string;
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
// POTENCIAL DE VENTA
// ============================================================
export interface SalePotentialItem {
  key: string;
  probability: number;
  reason: string;
}

export interface SalePotential {
  vehicleId: string;
  chassis: string;
  totalAccessories: number;
  sold: number;
  gifted: number;
  notApplicable: number;
  currentSaleRate: number;
  potentialSaleRate: number;
  weightedPotentialRate: number;
  highPotentialItems: SalePotentialItem[];
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
  totalPages: number;
  nextCursor?: string | null;
}

// ============================================================
// CALL CENTER — Dashboard Centro de Llamadas
// ============================================================
export interface CallCenterVehicle {
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

export type Prioridad = "ALTA" | "MEDIA" | "BAJA";
export type Oportunidad = "AMBOS" | "SOLO_SEGURO" | "SOLO_TELEMETRIA" | "NINGUNA";

export interface ClassifiedVehicle extends CallCenterVehicle {
  tieneSeguro: boolean;
  tieneTelemetria: boolean;
  prioridad: Prioridad;
  oportunidad: Oportunidad;
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
  dateFrom?: string;
  dateTo?: string;
}
