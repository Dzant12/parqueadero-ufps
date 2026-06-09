export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campus ParkGuard - Panel de Analíticas",
  description: "Métricas de flujo y capacidad en tiempo real para el estacionamiento del campus",
};

import prisma, { Prisma } from "@parqueadero/database";
import AnalyticsFilters from "@/components/AnalyticsFilters";
import SeedButton from "@/components/SeedButton";

interface Props {
  searchParams: Promise<{
    period?: string;
    userType?: string;
    days?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const { period = "hoy", userType = "all", days, dateFrom, dateTo } = await searchParams;

  // ----------------------------------------------------------------------------
  // 1. Cálculos de fechas en la Zona Horaria de Colombia (America/Bogota, UTC-5)
  // ----------------------------------------------------------------------------
  const now = new Date();
  
  const bogotaFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = bogotaFormatter.formatToParts(now);
  const getPart = (type: string) => parseInt(parts.find(p => p.type === type)?.value || "0");
  
  const bYear = getPart('year');
  const bMonth = getPart('month');
  const bDay = getPart('day');

  const pad = (num: number) => String(num).padStart(2, '0');
  
  // Limites del día de hoy en Bogotá
  const todayStart = new Date(`${bYear}-${pad(bMonth)}-${pad(bDay)}T00:00:00.000-05:00`);
  const todayEnd = new Date(`${bYear}-${pad(bMonth)}-${pad(bDay)}T23:59:59.999-05:00`);
  
  // Limites de la semana actual (iniciando Lunes)
  const bogotaDate = new Date(`${bYear}-${pad(bMonth)}-${pad(bDay)}T12:00:00.000Z`);
  const bDayOfWeek = bogotaDate.getUTCDay(); // 0: Dom, 1: Lun, ..., 6: Sab
  const daysSinceMonday = bDayOfWeek === 0 ? 6 : bDayOfWeek - 1;
  const weekStart = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  // Limites del mes actual
  const monthStart = new Date(`${bYear}-${pad(bMonth)}-01T00:00:00.000-05:00`);
  const nextMonthYear = bMonth === 12 ? bYear + 1 : bYear;
  const nextMonth = bMonth === 12 ? 1 : bMonth + 1;
  const monthEnd = new Date(`${nextMonthYear}-${pad(nextMonth)}-01T00:00:00.000-05:00`);
  monthEnd.setTime(monthEnd.getTime() - 1);

  // Selección de rango temporal de búsqueda
  let startDate = todayStart;
  let endDate = todayEnd;
  let periodLabel = "Hoy";

  if (period === "semana") {
    startDate = weekStart;
    endDate = weekEnd;
    periodLabel = "Esta Semana";
  } else if (period === "mes") {
    startDate = monthStart;
    endDate = monthEnd;
    periodLabel = "Este Mes";
  } else if (period === "dias" && days) {
    const numDays = Math.min(Math.max(parseInt(days, 10) || 7, 1), 365);
    startDate = new Date(todayStart.getTime() - (numDays - 1) * 24 * 60 * 60 * 1000);
    endDate = todayEnd;
    periodLabel = `Últimos ${numDays} Días`;
  } else if (period === "fecha" && dateFrom) {
    startDate = new Date(`${dateFrom}T00:00:00.000-05:00`);
    const effectiveTo = dateTo && dateTo >= dateFrom ? dateTo : dateFrom;
    endDate = new Date(`${effectiveTo}T23:59:59.999-05:00`);
    // Etiqueta del rango
    const fmt = (d: string) => {
      const [fy, fm, fd] = d.split("-");
      return `${fd}/${fm}/${fy}`;
    };
    periodLabel = effectiveTo !== dateFrom
      ? `${fmt(dateFrom)} – ${fmt(effectiveTo)}`
      : fmt(dateFrom);
  }

  // El filtro de usuario envía el valor canónico directamente (Estudiante, Docente, Administrativo, Personal, Visitante).
  // La cláusula WHERE busca ese valor normalizado en la BD.
  // Para datos históricos sucios (p. ej. "Estudiante/Personal", "ESTUDIANTE"), la normalización
  // se aplica en el procesamiento estadístico, no en el filtro de BD.
  const dbUserType: string | undefined = userType !== "all" ? userType : undefined;

  // Cláusula de filtrado de base de datos
  const whereClause: Prisma.AccessLogWhereInput = {
    timestamp: {
      gte: startDate,
      lte: endDate,
    },
  };
  if (dbUserType) {
    whereClause.userType = dbUserType;
  }

  // ----------------------------------------------------------------------------
  // 2. Consultas de Base de Datos mediante Prisma
  // ----------------------------------------------------------------------------
  const [
    logs,
    totalVehicles,
    pendingRequests,
    totalEntriesCount,
    totalExitsCount
  ] = await Promise.all([
    prisma.accessLog.findMany({
      where: whereClause,
      orderBy: { timestamp: "desc" },
    }),
    prisma.vehicle.count(),
    prisma.accessRequest.count({
      where: { status: "PENDING" },
    }),
    // Ocupación global del estacionamiento en tiempo real
    prisma.accessLog.count({
      where: {
        status: true,
        zone: { contains: "Entrada", mode: "insensitive" }
      }
    }),
    prisma.accessLog.count({
      where: {
        status: true,
        zone: { contains: "Salida", mode: "insensitive" }
      }
    })
  ]);

  // Cálculo de ocupación neta actual
  const currentOccupancy = Math.max(0, totalEntriesCount - totalExitsCount);
  const occupancyPercentage = Math.min(100, Math.round((currentOccupancy / 4850) * 100));

  // Métricas específicas del período seleccionado
  const totalPeriodAccesses = logs.length;
  const approvedPeriodAccesses = logs.filter(l => l.status).length;
  const rejectedPeriodAccesses = logs.filter(l => !l.status).length;

  // ----------------------------------------------------------------------------
  // 3. Procesamiento Estadístico para Distribución de Usuarios
  // ----------------------------------------------------------------------------
  // Función de normalización para consolidar valores históricos inconsistentes en la BD
  // (p. ej. "Estudiante/Personal", "ESTUDIANTE", "Docente", "Administrativo" → etiquetas canónicas)
  const normalizeUserType = (raw: string | null): string => {
    const t = (raw ?? "").trim().toLowerCase();
    if (!t || t === "desconocido") return "Desconocido";
    if (t === "visitante" || t.includes("invitado") || t.includes("investigador")) return "Visitante";
    // Tipos de Estudiante (del CSV de la universidad y del formulario de registro)
    if (
      t.includes("estudiante") ||
      t.includes("pregrado") ||
      t.includes("postgrado") ||
      t.includes("primer semestre") ||
      t.includes("preuniversitario") ||
      t.includes("egresado") ||
      t.includes("estadistico") ||
      t.includes("sies")
    ) return "Estudiante";
    // Tipos de Docente
    if (t.includes("docente") || t.includes("facultad") || t.includes("profesor") || t === "t") return "Docente";
    // Tipos de Administrativo
    if (
      t.includes("admin") ||
      t.includes("administrativo") ||
      t === "pt" ||
      t.includes("staff") ||
      t === "s"
    ) return "Administrativo";
    if (t.includes("personal") || t === "personal") return "Personal";
    // Caso especial heredado: "estudiante/personal" era un genérico
    if (t.includes("estudiante/personal") || t === "estudiante/personal") return "Personal";
    return raw ?? "Desconocido";
  };

  const userTypeDistribution = logs.reduce((acc: Record<string, number>, log) => {
    const label = normalizeUserType(log.userType);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const totalLogsSafe = logs.length || 1;
  const distributionColors: Record<string, string> = {
    "Estudiante":     "bg-[var(--color-primary)]",
    "Docente":        "bg-[var(--color-tertiary)]",
    "Administrativo": "bg-[var(--color-secondary)]",
    "Personal":       "bg-slate-500",
    "Visitante":      "bg-emerald-500",
    "Desconocido":    "bg-slate-400",
  };

  const distribution = Object.entries(userTypeDistribution).map(([label, count]) => ({
    label,
    count,
    pct: Math.round((count / totalLogsSafe) * 100),
    color: distributionColors[label] || "bg-[var(--color-outline-variant)]",
  })).sort((a, b) => b.count - a.count);

  // ----------------------------------------------------------------------------
  // 4. Modelado y Graficado de Tendencias de Tráfico (Custom SVG Graph)
  // ----------------------------------------------------------------------------
  let trends: { label: string; entries: number; exits: number }[] = [];

  if (period === "hoy") {
    // Horario: Agrupado por franjas de 2 horas (6 AM a 10 PM)
    const hourBuckets = [
      { label: "06:00", min: 0, max: 7 },
      { label: "08:00", min: 8, max: 9 },
      { label: "10:00", min: 10, max: 11 },
      { label: "12:00", min: 12, max: 13 },
      { label: "14:00", min: 14, max: 15 },
      { label: "16:00", min: 16, max: 17 },
      { label: "18:00", min: 18, max: 19 },
      { label: "20:00", min: 20, max: 21 },
      { label: "22:00", min: 22, max: 23 },
    ];
    trends = hourBuckets.map(hb => ({ label: hb.label, entries: 0, exits: 0 }));

    const bogotaFormatterHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      hour12: false
    });

    logs.forEach(log => {
      const hr = parseInt(bogotaFormatterHour.format(log.timestamp));
      const idx = hourBuckets.findIndex(hb => hr >= hb.min && hr <= hb.max);
      if (idx !== -1) {
        if (log.zone.toLowerCase().includes("salida")) {
          trends[idx].exits++;
        } else {
          trends[idx].entries++;
        }
      }
    });
  } else if (period === "semana") {
    // Semanal: Agrupado por días de Lunes a Domingo
    const dayNames = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    trends = dayNames.map(day => ({ label: day, entries: 0, exits: 0 }));

    const bogotaFormatterDay = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      weekday: 'short' // Mon, Tue, Wed, Thu, Fri, Sat, Sun
    });

