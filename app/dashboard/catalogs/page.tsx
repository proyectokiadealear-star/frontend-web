"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getColors,
  createColor,
  updateColor,
  deleteColor,
  getModels,
  createModel,
  updateModel,
  deleteModel,
  getConcessionaires,
  createConcessionaire,
  updateConcessionaire,
  deleteConcessionaire,
  getSedes,
  createSede,
  updateSede,
  deleteSede,
  getAccessories,
  createAccessory,
  updateAccessory,
  deleteAccessory,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CatalogItem } from "@/types";
import { Plus, Pencil, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type TabKey = "colores" | "modelos" | "concesionarios" | "sedes" | "accesorios";

interface TabConfig {
  key: TabKey;
  label: string;
  singularLabel: string;
  fetchFn: () => Promise<{ data: CatalogItem[] }>;
  createFn: (data: Partial<CatalogItem>) => Promise<unknown>;
  updateFn: (id: string, data: Partial<CatalogItem>) => Promise<unknown>;
  deleteFn: (id: string) => Promise<unknown>;
  fields: { name: string; label: string; required?: boolean }[];
  /** Fields shown only when editing (omit to use `fields`) */
  editFields?: { name: string; label: string; readonlyNote?: string }[];
  canEdit: boolean;
  canDelete: boolean;
}

// ─── Tab Configurations ──────────────────────────────────────────────────────

const TABS: TabConfig[] = [
  {
    key: "colores",
    label: "Colores",
    singularLabel: "color",
    fetchFn: getColors,
    createFn: createColor,
    updateFn: updateColor,
    deleteFn: deleteColor,
    fields: [
      { name: "name", label: "Nombre", required: true },
    ],
    canEdit: true,
    canDelete: true,
  },
  {
    key: "modelos",
    label: "Modelos",
    singularLabel: "modelo",
    fetchFn: getModels,
    createFn: createModel,
    updateFn: updateModel,
    deleteFn: deleteModel,
    fields: [
      { name: "name", label: "Nombre", required: true },
    ],
    canEdit: true,
    canDelete: true,
  },
  {
    key: "concesionarios",
    label: "Concesionarios",
    singularLabel: "concesionario",
    fetchFn: getConcessionaires,
    createFn: createConcessionaire,
    updateFn: updateConcessionaire,
    deleteFn: deleteConcessionaire,
    fields: [
      { name: "name", label: "Nombre", required: true },
    ],
    canEdit: true,
    canDelete: true,
  },
  {
    key: "sedes",
    label: "Sedes",
    singularLabel: "sede",
    fetchFn: getSedes,
    createFn: createSede,
    updateFn: updateSede,
    deleteFn: deleteSede,
    fields: [
      { name: "name", label: "Nombre", required: true },
      { name: "code", label: "C\u00f3digo (ej: SURMOTOR)", required: true },
    ],
    editFields: [
      { name: "name", label: "Nombre" },
      { name: "code", label: "C\u00f3digo", readonlyNote: "El c\u00f3digo no se puede cambiar (romper\u00eda asignaciones de usuarios)" },
    ],
    canEdit: true,
    canDelete: true,
  },
  {
    key: "accesorios",
    label: "Accesorios",
    singularLabel: "accesorio",
    fetchFn: getAccessories,
    createFn: createAccessory,
    updateFn: updateAccessory,
    deleteFn: deleteAccessory,
    fields: [
      { name: "name", label: "Nombre", required: true },
      { name: "key", label: "Clave interna (ej: ALARMA)", required: true },
    ],
    editFields: [
      { name: "name", label: "Nombre" },
      { name: "key", label: "Clave interna", readonlyNote: "La clave no se puede cambiar (romper\u00eda el historial de accesorios)" },
    ],
    canEdit: true,
    canDelete: true,
  },
];

// ─── Catalog Table (generic per tab) ────────────────────────────────────────

function CatalogTab({ config }: { config: TabConfig }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await config.fetchFn();
      setItems(res.data);
    } catch {
      toast.error(`Error al cargar ${config.label.toLowerCase()}`);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openCreate = () => {
    setEditItem(null);
    const blank: Record<string, string> = {};
    config.fields.forEach((f) => (blank[f.name] = ""));
    setFormData(blank);
    setModalOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditItem(item);
    const activeFields = config.editFields ?? config.fields;
    const prefilled: Record<string, string> = {};
    activeFields.forEach(
      (f) => (prefilled[f.name] = String((item as unknown as Record<string, unknown>)[f.name] ?? ""))
    );
    setFormData(prefilled);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const activeFields = editItem ? (config.editFields ?? config.fields) : config.fields;
    const missing = activeFields.find(
      (f) => (f as { required?: boolean }).required && !formData[f.name]?.trim()
    );
    if (missing) {
      toast.error(`El campo "${missing.label}" es obligatorio`);
      return;
    }
    setSaving(true);
    try {
      if (editItem) {
        await config.updateFn(editItem.id, formData);
        toast.success(`${config.singularLabel} actualizado`);
      } else {
        await config.createFn(formData);
        toast.success(`${config.singularLabel} creado`);
      }
      setModalOpen(false);
      fetchItems();
    } catch {
      toast.error(`Error al guardar el ${config.singularLabel}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await config.deleteFn(confirmDelete.id);
      toast.success(`${config.singularLabel} eliminado`);
      setConfirmDelete(null);
      fetchItems();
    } catch {
      toast.error(`Error al eliminar el ${config.singularLabel}`);
    } finally {
      setDeleting(false);
    }
  };

  // Get the first visible field as main label column
  const mainField = config.fields[0];
  const secondaryFields = config.fields.slice(1);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {items.length} registro{items.length !== 1 ? "s" : ""} encontrado{items.length !== 1 ? "s" : ""}
        </p>
        <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
          Agregar {config.singularLabel}
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">{mainField.label}</th>
                {secondaryFields.map((f) => (
                  <th key={f.name} className="px-4 py-3">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={config.fields.length + 1}
                    className="text-center text-gray-400 py-10"
                  >
                    No hay {config.label.toLowerCase()} registrados.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {String((item as unknown as Record<string, unknown>)[mainField.name] ?? "—")}
                    </td>
                    {secondaryFields.map((f) => (
                      <td key={f.name} className="px-4 py-3 text-gray-500">
                        {String((item as unknown as Record<string, unknown>)[f.name] ?? "—")}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {config.canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Pencil size={13} />}
                            onClick={() => openEdit(item)}
                            title="Editar"
                          />
                        )}
                        {config.canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 size={13} />}
                            onClick={() => setConfirmDelete(item)}
                            title="Eliminar"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          />
                        )}
                        {!config.canEdit && !config.canDelete && (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editItem
            ? `Editar ${config.singularLabel}`
            : `Nuevo ${config.singularLabel}`
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editItem ? "Guardar cambios" : "Crear"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {(editItem ? (config.editFields ?? config.fields) : config.fields).map((f) => {
            const isReadonly = !!(f as { readonlyNote?: string }).readonlyNote;
            return isReadonly ? (
              <div key={f.name}>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {f.label}
                </label>
                <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-400 font-mono">
                  {formData[f.name] ?? ""}
                </div>
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ {(f as { readonlyNote?: string }).readonlyNote}
                </p>
              </div>
            ) : (
              <Input
                key={f.name}
                label={f.label}
                value={formData[f.name] ?? ""}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, [f.name]: e.target.value }))
                }
                required={(f as { required?: boolean }).required}
              />
            );
          })}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={`Eliminar ${config.singularLabel}`}
        description={`¿Estás seguro de que deseas eliminar "${
          confirmDelete
            ? String((confirmDelete as unknown as Record<string, unknown>)[mainField.name] ?? "")
            : ""
        }"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleting}
      />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function CatalogsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("colores");
  const currentConfig = TABS.find((t) => t.key === activeTab)!;

  return (
    <div>
      <PageHeader
        title="Gestión de Información"
        subtitle="Administra los catálogos del sistema"
      />

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 mb-6 gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === t.key
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <CatalogTab key={activeTab} config={currentConfig} />
    </div>
  );
}
