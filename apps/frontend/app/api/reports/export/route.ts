import { NextRequest, NextResponse } from "next/server";
import prisma from "@parqueadero/database";
import type { AccessLog } from "../../../../generated/prisma/client";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Obtiene la hora en Bogotá (0-23) a partir de un Date UTC
// Colombia es siempre UTC-5, sin horario de verano → aritmética directa
// ---------------------------------------------------------------------------
function getBogotaHour(date: Date): number {
  return new Date(date.getTime() - 5 * 60 * 60 * 1000).getUTCHours();
}

// ---------------------------------------------------------------------------
// Comprueba si un Date cae dentro del turno solicitado
//   manana : 06:00 – 11:59
//   tarde  : 12:00 – 17:59
//   noche  : 18:00 – 05:59
// ---------------------------------------------------------------------------
function matchesShift(date: Date, shift: string): boolean {
  const h = getBogotaHour(date);
  if (shift === "manana") return h >= 6 && h <= 11;
  if (shift === "tarde")  return h >= 12 && h <= 17;
  if (shift === "noche")  return h >= 18 || h <= 5;
  return true;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const plateQuery    = searchParams.get("plate")    || undefined;
  const dateFromQuery = searchParams.get("dateFrom") || undefined;
  const dateToQuery   = searchParams.get("dateTo")   || undefined;
  const zoneQuery     = searchParams.get("zone")     || undefined;
  const shiftQuery    = searchParams.get("shift")    || undefined;

  // -------------------------------------------------------------------------
  // Cláusula WHERE de Prisma (filtros que soporta la BD)
  // -------------------------------------------------------------------------
  const whereClause: import("../../../../generated/prisma/client").Prisma.AccessLogWhereInput = {};

  if (plateQuery) {
    whereClause.plate = { contains: plateQuery, mode: "insensitive" };
  }

  if (zoneQuery && zoneQuery !== "all") {
    whereClause.zone = { contains: zoneQuery, mode: "insensitive" };
  }

  if (dateFromQuery || dateToQuery) {
    whereClause.timestamp = {};
    if (dateFromQuery) {
      whereClause.timestamp.gte = new Date(`${dateFromQuery}T00:00:00.000-05:00`);
    }
    if (dateToQuery) {
      whereClause.timestamp.lte = new Date(`${dateToQuery}T23:59:59.999-05:00`);
    }
  }

  // -------------------------------------------------------------------------
  // Traer todos los registros y aplicar filtro de turno en memoria
  // -------------------------------------------------------------------------
  const logs = await prisma.accessLog.findMany({
    where: whereClause,
    orderBy: { timestamp: "desc" },
  });

  const filteredLogs =
    shiftQuery && shiftQuery !== "all"
      ? logs.filter((row: AccessLog) => matchesShift(row.timestamp, shiftQuery))
      : logs;

  // -------------------------------------------------------------------------
  // Enriquecer con nombre del propietario
  // -------------------------------------------------------------------------
  const enriched = await Promise.all(
    filteredLogs.map(async (row: AccessLog) => {
      let ownerName = "Desconocido";

      if (row.plate && row.plate !== "UNKNOWN") {
        const vehicle = await prisma.vehicle.findUnique({
          where: { plate: row.plate },
          include: { owner: true },
        });

        if (vehicle?.owner) {
          ownerName = `${vehicle.owner.firstname} ${vehicle.owner.surname}`.trim();
        } else {
          const guestRequest = await prisma.accessRequest.findFirst({
            where: { plateNumber: row.plate, status: "APPROVED" },
            orderBy: { visitDate: "desc" },
          });
          if (guestRequest) {
            ownerName = guestRequest.requesterName;
          } else {
            const reg = await prisma.userRegistration.findFirst({
              where: { plate: row.plate, status: "APROBADO" },
              orderBy: { createdAt: "desc" },
            });
            if (reg) ownerName = reg.fullName;
          }
        }
      }

      return {
        id:        row.id,
        timestamp: row.timestamp.toISOString(),
        plate:     row.plate,
        ownerName,
        userType:  row.userType || "",
        zone:      row.zone,
        status:    row.status ? "PERMITIDO" : "DENEGADO",
        reason:    row.reason || "",
        method:    row.method || "MANUAL",
      };
    })
  );

  return NextResponse.json(enriched);
}
