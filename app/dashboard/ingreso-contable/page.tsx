"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getVehicles,
  getModels,
  getColors,
  getSedes,
  createVehicle,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { VehicleStatus } from "@/lib/constants";
import type { Vehicle, CatalogItem } from "@/types";
import { Plus, Car } from "lucide-react";
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

  // Submit
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

  return (
    <div>
      <PageHeader
        title="Ingreso Contable"
        subtitle="Registra vehículos nuevos que aún no han llegado físicamente"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Formulario ─────────────────────────────────── */}
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

        {/* ── Registrados recientemente ──────────────────── */}
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
    </div>
  );
}
