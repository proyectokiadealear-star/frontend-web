"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";
import DataRain from "@/components/ui/DataRain";

export default function LoginPage() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      toast.error("Tu sesión ha expirado. Inicia sesión nuevamente.", { duration: 5000 });
    }
  }, []);

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
    <div className="min-h-screen flex">
      {/* ── Left: Login form ── */}
      <div className="flex flex-1 items-center justify-center bg-white px-8 py-12 lg:px-16">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: "linear-gradient(135deg,#1a1a1a 0%,#000000 100%)" }}
            >
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 2.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15zm-1 3v5.25l4.5 2.625-.75 1.3L9 13.5V7.5h2z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-widest text-gray-400 uppercase">
              KIASURMOTOR
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Correo electrónico
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail size={15} />
                </span>
                <input
                  type="email"
                  placeholder="usuario@kiasurmotor.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((p) => ({ ...p, email: undefined }));
                  }}
                  autoComplete="email"
                  autoFocus
                  className={`w-full border rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-900 bg-white transition-colors
                    focus:outline-none focus:ring-2 focus:border-transparent
                    ${errors.email
                      ? "border-red-400 bg-red-50 focus:ring-red-300"
                      : "border-gray-300 hover:border-gray-400 focus:ring-gray-400/30 focus:border-gray-900"
                    }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock size={15} />
                </span>
                <input
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((p) => ({ ...p, password: undefined }));
                  }}
                  autoComplete="current-password"
                  className={`w-full border rounded-lg pl-10 pr-10 py-2.5 text-sm text-gray-900 bg-white transition-colors
                    focus:outline-none focus:ring-2 focus:border-transparent
                    ${errors.password
                      ? "border-red-400 bg-red-50 focus:ring-red-300"
                      : "border-gray-300 hover:border-gray-400 focus:ring-gray-400/30 focus:border-gray-900"
                    }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all
                disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] mt-1"
              style={{
                background: loading
                  ? "#6b7280"
                  : "linear-gradient(135deg,#1a1a1a 0%,#000000 100%)",
                boxShadow: loading ? "none" : "0 4px 14px 0 rgba(0,0,0,0.35)",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                "Iniciar sesión"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-8">
            ¿Sin acceso? Contacta al Jefe de Taller.
          </p>
        </div>
      </div>

      {/* ── Right: Brand panel ── */}
      <div
        className="hidden lg:flex flex-1 flex-col items-center justify-center relative overflow-hidden"
        style={{ background: "#050505" }}
      >
        {/* Wheel canvas */}
        <DataRain className="absolute inset-0 w-full h-full" />

        {/* Centered dark blur backdrop — makes content readable over wheel */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 85% at 50% 50%, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 65%, transparent 100%)",
          }}
        />

        {/* Keyframes */}
        <style>{`
          @keyframes slideIn {
            from { opacity:0; transform:translateY(20px); }
            to   { opacity:1; transform:translateY(0); }
          }
          .si { animation: slideIn 0.7s cubic-bezier(.22,1,.36,1) both; }
        `}</style>

        {/* ── Central content ── */}
        <div className="relative z-10 flex flex-col items-center px-10 gap-8 w-full max-w-lg">

          {/* Eyebrow */}
          <p className="si text-white/50 text-[11px] font-semibold tracking-[0.4em] uppercase" style={{ animationDelay: "0s" }}>
            Bienvenido a
          </p>

          {/* Brand hero */}
          <div className="si text-center -mt-4" style={{ animationDelay: "0.08s" }}>
            <h1
              className="font-black uppercase leading-none tracking-tighter text-white"
              style={{ fontSize: "clamp(3.2rem, 6vw, 5rem)", textShadow: "0 2px 40px rgba(0,0,0,0.9)" }}
            >
              KIASURMOTO<span className="text-white/60">R</span>
            </h1>
            <p className="text-white/60 text-base mt-3 font-medium tracking-wide">
              Plataforma de gestión de entregas vehiculares
            </p>
          </div>

          {/* Divider */}
          <div className="si w-16 h-0.5 rounded-full bg-white/20" style={{ animationDelay: "0.16s" }} />

          {/* Feature cards */}
          <div className="si flex flex-col gap-3 w-full" style={{ animationDelay: "0.22s" }}>
            {[
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zm-9 5H5V9h6v3zm8 0h-6V9h6v3z"/>
                  </svg>
                ),
                title: "Control de Stock",
                desc: "Inventario en tiempo real por sede y concesionario",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM9 13h6v1H9v-1zm0 3h6v1H9v-1zm0-6h3v1H9v-1z"/>
                  </svg>
                ),
                title: "Documentación",
                desc: "Valida y centraliza los documentos de cada entrega",
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                    <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 14.93V15a1 1 0 00-2 0v1.93A8.001 8.001 0 014.07 13H6a1 1 0 000-2H4.07A8.001 8.001 0 0111 4.07V6a1 1 0 002 0V4.07A8.001 8.001 0 0119.93 11H18a1 1 0 000 2h1.93A8.001 8.001 0 0113 16.93zM12 13a1 1 0 110-2 1 1 0 010 2z"/>
                  </svg>
                ),
                title: "Trazabilidad",
                desc: "Seguimiento completo del ciclo de vida del vehículo",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-4 rounded-2xl px-5 py-4"
                style={{
                  background: "rgba(255,255,255,0.09)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.22)" }}
                >
                  {f.icon}
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{f.title}</p>
                  <p className="text-white/55 text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="si text-white/25 text-[10px] tracking-[0.3em] uppercase" style={{ animationDelay: "0.38s" }}>
            KIA · Sur Motor · Colombia
          </p>

        </div>
      </div>
    </div>
  );
}
