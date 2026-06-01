"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface AnalyticsFiltersProps {
  currentPeriod: string;
  currentUserType: string;
  currentDays?: string;
  currentDateFrom?: string;
  currentDateTo?: string;
}

export default function AnalyticsFilters({
  currentPeriod,
  currentUserType,
  currentDays,
  currentDateFrom,
  currentDateTo,
}: AnalyticsFiltersProps) {
  const router = useRouter();
  const [showDaysMenu, setShowDaysMenu] = useState(false);
  const [showDateRange, setShowDateRange] = useState(currentPeriod === "fecha");
  const [localFrom, setLocalFrom] = useState(currentDateFrom ?? "");
  const [localTo, setLocalTo] = useState(currentDateTo ?? "");

  const today = new Date().toISOString().split("T")[0];

  const handlePeriodChange = (period: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("period", period);
    params.delete("days");
    params.delete("dateFrom");
    params.delete("dateTo");
    setShowDaysMenu(false);
    setShowDateRange(false);
    setLocalFrom("");
    setLocalTo("");
    router.push(`/analytics?${params.toString()}`);
  };

  const handleDaysChange = (days: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("period", "dias");
    params.set("days", days);
    params.delete("dateFrom");
    params.delete("dateTo");
    setShowDaysMenu(false);
    router.push(`/analytics?${params.toString()}`);
  };

  const handleApplyRange = () => {
    if (!localFrom) return;
    const params = new URLSearchParams(window.location.search);
    params.set("period", "fecha");
    params.set("dateFrom", localFrom);
    if (localTo) {
      params.set("dateTo", localTo);
    } else {
      params.delete("dateTo");
    }
    params.delete("days");
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

  const handlePrint = () => window.print();

  const isDias = currentPeriod === "dias";
  const isFecha = currentPeriod === "fecha";

  // Label compacto del rango activo
  const formatShort = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };
  const rangeLabel =
    isFecha && currentDateFrom
      ? currentDateTo && currentDateTo !== currentDateFrom
        ? `${formatShort(currentDateFrom)} – ${formatShort(currentDateTo)}`
        : formatShort(currentDateFrom)
      : "Rango";

  return (
    <div className="flex flex-wrap items-center gap-3 mt-4 xl:mt-0 w-full xl:w-auto">

      {/* Period Selector */}
      <div className="flex bg-[var(--color-surface-container)] rounded-lg p-1 w-full sm:w-auto">
        {[
          { key: "hoy", label: "Hoy" },
          { key: "semana", label: "Semana" },
          { key: "mes", label: "Mes" },
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

        {/* Días button with submenu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDaysMenu((v) => !v);
              setShowDateRange(false);
            }}
            className={`flex items-center gap-1 px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              isDias
                ? "bg-[var(--color-surface-container-lowest)] shadow-sm text-[var(--color-primary)]"
                : "text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            }`}
          >
            {isDias ? `${currentDays ?? "7"}d` : "Días"}
            <span className="material-symbols-outlined text-[10px]">expand_more</span>
          </button>
          {showDaysMenu && (
            <div className="absolute top-full left-0 mt-1 z-50 flex flex-col bg-[var(--color-surface-container-lowest)] border border-[var(--color-outline-variant)]/30 rounded-xl shadow-xl overflow-hidden min-w-[110px]">
              {["7", "15", "30"].map((d) => (
                <button
                  key={d}
                  onClick={() => handleDaysChange(d)}
                  className={`px-4 py-2 text-xs font-bold text-left hover:bg-[var(--color-primary)]/10 transition-colors ${
                    isDias && currentDays === d
                      ? "text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                      : "text-[var(--color-on-surface)]"
                  }`}
                >
                  Últimos {d} días
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rango de fechas button */}
        <button
          onClick={() => {
            setShowDateRange((v) => !v);
            setShowDaysMenu(false);
          }}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
            isFecha
              ? "bg-[var(--color-surface-container-lowest)] shadow-sm text-[var(--color-primary)]"
              : "text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">date_range</span>
          <span className="max-w-[120px] truncate">{rangeLabel}</span>
        </button>
      </div>

      {/* Inline Date Range Picker */}
      {showDateRange && (
        <div className="flex flex-wrap items-center gap-2 bg-[var(--color-surface-container)] rounded-xl px-4 py-2.5 border border-[var(--color-primary)]/30 shadow-lg">
          <span className="material-symbols-outlined text-[var(--color-primary)] text-sm">event</span>

          {/* Desde */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Desde</span>
            <input
              type="date"
              value={localFrom}
              max={localTo || today}
              onChange={(e) => setLocalFrom(e.target.value)}
              className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-lg text-xs font-bold text-[var(--color-on-surface)] outline-none cursor-pointer px-2 py-1 [color-scheme:dark]"
            />
          </div>

          <span className="text-[var(--color-on-surface-variant)] text-sm font-bold mt-3">→</span>

          {/* Hasta */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-black uppercase tracking-widest text-[var(--color-on-surface-variant)]">Hasta</span>
            <input
              type="date"
              value={localTo}
              min={localFrom || undefined}
              max={today}
              onChange={(e) => setLocalTo(e.target.value)}
              className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-lg text-xs font-bold text-[var(--color-on-surface)] outline-none cursor-pointer px-2 py-1 [color-scheme:dark]"
            />
          </div>

          {/* Aplicar */}
          <button
            onClick={handleApplyRange}
            disabled={!localFrom}
            className="mt-3 px-3 py-1.5 bg-[var(--color-primary)] text-white text-xs font-black rounded-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Aplicar
          </button>

          {/* Limpiar */}
          {isFecha && (
            <button
              onClick={() => {
                setLocalFrom("");
                setLocalTo("");
                handlePeriodChange("hoy");
              }}
              className="mt-3 text-[var(--color-on-surface-variant)] hover:text-[var(--color-error)] transition-colors"
              title="Limpiar rango"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      )}

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
