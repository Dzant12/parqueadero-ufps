"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SeedButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSeed = async () => {
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const response = await fetch(`${backendUrl}/api/seed`);
      const data = await response.json();
      if (data.success) {
        router.refresh();
      } else {
        alert("Ocurrió un error al generar los datos.");
      }
    } catch (error) {
      console.error("Seeding failed", error);
      alert("Error de conexión al servidor backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSeed}
      disabled={loading}
      className="mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-xl font-bold text-sm hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--color-primary)]/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <span className="material-symbols-outlined animate-spin text-lg">sync</span>
          Generando Datos...
        </>
      ) : (
        <>
          <span className="material-symbols-outlined text-lg">database</span>
          Sembrar Datos de Tránsito (30 Días)
        </>
      )}
    </button>
  );
}
