import { NextRequest, NextResponse } from "next/server";
import prisma from "@parqueadero/database";
import type { AccessLog } from "../../../../generated/prisma/client";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Normaliza valores históricos sucios de userType a etiquetas canónicas
// ---------------------------------------------------------------------------
function normalizeUserType(raw: string | null): string {
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
  if (t.includes("estudiante/personal") || t === "estudiante/personal") return "Personal";
  return raw ?? "Desconocido";
}

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
  // Enriquecer con nombre del propietario — batch (4 queries totales)
  // -------------------------------------------------------------------------
  const plates = [...new Set(
    filteredLogs.map((r: AccessLog) => r.plate).filter((p) => p && p !== "UNKNOWN")
  )];

  const [batchVehicles, batchAccessReqs, batchUserRegs] = await Promise.all([
    prisma.vehicle.findMany({
      where: { plate: { in: plates } },
      include: { owner: true },
    }),
    prisma.accessRequest.findMany({
      where: { plateNumber: { in: plates }, status: "APPROVED" },
      orderBy: { visitDate: "desc" },
    }),
    prisma.userRegistration.findMany({
      where: { plate: { in: plates }, status: "APROBADO" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const cardnumbers = batchVehicles
    .filter((v) => v.owner?.cardnumber)
    .map((v) => v.owner!.cardnumber!);

  const ownerRegs = cardnumbers.length > 0
    ? await prisma.userRegistration.findMany({
        where: { institutionalCode: { in: cardnumbers }, status: "APROBADO" },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Mapas O(1)
  const vehicleMap    = new Map(batchVehicles.map((v) => [v.plate, v]));
  const accessReqMap  = new Map<string, typeof batchAccessReqs[0]>();
  batchAccessReqs.forEach((r) => { if (!accessReqMap.has(r.plateNumber)) accessReqMap.set(r.plateNumber, r); });
  const userRegByPlate = new Map<string, typeof batchUserRegs[0]>();
  batchUserRegs.forEach((r) => { if (r.plate && !userRegByPlate.has(r.plate)) userRegByPlate.set(r.plate, r); });
  const ownerRegByCode = new Map<string, typeof ownerRegs[0]>();
  ownerRegs.forEach((r) => { if (r.institutionalCode && !ownerRegByCode.has(r.institutionalCode)) ownerRegByCode.set(r.institutionalCode, r); });

  const enriched = filteredLogs.map((row: AccessLog) => {
    let ownerName = "Desconocido";

    if (row.plate && row.plate !== "UNKNOWN") {
      const vehicle = vehicleMap.get(row.plate);

      if (vehicle?.owner) {
        ownerName = `${vehicle.owner.firstname} ${vehicle.owner.surname}`.trim();
      } else {
        const accessReq = accessReqMap.get(row.plate);
        if (accessReq) {
          ownerName = accessReq.requesterName;
        } else {
          const reg = userRegByPlate.get(row.plate);
          if (reg) ownerName = reg.fullName;
        }
      }
    }

    return {
      id:        row.id,
      timestamp: row.timestamp.toISOString(),
      plate:     row.plate,
      ownerName,
      userType:  normalizeUserType(row.userType),
      zone:      row.zone,
      status:    row.status ? "PERMITIDO" : "DENEGADO",
      reason:    row.reason || "",
      method:    row.method || "MANUAL",
    };
  });

  return NextResponse.json(enriched);
}
