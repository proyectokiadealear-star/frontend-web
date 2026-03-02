"use client";

import { useEffect, useState } from "react";
import { updateDocumentation } from "@/lib/api";
import {
  Upload,
  FileText,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  CheckCircle,
  Save,
} from "lucide-react";
import toast from "react-hot-toast";

/**
 * DocFileField
 *
 * Muestra un documento PDF guardado en el sistema.
 * Permite ver el PDF en un iframe inline y reemplazarlo subiendo un archivo nuevo.
 *
 * Props:
 *  - label        Etiqueta visible del campo
 *  - fieldName    Nombre del campo multipart que acepta el backend
 *                 ("vehicleInvoice" | "giftEmail" | "accessoryInvoice")
 *  - vehicleId    ID del vehículo para la llamada PATCH
 *  - existingUrl  URL del documento actualmente guardado (puede ser null)
 *  - onSaved      Callback opcional que se ejecuta tras guardar con éxito
 */
interface DocFileFieldProps {
  label: string;
  fieldName: "vehicleInvoice" | "giftEmail" | "accessoryInvoice";
  vehicleId: string;
  existingUrl?: string | null;
  onSaved?: () => void;
}

export function DocFileField({
  label,
  fieldName,
  vehicleId,
  existingUrl,
  onSaved,
}: DocFileFieldProps) {
  const [file, setFile] = useState<File | undefined>(undefined);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  // Genera/revoca blob URL cuando cambia el archivo local
  useEffect(() => {
    if (!file) {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewSrc = file ? blobUrl : existingUrl ?? null;
  const hasDocument = !!(existingUrl?.trim()) || !!file;

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append(fieldName, file);
      await updateDocumentation(vehicleId, fd);
      toast.success("Documento actualizado");
      setFile(undefined);
      setPreviewOpen(false);
      setInputKey((k) => k + 1);
      onSaved?.();
    } catch {
      toast.error("Error al guardar el documento");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveNewFile = () => {
    setFile(undefined);
    setPreviewOpen(false);
    setInputKey((k) => k + 1);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Label */}
      <span className="text-sm font-medium text-gray-700">{label}</span>

      {hasDocument ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Header de la tarjeta */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
            {/* Icono + nombre */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {file ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                    <FileText size={14} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-amber-600 font-medium">
                      Nuevo archivo — sin guardar
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <CheckCircle size={14} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      Documento cargado
                    </p>
                    <p className="text-xs text-green-600 font-medium">
                      Guardado en el sistema
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Ver / Ocultar */}
              <button
                type="button"
                onClick={() => setPreviewOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors cursor-pointer"
              >
                {previewOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                {previewOpen ? "Ocultar" : "Ver documento"}
              </button>

              {/* Reemplazar */}
              <label
                htmlFor={`docfile-${fieldName}`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors cursor-pointer"
              >
                <RefreshCw size={12} />
                Reemplazar
              </label>
              <input
                key={inputKey}
                id={`docfile-${fieldName}`}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  setPreviewOpen(false);
                  setFile(e.target.files?.[0]);
                }}
              />

              {/* Guardar nuevo archivo */}
              {file && (
                <>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <Save size={12} />
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveNewFile}
                    disabled={saving}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Descartar nuevo archivo"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Preview iframe inline */}
          {previewOpen && previewSrc && (
            <div className="border-t border-gray-200">
              <iframe
                src={previewSrc}
                title={label}
                className="w-full"
                style={{ height: "560px" }}
              />
            </div>
          )}
        </div>
      ) : (
        /* Sin documento: zona de carga */
        <div>
          <label
            htmlFor={`docfile-${fieldName}`}
            className="inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-colors w-full justify-center"
          >
            <Upload size={15} />
            Seleccionar PDF
          </label>
          <input
            key={inputKey}
            id={`docfile-${fieldName}`}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0])}
          />
        </div>
      )}
    </div>
  );
}
