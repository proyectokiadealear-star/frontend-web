"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getVehicles,
  getModels,
  getColors,
  getSedes,
  createVehicle,
  previewExcel,
  cargarExcel,
} from "@/lib/api";
import type { EtlRow } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { VehicleStatus } from "@/lib/constants";
import type { Vehicle, CatalogItem } from "@/types";
import {
  Plus,
  Car,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";

export default function IngresoContablePage() {
  const { user } = useAuth();

  // Catalogs
  const [models, setModels] = useState<CatalogItem[]>([]);
  const [colors, setColors] = useState<CatalogItem[]>([]);
  const [sedes, setSedes] = useState<CatalogItem[]>([]);

  // Form
  const [form, setForm] = useState({
    chassis: "",
    model: "",
    year: "",
    color: "",
    sede: "",
    isFacturado: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Recently registered vehicles
  const [recent, setRecent] = useState<Vehicle[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // ── Tabs ────────────────────────────────────────────
  type TabView = "individual" | "masiva";
  const [activeTab, setActiveTab] = useState<TabView>("individual");

  // ── Carga masiva — estado de la carga ─────────────
  type MasivaStep = "idle" | "previewing" | "preview_ready" | "confirming" | "done";
  const [step, setStep] = useState<MasivaStep>("idle");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<EtlRow[]>([]);
  const [uploadResult, setUploadResult] = useState<{
    total: number;
    insertados: number;
    actualizados: number;
    ignorados: number;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  // Fetch catalogs
  useEffect(() => {
    Promise.all([getModels(), getColors(), getSedes()])
      .then(([mRes, cRes, sRes]) => {
        setModels(mRes.data ?? []);
        setColors(cRes.data ?? []);
        setSedes(sRes.data ?? []);
      })
      .catch(() => {});
  }, []);

  // Fetch recently registered (POR_ARRIBAR)
  const fetchRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await getVehicles({
        status: VehicleStatus.POR_ARRIBAR,
        limit: 20,
      });
      setRecent(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  // Validation
  const validate = () => {
    const errs: Record<string, string> = {};
    const chassis = form.chassis.trim();
    if (!chassis) errs.chassis = "Requerido";
    else if (!/^[A-Za-z0-9]{6,20}$/.test(chassis))
      errs.chassis = "6-20 caracteres alfanuméricos";
    if (!form.model) errs.model = "Selecciona un modelo";
    const yearNum = Number(form.year);
    if (!form.year) errs.year = "Ingresa el año";
    else if (!Number.isInteger(yearNum) || yearNum < currentYear)
      errs.year = `El año debe ser ${currentYear} o superior`;
    if (!form.color) errs.color = "Selecciona un color";
    if (!form.sede) errs.sede = "Selecciona una sede";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit individual
  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await createVehicle({
        chassis: form.chassis.trim().toUpperCase(),
        model: form.model.toUpperCase(),
        year: Number(form.year),
        color: form.color.toUpperCase(),
        sede: form.sede,
        isFacturado: form.isFacturado,
      });
      toast.success("Vehículo registrado correctamente");
      setForm({
        chassis: "",
        model: "",
        year: "",
        color: "",
        sede: "",
        isFacturado: true,
      });
      setErrors({});
      fetchRecent();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Error al registrar vehículo";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── PASO 1: seleccionar archivo → preview ──────────
  const handleSeleccionarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setPendingFile(file);
    setPreviewRows([]);
    setUploadResult(null);
    setUploadError(null);
    setStep("previewing");

    try {
      const result = await previewExcel(file);
      setPreviewRows(result.data);
      setStep("preview_ready");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Error al leer el archivo Excel";
      setUploadError(msg);
      toast.error(msg);
      setStep("idle");
      setPendingFile(null);
    }
  };

  // ── PASO 2: confirmar → upsert en Firestore ────────
  const handleConfirmar = async () => {
    if (!pendingFile) return;
    setStep("confirming");
    setUploadError(null);

    try {
      const result = await cargarExcel(pendingFile);
      setUploadResult(result);
      setStep("done");
      fetchRecent();
      toast.success(
        `Carga completada: ${result.insertados} nuevos, ${result.actualizados} actualizados`
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Error al procesar la carga";
      setUploadError(msg);
      toast.error(msg);
      setStep("preview_ready"); // stay in preview so user can retry
    }
  };

  // Resetear flujo masivo
  const handleReiniciar = () => {
    setStep("idle");
    setPendingFile(null);
    setPreviewRows([]);
    setUploadResult(null);
    setUploadError(null);
  };

  // Status badge colores simples para preview
  const statusColor: Record<string, string> = {
    POR_ARRIBAR: "bg-blue-100 text-blue-800",
    NO_FACTURADO: "bg-gray-100 text-gray-700",
    CEDIDO: "bg-orange-100 text-orange-800",
    ENTREGADO: "bg-green-100 text-green-800",
  };

  return (
    <div>
      <PageHeader
        title="Ingreso Contable"
        subtitle="Registra vehículos nuevos que aún no han llegado físicamente"
      />

      {/* ── Tab bar ─────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("individual")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "individual"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <Plus size={15} />
            Registro individual
          </span>
        </button>
        <button
          onClick={() => setActiveTab("masiva")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "masiva"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="flex items-center gap-2">
            <Upload size={15} />
            Carga masiva Excel
          </span>
        </button>
      </div>

      {/* ── TAB: INDIVIDUAL ───────────────────────────── */}
      {activeTab === "individual" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-200 rounded-xl p-6 sticky top-6">
              <div className="flex items-center gap-2 mb-1">
                <Plus size={16} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Registrar Vehículo
                </h2>
              </div>
              <p className="text-xs text-gray-400 mb-5">
                Sin foto ni concesionario origen. El estado inicial depende de si
                el vehículo ya tiene factura del importador.
              </p>

              <div className="space-y-4">
                <Input
                  label="Chasis"
                  placeholder="Ej: 8LGFB8149TE011987"
                  required
                  value={form.chassis}
                  maxLength={20}
                  error={errors.chassis}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      chassis: e.target.value
                        .replace(/[^A-Za-z0-9]/g, "")
                        .toUpperCase(),
                    }))
                  }
                />
                <Select
                  label="Modelo"
                  required
                  placeholder="Seleccionar modelo..."
                  value={form.model}
                  error={errors.model}
                  options={models.map((m) => ({
                    value: m.name,
                    label: m.name,
                  }))}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, model: e.target.value }))
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Año"
                    required
                    type="number"
                    placeholder={String(currentYear)}
                    min={currentYear}
                    value={form.year}
                    error={errors.year}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, year: e.target.value }))
                    }
                  />
                  <Select
                    label="Color"
                    required
                    placeholder="Color..."
                    value={form.color}
                    error={errors.color}
                    options={colors.map((c) => ({
                      value: c.name,
                      label: c.name,
                    }))}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, color: e.target.value }))
                    }
                  />
                </div>

                <Select
                  label="Sede"
                  required
                  placeholder="Seleccionar sede..."
                  value={form.sede}
                  error={errors.sede}
                  options={sedes.map((s) => ({
                    value: s.code || s.name,
                    label: s.name,
                  }))}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, sede: e.target.value }))
                  }
                />

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFacturado}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, isFacturado: e.target.checked }))
                    }
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      Vehículo facturado
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Desmarca si el vehículo aún no tiene factura del importador
                    </p>
                  </div>
                </label>

                <div className="pt-3 border-t border-gray-100">
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleSubmit}
                    loading={saving}
                    disabled={saving}
                    icon={<Plus size={15} />}
                  >
                    Registrar vehículo
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Registrados recientemente */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Car size={16} className="text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Registrados recientemente
                </h2>
              </div>
              <span className="text-xs bg-gray-100 text-gray-600 font-medium px-2 py-0.5 rounded-full">
                {recent.length} por arribar
              </span>
            </div>

            {loadingRecent ? (
              <SkeletonGrid cols={2} rows={2} />
            ) : recent.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <Car size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-400">
                  No hay vehículos registrados aún.
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  Usa el formulario de la izquierda para comenzar.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Chasis
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Modelo
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Año
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Color
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recent.map((v) => (
                      <tr
                        key={v.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {v.chassis}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {v.model}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{v.year}</td>
                        <td className="px-4 py-3 text-gray-600">{v.color}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={v.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: CARGA MASIVA ─────────────────────────── */}
      {activeTab === "masiva" && (
        <div className="space-y-6">

          {/* ── STEP: idle — zona de upload ────────────── */}
          {step === "idle" && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl p-8">
                <div className="flex items-center gap-3 mb-2">
                  <FileSpreadsheet size={20} className="text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                    Cargar inventario desde Excel KDCS
                  </h2>
                </div>
                <p className="text-xs text-gray-400 mb-6">
                  Sube el reporte mensual KDCS en formato{" "}
                  <span className="font-medium">.xlsx</span>. El sistema mostrará
                  un preview antes de aplicar los cambios.
                </p>

                <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-xl cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleSeleccionarArchivo}
                  />
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Upload size={24} />
                    <span className="text-sm font-medium text-gray-600">
                      Seleccionar archivo Excel
                    </span>
                    <span className="text-xs">KDCS .xlsx — máximo 10 MB</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ── STEP: previewing — spinner ─────────────── */}
          {step === "previewing" && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Leyendo archivo con el ETL…</p>
                <p className="text-xs text-gray-400">{pendingFile?.name}</p>
              </div>
            </div>
          )}

          {/* ── STEP: preview_ready — tabla ────────────── */}
          {step === "preview_ready" && (
            <div className="space-y-4">
              {/* Cabecera del preview */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye size={16} className="text-gray-400" />
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">
                      Preview — {previewRows.length} vehículos detectados
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Archivo:{" "}
                      <span className="font-medium">{pendingFile?.name}</span>.
                      Revisa los datos y confirma para aplicar los cambios.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleReiniciar}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <RefreshCw size={13} />
                    Cambiar archivo
                  </button>
                  <Button
                    variant="primary"
                    onClick={handleConfirmar}
                    icon={<CheckCircle2 size={15} />}
                  >
                    Confirmar carga ({previewRows.length})
                  </Button>
                </div>
              </div>

              {/* Tabla preview */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm min-w-[1100px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          #
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Chasis
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Modelo
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Color
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Sede
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Estado
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Año
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Factura
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          F. Entrega
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Cliente
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Cédula
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          Teléfono
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                            {i + 1}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-700 whitespace-nowrap">
                            {row.chassis ?? <span className="text-red-400 italic">sin chasis</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-900 font-medium whitespace-nowrap">
                            {row.model ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                            {row.color ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                            {row.sede ?? "—"}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            {row.status ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  statusColor[row.status] ?? "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {row.status}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {row.year ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {row.createdAt
                              ? new Date(row.createdAt).toLocaleDateString("es-EC", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            {row.deliveryDate
                              ? new Date(row.deliveryDate).toLocaleDateString("es-EC", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                            {row.clientName ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                            {row.clientId ?? <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">
                            {row.clientPhone ?? <span className="text-gray-300">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: confirming — spinner ──────────────── */}
          {step === "confirming" && (
            <div className="max-w-xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Aplicando cambios en Firestore…</p>
                <p className="text-xs text-gray-400">{previewRows.length} vehículos</p>
              </div>
            </div>
          )}

          {/* ── STEP: done — resultado ─────────────────── */}
          {step === "done" && uploadResult && (
            <div className="max-w-xl mx-auto space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 size={18} className="text-green-600" />
                  <h2 className="text-sm font-semibold text-green-800">
                    Carga completada
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: "Total procesados", value: uploadResult.total, color: "text-gray-700" },
                    { label: "Insertados", value: uploadResult.insertados, color: "text-green-700" },
                    { label: "Actualizados", value: uploadResult.actualizados, color: "text-blue-700" },
                    { label: "Ignorados", value: uploadResult.ignorados, color: "text-gray-500" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-100"
                    >
                      <div className={`text-2xl font-bold ${item.color}`}>
                        {item.value}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{item.label}</div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleReiniciar}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 transition-colors"
                >
                  <RefreshCw size={13} />
                  Cargar otro archivo
                </button>
              </div>
            </div>
          )}

          {/* Error global (visible en cualquier step) */}
          {uploadError && (
            <div className="max-w-xl mx-auto">
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-500" />
                  <span className="text-sm text-red-700">{uploadError}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
