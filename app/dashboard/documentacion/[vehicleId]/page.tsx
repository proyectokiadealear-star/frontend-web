"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getVehicle,
  getDocumentation,
  createDocumentation,
  updateDocumentation,
  getAccessories,
  deleteDocumentFile,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowLeft, Upload, FileText, RefreshCw, X, CheckCircle, Plus, Trash2, AlertTriangle } from "lucide-react";
import {
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

// Validación básica de formato — el backend (IsEcuadorianCedula) hace la verificación completa
function validateCedula(value: string): boolean {
  return /^\d{10}(\d{3})?$/.test(value);
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
    giftEmailFiles: File[];
    accessoryInvoiceFiles: File[];
  }>({ giftEmailFiles: [], accessoryInvoiceFiles: [] });

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
        let accessories = buildFromCatalog(d.accessories);
        // Reapertura: pre-select requested accessories as VENDIDO
        if (vRes.data.isReopening && vRes.data.reopenAccessories?.length) {
          const reopenSet = new Set(vRes.data.reopenAccessories.map((k: string) => k.toUpperCase()));
          accessories = accessories.map(a =>
            reopenSet.has(a.key.toUpperCase())
              ? { ...a, classification: AccessoryClassification.VENDIDO as AccessoryClassificationType }
              : a
          );
        }
        setFormData({
          clientName: d.clientName || "",
          clientId: d.clientId || "",
          clientPhone: d.clientPhone || "",
          registrationType: d.registrationType || "",
          paymentMethod: d.paymentMethod || "",
          accessories,
        });
      } else {
        // Pre-fill client fields from vehicle data (populated by Excel import).
        // All fields remain editable — this is just a convenience pre-fill.
        const v = vRes.data;
        let acc = buildFromCatalog();
        // Reapertura: pre-select requested accessories as VENDIDO
        if (v.isReopening && v.reopenAccessories?.length) {
          const reopenSet = new Set(v.reopenAccessories.map((k: string) => k.toUpperCase()));
          acc = acc.map(a =>
            reopenSet.has(a.key.toUpperCase())
              ? { ...a, classification: AccessoryClassification.VENDIDO as AccessoryClassificationType }
              : a
          );
        }
        setFormData((prev) => ({
          ...prev,
          clientName:    v.clientName    ?? prev.clientName,
          clientId:      v.clientId      ?? prev.clientId,
          clientPhone:   v.clientPhone   ?? prev.clientPhone,
          paymentMethod: v.paymentMethod ?? prev.paymentMethod,
          accessories:   acc,
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
      e.clientId = "Debe tener 10 dígitos (cédula) o 13 dígitos (RUC).";
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
        formData.accessories.map((a) => {
          const item: { key: string; classification: string; notes?: string } = {
            key: a.key, // preserve exact key as stored in the catalog/DB
            classification: a.classification,
          };
          if (a.key.toLowerCase() === "otros" && a.notes) item.notes = a.notes;
          return item;
        })
      )
    );
    if (files.invoiceFile) fd.append("vehicleInvoice", files.invoiceFile);
    files.giftEmailFiles.forEach((f) => fd.append("giftEmail", f));
    files.accessoryInvoiceFiles.forEach((f) => fd.append("accessoryInvoice", f));
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
        if (!saveAsPending && vehicle?.isReopening) {
          // Completed reopening doc → go to vehicle detail (already ASIGNADO)
          toast.success("Documentación de reapertura completada");
          router.push(`/dashboard/stock/${vehicleId}`);
        } else if (!saveAsPending && isPending) {
          // Completed a pending doc → go to stock
          toast.success("Documentación completada correctamente");
          router.push("/dashboard/stock");
        } else {
          // Pure partial edit — go back to wherever the user came from
          toast.success("Documentación actualizada");
          router.back();
        }
      } else {
        if (saveAsPending) {
          toast("Guardado como pendiente", { icon: "⏳" });
          router.back();
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

  const updateAccessoryNotes = (key: string, notes: string) => {
    setFormData((prev) => ({
      ...prev,
      accessories: prev.accessories.map((a) =>
        a.key === key ? { ...a, notes } : a
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

      {/* Reapertura Banner */}
      {vehicle.isReopening && (
        <div className="mb-6 border border-amber-300 bg-amber-50 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Reapertura solicitada
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Solicitada por{" "}
                <span className="font-medium">
                  {vehicle.reopenRequestedByName}
                </span>
                : {vehicle.reopenReason}
              </p>
              {vehicle.reopenAccessories && vehicle.reopenAccessories.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-amber-600 mb-1">
                    Accesorios solicitados:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {vehicle.reopenAccessories.map((key) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium"
                      >
                        {AccessoryLabel[key.toUpperCase() as keyof typeof AccessoryLabel] ?? key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
              placeholder="JUAN PÉREZ GARCÍA"
              value={formData.clientName}
              onChange={(e) =>
                setFormData((p) => ({ ...p, clientName: e.target.value.toUpperCase() }))
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
            <MultiFileField
              label="Correo de obsequio (PDF)"
              fieldName="giftEmail"
              vehicleId={vehicleId!}
              existingUrls={existingDoc?.giftEmailUrls ?? (existingDoc?.giftEmailUrl ? [existingDoc.giftEmailUrl] : [])}
              files={files.giftEmailFiles}
              onChange={(f) => setFiles((p) => ({ ...p, giftEmailFiles: f }))}
              max={5}
              onExistingRemoved={fetchData}
            />
            <MultiFileField
              label="Factura de accesorios (PDF)"
              fieldName="accessoryInvoice"
              vehicleId={vehicleId!}
              existingUrls={existingDoc?.accessoryInvoiceUrls ?? (existingDoc?.accessoryInvoiceUrl ? [existingDoc.accessoryInvoiceUrl] : [])}
              files={files.accessoryInvoiceFiles}
              onChange={(f) => setFiles((p) => ({ ...p, accessoryInvoiceFiles: f }))}
              max={5}
              onExistingRemoved={fetchData}
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
                  className="px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="grid grid-cols-[1fr_auto] items-center gap-4">
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
                  {acc.key.toLowerCase() === "otros" && acc.classification !== AccessoryClassification.NO_APLICA && (
                    <div className="mt-2 ml-0">
                      <input
                        type="text"
                        placeholder="Detalle del accesorio (ej: Pantalla Android 10″)"
                        value={acc.notes || ""}
                        onChange={(e) => updateAccessoryNotes(acc.key, e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                      />
                    </div>
                  )}
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
              {isPending && !vehicle?.isReopening && (
                <Button
                  variant="primary"
                  onClick={() => handleSave(false)}
                  loading={saving === "final"}
                  disabled={saving !== null}
                >
                  Completar documentación
                </Button>
              )}
              {vehicle?.isReopening && (
                <Button
                  variant="primary"
                  onClick={() => handleSave(false)}
                  loading={saving === "final"}
                  disabled={saving !== null}
                >
                  Completar reapertura
                </Button>
              )}
            </>
          ) : (
            // ── CREATE MODE ────────────────────────────────────────
            <>
              {!vehicle?.isReopening && (
                <Button
                  variant="outline"
                  onClick={() => handleSave(true)}
                  loading={saving === "pending"}
                  disabled={saving !== null}
                >
                  Guardar como pendiente
                </Button>
              )}
              <Button
                variant="primary"
                onClick={() => handleSave(false)}
                loading={saving === "final"}
                disabled={saving !== null}
              >
                {vehicle?.isReopening ? "Completar reapertura" : "Guardar y documentar"}
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

// ── MultiFileField (múltiples PDFs, hasta N) ─────────────────

function MultiFileField({
  label,
  fieldName,
  vehicleId,
  existingUrls,
  files,
  onChange,
  max,
  onExistingRemoved,
}: {
  label: string;
  fieldName: string;
  vehicleId: string;
  existingUrls: string[];
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
  onExistingRemoved?: () => void;
}) {
  const [inputKey, setInputKey] = useState(0);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const totalCount = existingUrls.length + files.length;
  const canAdd = totalCount < max;

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (existingUrls.length + files.length >= max) {
      toast.error(`Máximo ${max} archivos permitidos`);
      return;
    }
    onChange([...files, selected]);
    setInputKey((k) => k + 1);
  };

  const handleRemoveNew = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const handleRemoveExisting = async (index: number) => {
    setRemovingIdx(index);
    try {
      await deleteDocumentFile(vehicleId, fieldName, index);
      toast.success("Archivo eliminado");
      onExistingRemoved?.();
    } catch {
      toast.error("Error al eliminar el archivo");
    } finally {
      setRemovingIdx(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>

      {/* Existing files from server */}
      {existingUrls.map((url, idx) => (
        <div
          key={`existing-${idx}`}
          className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 bg-gray-50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle size={13} className="text-green-600" />
            </div>
            <span className="text-sm font-medium text-gray-700 truncate">
              Documento {idx + 1} — guardado
            </span>
          </div>
          <button
            type="button"
            disabled={removingIdx === idx}
            onClick={() => handleRemoveExisting(idx)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
            title="Eliminar archivo"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {/* New files (not yet saved) */}
      {files.map((file, idx) => (
        <div
          key={`new-${idx}`}
          className="flex items-center justify-between border border-amber-200 rounded-xl px-4 py-3 bg-amber-50"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <FileText size={13} className="text-amber-600" />
            </div>
            <span className="text-sm font-medium text-gray-800 truncate">{file.name}</span>
          </div>
          <button
            type="button"
            onClick={() => handleRemoveNew(idx)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer shrink-0"
            title="Quitar archivo"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      {/* Add button */}
      {canAdd && (
        <div>
          <label
            htmlFor={`multi-${fieldName}`}
            className="inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-colors w-full justify-center"
          >
            {totalCount === 0 ? <Upload size={15} /> : <Plus size={15} />}
            {totalCount === 0 ? "Seleccionar PDF" : "Agregar otro PDF"}
          </label>
          <input
            key={inputKey}
            id={`multi-${fieldName}`}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleAdd}
          />
        </div>
      )}

      {/* Counter */}
      {totalCount > 0 && (
        <p className="text-xs text-gray-400">{totalCount} de {max} archivos</p>
      )}
    </div>
  );
}
