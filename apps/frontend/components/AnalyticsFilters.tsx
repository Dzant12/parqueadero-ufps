"use client";

import { useRouter } from "next/navigation";

interface AnalyticsFiltersProps {
  currentPeriod: string;
  currentUserType: string;
}

export default function AnalyticsFilters({ currentPeriod, currentUserType }: AnalyticsFiltersProps) {
  const router = useRouter();
  
  const handlePeriodChange = (period: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("period", period);
    router.push(`/analytics?${params.toString()}`);
  };

  const handleUserTypeChange = (userType: string) => {
    const params = new URLSearchParams(window.location.search);
    if (userType === "all") {
      params.delete("userType");
    } else {
      params.set("userType", userType);
    }
    router.push(`/analytics?${params.toString()}`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mt-4 xl:mt-0 w-full xl:w-auto">
      {/* Period Selector */}
      <div className="flex bg-[var(--color-surface-container)] rounded-lg p-1 w-full sm:w-auto">
        {[
          { key: "hoy", label: "Hoy" },
          { key: "semana", label: "Semana" },
          { key: "mes", label: "Mes" }
        ].map((item) => {
          const isActive = currentPeriod === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handlePeriodChange(item.key)}
              className={`flex-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                isActive
                  ? "bg-[var(--color-surface-container-lowest)] shadow-sm text-[var(--color-primary)]"
                  : "text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* User Type Selector */}
      <select
        value={currentUserType}
        onChange={(e) => handleUserTypeChange(e.target.value)}
        className="bg-[var(--color-surface-container-low)] border-none rounded-lg text-xs font-bold py-2 pr-8 pl-4 text-[var(--color-on-surface)] focus:ring-[var(--color-primary)]/20 w-full sm:w-auto cursor-pointer"
      >
        <option value="all">Todos los Tipos de Usuario</option>
        <option value="Estudiante">Estudiante</option>
        <option value="Facultad">Facultad (Docentes)</option>
        <option value="Personal">Personal (Administrativos)</option>
        <option value="Visitante">Visitante</option>
        <option value="Desconocido">Desconocido</option>
      </select>

      {/* Generate Report Button */}
      <button
        onClick={handlePrint}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-on-surface)] text-[var(--color-surface)] rounded-lg font-bold text-xs hover:opacity-90 transition-all w-full sm:w-auto cursor-pointer"
      >
        <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
        Generar Reporte PDF
      </button>
    </div>
  );
}
