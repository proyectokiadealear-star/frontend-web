"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getVehicle,
  getDocumentation,
  createDocumentation,
  updateDocumentation,
  getAccessories,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowLeft, Upload, FileText, RefreshCw, X, CheckCircle } from "lucide-react";
import {
  AccessoryKey,
  AccessoryLabel,
  AccessoryClassification,
  AccessoryClassificationLabel,
  PaymentMethod,
  PaymentMethodLabel,
  VehicleStatus,
  type AccessoryClassificationType,
} from "@/lib/constants";
import type { Vehicle, Documentation, AccessoryItem, CatalogItem } from "@/types";
import toast from "react-hot-toast";

type Step = 0 | 1 | 2;
const STEP_LABELS = ["Datos del Cliente", "Documentos", "Accesorios"];

const REGISTRY_TYPES = [
  { value: "NORMAL", label: "Normal" },
  { value: "RAPIDA", label: "Rápida" },
  { value: "EXCLUSIVA", label: "Exclusiva" },
];

const CLASSIFICATION_OPTIONS = Object.entries(AccessoryClassificationLabel).map(
  ([v, l]) => ({ value: v, label: l })
);

const PAYMENT_OPTIONS = Object.entries(PaymentMethodLabel).map(([v, l]) => ({
  value: v,
  label: l,
}));

// Fallback si el catálogo no tiene items con key
const ACCESSORY_FALLBACK: CatalogItem[] = Object.entries(AccessoryLabel).map(
  ([k, name]) => ({ id: k, name, key: k }) // k ya es MAYÚSCULAS ("ALARMA", etc.)
);

interface FormData {
  clientName: string;
  clientId: string;
  clientPhone: string;
  registrationType: string;
  paymentMethod: string;
  accessories: AccessoryItem[];
}

// ── Validación cédula ecuatoriana (10 dígitos) o RUC persona natural (13 dígitos) ──
function validateCedula(value: string): boolean {
  if (!/^\d{10}(\d{3})?$/.test(value)) return false;
  // Si es RUC (13 dígitos), los últimos 3 deben ser "001"
  if (value.length === 13 && value.slice(10) !== "001") return false;
  const cedula = value.substring(0, 10);
  const province = parseInt(cedula.substring(0, 2), 10);
  if (province < 1 || (province > 24 && province !== 30)) return false;
  const thirdDigit = parseInt(cedula[2], 10);
  if (thirdDigit >= 6) return false; // solo persona natural
  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(cedula[i], 10) * coefficients[i];
    if (val >= 10) val -= 9;
    sum += val;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cedula[9], 10);
}