    const weekdayMap: Record<string, number> = {
      "Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6
    };

    logs.forEach(log => {
      const dayStr = bogotaFormatterDay.format(log.timestamp);
      const idx = weekdayMap[dayStr];
      if (idx !== undefined) {
        if (log.zone.toLowerCase().includes("salida")) {
          trends[idx].exits++;
        } else {
          trends[idx].entries++;
        }
      }
    });
  } else {
    // Mensual: Agrupado en 5 semanas
    const weekBuckets = [
      { label: "Semana 1", min: 1, max: 7 },
      { label: "Semana 2", min: 8, max: 14 },
      { label: "Semana 3", min: 15, max: 21 },
      { label: "Semana 4", min: 22, max: 28 },
      { label: "Semana 5", min: 29, max: 31 },
    ];
    trends = weekBuckets.map(wb => ({ label: wb.label, entries: 0, exits: 0 }));

    const bogotaFormatterDate = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota',
      day: 'numeric'
    });

    logs.forEach(log => {
      const dayOfMonth = parseInt(bogotaFormatterDate.format(log.timestamp));
      const idx = weekBuckets.findIndex(wb => dayOfMonth >= wb.min && dayOfMonth <= wb.max);
      if (idx !== -1) {
        if (log.zone.toLowerCase().includes("salida")) {
          trends[idx].exits++;
        } else {
          trends[idx].entries++;
        }
      }
    });
  }

  // Cálculos para el dimensionamiento del gráfico SVG vectorial
  const maxTrendVal = Math.max(...trends.map(t => Math.max(t.entries, t.exits)), 1);
  
  const width = 600;
  const height = 180;
  const paddingX = 40;
  const paddingY = 20;
  
  const pointsEntries = trends.map((t, i) => {
    const x = paddingX + (i / (trends.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (t.entries / maxTrendVal) * (height - 2 * paddingY);
    return { x, y, val: t.entries, label: t.label };
  });

  const pointsExits = trends.map((t, i) => {
    const x = paddingX + (i / (trends.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (t.exits / maxTrendVal) * (height - 2 * paddingY);
    return { x, y, val: t.exits, label: t.label };
  });

  const pathEntriesD = pointsEntries.length > 0 
    ? `M ${pointsEntries[0].x},${pointsEntries[0].y} ` + pointsEntries.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')
    : '';

  const pathExitsD = pointsExits.length > 0 
    ? `M ${pointsExits[0].x},${pointsExits[0].y} ` + pointsExits.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')
    : '';

  const areaEntriesD = pointsEntries.length > 0
    ? `${pathEntriesD} L ${pointsEntries[pointsEntries.length - 1].x},${height - paddingY} L ${pointsEntries[0].x},${height - paddingY} Z`
    : '';

  const areaExitsD = pointsExits.length > 0
    ? `${pathExitsD} L ${pointsExits[pointsExits.length - 1].x},${height - paddingY} L ${pointsExits[0].x},${height - paddingY} Z`
    : '';

  // Detección del pico de volumen en el período
  let peakItem = trends[0];
  trends.forEach(t => {
    if ((t.entries + t.exits) > (peakItem.entries + peakItem.exits)) {
      peakItem = t;
    }
  });

  // ----------------------------------------------------------------------------
  // 5. Procesamiento de Log de Auditoría
  // ----------------------------------------------------------------------------
  const auditLogs = logs.slice(0, 4);

  return (
    <div className="page-wrapper space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title text-3xl font-black">Analíticas de Operaciones</h2>
          <p className="page-subtitle text-xs text-[var(--color-on-surface-variant)] uppercase tracking-wider mt-1">
            Métricas de control de acceso e ingresos • Filtro Activo: <span className="font-bold text-[var(--color-primary)]">{periodLabel.toUpperCase()}</span>
          </p>
        </div>
        <AnalyticsFilters
          currentPeriod={period}
          currentUserType={userType}
          currentDays={days}
          currentDateFrom={dateFrom}
          currentDateTo={dateTo}
        />
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { label: "Capacidad Total", value: "4,850", sub: "Espacios Totales", bar: 100, extraColor: "" },
          { label: "Ocupación Estimada", value: `${occupancyPercentage}%`, sub: `${currentOccupancy} Vehículos adentro`, bar: occupancyPercentage, extraColor: "text-[var(--color-primary)] font-bold" },
          { label: `Accesos Concedidos`, value: approvedPeriodAccesses.toString(), sub: `Registrados ${periodLabel}`, bar: null, extraColor: "text-emerald-600 font-bold", isIncome: true },
          { label: "Accesos Denegados", value: rejectedPeriodAccesses.toString(), sub: `Alertas de seguridad`, badge: rejectedPeriodAccesses > 0 ? "Revisión Recomendada" : undefined, bar: null, isDenial: true },
        ].map((card) => (
          <div key={card.label} className="card-padded flex flex-col gap-1">
            <span className="font-[var(--font-label)] text-[0.65rem] font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-widest">{card.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-[var(--font-headline)] font-black text-[var(--color-on-surface)]">{card.value}</span>
              {card.sub && <span className={`text-[0.65rem] font-[var(--font-label)] ${card.extraColor || "text-[var(--color-on-surface-variant)]"}`}>{card.sub}</span>}
              {card.badge && (
                <span className="badge badge-warning text-[0.55rem] font-black">{card.badge}</span>
              )}
            </div>
            {card.bar !== null && (
              <div className="mt-4 w-full bg-[var(--color-surface-container-high)] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[var(--color-primary)] h-full transition-all duration-500" style={{ width: `${card.bar}%` }} />
              </div>
            )}
            {card.isIncome && (
              <div className="mt-4 flex items-center gap-1">
                <span className="material-symbols-outlined text-emerald-600 text-sm">check_circle</span>
                <span className="text-[0.65rem] font-[var(--font-label)] text-[var(--color-on-surface-variant)]">Tránsito regular autorizado</span>
              </div>
            )}
            {card.isDenial && (
              <div className="mt-4 flex items-center gap-1">
                <span className="material-symbols-outlined text-[var(--color-tertiary)] text-sm">report</span>
                <span className="text-[0.65rem] font-[var(--font-label)] text-[var(--color-on-surface-variant)]">Placas no registradas/tags inactivos</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Analytical Visuals (Bento) */}
      {logs.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center p-12 bg-[var(--color-surface-container-lowest)] rounded-3xl border border-dashed border-[var(--color-outline-variant)]/40 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-surface-container-high)] flex items-center justify-center text-[var(--color-on-surface-variant)] mb-4">
            <span className="material-symbols-outlined text-3xl">bar_chart_4_bars</span>
          </div>
          <h3 className="font-[var(--font-headline)] font-extrabold text-[var(--color-on-surface)] text-xl">Sin Datos Disponibles</h3>
          <p className="font-[var(--font-label)] text-xs text-[var(--color-on-surface-variant)] max-w-md mt-2">
            No se han registrado eventos de acceso para {periodLabel.toLowerCase()} con el filtro de tipo de usuario seleccionado. Si deseas verificar el diseño y las analíticas dinámicas, puedes generar logs de prueba simulados para los últimos 30 días.
          </p>
          <SeedButton />
        </div>
      ) : (
        <>
          <div className="bento-grid">
            {/* Usage by User Type */}
            <div className="col-span-12 xl:col-span-5 card-padded !p-8 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="font-[var(--font-headline)] font-extrabold text-[var(--color-on-surface)]">Uso por Tipo de Usuario</h3>
                    <p className="font-[var(--font-label)] text-xs text-[var(--color-on-surface-variant)] mt-1">Tránsito clasificado por estamento</p>
                  </div>
                  <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">category</span>
                </div>
                <div className="space-y-5">
                  {distribution.map((item) => (
                    <div key={item.label} className="space-y-1.5">
                      <div className="flex justify-between font-[var(--font-label)] text-xs font-bold text-[var(--color-on-surface)]">
                        <span>{item.label}</span>
                        <span className="text-[var(--color-on-surface-variant)] font-normal">{item.count} accesos ({item.pct}%)</span>
                      </div>
                      <div className="h-2.5 bg-[var(--color-surface-container-high)] rounded-sm overflow-hidden">
                        <div className={`${item.color} h-full transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 pt-4 border-t border-[var(--color-outline-variant)]/15 flex items-center justify-between">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {distribution.slice(0, 3).map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 ${item.color} rounded-full`} />
                      <span className="font-[var(--font-label)] text-[0.65rem] text-[var(--color-on-surface-variant)] font-semibold">{item.label.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Traffic Trends */}
            <div className="col-span-12 xl:col-span-7 card-padded !p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-[var(--font-headline)] font-extrabold text-[var(--color-on-surface)]">Tránsito de Estacionamiento</h3>
                  <p className="font-[var(--font-label)] text-xs text-[var(--color-on-surface-variant)] mt-1">Volumen de ingresos vs egresos por período</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-[var(--color-primary)] rounded-full" />
                    <span className="text-[0.65rem] font-black font-[var(--font-label)] text-[var(--color-on-surface-variant)] uppercase tracking-wider">ENTRADAS</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-[var(--color-tertiary)] rounded-full" />
                    <span className="text-[0.65rem] font-black font-[var(--font-label)] text-[var(--color-on-surface-variant)] uppercase tracking-wider">SALIDAS</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Responsive SVG Line Chart */}
              <div className="relative h-64 w-full flex items-end justify-between px-2">
                <div className="absolute inset-0 flex items-end">
                  <svg className="w-full h-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`}>
                    <defs>
                      <linearGradient id="entriesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="exitsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-tertiary)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="var(--color-tertiary)" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                      const y = paddingY + ratio * (height - 2 * paddingY);
                      return (
                        <line
                          key={ratio}
                          x1={paddingX}
                          y1={y}
                          x2={width - paddingX}
                          y2={y}
                          stroke="var(--color-outline-variant)"
                          strokeOpacity="0.15"
                          strokeDasharray="4"
                        />
                      );
                    })}

                    {/* Area Gradients */}
                    {areaEntriesD && (
                      <path d={areaEntriesD} fill="url(#entriesGrad)" className="transition-all duration-500" />
                    )}
                    {areaExitsD && (
                      <path d={areaExitsD} fill="url(#exitsGrad)" className="transition-all duration-500" />
                    )}

                    {/* Lines */}
                    {pathEntriesD && (
                      <path
                        d={pathEntriesD}
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all duration-500"
                      />
                    )}
                    {pathExitsD && (
                      <path
                        d={pathExitsD}
                        fill="none"
                        stroke="var(--color-tertiary)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all duration-500"
                      />
                    )}

                    {/* Dynamic Markers for Entries */}
                    {pointsEntries.map((p, i) => (
                      <g key={`entry-${i}`} className="group/marker cursor-pointer">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill="var(--color-primary)"
                          stroke="var(--color-surface)"
                          strokeWidth="2"
                        />
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="8"
                          fill="var(--color-primary)"
                          fillOpacity="0.2"
                          className="opacity-0 group-hover/marker:opacity-100 transition-opacity"
                        />
                      </g>
                    ))}

                    {/* Dynamic Markers for Exits */}
                    {pointsExits.map((p, i) => (
                      <g key={`exit-${i}`} className="group/marker cursor-pointer">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill="var(--color-tertiary)"
                          stroke="var(--color-surface)"
                          strokeWidth="2"
                        />
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="8"
                          fill="var(--color-tertiary)"
                          fillOpacity="0.2"
                          className="opacity-0 group-hover/marker:opacity-100 transition-opacity"
                        />
                      </g>
                    ))}
                  </svg>
                </div>

                {/* X Axis Labels */}
                <div className="absolute left-0 right-0 bottom-0 flex justify-between px-10 text-[0.65rem] font-bold font-[var(--font-label)] text-[var(--color-on-surface-variant)]">
                  {trends.map((pt) => (
                    <span key={pt.label}>{pt.label}</span>
                  ))}
                </div>
              </div>

              {/* Peak Indicator */}
              <div className="mt-8 p-4 bg-[var(--color-surface-container-low)] rounded-xl flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--color-primary)]">info</span>
                <p className="text-xs font-[var(--font-label)] text-[var(--color-on-surface-variant)]">
                  Volumen pico registrado en la franja <span className="font-bold text-[var(--color-on-surface)]">{peakItem.label}</span> con un total de <span className="font-bold text-[var(--color-primary)]">{peakItem.entries} entradas</span> y <span className="font-bold text-[var(--color-tertiary)]">{peakItem.exits} salidas</span>.
                </p>
              </div>
            </div>
          </div>

          {/* Lower Detail Section */}
          <div className="w-full">
            {/* Dynamic Audit Log */}
            <div className="card-padded flex flex-col justify-between">
              <div>
                <h3 className="font-[var(--font-headline)] font-extrabold text-[var(--color-on-surface)] mb-4">Log de Auditoría de Accesos</h3>
                <div className="space-y-1.5">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => {
                      const isSuccess = log.status;
                      const isExitLog = log.zone.toLowerCase().includes("salida");
                      
                      const icon = isSuccess ? (isExitLog ? "logout" : "login") : "warning";
                      const bg = isSuccess 
                        ? (isExitLog ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800")
                        : "bg-red-100 text-red-800";
                      const title = isSuccess 
                        ? `Acceso Concedido: ${log.plate}`
                        : `Acceso Denegado: ${log.plate}`;
                      const sub = `${log.zone} • Método: ${log.method} • Tipo: ${log.userType}`;
                      
                      // Format simple time
                      const timeStr = new Intl.DateTimeFormat('es-CO', {
                        timeZone: 'America/Bogota',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      }).format(log.timestamp);

                      return (
                        <div key={log.id} className="flex items-center justify-between py-2.5 hover:bg-[var(--color-surface-container-low)] px-3 rounded-lg transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center`}>
                              <span className="material-symbols-outlined text-sm">{icon}</span>
                            </div>
                            <div>
                              <p className="text-xs font-[var(--font-headline)] font-bold text-[var(--color-on-surface)]">{title}</p>
                              <p className="text-[0.65rem] font-[var(--font-label)] text-[var(--color-on-surface-variant)]">{sub}</p>
                            </div>
                          </div>
                          <span className="text-[0.65rem] font-[var(--font-label)] font-bold text-[var(--color-on-surface-variant)]">{timeStr}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs italic text-[var(--color-on-surface-variant)] py-4 text-center">No hay registros de auditoría recientes.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
