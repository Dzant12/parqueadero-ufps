"use server";

/**
 * @file actions.ts
 * @description Módulo de Acciones de Servidor (Server Actions) globales de Next.js.
 * Este archivo implementa el puente de comunicación directa ("use server") entre los componentes
 * de cliente del frontend y la capa de base de datos de Prisma en el backend.
 * 
 * ### Funcionalidades Críticas de Negocio:
 * 1. **Verificación de Placas (`verifyPlate`)**: Valida permisos activos, dobles ingresos/salidas (Anti-Passback)
 *    y recupera en cascada los carnets digitales asociados (estudiantes, visitantes o radicados pendientes).
 * 2. **Registro de Bitácora (`registerAccess`)**: Inserta eventos en la base de datos y fuerza la purga de
 *    caché de páginas de Next.js (`revalidatePath`) para reflejar instantáneamente el tráfico en el dashboard.
 * 3. **Gestión de Solicitudes (`updateAccessRequestStatus`)**: Aprueba o rechaza solicitudes de visitantes,
 *    mapea dinámicamente tarjetas RFID físicas a invitados mediante Upserts en la base de datos, y desencadena
 *    notificaciones por correo electrónico personalizadas en caso de rechazo del trámite.
 * 
 * @module frontend/app/actions
 * @see {@link https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations}
 */

import prisma from "@parqueadero/database";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/lib/email";
import { guestRejectedEmailHtml } from "@/lib/email-templates";

/**
 * Realiza una consulta analítica y de seguridad de una placa vehicular en el campus.
 * Valida la consistencia de Anti-Passback para evitar accesos redundantes y consulta en cascada
 * el tipo de usuario e identificaciones digitales.
 * 
 * @async
 * @function verifyPlate
 * @param {string} plate - Placa del vehículo a evaluar (Ej: "PRK-8821").
 * @param {string} [zone] - Zona física en donde se solicita el ingreso/salida para Anti-Passback (Ej: "Entrada Principal").
 * 
 * @returns {Promise<Object>} Resultado estructurado indicando el estado de autorización:
 * - Si es denegado: `{ status: "unauthorized", reason: string }`
 * - Si es concedido: `{ status: "authorized", type: string, ownerName: string, carnetUrl: string | null }`
 */
