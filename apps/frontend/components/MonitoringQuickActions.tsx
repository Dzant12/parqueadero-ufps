"use client";

import { useState } from "react";

export default function MonitoringQuickActions() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (label: string) => {
    setLoading(label);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const normalizedBackendUrl = backendUrl.replace(/\/$/, "");

      // Primero obtenemos la zona actual
      const configRes = await fetch(`${normalizedBackendUrl}/api/rfid/config`);
      const configData = await configRes.json();
      const zonaActual = configData.globalActiveZone ?? "Desconocida";

      // Luego hacemos el toggle
      const res = await fetch(`${normalizedBackendUrl}/api/rfid/toggle-zone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      const zonaNueva = data.newZone;
      alert(
        `📡 Zona cambiada\n\n` +
        `Antes: ${zonaActual}\n` +
        `Ahora: ${zonaNueva}\n\n` +
        `El ESP32 sincronizará la nueva zona en los próximos 10 segundos.`
      );
    } catch {
      alert("❌ Error al comunicar con el servidor. Verifica que el backend esté activo.");
    }
    setLoading(null);
  };

  const actions = [
    { icon: "settings_input_antenna", label: "Configurar Lector Único", color: "text-[var(--color-primary)]", bg: "hover:bg-[var(--color-primary-container)]/10" },
  ];

  return (
    <div className="grid grid-cols-1 gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          disabled={loading !== null}
          onClick={() => handleAction(action.label)}
          className={`flex items-center justify-center gap-3 w-full py-3 bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/20 ${action.bg} transition-all text-[var(--color-on-surface)] font-bold text-sm rounded-lg active:scale-95 disabled:opacity-50`}
        >
          {loading === action.label ? (
            <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className={`material-symbols-outlined ${action.color}`}>{action.icon}</span>
          )}
          {action.label}
        </button>
      ))}
    </div>
  );
}
