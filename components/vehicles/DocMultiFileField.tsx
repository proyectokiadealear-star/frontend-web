"use client";

import { useEffect, useState } from "react";
import { updateDocumentation, deleteDocumentFile } from "@/lib/api";
import {
  Upload,
  FileText,
  Eye,
  EyeOff,
  Save,
  X,
  CheckCircle,
  Plus,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

/**
 * DocMultiFileField
 *
 * Muestra múltiples documentos PDF guardados para un campo (giftEmail / accessoryInvoice).
 * Permite ver cada PDF en un iframe, agregar nuevos PDFs (hasta `max`) y eliminar existentes.
 */
interface DocMultiFileFieldProps {
  label: string;
  fieldName: "giftEmail" | "accessoryInvoice";
  vehicleId: string;
  existingUrls: string[];
  max: number;
  onSaved?: () => void;
}

export function DocMultiFileField({
  label,
  fieldName,
  vehicleId,
  existingUrls,
  max,
  onSaved,
}: DocMultiFileFieldProps) {
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [blobUrls, setBlobUrls] = useState<string[]>([]);
  const [previewIdx, setPreviewIdx] = useState<string | null>(null); // "existing-0", "new-1", etc.
  const [saving, setSaving] = useState(false);
  const [removingIdx, setRemovingIdx] = useState<number | null>(null);
  const [inputKey, setInputKey] = useState(0);

  const totalCount = existingUrls.length + newFiles.length;
  const canAdd = totalCount < max;

  // Generate/revoke blob URLs for new files
  useEffect(() => {
    const urls = newFiles.map((f) => URL.createObjectURL(f));
    setBlobUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [newFiles]);

  const handleAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (totalCount >= max) {
      toast.error(`Máximo ${max} archivos permitidos`);
      return;
    }
    setNewFiles((prev) => [...prev, selected]);
    setInputKey((k) => k + 1);
  };

  const handleRemoveNew = (idx: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
    setPreviewIdx(null);
  };

  const handleRemoveExisting = async (index: number) => {
    setRemovingIdx(index);
    try {
      await deleteDocumentFile(vehicleId, fieldName, index);
      toast.success("Archivo eliminado");
      setPreviewIdx(null);
      onSaved?.();
    } catch {
      toast.error("Error al eliminar el archivo");
    } finally {
      setRemovingIdx(null);
    }
  };

  const handleSaveAll = async () => {
    if (newFiles.length === 0) return;
    setSaving(true);
    try {
      const fd = new FormData();
      newFiles.forEach((f) => fd.append(fieldName, f));
      await updateDocumentation(vehicleId, fd);
      toast.success("Documentos guardados");
      setNewFiles([]);
      setPreviewIdx(null);
      onSaved?.();
    } catch {
      toast.error("Error al guardar los documentos");
    } finally {
      setSaving(false);
    }
  };

  const getPreviewSrc = () => {
    if (!previewIdx) return null;
    const [type, idxStr] = previewIdx.split("-");
    const idx = parseInt(idxStr, 10);
    if (type === "existing") return existingUrls[idx] ?? null;
    if (type === "new") return blobUrls[idx] ?? null;
    return null;
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>

      {/* Existing files */}
      {existingUrls.map((url, idx) => {
        const key = `existing-${idx}`;
        const isOpen = previewIdx === key;
        return (
          <div key={key} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <CheckCircle size={13} className="text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-700 truncate">
                  Documento {idx + 1}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewIdx(isOpen ? null : key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors cursor-pointer"
                >
                  {isOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                  {isOpen ? "Ocultar" : "Ver"}
                </button>
                <button
                  type="button"
                  disabled={removingIdx === idx}
                  onClick={() => handleRemoveExisting(idx)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  title="Eliminar archivo"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="border-t border-gray-200">
                <iframe
                  src={url}
                  title={`${label} ${idx + 1}`}
                  className="w-full"
                  style={{ height: "560px" }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* New files (not saved yet) */}
      {newFiles.map((file, idx) => {
        const key = `new-${idx}`;
        const isOpen = previewIdx === key;
        return (
          <div key={key} className="border border-amber-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-amber-600 font-medium">Sin guardar</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewIdx(isOpen ? null : key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-white transition-colors cursor-pointer"
                >
                  {isOpen ? <EyeOff size={12} /> : <Eye size={12} />}
                  {isOpen ? "Ocultar" : "Ver"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveNew(idx)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Quitar archivo"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            {isOpen && blobUrls[idx] && (
              <div className="border-t border-amber-200">
                <iframe
                  src={blobUrls[idx]}
                  title={`${label} nuevo ${idx + 1}`}
                  className="w-full"
                  style={{ height: "560px" }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Add button */}
      {canAdd && (
        <div>
          <label
            htmlFor={`docmulti-${fieldName}`}
            className="inline-flex items-center gap-2 border border-dashed border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400 cursor-pointer transition-colors w-full justify-center"
          >
            {totalCount === 0 ? <Upload size={15} /> : <Plus size={15} />}
            {totalCount === 0 ? "Seleccionar PDF" : "Agregar otro PDF"}
          </label>
          <input
            key={inputKey}
            id={`docmulti-${fieldName}`}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleAdd}
          />
        </div>
      )}

      {/* Save button for new files */}
      {newFiles.length > 0 && (
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          <Save size={14} />
          {saving ? "Guardando…" : `Guardar ${newFiles.length} archivo${newFiles.length > 1 ? "s" : ""}`}
        </button>
      )}

      {/* Counter */}
      {totalCount > 0 && (
        <p className="text-xs text-gray-400">
          {totalCount} de {max} archivos
        </p>
      )}
    </div>
  );
}
