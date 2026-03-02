"use client";

import { useEffect, useState, useCallback } from "react";
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { RoleEnum, RoleLabel } from "@/lib/constants";
import type { UserProfile } from "@/types";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import toast from "react-hot-toast";

const ROLE_OPTIONS = [
  { value: "", label: "Todos los roles" },
  ...Object.entries(RoleLabel).map(([k, v]) => ({ value: k, label: v })),
];

const ROLE_FORM_OPTIONS = Object.entries(RoleLabel).map(([k, v]) => ({
  value: k,
  label: v,
}));

interface UserForm {
  displayName: string;
  email: string;
  role: string;
  sede: string;
  active: boolean;
}

const emptyForm: UserForm = {
  displayName: "",
  email: "",
  role: RoleEnum.ASESOR,
  sede: "",
  active: true,
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getUsers(roleFilter ? { role: roleFilter } : {});
      setUsers(res.data);
    } catch {
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setForm({
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      sede: u.sede ?? "",
      active: u.active ?? true,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.displayName.trim() || !form.role) {
      toast.error("Nombre y rol son obligatorios");
      return;
    }
    if (!editUser && !form.email.trim()) {
      toast.error("El email es obligatorio para nuevos usuarios");
      return;
    }
    setSaving(true);
    try {
      if (editUser) {
        await updateUser(editUser.uid, {
          displayName: form.displayName,
          role: form.role,
          sede: form.sede || undefined,
          active: form.active,
        });
        toast.success("Usuario actualizado");
      } else {
        await createUser(form);
        toast.success("Usuario creado correctamente");
      }
      setModalOpen(false);
      fetchUsers();
    } catch {
      toast.error("Error al guardar el usuario");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteUser(confirmDelete.uid);
      toast.success("Usuario eliminado");
      setConfirmDelete(null);
      fetchUsers();
    } catch {
      toast.error("Error al eliminar el usuario");
    } finally {
      setDeleting(false);
    }
  };

  const handleResetPassword = async (u: UserProfile) => {
    const toastId = toast.loading("Enviando email de restablecimiento...");
    try {
      await resetPassword(u.uid);
      toast.success(`Email enviado a ${u.email}`, { id: toastId });
    } catch {
      toast.error("Error al restablecer contraseña", { id: toastId });
    }
  };

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Gestión de Usuarios"
        subtitle="Administra las cuentas del sistema"
        actions={
          <Button icon={<Plus size={16} />} onClick={openCreate}>
            Nuevo usuario
          </Button>
        }
      />

      <SearchFilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre o email..."
        filters={[
          {
            key: "role",
            label: "Rol",
            value: roleFilter,
            options: ROLE_OPTIONS,
            onChange: setRoleFilter,
          },
        ]}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-4">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Sede</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-10">
                    No hay usuarios con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.displayName}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {RoleLabel[u.role as keyof typeof RoleLabel] ?? u.role}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{u.sede ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.active !== false
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.active !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil size={13} />}
                          onClick={() => openEdit(u)}
                          title="Editar"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<KeyRound size={13} />}
                          onClick={() => handleResetPassword(u)}
                          title="Restablecer contraseña"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Trash2 size={13} />}
                          onClick={() => setConfirmDelete(u)}
                          title="Eliminar"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        />
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
        title={editUser ? "Editar usuario" : "Nuevo usuario"}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editUser ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre completo"
            value={form.displayName}
            onChange={(e) =>
              setForm((p) => ({ ...p, displayName: e.target.value }))
            }
            required
          />
          {!editUser && (
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              required
            />
          )}
          <Select
            label="Rol"
            value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
            options={ROLE_FORM_OPTIONS}
            required
          />
          <Input
            label="Sede (opcional)"
            value={form.sede}
            onChange={(e) => setForm((p) => ({ ...p, sede: e.target.value }))}
            placeholder="Ej: Bogotá Norte"
          />
          {editUser && (
            <div className="flex items-center gap-2">
              <input
                id="active-toggle"
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm((p) => ({ ...p, active: e.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300 accent-gray-900 cursor-pointer"
              />
              <label
                htmlFor="active-toggle"
                className="text-sm text-gray-700 cursor-pointer select-none"
              >
                Usuario activo
              </label>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Eliminar usuario"
        description={`¿Estás seguro de que deseas eliminar a "${confirmDelete?.displayName}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleting}
      />
    </div>
  );
}
