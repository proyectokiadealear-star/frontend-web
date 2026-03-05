// ============================================================
// ENUMS — valores que se envían al backend en MAYUSCULAS
// ============================================================

export const VehicleStatus = {
  POR_ARRIBAR: "POR_ARRIBAR",
  ENVIADO_A_MATRICULAR: "ENVIADO_A_MATRICULAR",
  DOCUMENTACION_PENDIENTE: "DOCUMENTACION_PENDIENTE",
  DOCUMENTADO: "DOCUMENTADO",
  CERTIFICADO_STOCK: "CERTIFICADO_STOCK",
  ORDEN_GENERADA: "ORDEN_GENERADA",
  ASIGNADO: "ASIGNADO",
  EN_INSTALACION: "EN_INSTALACION",
  INSTALACION_COMPLETA: "INSTALACION_COMPLETA",
  REAPERTURA_OT: "REAPERTURA_OT",
  LISTO_PARA_ENTREGA: "LISTO_PARA_ENTREGA",
  AGENDADO: "AGENDADO",
  ENTREGADO: "ENTREGADO",
  CEDIDO: "CEDIDO",
} as const;

export type VehicleStatusType = (typeof VehicleStatus)[keyof typeof VehicleStatus];

export const VehicleStatusLabel: Record<VehicleStatusType, string> = {
  POR_ARRIBAR: "Por Arribar",
  ENVIADO_A_MATRICULAR: "Enviado a Matricular",
  DOCUMENTACION_PENDIENTE: "Doc. Pendiente",
  DOCUMENTADO: "Documentado",
  CERTIFICADO_STOCK: "Certificado en Stock",
  ORDEN_GENERADA: "OT Generada",
  ASIGNADO: "Asignado a Técnico",
  EN_INSTALACION: "En Instalación",
  INSTALACION_COMPLETA: "Instalación Completa",
  REAPERTURA_OT: "Reapertura OT",
  LISTO_PARA_ENTREGA: "Listo para Entrega",
  AGENDADO: "Agendado",
  ENTREGADO: "Entregado",
  CEDIDO: "Cedido",
};

export const VehicleStatusColor: Record<VehicleStatusType, string> = {
  POR_ARRIBAR: "bg-gray-100 text-gray-700",
  ENVIADO_A_MATRICULAR: "bg-indigo-50 text-indigo-700",
  DOCUMENTACION_PENDIENTE: "bg-amber-50 text-amber-700",
  DOCUMENTADO: "bg-violet-50 text-violet-700",
  CERTIFICADO_STOCK: "bg-blue-50 text-blue-700",
  ORDEN_GENERADA: "bg-sky-50 text-sky-700",
  ASIGNADO: "bg-sky-100 text-sky-800",
  EN_INSTALACION: "bg-orange-50 text-orange-700",
  INSTALACION_COMPLETA: "bg-green-50 text-green-700",
  REAPERTURA_OT: "bg-red-50 text-red-700",
  LISTO_PARA_ENTREGA: "bg-green-100 text-green-800",
  AGENDADO: "bg-emerald-50 text-emerald-700",
  ENTREGADO: "bg-gray-900 text-white",
  CEDIDO: "bg-gray-100 text-gray-500",
};

// ============================================================

export const RoleEnum = {
  JEFE_TALLER: "JEFE_TALLER",
  ASESOR: "ASESOR",
  LIDER_TECNICO: "LIDER_TECNICO",
  PERSONAL_TALLER: "PERSONAL_TALLER",
  DOCUMENTACION: "DOCUMENTACION",
  SOPORTE: "SOPORTE",
} as const;

export type RoleEnumType = (typeof RoleEnum)[keyof typeof RoleEnum];

export const RoleLabel: Record<RoleEnumType, string> = {
  JEFE_TALLER: "Jefe de Taller",
  ASESOR: "Asesor",
  LIDER_TECNICO: "Líder Técnico",
  PERSONAL_TALLER: "Personal de Taller",
  DOCUMENTACION: "Documentación",
  SOPORTE: "Soporte",
};

// ============================================================

export const AccessoryKey = {
  BOTON_ENCENDIDO: "BOTON_ENCENDIDO",
  KIT_CARRETERA: "KIT_CARRETERA",
  AROS: "AROS",
  LAMINAS: "LAMINAS",
  MOQUETAS: "MOQUETAS",
  CUBREMALETAS: "CUBREMALETAS",
  SEGURO: "SEGURO",
  TELEMETRIA: "TELEMETRIA",
  SENSORES: "SENSORES",
  ALARMA: "ALARMA",
  NEBLINEROS: "NEBLINEROS",
  KIT_SEGURIDAD: "KIT_SEGURIDAD",
  PROTECTOR_CERAMICO: "PROTECTOR_CERAMICO",
  OTROS: "OTROS",
} as const;

export type AccessoryKeyType = (typeof AccessoryKey)[keyof typeof AccessoryKey];

export const AccessoryLabel: Record<AccessoryKeyType, string> = {
  BOTON_ENCENDIDO: "Botón de Encendido",
  KIT_CARRETERA: "Kit de Carretera",
  AROS: "Aros",
  LAMINAS: "Láminas",
  MOQUETAS: "Moquetas",
  CUBREMALETAS: "Cubremaletas",
  SEGURO: "Seguro",
  TELEMETRIA: "Telemetría",
  SENSORES: "Sensores",
  ALARMA: "Alarma",
  NEBLINEROS: "Neblineros",
  KIT_SEGURIDAD: "Kit de Seguridad",
  PROTECTOR_CERAMICO: "Protector Cerámico",
  OTROS: "Otros",
};

// ============================================================

export const AccessoryClassification = {
  VENDIDO: "VENDIDO",
  OBSEQUIADO: "OBSEQUIADO",
  NO_APLICA: "NO_APLICA",
} as const;

export type AccessoryClassificationType =
  (typeof AccessoryClassification)[keyof typeof AccessoryClassification];

export const AccessoryClassificationLabel: Record<AccessoryClassificationType, string> = {
  VENDIDO: "Vendido",
  OBSEQUIADO: "Obsequiado",
  NO_APLICA: "No Aplica",
};

// ============================================================

export const PaymentMethod = {
  CONTADO: "CONTADO",
  CREDITO: "CREDITO",
} as const;

export type PaymentMethodType = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const PaymentMethodLabel: Record<PaymentMethodType, string> = {
  CONTADO: "Contado",
  CREDITO: "Crédito",
};

// ============================================================
// API
// ============================================================
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"
).replace(/\/+$/, ""); // strip trailing slash
