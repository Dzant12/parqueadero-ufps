export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registro de Vehículos - Campus ParkGuard",
  description: "Gestionar permisos de campus y logs de acceso de vehículos",
};

import prisma from "@parqueadero/database";
import { Prisma } from "@/generated/prisma/client/index.js";
import VehicleRowActions from "./VehicleRowActions";
import VehicleFilters from "./VehicleFilters";

interface PageProps {
  searchParams: Promise<{
    plate?: string;
    owner?: string;
    department?: string;
  }>;
}

export default async function VehiclesPage({ searchParams }: PageProps) {
  const query = await searchParams;
  
  const where: Prisma.VehicleWhereInput = {};
  
  if (query.plate) {
    where.plate = { contains: query.plate, mode: 'insensitive' };
  }
  
  if (query.owner) {
    where.owner = {
      OR: [
        { firstname: { contains: query.owner, mode: 'insensitive' } },
        { surname: { contains: query.owner, mode: 'insensitive' } },
      ]
    };
  }
  
  if (query.department) {
    where.department = query.department;
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    include: {
      owner: true,
    },
    orderBy: {
      registeredAt: "desc",
    },
  });

  const getStatusCls = (status: string) => {
    switch (status) {
      case "Permiso Activo":
        return "badge-success";
      case "Renovación Pendiente":
        return "badge-warning";
      case "Suspendido":
        return "badge-error";
      default:
        return "badge-neutral";
    }
  };

  const getVehicleIcon = (plate: string) => {
    // Motorcycle format: 3 letters + 2 digits + 1 letter (e.g., MGO18G)
    const isMotorcycle = /^[A-Z]{3}[0-9]{2}[A-Z]$/.test(plate.toUpperCase().trim());
    return isMotorcycle ? "two_wheeler" : "directions_car";
  };

  return (
    <div className="page-wrapper space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-0">
        <div>
          <h2 className="page-title">Registro de Vehículos</h2>
          <p className="page-subtitle">Gestionar permisos del campus y logs de acceso de vehículos</p>
        </div>
      </div>


      {/* Search & Filter Bar */}
      <VehicleFilters />

      {/* Data Table */}
      <div className="table-wrapper">
        <table className="table-base">
          <thead className="table-thead">
            <tr>
              <th>Detalles del Vehículo</th>
              <th>ID de Placa</th>
              <th>Propietario / Departamento</th>
              <th>Estado del Permiso</th>
              <th>Fecha de Registro</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v: { id: number; plate: string; rfidTag: string | null; brand: string | null; model: string; color: string; status: string; registeredAt: Date; icon: string; department: string; owner: { firstname: string, surname: string } | null }) => (
              <tr key={v.plate} className="table-row">
                <td className="table-cell">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 bg-[var(--color-surface-container-low)] rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">{getVehicleIcon(v.plate)}</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[var(--color-on-surface)]">{v.brand || v.model}</p>
                      <p className="font-[var(--font-label)] text-[0.75rem] text-[var(--color-on-surface-variant)]">{v.brand ? v.model : v.color}</p>
                    </div>
                  </div>
                </td>
                <td className="table-cell">
                  <div className="flex flex-col gap-1">
                    <span className="bg-[var(--color-on-surface)] text-[var(--color-surface)] px-3 py-1 rounded font-mono text-xs font-bold tracking-widest w-fit">{v.plate}</span>
                    {v.rfidTag && (
                      <div className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] font-bold">
                        <span className="material-symbols-outlined text-[12px]">nfc</span>
                        {v.rfidTag}
                      </div>
                    )}
                  </div>
                </td>
                <td className="table-cell">
                  <p className="text-sm font-semibold text-[var(--color-on-surface)]">
                    {v.owner ? `${v.owner.firstname} ${v.owner.surname}` : "Propietario Genérico"}
                  </p>
                  <p className="font-[var(--font-label)] text-[0.75rem] text-[var(--color-primary)]">{v.department}</p>
                </td>
                <td className="table-cell">
                  <span className={`badge ${getStatusCls(v.status)}`}>{v.status}</span>
                </td>
                <td className="table-cell">
                  <span className="font-[var(--font-label)] text-sm text-[var(--color-on-surface-variant)]">{new Date(v.registeredAt).toLocaleDateString()}</span>
                </td>
                <td className="table-cell text-right">
                  <VehicleRowActions vehicle={v} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="table-footer">
          <p className="table-footer-text">
            Mostrando <span className="font-bold text-[var(--color-on-surface)]">1 a {vehicles.length}</span> de{" "}
            <span className="font-bold text-[var(--color-on-surface)]">{vehicles.length}</span> entradas
          </p>
          <div className="flex items-center gap-1">
            <button className="pagination-btn" disabled>
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <button className="pagination-btn active">1</button>
            <button className="pagination-btn" disabled>
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* System Usage Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: "directions_car", bg: "bg-[var(--color-primary)]/10", iconColor: "text-[var(--color-primary)]", value: vehicles.length.toString(), label: "Total Registrados", sub: "Activos en el sistema" },
          { icon: "verified", bg: "bg-[var(--color-primary-container)]/20", iconColor: "text-[var(--color-primary)]", value: vehicles.filter((v: { status: string }) => v.status === "Permiso Activo").length.toString(), label: "Permisos Activos", sub: "Válidos y vigentes" },
          { icon: "pending_actions", bg: "bg-[var(--color-tertiary-container)]/20", iconColor: "text-[var(--color-tertiary)]", value: vehicles.filter((v: { status: string }) => v.status !== "Permiso Activo").length.toString(), label: "Pendientes / Expirados", sub: "Requieren atención" },
        ].map((card) => (
          <div key={card.label} className="card-padded flex items-center gap-6">
            <div className={`w-14 h-14 ${card.bg} rounded-full flex items-center justify-center ${card.iconColor}`}>
              <span className="material-symbols-outlined">{card.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-black text-[var(--color-on-surface)]">{card.value}</p>
              <p className="font-bold text-sm text-[var(--color-on-surface)]">{card.label}</p>
              <p className="font-[var(--font-label)] text-[0.7rem] text-[var(--color-on-surface-variant)] mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
