"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Redirection logic is handled by middleware but we force it here for UX
        router.push("/");
        router.refresh();
      } else {
        setError(data.error || "Error al iniciar sesión");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)] relative overflow-hidden">
      {/* Abstract Background Shapes */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[var(--color-primary-fixed)] rounded-full blur-[120px] opacity-30 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-[var(--color-tertiary-fixed)] rounded-full blur-[120px] opacity-20" />

      <div className="w-full max-w-md p-8 z-10">
        <div className="card shadow-2xl border-white/20 backdrop-blur-xl bg-white/70 overflow-hidden transform transition-all duration-500 hover:scale-[1.01]">
          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-tertiary)]" />
          
          <div className="p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-[var(--color-primary)] rounded-2xl flex items-center justify-center shadow-lg mb-4">
                <span className="material-symbols-outlined text-white text-3xl">local_parking</span>
              </div>
              <h1 className="text-3xl font-black text-[var(--color-on-surface)] tracking-tight">UFPS PARKING</h1>
              <p className="text-[var(--color-on-surface-variant)] text-sm font-medium mt-1">Portal de Acceso Administrativo</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-[var(--color-error)] rounded-r-lg flex items-center gap-3 animate-[shake_0.5s_ease-in-out]">
                <span className="material-symbols-outlined text-[var(--color-error)] text-xl">error</span>
                <p className="text-[var(--color-error)] text-xs font-bold uppercase tracking-wider">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[var(--color-on-surface-variant)] uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">person</span>
                  Usuario
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
                    placeholder="Ingrese su nickname"
                  />
                  <div className="absolute bottom-0 left-0 h-0.5 bg-[var(--color-primary)] w-0 group-focus-within:w-full transition-all duration-300" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-[var(--color-on-surface-variant)] uppercase tracking-widest flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Contraseña
                </label>
                <div className="relative group">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-xl px-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all"
                    placeholder="••••••••"
                  />
                  <div className="absolute bottom-0 left-0 h-0.5 bg-[var(--color-primary)] w-0 group-focus-within:w-full transition-all duration-300" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-[var(--color-outline-variant)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]/20" />
                  <span className="text-xs font-semibold text-[var(--color-on-surface-variant)] group-hover:text-[var(--color-on-surface)] transition-colors">Recordarme</span>
                </label>
                <a href="#" className="text-xs font-bold text-[var(--color-primary)] hover:underline">¿Olvidó su contraseña?</a>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-container)] text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-[0_8px_30px_rgb(0,91,191,0.3)] hover:shadow-[0_8px_40px_rgb(0,91,191,0.4)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-10"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Iniciar Sesión</span>
                    <span className="material-symbols-outlined">login</span>
                  </>
                )}
              </button>
            </form>
          </div>
          
          <div className="bg-[var(--color-surface-container-low)] p-6 border-t border-[var(--color-outline-variant)]/20 text-center">
            <p className="text-[10px] text-[var(--color-on-surface-variant)] font-bold uppercase tracking-widest">
              © {new Date().getFullYear()} Universidad Francisco de Paula Santander
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}
