"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function VehicleFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [plate, setPlate] = useState(searchParams.get("plate") || "");
  const [owner, setOwner] = useState(searchParams.get("owner") || "");
  const [department, setDepartment] = useState(searchParams.get("department") || "Todos los Departamentos");

  // Sync state with URL when back/forward is used
  useEffect(() => {
    setPlate(searchParams.get("plate") || "");
    setOwner(searchParams.get("owner") || "");
    setDepartment(searchParams.get("department") || "Todos los Departamentos");
  }, [searchParams]);

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (plate) params.set("plate", plate.toUpperCase());
    else params.delete("plate");

    if (owner) params.set("owner", owner);
    else params.delete("owner");

    if (department !== "Todos los Departamentos") params.set("department", department);
    else params.delete("department");

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleClear = () => {
    setPlate("");
    setOwner("");
    setDepartment("Todos los Departamentos");
    router.push(pathname);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="card-padded border-b-2 border-[var(--color-primary)]">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="space-y-2">
          <label className="font-[var(--font-label)] text-[0.75rem] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider">Placa</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] text-sm opacity-50">search</span>
            <input 
              className="search-input" 
              placeholder="ej. ABC123" 
              type="text" 
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="font-[var(--font-label)] text-[0.75rem] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider">Propietario</label>
          <input 
            className="w-full bg-[var(--color-surface-container-high)] border-0 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[var(--color-primary)]/20 text-sm font-[var(--font-label)] text-[var(--color-on-surface)] outline-none transition-all" 
            placeholder="Buscar por nombre..." 
            type="text" 
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="space-y-2">
          <label className="font-[var(--font-label)] text-[0.75rem] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider">Departamento</label>
          <div className="relative">
            <select 
              className="w-full bg-[var(--color-surface-container-high)] border-0 rounded-lg py-2.5 px-4 focus:ring-2 focus:ring-[var(--color-primary)]/20 text-sm font-[var(--font-label)] text-[var(--color-on-surface)] appearance-none outline-none cursor-pointer"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option>Todos los Departamentos</option>
              <option>ESTUDIANTE</option>
              <option>ADMINISTRATIVO</option>
              <option>DOCENTE</option>
              <option>OTRO</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-on-surface-variant)] text-lg pointer-events-none opacity-50">expand_more</span>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <button 
            onClick={handleClear}
            className="btn btn-ghost flex-1 h-[42px] hover:bg-[var(--color-surface-container-low)]"
          >
            Limpiar
          </button>
          <button 
            onClick={handleSearch}
            className="btn btn-primary flex-1 h-[42px] shadow-lg shadow-[var(--color-primary)]/20"
          >
            <span className="material-symbols-outlined text-sm">filter_alt</span>
            Buscar
          </button>
        </div>
      </div>
    </div>
  );
}