export default function DocumentacionFormPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [existingDoc, setExistingDoc] = useState<Documentation | null>(null);
  const [catalogAccessories, setCatalogAccessories] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"pending" | "final" | null>(null);
  const [step, setStep] = useState<Step>(0);

  const [formData, setFormData] = useState<FormData>({
    clientName: "",
    clientId: "",
    clientPhone: "",
    registrationType: "",
    paymentMethod: "",
    accessories: [],
  });

  const [files, setFiles] = useState<{
    invoiceFile?: File;
    giftEmailFile?: File;
    accessoryInvoiceFile?: File;
  }>({});

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const fetchData = useCallback(async () => {
    if (!vehicleId) return;
    setLoading(true);
    try {
      const [vRes, catRes, dRes] = await Promise.all([
        getVehicle(vehicleId),
        getAccessories().catch(() => ({ data: [] as CatalogItem[] })),
        getDocumentation(vehicleId).catch(() => null),
      ]);

      setVehicle(vRes.data);

      const catalog: CatalogItem[] = catRes.data ?? [];

      // Si el catálogo no devolvió items con key, usa la lista hardcoded como fallback.
      const keyed = catalog.filter((c) => c.key);
      const source = keyed.length > 0 ? keyed : ACCESSORY_FALLBACK;
      setCatalogAccessories(source);

      const buildFromCatalog = (existingAcc?: AccessoryItem[]) =>
        source.map((item) => {
          const catalogKey = item.key!; // exact key as stored in DB (e.g. "aros" or "CUBRE_LLUVIAS")
          const existing = existingAcc?.find(
            (a) => a.key.toUpperCase() === catalogKey.toUpperCase() // case-insensitive match
          );
          return {
            key: catalogKey as AccessoryItem["key"], // preserve exact DB key
            name: item.name,
            classification:
              (existing?.classification as AccessoryClassificationType) ??
              AccessoryClassification.NO_APLICA,
          };
        });

      if (dRes?.data) {
        const d = dRes.data;
        setExistingDoc(d);
        setFormData({
          clientName: d.clientName || "",
          clientId: d.clientId || "",
          clientPhone: d.clientPhone || "",
          registrationType: d.registrationType || "",
          paymentMethod: d.paymentMethod || "",
          accessories: buildFromCatalog(d.accessories),
        });
      } else {
        // Pre-fill client fields from vehicle data (populated by Excel import).
        // All fields remain editable — this is just a convenience pre-fill.
        const v = vRes.data;
        setFormData((prev) => ({
          ...prev,
          clientName:    v.clientName    ?? prev.clientName,
          clientId:      v.clientId      ?? prev.clientId,
          clientPhone:   v.clientPhone   ?? prev.clientPhone,
          paymentMethod: v.paymentMethod ?? prev.paymentMethod,
          accessories:   buildFromCatalog(),
        }));
      }
    } catch {
      toast.error("Error al cargar el vehículo");
    } finally {
      setLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const validate = (): boolean => {
    if (step !== 0) return true;
    const e: typeof errors = {};
    if (!formData.clientName.trim()) e.clientName = "Requerido";
    if (!formData.clientId.trim()) {
      e.clientId = "Requerido";
    } else if (!isEditMode && !validateCedula(formData.clientId)) {
      // In edit mode skip strict cedula check so existing (possibly test) data doesn't block navigation
      e.clientId = "Cédula (10 dígitos) o RUC (13 dígitos) inválido. Verifica provincia (01-24), tipo (persona natural) y dígito verificador.";
    }
    if (!formData.clientPhone.trim()) {
      e.clientPhone = "Requerido";
    } else if (!isEditMode && !/^09\d{8}$/.test(formData.clientPhone)) {
      // Same: don\'t block editing docs that were saved with a different format
      e.clientPhone = "Debe tener formato 09XXXXXXXX (10 dígitos, inicia con 09)";
    }
    if (!formData.registrationType) e.registrationType = "Requerido";
    if (!formData.paymentMethod) e.paymentMethod = "Requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    setStep((s) => Math.min(s + 1, 2) as Step);
  };

  const isEditMode = !!existingDoc;
  const isPending = vehicle?.status === VehicleStatus.DOCUMENTACION_PENDIENTE;

  // saveAsPending:
  //  - CREATE: always send (true = pending, false = final)
  //  - PATCH partial edit: omit the field entirely (backend does not change state)
  //  - PATCH complete pending: send false (transitions DOCUMENTACION_PENDIENTE → DOCUMENTADO)
  const buildFormData = (saveAsPending: boolean) => {
    const fd = new FormData();
    fd.append("clientName", formData.clientName);
    fd.append("clientId", formData.clientId);
    fd.append("clientPhone", formData.clientPhone);
    fd.append("registrationType", formData.registrationType);
    fd.append("paymentMethod", formData.paymentMethod);
    // On edit: only append saveAsPending=false to complete a pending doc.
    // A pure partial edit must NOT send saveAsPending so the backend skips state change.
    if (!isEditMode || !saveAsPending) {
      fd.append("saveAsPending", String(saveAsPending));
    }
    fd.append(
      "accessories",
      JSON.stringify(
        formData.accessories
          // Backend validates against a static enum (14 keys). Filter out
          // custom catalog accessories whose key isn't in that enum yet.
          .filter((a) =>
            Object.values(AccessoryKey)
              .map((v) => v.toLowerCase())
              .includes(a.key.toLowerCase())
          )
          .map((a) => {
            const item: { key: string; classification: string; notes?: string } = {
              key: a.key.toLowerCase(), // backend enum is all lowercase (boton_encendido, aros...)
              classification: a.classification,
            };
            // 'notes' solo para el accesorio 'otros'
            if (a.key.toLowerCase() === "otros" && a.notes) item.notes = a.notes;
            return item;
          })
      )
    );
    if (files.invoiceFile) fd.append("vehicleInvoice", files.invoiceFile);
    if (files.giftEmailFile) fd.append("giftEmail", files.giftEmailFile);
    if (files.accessoryInvoiceFile)
      fd.append("accessoryInvoice", files.accessoryInvoiceFile);
    return fd;
  };

  const handleSave = async (saveAsPending: boolean) => {
    setSaving(saveAsPending ? "pending" : "final");
    try {
      const fd = buildFormData(saveAsPending);
      if (existingDoc) {
        await updateDocumentation(vehicleId!, fd);
      } else {
        await createDocumentation(vehicleId!, fd);
      }

      if (isEditMode) {
        if (!saveAsPending && isPending) {
          // Completed a pending doc → go to stock
          toast.success("Documentación completada correctamente");
          router.push("/dashboard/stock");
        } else {
          // Pure partial edit
          toast.success("Documentación actualizada");
          router.push("/dashboard/documentacion");
        }
      } else {
        if (saveAsPending) {
          toast("Guardado como pendiente", { icon: "⏳" });
          router.push("/dashboard/documentacion");
        } else {
          toast.success("Vehículo documentado correctamente");
          router.push("/dashboard/stock");
        }
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Error al guardar la documentación";
      toast.error(msg);
    } finally {
      setSaving(null);
    }
  };

  const updateAccessory = (key: string, classification: AccessoryClassificationType) => {
    setFormData((prev) => ({
      ...prev,
      accessories: prev.accessories.map((a) =>
        a.key === key ? { ...a, classification } : a
      ),
    }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400">Vehículo no encontrado.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm text-gray-400">Documentación</span>
      </div>

      <PageHeader
        title={isEditMode ? "Editar Documentación" : "Documentar Vehículo"}
        subtitle={`${vehicle.model} | Chasis: ${vehicle.chassis}`}
        badge={<StatusBadge status={vehicle.status} />}
      />

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8 bg-white border border-gray-200 rounded-xl p-1 w-fit">
        {STEP_LABELS.map((label, i) => (
          <button
            key={label}
            onClick={() => i < step + 1 && setStep(i as Step)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              i === step
                ? "bg-gray-900 text-white"
                : i < step
                ? "text-gray-700 hover:bg-gray-100"
                : "text-gray-400 cursor-default"
            }`}
          >
            <span className="mr-1.5 text-xs font-bold">{i + 1}.</span>
            {label}
          </button>
        ))}
      </div>

      {/* Form Steps */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {step === 0 && (
          <div className="space-y-4 max-w-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Datos del Comprador
            </h3>
            <Input
              label="Nombre completo"
              placeholder="Juan Pérez García"
              value={formData.clientName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, clientName: e.target.value }))
              }
              error={errors.clientName}
              required
            />
            <Input
              label="Cédula / RUC"
              placeholder="1723456789 o 1723456789001"
              value={formData.clientId}
              maxLength={13}
              onChange={(e) =>
                setFormData((p) => ({
                  ...p,
                  clientId: e.target.value.replace(/\D/g, ""),
                }))
              }
              error={errors.clientId}
              required
            />
            <Input
              label="Teléfono"
              type="tel"
              placeholder="09XXXXXXXX"
              value={formData.clientPhone}
              maxLength={10}
              onChange={(e) =>
                setFormData((p) => ({ ...p, clientPhone: e.target.value.replace(/\D/g, "") }))
              }
              error={errors.clientPhone}
              required
            />

            {/* Tipo de matrícula — botones */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Tipo de matrícula <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {REGISTRY_TYPES.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setFormData((p) => ({ ...p, registrationType: opt.value }))
                    }
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                      formData.registrationType === opt.value
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors.registrationType && (
                <p className="text-xs text-red-500">{errors.registrationType}</p>
              )}
            </div>

            {/* Tipo de pago — botones */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Tipo de pago <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setFormData((p) => ({ ...p, paymentMethod: opt.value }))
                    }
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors cursor-pointer ${
                      formData.paymentMethod === opt.value
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors.paymentMethod && (
                <p className="text-xs text-red-500">{errors.paymentMethod}</p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 max-w-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Documentos del Vehículo
            </h3>
            <FileField
              label="Factura del vehículo (PDF)"
              name="invoiceFile"
              existingUrl={existingDoc?.vehicleInvoiceUrl}
              file={files.invoiceFile}
              onChange={(f) => setFiles((p) => ({ ...p, invoiceFile: f }))}
              required
            />
            <FileField
              label="Correo de obsequio (PDF)"
              name="giftEmailFile"
              existingUrl={existingDoc?.giftEmailUrl}
              file={files.giftEmailFile}
              onChange={(f) => setFiles((p) => ({ ...p, giftEmailFile: f }))}
            />
            <FileField
              label="Factura de accesorios (PDF)"
              name="accessoryInvoiceFile"
              existingUrl={existingDoc?.accessoryInvoiceUrl}
              file={files.accessoryInvoiceFile}
              onChange={(f) =>
                setFiles((p) => ({ ...p, accessoryInvoiceFile: f }))
              }
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              Clasificación de Accesorios
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Selecciona la clasificación para cada accesorio incluido en el vehículo.
            </p>
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-3 pb-1 border-b border-gray-200">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Accesorio</span>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Clasificación</span>
              </div>
              {formData.accessories.map((acc) => {
                const catalogItem = catalogAccessories.find(
                  (c) => (c.key ?? c.name).toLowerCase() === acc.key.toLowerCase()
                );
                const displayName = catalogItem?.name
                  ? catalogItem.name.charAt(0).toUpperCase() +
                    catalogItem.name.slice(1).toLowerCase()
                  : acc.key;
                return (
                <div
                  key={acc.key}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-800">
                    {displayName}
                  </span>
                  <div className="flex gap-1">
                    {CLASSIFICATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateAccessory(acc.key, opt.value as AccessoryClassificationType)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                          acc.classification === opt.value
                            ? opt.value === AccessoryClassification.VENDIDO
                              ? "bg-gray-900 text-white border-gray-900"
                              : opt.value === AccessoryClassification.OBSEQUIADO
                              ? "bg-gray-700 text-white border-gray-700"
                              : "bg-gray-100 text-gray-700 border-gray-300"
                            : "bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-700"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
            {formData.accessories.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">
                No hay accesorios configurados en el catálogo.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6">
        <div>
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(s - 1, 0) as Step)}
            >
              ← Anterior
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {step < 2 ? (
            <Button variant="primary" onClick={handleNext}>
              Siguiente →
            </Button>
          ) : isEditMode ? (
            // ── EDIT MODE ──────────────────────────────────────────
            <>
              <Button
                variant="outline"
                onClick={() => handleSave(true)}
                loading={saving === "pending"}
                disabled={saving !== null}
              >
                Guardar cambios
              </Button>
              {isPending && (
                <Button
                  variant="primary"
                  onClick={() => handleSave(false)}
                  loading={saving === "final"}
                  disabled={saving !== null}
                >
                  Completar documentación
                </Button>
              )}
            </>
          ) : (
            // ── CREATE MODE ────────────────────────────────────────
            <>
              <Button
                variant="outline"
                onClick={() => handleSave(true)}
                loading={saving === "pending"}
                disabled={saving !== null}
              >
                Guardar como pendiente
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSave(false)}
                loading={saving === "final"}
                disabled={saving !== null}
              >
                Guardar y documentar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FileField (solo carga, sin preview) ───────────────────────

function FileField({
  label,
  name,
  existingUrl,
  file,
  onChange,
  required,
}: {
  label: string;
  name: string;
  existingUrl?: string | null;
  file?: File;
  onChange: (f: File | undefined) => void;
  required?: boolean;
}) {
  const [inputKey, setInputKey] = useState(0);
  const hasExisting = !!(existingUrl?.trim());

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* Documento guardado en el sistema (sin preview) */}
      {hasExisting && !file && (
        <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle size={13} className="text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">Documento guardado</span>
          </div>
          <label
            htmlFor={name}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            <RefreshCw size={12} />
            Reemplazar
          </label>
          <input
            key={inputKey}
            id={name}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0])}
          />
        </div>
      )}

      {/* Archivo local seleccionado */}
      {file && (
        <div className="flex items-center justify-between border border-amber-200 rounded-xl px-4 py-3 bg-amber-50">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <FileText size={13} className="text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-800 truncate">{file.name}</span>
          </div>
          <button
            type="button"
            onClick={() => { onChange(undefined); setInputKey((k) => k + 1); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
            title="Quitar archivo"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Zona de carga cuando no hay nada */}
      {!hasExisting && !file && (
        <div>
          <label
            htmlFor={name}
            className="inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-colors w-full justify-center"
          >
            <Upload size={15} />
            Seleccionar PDF
          </label>
          <input
            key={inputKey}
            id={name}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => onChange(e.target.files?.[0])}
          />
        </div>
      )}
    </div>
  );
}
