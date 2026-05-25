export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campus ParkGuard - Centro de Monitoreo",
  description: "Monitoreo de seguridad en tiempo real para las zonas de estacionamiento del campus",
};

import prisma from "@parqueadero/database";
import PlateVerification from "@/components/PlateVerification";
import RfidMonitor from "@/components/RfidMonitor";
import GateConsole from "@/components/GateConsole";
import Link from "next/link";
import TableExportButton from "@/components/TableExportButton";
import MonitoringQuickActions from "@/components/MonitoringQuickActions";
import FormattedTime from "@/components/FormattedTime";

interface Props {
  searchParams: Promise<{
    tab?: string;
  }>;
}

export default async function MonitoringPage({ searchParams }: Props) {
  const { tab = "entrada" } = await searchParams;
  const isExit = tab === "salida";
  const activeZone = isExit ? "Salida Principal" : "Entrada Principal";

  // Calculate start of today in Colombia timezone (UTC-5)
  const bogotaDateString = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  const todayStart = new Date(`${bogotaDateString}T00:00:00.000-05:00`);

  // Fetch real statistics for today in this zone
  const [recentActivity, totalToday, totalRejected] = await Promise.all([
    prisma.accessLog.findMany({
      where: {
        zone: {
          contains: isExit ? "Salida" : "Entrada",
          mode: "insensitive",
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 10,
    }),
    prisma.accessLog.count({
      where: {
        zone: { contains: isExit ? "Salida" : "Entrada", mode: "insensitive" },
        status: true,
        timestamp: { gte: todayStart },
      },
    }),
    prisma.accessLog.count({
      where: {
        zone: { contains: isExit ? "Salida" : "Entrada", mode: "insensitive" },
        status: false,
        timestamp: { gte: todayStart },
      },
    }),
  ]);

  const lastLog = recentActivity[0];

  return (
    <div className="page-wrapper">
      {/* Page Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="page-title text-3xl font-black">Centro de Monitoreo</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isExit ? "bg-amber-500" : "bg-[var(--color-primary)]"} animate-pulse`} />
            <span className="font-[var(--font-label)] text-xs font-medium text-[var(--color-on-surface-variant)] uppercase tracking-widest">
              SISTEMA EN VIVO: {activeZone.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[var(--color-surface-container-low)] p-1 rounded-xl border border-[var(--color-outline-variant)]/15">
          <Link 
            href="/?tab=entrada"
            className={`px-6 py-2 text-xs font-black rounded-lg transition-all ${
              !isExit 
                ? "bg-[var(--color-primary)] text-white shadow-lg" 
                : "text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            }`}
          >
            MÓDULO ENTRADA
          </Link>
          <Link 
            href="/?tab=salida"
            className={`px-6 py-2 text-xs font-black rounded-lg transition-all ${
              isExit 
                ? "bg-amber-600 text-white shadow-lg" 
                : "text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            }`}
          >
            MÓDULO SALIDA
          </Link>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Main Functional Section */}
        <div className="col-span-12 xl:col-span-8 space-y-6">
          <div className="aspect-video xl:aspect-auto xl:h-[450px]">
            <GateConsole zone={activeZone} lastPlate={lastLog?.plate} />
          </div>

          {/* Recent Activity Table */}
          <div className="table-wrapper">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--color-outline-variant)]/15">
              <h3 className="font-bold text-[var(--color-on-surface)] text-sm">
                Actividad Reciente - {isExit ? "Salidas" : "Entradas"}
              </h3>
              <div className="flex items-center gap-4">
                <span className="text-[0.65rem] font-bold text-[var(--color-on-surface-variant)]">FILTRADO POR: {activeZone.toUpperCase()}</span>
                <TableExportButton data={recentActivity} filename={`log_${tab}`} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead className="table-thead">
                  <tr>
                    <th>Hora</th>
                    <th>Placa</th>
                    <th>Método</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentActivity.length > 0 ? (
                    recentActivity.map((row: { id: number; timestamp: Date; plate: string; method: string; status: boolean }) => (
                      <tr key={row.id} className="table-row">
                        <td className="table-cell font-mono text-sm text-[var(--color-on-surface-variant)]">
                          <FormattedTime date={row.timestamp} />
                        </td>
                        <td className="table-cell font-bold text-[var(--color-on-surface)]">{row.plate}</td>
                        <td className="table-cell">
                          <span className="text-[0.6rem] font-black px-2 py-0.5 rounded bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)]">
                            {row.method}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${row.status ? "badge-success" : "badge-error"}`}>
                            {row.status ? (isExit ? "SALIDA PERMITIDA" : "ENTRADA PERMITIDA") : "DENEGADO"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="table-cell text-center py-12 text-[var(--color-on-surface-variant)] text-sm italic">
                        No hay actividad registrada para esta zona hoy.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column - Control Panel */}
        <div className="col-span-12 xl:col-span-4 space-y-6">
          <div className={`card overflow-hidden border-t-4 ${isExit ? "border-amber-600" : "border-[var(--color-primary)]"}`}>
            <div className="px-6 py-4 bg-[var(--color-surface-container-low)] border-b border-[var(--color-outline-variant)]/15">
              <div className="flex items-center justify-between">
                <h3 className={`text-xs font-black tracking-widest uppercase ${isExit ? "text-amber-600" : "text-[var(--color-primary)]"}`}>
                  Panel de Control: {isExit ? "Salida" : "Entrada"}
                </h3>
                <div className="flex gap-1 p-0.5 bg-[var(--color-surface-container-high)] rounded-lg">
                  <button className="px-3 py-1 text-[0.65rem] font-black rounded-md bg-[var(--color-primary)] text-white">LIVE</button>
                  <Link href="/reports" className="px-3 py-1 text-[0.65rem] font-black rounded-md text-[var(--color-on-surface-variant)] hover:bg-white/50">HISTORIAL</Link>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <RfidMonitor zone={activeZone} />
              <PlateVerification zone={activeZone} />
            </div>
          </div>

          {/* Quick Stats Module (Functional) */}
          <div className="card-padded bg-[var(--color-surface-container-lowest)] border-dashed">
            <h4 className="text-[0.6rem] font-black text-[var(--color-on-surface-variant)] tracking-widest uppercase mb-4">
              Métricas de Flujo ({tab.toUpperCase()})
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[var(--color-surface-container-low)] rounded-lg">
                <p className="text-[0.6rem] font-bold text-[var(--color-on-surface-variant)] uppercase">Hoy (Autorizados)</p>
                <p className="text-xl font-black text-[var(--color-on-surface)]">{totalToday}</p>
                <p className="text-[0.5rem] text-[var(--color-on-surface-variant)] font-medium opacity-60">Total día actual</p>
              </div>
              <div className="p-3 bg-[var(--color-surface-container-low)] rounded-lg">
                <p className="text-[0.6rem] font-bold text-[var(--color-on-surface-variant)] uppercase">Rechazos</p>
                <p className="text-xl font-black text-[var(--color-on-surface)]">{totalRejected}</p>
                <p className="text-[0.5rem] text-[var(--color-on-surface-variant)] font-medium opacity-60">Detecciones fallidas</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <MonitoringQuickActions />


        </div>
      </div>
    </div>
  );
}
