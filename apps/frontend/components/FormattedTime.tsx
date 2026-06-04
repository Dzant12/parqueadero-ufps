"use client";

interface FormattedTimeProps {
  date: Date | string;
  className?: string;
  showDate?: boolean;
}

/**
 * Muestra fechas/horas siempre en la zona horaria de Bogotá (UTC-5),
 * independientemente del timezone del servidor o del navegador del usuario.
 * suppressHydrationWarning evita errores de hidratación entre SSR y cliente.
 */
export default function FormattedTime({ date, className, showDate = false }: FormattedTimeProps) {
  const d = new Date(date);

  const TZ = "America/Bogota";

  const formatted = showDate
    ? d.toLocaleDateString("es-CO", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }) +
      " " +
      d.toLocaleTimeString("es-CO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })
    : d.toLocaleTimeString("es-CO", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <span className={className} suppressHydrationWarning>
      {formatted}
    </span>
  );
}
