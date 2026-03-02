"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Mostrar aviso si la sesión expiró
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      toast.error("Tu sesión ha expirado. Inicia sesión nuevamente.", { duration: 5000 });
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [authLoading, user, router]);

  if (authLoading || (!authLoading && user)) return null;

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = "El correo es requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = "Correo inválido";
    if (!password) e.password = "La contraseña es requerida";
    else if (password.length < 6) e.password = "Mínimo 6 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success("Bienvenido al sistema");
      // La redirección la maneja el useEffect cuando user se actualiza
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        setErrors({ password: "Credenciales incorrectas" });
      } else if (status === 429) {
        toast.error("Demasiados intentos. Intenta más tarde.");
      } else {
        toast.error("Error al iniciar sesión. Verifica tu conexión.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gray-900 px-8 py-8 flex flex-col items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <span className="text-gray-900 text-lg font-black">K</span>
            </div>
            <div className="text-center">
              <h1 className="text-white font-bold text-xl tracking-tight">
                KIA Dealer
              </h1>
              <p className="text-gray-400 text-xs mt-0.5">
                Sistema de gestión de entregas
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <h2 className="text-base font-semibold text-gray-900 mb-6">
              Iniciar sesión
            </h2>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="usuario@kia.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((p) => ({ ...p, email: undefined }));
                }}
                error={errors.email}
                leftIcon={<Mail size={14} />}
                autoComplete="email"
                autoFocus
                required
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Contraseña <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock size={14} />
                  </div>
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((p) => ({ ...p, password: undefined }));
                    }}
                    autoComplete="current-password"
                    className={`w-full border rounded-md pl-9 pr-10 py-2 text-sm text-gray-900 bg-white transition-colors
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                      ${errors.password ? "border-red-400 bg-red-50" : "border-gray-300 hover:border-gray-400"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-600">{errors.password}</p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loading}
                className="mt-2"
              >
                Ingresar
              </Button>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          ¿No tienes acceso? Contacta al Jefe de Taller.
        </p>
      </div>
    </div>
  );
}
