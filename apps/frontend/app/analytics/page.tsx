export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Campus ParkGuard - Panel de Analíticas",
  description: "Métricas de flujo y capacidad en tiempo real para el estacionamiento del campus",
};

import prisma from "@parqueadero/database";

export default async function AnalyticsPage() {
  const totalVehicles = await prisma.vehicle.count();
  const pendingRequests = await prisma.accessRequest.count({
    where: { status: "PENDING" },
  });

  const logs = await prisma.accessLog.findMany();
  const userTypeDistribution = logs.reduce((acc: Record<string, number>, log: { userType: string }) => {
    acc[log.userType] = (acc[log.userType] || 0) + 1;
    return acc;
  }, {});

  const totalLogs = logs.length || 1;
  const distribution = (Object.entries(userTypeDistribution) as [string, number][]).map(([label, count]) => ({
    label,
    pct: Math.round((count / totalLogs) * 100),
    color: label === "Student" ? "bg-[var(--color-primary)]" : "bg-[var(--color-primary-container)]",
  }));

  return (
    <div className="page-wrapper space-y-8">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Analíticas de Operaciones</h2>
          <p className="page-subtitle">Métricas de capacidad y tráfico en tiempo real</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4 xl:mt-0">
          <div className="flex bg-[var(--color-surface-container)] rounded-lg p-1 w-full sm:w-auto">
            <button className="flex-1 px-4 py-1.5 text-xs font-bold bg-[var(--color-surface-container-lowest)] shadow-sm rounded-md text-[var(--color-primary)]">Hoy</button>
            <button className="flex-1 px-4 py-1.5 text-xs font-bold text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">Semana</button>
            <button className="flex-1 px-4 py-1.5 text-xs font-bold text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]">Mes</button>
          </div>
          <select className="bg-[var(--color-surface-container-low)] border-none rounded-lg text-xs font-bold py-2 pr-8 pl-4 text-[var(--color-on-surface)] focus:ring-[var(--color-primary)]/20 w-full sm:w-auto">
            <option>Todos los Tipos de Usuario</option>
            <option>Estudiante</option>
            <option>Facultad</option>
            <option>Personal</option>
            <option>Visitante</option>
          </select>
          <button className="flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-on-surface)] text-[var(--color-surface)] rounded-lg font-bold text-xs hover:opacity-90 transition-all w-full sm:w-auto">
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            Generar Reporte PDF
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { label: "Capacidad Total", value: "4,850", sub: "Espacios", bar: 100, extraColor: "" },
          { label: "Ocupación Actual", value: `${Math.round((totalVehicles / 4850) * 100)}%`, sub: `${totalVehicles} Vehículos`, bar: Math.round((totalVehicles / 4850) * 100), extraColor: "text-[var(--color-primary)] font-bold" },
          { label: "Ingresos Diarios", value: "$0.00", sub: "Integración Pendiente", bar: null, extraColor: "text-green-600 font-bold" },
          { label: "Solicitudes Pendientes", value: pendingRequests.toString(), sub: null, badge: "Acción Necesaria", bar: null },
        ].map((card) => (
          <div key={card.label} className="card-padded flex flex-col gap-1">
            <span className="font-[var(--font-label)] text-xs font-semibold text-[var(--color-on-surface-variant)] uppercase tracking-wider">{card.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-[var(--font-headline)] font-black text-[var(--color-on-surface)]">{card.value}</span>
              {card.sub && <span className={`text-[0.65rem] font-[var(--font-label)] ${card.extraColor || "text-[var(--color-on-surface-variant)]"}`}>{card.sub}</span>}
              {card.badge && (
                <span className="badge badge-warning">{card.badge}</span>
              )}
            </div>
            {card.bar !== null && (
              <div className="mt-4 w-full bg-[var(--color-surface-container-high)] h-1.5 rounded-full overflow-hidden">
                <div className="bg-[var(--color-primary)] h-full" style={{ width: `${card.bar}%` }} />
              </div>
            )}
            {card.label === "Ingresos Diarios" && (
              <div className="mt-4 flex items-center gap-1">
                <span className="material-symbols-outlined text-green-600 text-sm">trending_up</span>
                <span className="text-xs font-[var(--font-label)] text-[var(--color-on-surface-variant)]">Precio por hora pico activo</span>
              </div>
            )}
            {card.label === "Solicitudes Pendientes" && (
              <div className="mt-4 flex items-center gap-1">
                <span className="material-symbols-outlined text-[var(--color-tertiary)] text-sm">history</span>
                <span className="text-xs font-[var(--font-label)] text-[var(--color-on-surface-variant)]">Respuesta prom.: 12 min</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Analytical Visuals (Bento) */}
      <div className="bento-grid">
        {/* Usage by User Type */}
        <div className="col-span-12 xl:col-span-5 card-padded !p-8">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="font-[var(--font-headline)] font-extrabold text-[var(--color-on-surface)]">Uso por Tipo de Usuario</h3>
              <p className="font-[var(--font-label)] text-xs text-[var(--color-on-surface-variant)] mt-1">Sesiones activas categorizadas</p>
            </div>
            <span className="material-symbols-outlined text-[var(--color-on-surface-variant)]">more_vert</span>
          </div>
          <div className="space-y-6">
            {distribution.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between font-[var(--font-label)] text-xs font-bold text-[var(--color-on-surface)]">
                  <span>{item.label}</span>
                  <span>{item.pct}%</span>
                </div>
                <div className="h-3 bg-[var(--color-surface-container-high)] rounded-sm overflow-hidden">
                  <div className={`${item.color} h-full`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 pt-6 border-t border-[var(--color-outline-variant)]/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[var(--color-primary)] rounded-full" />
              <span className="font-[var(--font-label)] text-[0.7rem] text-[var(--color-on-surface-variant)]">Residente Primario</span>
            </div>
            <button className="text-xs font-bold text-[var(--color-primary)] hover:underline">Ver detalles</button>
          </div>
        </div>

        {/* Traffic Trends */}
        <div className="col-span-12 xl:col-span-7 card-padded !p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="font-[var(--font-headline)] font-extrabold text-[var(--color-on-surface)]">Tráfico de Estacionamiento</h3>
              <p className="font-[var(--font-label)] text-xs text-[var(--color-on-surface-variant)] mt-1">Entradas vs salidas por hora</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full" />
                <span className="text-[0.65rem] font-bold font-[var(--font-label)] text-[var(--color-on-surface-variant)]">ENTRADAS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[var(--color-outline-variant)] rounded-full" />
                <span className="text-[0.65rem] font-bold font-[var(--font-label)] text-[var(--color-on-surface-variant)]">SALIDAS</span>
              </div>
            </div>
          </div>
          <div className="relative h-64 w-full flex items-end justify-between px-2">
            <div className="absolute inset-0 flex items-end">
              <svg className="w-full h-full opacity-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path className="text-[var(--color-primary)]" d="M0 100 L10 80 L20 85 L30 40 L40 50 L50 20 L60 30 L70 10 L80 40 L90 20 L100 50 L100 100 Z" fill="currentColor" />
              </svg>
            </div>
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0,1,2,3].map(i => <div key={i} className="w-full border-t border-[var(--color-outline-variant)]/15" />)}
            </div>
            <div className="relative flex-1 flex justify-around items-end h-full z-10">
              {[
                { time: "08:00", mb: "mb-24" },
                { time: "10:00", mb: "mb-48" },
                { time: "12:00", mb: "mb-32" },
                { time: "14:00", mb: "mb-56" },
                { time: "16:00", mb: "mb-20" },
                { time: "18:00", mb: "mb-12" },
              ].map((pt) => (
                <div key={pt.time} className="group relative flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full bg-[var(--color-primary)] ${pt.mb} group-hover:scale-150 transition-all`} />
                  <span className="text-[0.65rem] font-[var(--font-label)] text-[var(--color-on-surface-variant)] mt-4">{pt.time}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 p-4 bg-[var(--color-surface-container-low)] rounded-lg flex items-center gap-4">
            <span className="material-symbols-outlined text-[var(--color-primary)]">info</span>
            <p className="text-xs font-[var(--font-label)] text-[var(--color-on-surface-variant)]">
              Volumen pico detectado a las <span className="font-bold text-[var(--color-on-surface)]">14:22</span> con 420 vehículos ingresando por hora. Recomendación: Abrir Portón Auxiliar 4.
            </p>
          </div>
        </div>
      </div>

      {/* Lower Detail Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Critical Audit Log */}
        <div className="col-span-1 md:col-span-2 card-padded">
          <h3 className="font-[var(--font-headline)] font-extrabold text-[var(--color-on-surface)] mb-6">Log de Auditoría Crítica</h3>
          <div className="space-y-2">
            {[
              { icon: "login", bg: "bg-[var(--color-primary-container)]/20", iconColor: "text-[var(--color-primary)]", title: "Placa ABC-1234 Ingresó", sub: "Zona B • Permiso de Personal", time: "14:52:10" },
              { icon: "warning", bg: "bg-[var(--color-error-container)]/20", iconColor: "text-[var(--color-error)]", title: "Intento de Entrada no Autorizado", sub: "Portón 2 • Placa OCULTA", time: "14:51:04" },
              { icon: "pending", bg: "bg-[var(--color-tertiary-container)]/20", iconColor: "text-[var(--color-tertiary)]", title: "Acceso de Invitado Solicitado", sub: "Kiosco de Visitantes 1", time: "14:50:55" },
            ].map((log) => (
              <div key={log.title} className="flex items-center justify-between py-3 hover:bg-[var(--color-surface-container-low)] px-3 rounded-lg transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg ${log.bg} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined ${log.iconColor} text-sm`}>{log.icon}</span>
                  </div>
                  <div>
                    <p className="text-xs font-[var(--font-headline)] font-bold text-[var(--color-on-surface)]">{log.title}</p>
                    <p className="text-[0.65rem] font-[var(--font-label)] text-[var(--color-on-surface-variant)]">{log.sub}</p>
                  </div>
                </div>
                <span className="text-[0.65rem] font-[var(--font-label)] font-bold text-[var(--color-on-surface-variant)]">{log.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zone Distribution */}
        <div className="card overflow-hidden relative group">
          <img
            className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDlptLvH73sWKcRhNuVqohWf8h1PZeMQI_Db317ARTYS7txZ5KNzE9Oefb0xoXJRp-lovE9uc556ddvsog_xLxTdh_Md4Go-awPgjR70-Ogi9nk1p6pbRIyLxnYakxTVGk-UjILQX0nqhI73HbwRGpp-LpHTVVgZXbj96-WDOKqkYjIi1p2dFunvMlMgsxaW7gCutr3VR4H3Dtiyr3uoK8CcokCZn8K_xeipwV4YMmXhvamtgKyDh5fSgQHyb_zT1zaDDm7j2fYLykF"
            alt="Campus map"
          />
          <div className="relative z-10 p-6">
            <h3 className="font-[var(--font-headline)] font-extrabold text-[var(--color-on-surface)] mb-1">Distribución por Zonas</h3>
            <p className="font-[var(--font-label)] text-[0.65rem] text-[var(--color-on-surface-variant)] mb-6">Mapa de calor en vivo del campus</p>
            <div className="space-y-3">
              {[
                { label: "Facultad Norte (Lote A)", pct: "95%", cls: "badge-primary" },
                { label: "Estudiantes Central (Lote B)", pct: "78%", cls: "badge-primary" },
                { label: "Comunes Visitantes (Lote C)", pct: "42%", cls: "badge-success" },
                { label: "Estadio Sur (Lote D)", pct: "12%", cls: "badge-success" },
              ].map((zone) => (
                <div key={zone.label} className="flex justify-between items-center text-[0.65rem] font-[var(--font-label)]">
                  <span className="font-bold text-[var(--color-on-surface)]">{zone.label}</span>
                  <span className={`badge ${zone.cls}`}>{zone.pct} Lleno</span>
                </div>
              ))}
            </div>
            <button className="mt-8 w-full py-2 bg-[var(--color-surface-container-lowest)]/60 backdrop-blur-sm border border-[var(--color-outline-variant)]/30 rounded-lg text-xs font-bold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-container-lowest)] transition-colors">
              Expandir Mapa en Vivo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
