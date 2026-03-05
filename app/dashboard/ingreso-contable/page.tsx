"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getVehicles,
  getModels,
  getColors,
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

  // Form
  const [form, setForm] = useState({
    chassis: "",
    model: "",
    year: "",
    color: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Recently registered vehicles
  const [recent, setRecent] = useState<Vehicle[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const currentYear = new Date().getFullYear();
  const yearOptions = [
    { value: String(currentYear), label: String(currentYear) },
    { value: String(currentYear + 1), label: String(currentYear + 1) },
  ];

  // Fetch catalogs
  useEffect(() => {
    Promise.all([getModels(), getColors()])
      .then(([mRes, cRes]) => {
        setModels(mRes.data ?? []);
        setColors(cRes.data ?? []);
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
    if (!form.year) errs.year = "Selecciona el año";
    if (!form.color) errs.color = "Selecciona un color";
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
      });
      toast.success("Vehículo registrado correctamente");
      setForm({ chassis: "", model: "", year: "", color: "" });
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
              Sin foto ni concesionario origen. Se asigna estado{" "}
              <span className="font-medium text-gray-500">Por Arribar</span>.
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
                <Select
                  label="Año"
                  required
                  placeholder="Año..."
                  value={form.year}
                  error={errors.year}
                  options={yearOptions}
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

              <div className="pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-3">
                  Sede asignada:{" "}
                  <span className="font-medium text-gray-600">
                    {user?.sede ?? "—"}
                  </span>
                </p>
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