export async function verifyPlate(plate: string, zone?: string) {
  
  // ---------------------------------------------------------------------------
  // LÓGICA DE PREVENCIÓN DE DOBLE ACCESO (ANTI-PASSBACK SIMPLIFICADO)
  // Evalúa cronológicamente si el vehículo intenta ingresar o salir de forma consecutiva
  // sin alternar el estado físico, evitando que colados usen registros ajenos.
  // ---------------------------------------------------------------------------
  if (zone) {
    const lastAccess = await prisma.accessLog.findFirst({
      where: { plate, status: true },
      orderBy: { timestamp: "desc" }
    });
    
    if (lastAccess) {
      const isEntering = zone.toLowerCase().includes("entrada");
      const wasEntering = lastAccess.zone.toLowerCase().includes("entrada");
      
      if (isEntering && wasEntering) {
        return { status: "unauthorized", reason: "El vehículo ya se encuentra dentro del parqueadero." };
      }
      
      const isExiting = zone.toLowerCase().includes("salida");
      const wasExiting = lastAccess.zone.toLowerCase().includes("salida");
      
      if (isExiting && wasExiting) {
         return { status: "unauthorized", reason: "El vehículo no se encuentra dentro del parqueadero." };
      }
    } else if (zone.toLowerCase().includes("salida")) {
      // Intento de salida de un vehículo que nunca ha ingresado
      return { status: "unauthorized", reason: "El vehículo no se encuentra dentro del parqueadero (sin registro previo)." };
    }
  }

  // ---------------------------------------------------------------------------
  // PASO 1: Búsqueda de Miembros Institucionales Registrados
  // ---------------------------------------------------------------------------
  const vehicle = await prisma.vehicle.findUnique({
    where: { plate },
    include: { owner: true }
  });

  if (vehicle) {
    if (vehicle.status.toLowerCase().includes("activo")) {
      let carnetUrl = null;
      
      // Cascading lookup del carnet digitalizado en las solicitudes de aprobación del estudiante
      if (vehicle.owner) {
        const reg = await prisma.userRegistration.findFirst({
          where: {
            OR: [
              { institutionalCode: vehicle.owner.cardnumber },
              { plate: vehicle.plate }
            ],
            status: "APROBADO"
          },
          orderBy: { createdAt: "desc" }
        });
        if (reg) {
          carnetUrl = reg.carnetFilePath;
        }
      }
      
      // Fallback a búsqueda exclusiva por placa si el propietario no tiene carnet indexado
      if (!carnetUrl) {
        const reg = await prisma.userRegistration.findFirst({
          where: { plate: vehicle.plate },
          orderBy: { createdAt: "desc" }
        });
        if (reg) {
          carnetUrl = reg.carnetFilePath;
        }
      }
      
      // Resolución del tipo real a partir del userType del propietario o del vehículo
      let resolvedType = "Personal";
      const ownerType = vehicle.owner?.userType?.trim().toLowerCase();
      if (ownerType) {
        if (ownerType.includes("estudiante")) resolvedType = "Estudiante";
        else if (ownerType.includes("docente") || ownerType.includes("facultad") || ownerType.includes("profesor")) resolvedType = "Docente";
        else if (ownerType.includes("admin") || ownerType.includes("personal") || ownerType.includes("administrativo")) resolvedType = "Administrativo";
      } else if (vehicle.department === "Visitante Temporal") {
        resolvedType = "Visitante";
      }

      return { 
        status: "authorized", 
        type: resolvedType, 
        ownerName: vehicle.owner ? `${vehicle.owner.firstname} ${vehicle.owner.surname}` : "Desconocido",
        carnetUrl
      };
    } else {
      // El vehículo está registrado pero se encuentra suspendido o inactivo
      return { status: "unauthorized", reason: `Vehículo con estado: ${vehicle.status}` };
    }
  }

  // ---------------------------------------------------------------------------
  // PASO 2: Búsqueda de Solicitudes de Visitantes Temporales Aprobadas para Hoy
  // ---------------------------------------------------------------------------
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const guestRequest = await prisma.accessRequest.findFirst({
    where: {
      plateNumber: plate,
      status: "APPROVED",
      visitDate: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  if (guestRequest) {
    return { 
      status: "authorized", 
      type: "Visitante", 
      ownerName: guestRequest.requesterName, 
      carnetUrl: guestRequest.hostCarnetPath // Retorna el carnet del docente anfitrión por seguridad
    };
  }

  // ---------------------------------------------------------------------------
  // PASO 3: Resguardo Final (Pre-registro de usuarios aprobado)
  // Maneja situaciones transicionales donde el vehículo fue aprobado pero el script
  // de sync no lo ha persistido en la tabla Vehicle.
  // ---------------------------------------------------------------------------
  const registration = await prisma.userRegistration.findFirst({
    where: {
      plate: plate,
      status: "APROBADO"
    }
  });

  if (registration) {
    return { 
      status: "authorized", 
      type: registration.userType, 
      ownerName: registration.fullName, 
      carnetUrl: registration.carnetFilePath 
    };
  }

  // CASO POR DEFECTO: El vehículo no existe ni tiene solicitudes vigentes
  return { status: "unauthorized", reason: "Vehículo no registrado o sin autorización vigente." };
}

/**
 * Registra de forma definitiva un evento de entrada o salida de la portería en la bitácora.
 * Vuelve a validar la invariante de Anti-Passback antes de la inserción transaccional por seguridad
 * y purga las cachés del lado del servidor de Next.js para reflejar los datos en tiempo real.
 * 
 * @async
 * @function registerAccess
 * @param {string} plate - Placa vehicular asociada (Ej: "PRK-8821").
 * @param {boolean} granted - Estado del acceso (true = Aprobado, false = Denegado).
 * @param {string} userType - Tipo de usuario conductor (Ej: "Estudiante").
 * @param {string} zone - Punto de control del portón (Ej: "Entrada Principal").
 * 
 * @returns {Promise<void>}
 * @throws {Error} Si el registro viola el flujo lógico de Anti-Passback para accesos permitidos.
 */
export async function registerAccess(plate: string, granted: boolean, userType: string, zone: string, reason?: string) {
  
  // Re-validación estricta de Anti-Passback previo a la escritura final
  if (granted) {
    const lastAccess = await prisma.accessLog.findFirst({
      where: { plate, status: true },
      orderBy: { timestamp: "desc" }
    });

    if (lastAccess) {
      const isEntering = zone.toLowerCase().includes("entrada");
      const wasEntering = lastAccess.zone.toLowerCase().includes("entrada");
      
      if (isEntering && wasEntering) {
        throw new Error("El vehículo ya se encuentra dentro del parqueadero.");
      }
      
      const isExiting = zone.toLowerCase().includes("salida");
      const wasExiting = lastAccess.zone.toLowerCase().includes("salida");
      
      if (isExiting && wasExiting) {
        throw new Error("El vehículo no se encuentra dentro del parqueadero.");
      }
    } else if (zone.toLowerCase().includes("salida")) {
      throw new Error("El vehículo no se encuentra dentro del parqueadero (sin registro previo).");
    }
  }

  // Persistencia del evento en base de datos
  await prisma.accessLog.create({
    data: {
      plate,
      status: granted,
      userType,
      zone,
      reason,
    }
  });

  // Purgado selectivo de la memoria caché de Next.js.
  // Esto obliga al App Router a re-evaluar y re-renderizar los Server Components asociados
  // a la visualización del dashboard y el visor de reportes.
  revalidatePath("/");
  revalidatePath("/reports");
}

/**
 * Actualiza el estado administrativo de una solicitud de acceso temporal de visitantes externos.
 * Si se aprueba e incluye un TAG RFID físico, aprovisiona de forma dinámica el tag al vehículo
 * mediante un patrón Upsert. Si se rechaza, notifica de inmediato vía email institucional al docente anfitrión.
 * 
 * @async
 * @function updateAccessRequestStatus
 * @param {number} id - Identificador de la solicitud en la base de datos.
 * @param {string} status - Nuevo estado de la solicitud (Ej: "APROBADO", "RECHAZADO").
 * @param {string} [rfidTag] - UID de tarjeta física RFID provista por el guardia en la portería.
 * @param {string} [rejectionReason] - Explicación libre del motivo de denegación de la visita.
 * 
 * @returns {Promise<Object>} Estado de la operación `{ success: boolean, error?: string, emailError?: string }`.
 */
export async function updateAccessRequestStatus(id: number, status: string, rfidTag?: string, rejectionReason?: string) {
  try {
    const request = await prisma.accessRequest.findUnique({ where: { id } });
    if (!request) return { success: false, error: "Solicitud no encontrada." };

    // Actualización del estado básico del trámite
    await prisma.accessRequest.update({
      where: { id },
      data: { status }
    });

    // --- Aprovisionamiento Automático de TAG RFID para Invitado Aprobado ---
    if ((status === "APROBADO" || status === "APPROVED") && rfidTag) {
      const normalizedTag = rfidTag.trim().toUpperCase();
      
      // Upsert: Registra o actualiza el vehículo temporal del visitante vinculando el TAG físico.
      // Esto permite que el invitado pueda entrar/salir de forma automatizada usando el lector inalámbrico.
      await prisma.vehicle.upsert({
        where: { plate: request.plateNumber },
        update: {
          rfidTag: normalizedTag,
          status: "Activo",
          department: "Visitante Temporal",
          brand: "VISITANTE",
          model: "TEMPORAL",
          color: "Gris",
          icon: "directions_car"
        },
        create: {
          plate: request.plateNumber,
          rfidTag: normalizedTag,
          status: "Activo",
          department: "Visitante Temporal",
          brand: "VISITANTE",
          model: "TEMPORAL",
          color: "Gris",
          icon: "directions_car"
        }
      });
    }

    let emailError: string | undefined;

    // --- Notificación de Rechazo vía Email al Anfitrión ---
    if (status === "RECHAZADO" && request.hostCode) {
      const host = await prisma.student.findUnique({
        where: { cardnumber: request.hostCode }
      });
      
      if (host) {
        // Mapeo prioritario de correo institucional @ufps.edu.co del docente o administrativo
        const ufpsEmail = host.email?.endsWith("@ufps.edu.co") 
          ? host.email 
          : (host.emailpro?.endsWith("@ufps.edu.co") ? host.emailpro : host.email ?? host.emailpro);
        
        if (ufpsEmail) {
          try {
            await sendMail({
              to: ufpsEmail,
              subject: "❌ Solicitud de visitante rechazada",
              html: guestRejectedEmailHtml({
                guestName: request.requesterName,
                hostName: `${host.firstname} ${host.surname}`.trim(),
                plate: request.plateNumber,
                rejectionReason
              })
            });
          } catch (err) {
            console.error("[sendMail] Error sending guest rejection:", err);
            emailError = "Estado actualizado, pero hubo un error enviando el correo al anfitrión.";
          }
        }
      }
    }

    // Fuerza la actualización de caché de Next.js para rutas administrativas
    revalidatePath("/requests");
    revalidatePath("/vehicles");
    
    return { success: true, emailError };
  } catch (error) {
    console.error("Error updating access request status:", error);
    return { success: false, error: "No se pudo actualizar el estado de la solicitud o asignar el TAG." };
  }
}
