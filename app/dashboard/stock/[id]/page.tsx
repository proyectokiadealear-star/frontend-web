"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  getVehicle,
  getCertification,
  getDocumentation,
  getStatusHistory,
  deleteVehicle,
  updateVehicle,
  updateCertification,
  getDeliveryCeremony,
  getSedes,
  getModels,
  getColors,
  getConcessionaires,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { DateInput } from "@/components/ui/DateInput";
import { Skeleton } from "@/components/ui/Skeleton";
import { TraceabilityTimeline } from "@/components/vehicles/TraceabilityTimeline";
import { DocFileField } from "@/components/vehicles/DocFileField";
import { AccessoryLabel, AccessoryClassificationLabel, RoleEnum } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { generateVehiclePDF } from "@/lib/generateVehiclePDF";
import type { Vehicle, Certification, Documentation, StatusHistoryEntry, DeliveryCeremony } from "@/types";
import { Car, ArrowLeft, Download, Trash2, Pencil, Camera, FileText, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

const tabs = ["Ingreso / Certificación", "Documentación", "Ceremonia de Entrega", "Trazabilidad"];

const RimsStatusLabel: Record<string, string> = {
  VIENE: "Vienen",
  RAYADOS: "Rayados",
  NO_VINIERON: "No vinieron",
};

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isJefe = user?.role === RoleEnum.JEFE_TALLER || user?.role === RoleEnum.SOPORTE;
  const canEditDoc =
    user?.role === RoleEnum.DOCUMENTACION ||
    user?.role === RoleEnum.JEFE_TALLER ||
    user?.role === RoleEnum.SOPORTE;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [cert, setCert] = useState<Certification | null>(null);
  const [doc, setDoc] = useState<Documentation | null>(null);
  const [ceremony, setCeremony] = useState<DeliveryCeremony | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [sedesOptions, setSedesOptions] = useState<{ value: string; label: string }[]>([]);
  const [modelsOptions, setModelsOptions] = useState<{ value: string; label: string }[]>([]);
  const [colorsOptions, setColorsOptions] = useState<{ value: string; label: string }[]>([]);
  const [concessionairesOptions, setConcessionairesOptions] = useState<{ value: string; label: string }[]>([]);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editVehicle, setEditVehicle] = useState({ model: "", year: "", color: "", sede: "", originConcessionaire: "", receptionDate: "" });
  const [editCert, setEditCert] = useState({ mileage: "", radio: "", seatType: "", rimsStatus: "", hasImprints: false, notes: "" });

  const openEdit = async () => {
    if (!vehicle) return;
    const toDateStr = (v: unknown): string => {
      if (!v) return "";
      if (typeof v === "string") return v.slice(0, 10);
      if (typeof v === "object" && v !== null && "_seconds" in v)
        return new Date((v as { _seconds: number })._seconds * 1000)
          .toISOString()
          .slice(0, 10);
      return "";
    };
    setEditVehicle({
      model: vehicle.model ?? "",
      year: String(vehicle.year ?? ""),
      color: vehicle.color ?? "",
      sede: vehicle.sede ?? "",
      originConcessionaire: vehicle.originConcessionaire ?? "",
      receptionDate: toDateStr(vehicle.receptionDate),
    });
    setEditCert({
      mileage: cert ? String(cert.mileage) : "",
      radio: cert?.radio ?? "",
      seatType: cert?.seatType ?? "",
      rimsStatus: cert?.rims?.status ?? "",
      hasImprints: cert?.hasImprints ?? false,
      notes: cert?.notes ?? "",
    });
    // Clear previous validation errors
    setEditErrors({});
    // Load catalogs in parallel if not already loaded
    try {
      const [sedesRes, modelsRes, colorsRes, concessRes] = await Promise.allSettled([
        sedesOptions.length === 0 ? getSedes() : Promise.resolve(null),
        modelsOptions.length === 0 ? getModels() : Promise.resolve(null),
        colorsOptions.length === 0 ? getColors() : Promise.resolve(null),
        concessionairesOptions.length === 0 ? getConcessionaires() : Promise.resolve(null),
      ]);
      if (sedesRes.status === "fulfilled" && sedesRes.value)
        setSedesOptions((sedesRes.value.data ?? []).map((s) => ({ value: s.code ?? s.name, label: s.name })));
      if (modelsRes.status === "fulfilled" && modelsRes.value)
        setModelsOptions((modelsRes.value.data ?? []).map((m) => ({ value: m.name, label: m.name })));
      if (colorsRes.status === "fulfilled" && colorsRes.value)
        setColorsOptions((colorsRes.value.data ?? []).map((c) => ({ value: c.name, label: c.name })));
      if (concessRes.status === "fulfilled" && concessRes.value)
        setConcessionairesOptions((concessRes.value.data ?? []).map((c) => ({ value: c.name, label: c.name })));
    } catch {
      // fallback: inputs remain as free text
    }
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!id) return;
    // Visual validation
    const errs: Record<string, string> = {};
    if (!editVehicle.model.trim()) errs.model = "El modelo es requerido";
    if (!editVehicle.year || Number(editVehicle.year) === 0) errs.year = "El año es requerido";
    if (!editVehicle.color.trim()) errs.color = "El color es requerido";
    if (!editVehicle.sede) errs.sede = "La sede es requerida";
    if (!editVehicle.originConcessionaire.trim()) errs.originConcessionaire = "El concesionario origen es requerido";
    if (Object.keys(errs).length > 0) { setEditErrors(errs); return; }
    setEditErrors({});
    setEditSaving(true);
    try {
      const vehiclePayload: Record<string, unknown> = {
        // Backend stores MAYÚSCULAS — uppercase before sending
        model: editVehicle.model.trim().toUpperCase(),
        year: Number(editVehicle.year),
        color: editVehicle.color.trim().toUpperCase(),
        sede: editVehicle.sede,
        originConcessionaire: editVehicle.originConcessionaire.trim().toUpperCase(),
        // receptionDate intentionally excluded — not in UpdateVehicleDto
      };
      // Remove empty strings to avoid overwriting with blank
      Object.keys(vehiclePayload).forEach((k) => {
        if (vehiclePayload[k] === "" || vehiclePayload[k] === 0 || vehiclePayload[k] === undefined)
          delete vehiclePayload[k];
      });
      const promises: Promise<unknown>[] = [updateVehicle(id, vehiclePayload as Partial<Vehicle>)];
      if (cert) {
        promises.push(
          updateCertification(id, {
            mileage: Number(editCert.mileage),
            radio: editCert.radio,
            seatType: editCert.seatType,
            rims: { status: editCert.rimsStatus, photoUrl: cert?.rims?.photoUrl },
            hasImprints: editCert.hasImprints,
            notes: editCert.notes,
          })
        );
      }
      await Promise.all(promises);
      toast.success("Vehículo actualizado");
      setEditOpen(false);
      fetchAll();
    } catch {
      toast.error("Error al actualizar");
    } finally {
      setEditSaving(false);
    }
  };

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [vRes, hRes] = await Promise.all([
        getVehicle(id),
        getStatusHistory(id),
      ]);
      setVehicle(vRes.data);
      setHistory(hRes.data);

      const [cRes, dRes, cerRes] = await Promise.allSettled([
        getCertification(id),
        getDocumentation(id),
        getDeliveryCeremony(id),
      ]);
      if (cRes.status === "fulfilled") setCert(cRes.value.data);
      if (dRes.status === "fulfilled") setDoc(dRes.value.data);
      setCeremony(cerRes.status === "fulfilled" ? cerRes.value.data : null);
    } catch {
      toast.error("Error al cargar el vehículo");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteVehicle(id);
      toast.success("Vehículo eliminado");
      router.replace("/dashboard/stock");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const handleReport = () => {
    if (!vehicle) return;
    generateVehiclePDF({ vehicle, cert, doc, ceremony, history });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm">Vehículo no encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>
        <span className="text-sm text-gray-400">Stock</span>
      </div>

      <PageHeader
        title={`${vehicle.model} — ${vehicle.color}`}
        subtitle={`Chasis: ${vehicle.chassis}`}
        badge={<StatusBadge status={vehicle.status} size="md" />}
        actions={
          <div className="flex gap-2">
            {isJefe && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Pencil size={14} />}
                  onClick={openEdit}
                >
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Download size={14} />}
                  onClick={handleReport}
                >
                  Reporte
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  onClick={() => setConfirmDelete(true)}
                >
                  Eliminar
                </Button>
              </>
            )}
            {user?.role === RoleEnum.DOCUMENTACION && vehicle.status === "CERTIFICADO_STOCK" && (
              <Button
                size="sm"
                onClick={() =>
                  router.push(`/dashboard/documentacion/${vehicle.id}`)
                }
              >
                Documentar
              </Button>
            )}
          </div>
        }
      />

      {/* Photo */}
      <div className="mb-6 h-52 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
        {vehicle.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.photoUrl}
            alt={vehicle.chassis}
            className="w-full h-full object-cover"
          />
        ) : (
          <Car size={48} className="text-gray-300" />
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              activeTab === i
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FieldSection title="Datos del Vehículo">
            <Field label="Modelo" value={vehicle.model} />
            <Field label="Año" value={String(vehicle.year)} />
            <Field label="Color" value={vehicle.color} />
            <Field label="Chasis" value={vehicle.chassis} mono />
            <Field label="Sede" value={vehicle.sede} />
            <Field label="Concesionario origen" value={vehicle.originConcessionaire} />
            <Field label="Fecha de recepción" value={formatDate(vehicle.receptionDate)} />
          </FieldSection>

          {cert && (
            <FieldSection title="Certificación">
              <Field label="Kilometraje" value={`${cert.mileage} km`} />
              <Field label="Radio" value={cert.radio} />
              <Field label="Tipo de asiento" value={cert.seatType} />
              <Field label="Estado de aros" value={RimsStatusLabel[cert.rims?.status ?? ""] ?? cert.rims?.status ?? "—"} />
              {cert.rims?.photoUrl && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Foto de aros</p>
                  <a href={cert.rims.photoUrl} target="_blank" rel="noreferrer">
                    <img
                      src={cert.rims.photoUrl}
                      alt="Foto de aros"
                      className="h-28 w-full object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer"
                    />
                  </a>
                </div>
              )}
              <Field label="Improntas" value={cert.hasImprints ? "Sí" : "No"} />
              {cert.notes && <Field label="Notas" value={cert.notes} />}
              <Field label="Certificado el" value={formatDateTime(cert.certifiedAt)} />
            </FieldSection>
          )}
        </div>
      )}

      {activeTab === 1 && (
        <div>
          {!doc ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <p className="text-sm text-gray-400">
                Aún no hay documentación registrada.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {canEditDoc && (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Pencil size={13} />}
                    onClick={() => router.push(`/dashboard/documentacion/${id}`)}
                  >
                    Editar documentación
                  </Button>
                </div>
              )}
              <FieldSection title="Datos del Cliente">
                <Field label="Nombre" value={doc.clientName} />
                <Field label="Cédula" value={doc.clientId} />
                <Field label="Teléfono" value={doc.clientPhone} />
                <Field label="Tipo de matrícula" value={doc.registrationType} />
              </FieldSection>

              {/* Documentos con preview y actualización inline */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Documentos
                </h3>
                <div className="space-y-4">
                  <DocFileField
                    label="Factura del vehículo"
                    fieldName="vehicleInvoice"
                    vehicleId={id!}
                    existingUrl={doc.vehicleInvoiceUrl}
                    onSaved={fetchAll}
                  />
                  <DocFileField
                    label="Correo de obsequio"
                    fieldName="giftEmail"
                    vehicleId={id!}
                    existingUrl={doc.giftEmailUrl}
                    onSaved={fetchAll}
                  />
                  <DocFileField
                    label="Factura de accesorios"
                    fieldName="accessoryInvoice"
                    vehicleId={id!}
                    existingUrl={doc.accessoryInvoiceUrl}
                    onSaved={fetchAll}
                  />
                </div>
              </div>

              <FieldSection title="Clasificación de Accesorios">
                  <div className="col-span-2 overflow-x-auto">
                    {!Array.isArray(doc.accessories) || doc.accessories.length === 0 ? (
                      <p className="text-sm text-gray-400 py-2">No hay accesorios registrados.</p>
                    ) : (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">
                            Accesorio
                          </th>
                          <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">
                            Clasificación
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {doc.accessories.map((acc) => (
                          <tr key={acc.key} className="border-b border-gray-100">
                            <td className="py-2 pr-4 text-gray-700">
                              {/* Try exact key, then uppercase (for lowercase seed keys like "aros") */}
                              {AccessoryLabel[acc.key as keyof typeof AccessoryLabel] ??
                                AccessoryLabel[acc.key.toUpperCase() as keyof typeof AccessoryLabel] ??
                                acc.key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                            </td>
                            <td className="py-2 text-gray-600">
                              {AccessoryClassificationLabel[acc.classification] ??
                                acc.classification}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    )}
                  </div>
                </FieldSection>
            </div>
          )}
        </div>
      )}

      {activeTab === 2 && (
        <div>
          {!ceremony ? (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
              <Camera size={36} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">Ceremonia de entrega no registrada</p>
              <p className="text-xs text-gray-400 mt-1">Aún no se ha completado la entrega del vehículo.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {ceremony.deliveryPhotoUrl && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Foto de Entrega</h3>
                  </div>
                  <div className="bg-gray-50 flex items-center justify-center" style={{ aspectRatio: "16/9" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ceremony.deliveryPhotoUrl} alt="Foto de entrega" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
              {ceremony.signedActaUrl && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Acta de Entrega Firmada</h3>
                  <a
                    href={ceremony.signedActaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <FileText size={14} />
                    Ver acta firmada
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FieldSection title="Datos de Entrega">
                  {ceremony.deliveredAt && (
                    <Field label="Fecha de entrega" value={formatDateTime(ceremony.deliveredAt)} />
                  )}
                  {ceremony.advisorName && (
                    <Field label="Asesor" value={ceremony.advisorName} />
                  )}
                  {ceremony.clientName && (
                    <Field label="Cliente" value={ceremony.clientName} />
                  )}
                  {ceremony.notes && (
                    <Field label="Observaciones" value={ceremony.notes} />
                  )}
                </FieldSection>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 3 && (
        <div>
          <TraceabilityTimeline history={history} />
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Eliminar vehículo"
        description={`¿Eliminar el vehículo ${vehicle.chassis}? Esta acción es irreversible.`}
        confirmLabel="Eliminar permanentemente"
      />

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar vehículo"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleEditSave} loading={editSaving}>
              Guardar cambios
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos del vehículo</p>
            <div className="space-y-3">
              {/* Modelo */}
              {modelsOptions.length > 0 ? (
                <Select
                  label="Modelo"
                  required
                  placeholder="Seleccionar modelo..."
                  value={editVehicle.model}
                  options={modelsOptions}
                  error={editErrors.model}
                  onChange={(e) => setEditVehicle((p) => ({ ...p, model: e.target.value }))}
                />
              ) : (
                <Input
                  label="Modelo"
                  required
                  placeholder="Ej: SPORTAGE"
                  value={editVehicle.model}
                  error={editErrors.model}
                  onChange={(e) => setEditVehicle((p) => ({ ...p, model: e.target.value }))}
                />
              )}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Año"
                  type="number"
                  required
                  placeholder="Ej: 2024"
                  value={editVehicle.year}
                  error={editErrors.year}
                  onChange={(e) => setEditVehicle((p) => ({ ...p, year: e.target.value }))}
                />
                {/* Color */}
                {colorsOptions.length > 0 ? (
                  <Select
                    label="Color"
                    required
                    placeholder="Seleccionar color..."
                    value={editVehicle.color}
                    options={colorsOptions}
                    error={editErrors.color}
                    onChange={(e) => setEditVehicle((p) => ({ ...p, color: e.target.value }))}
                  />
                ) : (
                  <Input
                    label="Color"
                    required
                    placeholder="Ej: BLANCO"
                    value={editVehicle.color}
                    error={editErrors.color}
                    onChange={(e) => setEditVehicle((p) => ({ ...p, color: e.target.value }))}
                  />
                )}
              </div>
              {/* Concesionario origen */}
              {concessionairesOptions.length > 0 ? (
                <Select
                  label="Concesionario origen"
                  required
                  placeholder="Seleccionar concesionario..."
                  value={editVehicle.originConcessionaire}
                  options={concessionairesOptions}
                  error={editErrors.originConcessionaire}
                  onChange={(e) => setEditVehicle((p) => ({ ...p, originConcessionaire: e.target.value }))}
                />
              ) : (
                <Input
                  label="Concesionario origen"
                  required
                  placeholder="Ej: KIA NORTE"
                  value={editVehicle.originConcessionaire}
                  error={editErrors.originConcessionaire}
                  onChange={(e) => setEditVehicle((p) => ({ ...p, originConcessionaire: e.target.value }))}
                />
              )}
              {/* Sede: select from catalog to avoid invalid enum values */}
              {sedesOptions.length > 0 ? (
                <Select
                  label="Sede"
                  required
                  placeholder="Seleccionar sede..."
                  value={editVehicle.sede}
                  options={sedesOptions}
                  error={editErrors.sede}
                  onChange={(e) => setEditVehicle((p) => ({ ...p, sede: e.target.value }))}
                />
              ) : (
                <Input
                  label="Sede"
                  required
                  placeholder="Ej: BOGOTA"
                  value={editVehicle.sede}
                  error={editErrors.sede}
                  onChange={(e) => setEditVehicle((p) => ({ ...p, sede: e.target.value }))}
                />
              )}
              <DateInput
                label="Fecha de recepción (solo visual)"
                value={editVehicle.receptionDate}
                onChange={(v) => setEditVehicle((p) => ({ ...p, receptionDate: v }))}
              />
            </div>
          </div>

          {cert && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Certificación</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Kilometraje"
                    type="number"
                    placeholder="Ej: 5"
                    value={editCert.mileage}
                    onChange={(e) => setEditCert((p) => ({ ...p, mileage: e.target.value }))}
                  />
                  <Input
                    label="Radio"
                    placeholder="Ej: INSTALADO"
                    value={editCert.radio}
                    onChange={(e) => setEditCert((p) => ({ ...p, radio: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Tipo de asiento"
                    placeholder="Ej: CUERO"
                    value={editCert.seatType}
                    onChange={(e) => setEditCert((p) => ({ ...p, seatType: e.target.value }))}
                  />
                  <Select
                    label="Estado de aros"
                    placeholder="Seleccionar..."
                    value={editCert.rimsStatus}
                    options={[
                      { value: "VIENE", label: "Vienen" },
                      { value: "RAYADOS", label: "Rayados" },
                      { value: "NO_VINIERON", label: "No vinieron" },
                    ]}
                    onChange={(e) => setEditCert((p) => ({ ...p, rimsStatus: e.target.value }))}
                  />
                </div>
                {cert.rims?.photoUrl && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Foto de aros actual</p>
                    <a href={cert.rims.photoUrl} target="_blank" rel="noreferrer">
                      <img
                        src={cert.rims.photoUrl}
                        alt="Foto de aros"
                        className="h-24 w-full object-cover rounded-lg border border-gray-200 hover:opacity-90 transition-opacity cursor-pointer"
                      />
                    </a>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    id="hasImprints"
                    type="checkbox"
                    checked={editCert.hasImprints}
                    onChange={(e) => setEditCert((p) => ({ ...p, hasImprints: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 cursor-pointer"
                  />
                  <label htmlFor="hasImprints" className="text-sm text-gray-700 cursor-pointer">
                    Tiene improntas
                  </label>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Notas</label>
                  <textarea
                    rows={3}
                    value={editCert.notes}
                    onChange={(e) => setEditCert((p) => ({ ...p, notes: e.target.value }))}
                    className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500 transition-colors"
                    placeholder="Observaciones adicionales..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function FieldSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span
        className={`text-sm text-gray-900 ${mono ? "font-chassis" : "font-medium"}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}


