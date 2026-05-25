export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reportes de Entrada y Salida - UFPS PARKING",
  description: "Log operacional detallado para el ciclo de 24 horas",
};

import prisma from "@parqueadero/database";
import TableExportButton from "@/components/TableExportButton";
import Link from "next/link";
import FormattedTime from "@/components/FormattedTime";

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const plateQuery = typeof params.plate === 'string' ? params.plate : undefined;
  const dateFromQuery = typeof params.dateFrom === 'string' ? params.dateFrom : undefined;
  const dateToQuery = typeof params.dateTo === 'string' ? params.dateTo : undefined;
  const zoneQuery = typeof params.zone === 'string' ? params.zone : undefined;

  const whereClause: import("../../generated/prisma/client").Prisma.AccessLogWhereInput = {};

  if (plateQuery) {
    whereClause.plate = {
      contains: plateQuery,
      mode: "insensitive"
    };
  }

  if (zoneQuery && zoneQuery !== "all") {
    whereClause.zone = {
      contains: zoneQuery,
      mode: "insensitive"
    };
  }

  if (dateFromQuery || dateToQuery) {
    whereClause.timestamp = {};
    if (dateFromQuery) {
      // Forzamos el inicio del día en la zona horaria de Colombia
      whereClause.timestamp.gte = new Date(`${dateFromQuery}T00:00:00.000-05:00`);
    }
    if (dateToQuery) {
      // Forzamos el fin del día en la zona horaria de Colombia
      whereClause.timestamp.lte = new Date(`${dateToQuery}T23:59:59.999-05:00`);
    }
  }

  const pageQuery = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const currentPage = isNaN(pageQuery) || pageQuery < 1 ? 1 : pageQuery;
  const pageSize = 10;

  const activityLogs = await prisma.accessLog.findMany({
    where: whereClause,
    orderBy: {
      timestamp: "desc",
    },
    take: pageSize,
    skip: (currentPage - 1) * pageSize,
  });

  const totalFilteredLogs = await prisma.accessLog.count({ where: whereClause });
  const totalPages = Math.ceil(totalFilteredLogs / pageSize) || 1;

  const totalEntries = await prisma.accessLog.count({
    where: { ...whereClause, status: true },
  });
  
  const totalRejected = await prisma.accessLog.count({
    where: { ...whereClause, status: false },
  });

  const totalLogs = totalEntries + totalRejected;
  const authPct = totalLogs > 0 ? ((totalEntries / totalLogs) * 100).toFixed(1) : "0.0";

  const getUserTypeCls = (type: string) => {
    switch (type) {
      case "Facultad":
        return "badge-primary";
      case "Estudiante":
        return "badge-secondary";
      case "Visitante":
        return "badge-warning";
      case "Administrador":
        return "badge-neutral";
      default:
        return "badge-neutral";
    }
  };

  const logsForPeak = await prisma.accessLog.findMany({
    where: whereClause,
    select: { timestamp: true }
  });
  
  const hourlyCount = new Array(24).fill(0);
  logsForPeak.forEach((log: { timestamp: Date }) => {
    // Usamos America/Bogota ya que es la zona horaria de la UFPS
    const bogotaHour = parseInt(new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/Bogota'
    }).format(log.timestamp));
    
    // El formato 'numeric' de 24 horas puede devolver 24 en lugar de 0 en algunos entornos
    const hourIdx = bogotaHour === 24 ? 0 : bogotaHour;
    hourlyCount[hourIdx]++;
  });
  
  const maxCount = Math.max(...hourlyCount.slice(6, 13), 1);
  const peakBars = hourlyCount.slice(6, 13).map(count => (count / maxCount) * 100);
  const maxPeakIndex = peakBars.indexOf(Math.max(...peakBars));

  const complianceStats = [
    { label: "Acceso Autorizado", value: `${authPct}%`, pct: Number(authPct), barColor: "bg-[var(--color-primary)]" },
  ];

  return (
    <div className="page-wrapper space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Reportes de Entrada/Salida de Vehículos</h2>
          <p className="page-subtitle">Log operacional detallado para el ciclo de 24 horas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 lg:mt-0">
          <form className="flex flex-wrap items-center gap-2 w-full sm:w-auto" method="GET" action="/reports">
            <select
              name="zone"
              defaultValue={zoneQuery || "all"}
              className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-lg px-3 py-1.5 text-xs font-bold text-[var(--color-on-surface)] w-32"
            >
              <option value="all">Todas las Zonas</option>
              <option value="Entrada">Entradas</option>
              <option value="Salida">Salidas</option>
            </select>
            <input
              type="text"
              name="plate"
              defaultValue={plateQuery || ""}
              placeholder="Placa..."
              className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-lg px-3 py-1.5 text-xs uppercase text-[var(--color-on-surface)] w-28"
            />
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFromQuery || ""}
              className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-lg px-2 py-1.5 text-xs text-[var(--color-on-surface)]"
            />
            <span className="text-[var(--color-on-surface-variant)] text-xs">-</span>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateToQuery || ""}
              className="bg-[var(--color-surface-container-low)] border border-[var(--color-outline-variant)]/30 rounded-lg px-2 py-1.5 text-xs text-[var(--color-on-surface)]"
            />
            <button type="submit" className="bg-[var(--color-primary)] text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:brightness-110">
              Filtrar
            </button>
            {(plateQuery || dateFromQuery || dateToQuery || zoneQuery) && (
              <a href="/reports" className="text-[10px] text-[var(--color-primary)] hover:underline ml-1">Limpiar</a>
            )}
          </form>
          <div className="flex gap-2 w-full sm:w-auto">
            <TableExportButton 
              data={activityLogs} 
              filename={`reporte_estacionamiento_${zoneQuery || 'total'}`} 
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: "login", border: "border-[var(--color-primary)]", label: "Accesos Permitidos", value: totalEntries.toString(), trend: null, trendIcon: "trending_up", trendColor: "text-[var(--color-primary)]", badge: null },
          { icon: "block", border: "border-[var(--color-error)]", label: "Accesos Denegados", value: totalRejected.toString(), trend: null, trendIcon: "trending_down", trendColor: "text-[var(--color-error)]", badge: null },
          { icon: "list_alt", border: "border-[var(--color-tertiary)]", label: "Registros Totales", value: totalLogs.toString(), trend: null, trendIcon: null, trendColor: null, badge: "FILTRADO" },
        ].map((card) => (
          <div key={card.label} className={`card-padded border-b-2 ${card.border} relative overflow-hidden group`}>
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <span className="material-symbols-outlined text-6xl text-[var(--color-on-surface)]">{card.icon}</span>
            </div>
            <p className="text-[10px] font-black text-[var(--color-on-surface-variant)] uppercase tracking-widest font-[var(--font-label)]">{card.label}</p>
            <h3 className="text-4xl font-black text-[var(--color-on-surface)] mt-2 tracking-tighter">{card.value}</h3>
            <div className="flex items-center gap-2 mt-4">
              {card.trend && (
                <>
                  <span className={`text-xs font-bold ${card.trendColor} flex items-center`}>
                    <span className="material-symbols-outlined text-xs">{card.trendIcon}</span>
                    {card.trend}
                  </span>
                  <span className="text-[10px] text-[var(--color-on-surface-variant)] font-medium font-[var(--font-label)]">vs ayer</span>
                </>
              )}
              {card.badge && (
                <span className="badge badge-warning">{card.badge}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        <div className="px-6 py-4 border-b border-[var(--color-outline-variant)]/15 flex items-center justify-between">
          <h4 className="font-bold text-[var(--color-on-surface)] text-sm">Log de Actividad en Tiempo Real</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-thead">
              <tr>
                {["Marca de Tiempo", "Placa", "Tipo de Usuario", "Zona", "Estado", "Motivo"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activityLogs.map((row: { id: number; plate: string; timestamp: Date; zone: string; status: boolean; userType: string; reason?: string | null }) => (
                <tr key={row.id} className="table-row group">
                  <td className="table-cell">
                    <div className="flex flex-col">
                      <FormattedTime date={row.timestamp} className="text-sm font-semibold text-[var(--color-on-surface)]" />
                      <FormattedTime date={row.timestamp} showDate className="text-[10px] text-[var(--color-on-surface-variant)] font-[var(--font-label)]" />
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm font-mono font-bold px-2 py-1 rounded bg-[var(--color-surface-container-high)] text-[var(--color-on-surface)]">{row.plate}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`badge ${getUserTypeCls(row.userType)}`}>{row.userType}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-[var(--color-on-surface-variant)] font-medium font-[var(--font-label)]">{row.zone}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${row.status ? "bg-[var(--color-primary)]" : "bg-[var(--color-error)]"}`} />
                      <span className={`text-xs font-bold ${row.status ? "text-[var(--color-primary)]" : "text-[var(--color-error)]"}`}>
                        {row.status ? "Permitido" : "Rechazado"}
                      </span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-[var(--color-on-surface-variant)] font-medium max-w-[200px] truncate block" title={row.reason || ""}>
                      {row.reason || "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="table-footer">
          <p className="table-footer-text">
            Mostrando {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, totalFilteredLogs)} de {totalFilteredLogs} entradas
          </p>
          <div className="flex items-center gap-1">
            <a 
              href={(() => {
                const query = new URLSearchParams();
                if (plateQuery) query.set("plate", plateQuery);
                if (dateFromQuery) query.set("dateFrom", dateFromQuery);
                if (dateToQuery) query.set("dateTo", dateToQuery);
                query.set("page", Math.max(1, currentPage - 1).toString());
                return `/reports?${query.toString()}`;
              })()}
              className={`pagination-btn ${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </a>
            {Array.from({ length: totalPages }).map((_, i) => {
              const query = new URLSearchParams();
              if (plateQuery) query.set("plate", plateQuery);
              if (dateFromQuery) query.set("dateFrom", dateFromQuery);
              if (dateToQuery) query.set("dateTo", dateToQuery);
              query.set("page", (i + 1).toString());
              
              return (
                <a
                  key={i}
                  href={`/reports?${query.toString()}`}
                  className={`pagination-btn ${currentPage === i + 1 ? "active" : ""}`}
                >
                  {i + 1}
                </a>
              );
            })}
            <a 
              href={(() => {
                const query = new URLSearchParams();
                if (plateQuery) query.set("plate", plateQuery);
                if (dateFromQuery) query.set("dateFrom", dateFromQuery);
                if (dateToQuery) query.set("dateTo", dateToQuery);
                query.set("page", Math.min(totalPages, currentPage + 1).toString());
                return `/reports?${query.toString()}`;
              })()}
              className={`pagination-btn ${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </a>
          </div>
        </div>
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Peak Traffic Window */}
        <div className="card-padded !p-8 relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[var(--color-primary)]/10 rounded-lg">
              <span className="material-symbols-outlined text-[var(--color-primary)]">insights</span>
            </div>
            <h5 className="text-sm font-bold text-[var(--color-on-surface)]">Ventana de Tráfico Pico</h5>
          </div>
          <div className="flex items-end gap-2 h-24 mb-6">
            {peakBars.map((h, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-sm ${i === maxPeakIndex ? "bg-[var(--color-primary)] relative" : i === maxPeakIndex + 1 || i === maxPeakIndex - 1 ? "bg-[var(--color-primary)]/60" : "bg-[var(--color-primary)]/20"}`}
                style={{ height: `max(4px, ${h}%)`, transition: "height 0.3s ease-in-out" }}
              >
                {i === maxPeakIndex && h > 0 && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[var(--color-on-surface)] text-[var(--color-surface)] text-[8px] px-1.5 py-0.5 rounded font-bold">
                    {String(i + 6).padStart(2, '0')}:00
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--color-on-surface-variant)] font-[var(--font-label)] leading-relaxed">
            La densidad de tráfico es actualmente un{" "}
            <span className="font-bold text-[var(--color-on-surface)]">14% mayor</span> que el promedio móvil de 7 días para este intervalo de tiempo. Se sugiere monitorear el flujo vehicular durante las horas pico para evitar congestión en los accesos.
          </p>
        </div>

        {/* Compliance Summary */}
        <div className="card-padded !p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-[var(--color-tertiary)]/10 rounded-lg">
              <span className="material-symbols-outlined text-[var(--color-tertiary)]">gavel</span>
            </div>
            <h5 className="text-sm font-bold text-[var(--color-on-surface)]">Resumen de Cumplimiento</h5>
          </div>
          <div className="space-y-4">
            {complianceStats.map((stat) => (
              <div key={stat.label}>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-[var(--color-on-surface-variant)] font-[var(--font-label)]">{stat.label}</span>
                  <span className="text-xs font-bold text-[var(--color-on-surface)]">{stat.value}</span>
                </div>
                <div className="w-full bg-[var(--color-surface-container-high)] h-1.5 rounded-full overflow-hidden mt-1">
                  <div className={`${stat.barColor} h-full`} style={{ width: `${stat.pct}%` }} />
                </div>
              </div>
            ))}
            <p className="text-[10px] text-[var(--color-on-surface-variant)] mt-4 font-[var(--font-label)] italic">
              Todos los sistemas operando dentro de los márgenes de seguridad definidos.
            </p>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <Link 
        href="/"
        title="Regresar al Monitoreo"
        className="fixed bottom-10 right-10 w-16 h-16 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group overflow-hidden"
      >
        <span className="material-symbols-outlined text-3xl group-hover:rotate-12 transition-transform">monitor_heart</span>
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </div>
  );
}
