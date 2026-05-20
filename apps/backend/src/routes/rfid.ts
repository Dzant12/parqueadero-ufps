/**
 * @file rfid.ts
 * @description Enrutador y controlador de lógica central para el control de acceso RFID.
 * Administra las comunicaciones provenientes de lectores de hardware ESP32 (físicos o simulados),
 * procesa las autorizaciones en tiempo real, mantiene una máquina de estados para detectar
 * e impedir el fraude por doble entrada/salida (Anti-Passback simplificado), y expone
 * endpoints para que el frontend obtenga eventos recientes por polling y resuelva carnets digitales.
 * 
 * ### Aspectos Arquitectónicos Clave:
 * 1. **Emulación de Hardware Único (`globalActiveZone`)**: Diseñado para soportar laboratorios o despliegues
 *    donde solo se cuenta con una placa física de lectura ESP32, permitiendo alternar virtualmente su rol
 *    como lector de "Entrada" o "Salida" desde la consola web.
 * 2. **Lógica de Prevención de Doble Acceso (State Machine)**: Analiza el historial cronológico para impedir
 *    que un vehículo registrado entre dos veces consecutivas sin registrar una salida intermedia (o viceversa).
 * 3. **Algoritmo de Resolución de Carnet Digital**: Resuelve en cascada la ruta de la fotografía del carnet de
 *    estudiante, de anfitrión docente o de registro temporal, para visualizar en tiempo real el perfil
 *    del conductor en las pantallas de seguridad del vigilante.
 * 
 * @module backend/routes/rfid
 * @requires express
 * @requires @parqueadero/database
 */

import { Router, Request, Response } from "express";
import prisma from "@parqueadero/database";

const router = Router();

/**
 * Estado global en memoria para la emulación del lector único ESP32.
 * Permite cambiar si el lector físico simula estar en la zona de "Entrada Principal"
 * o "Salida Principal" del campus.
 * 
 * @type {"Entrada Principal" | "Salida Principal"}
 */
let globalActiveZone: "Entrada Principal" | "Salida Principal" = "Entrada Principal";

/**
 * GET /api/rfid/config
 * Recupera la configuración actual de emulación de portones del lector RFID físico.
 * 
 * @name GetRfidConfig
 * @route {GET} /api/rfid/config
 * @returns {Object} JSON conteniendo la zona activa global (`globalActiveZone`).
 */
router.get("/config", (req, res) => {
  res.json({ globalActiveZone });
});

/**
 * POST /api/rfid/toggle-zone
 * Modifica o alterna la zona de emulación activa para el lector de hardware único.
 * Si se envía una zona en el body, se establece de forma explícita; de lo contrario, se invierte el estado actual.
 * 
 * @name ToggleRfidZone
 * @route {POST} /api/rfid/toggle-zone
 * @body {string} [zone] - Zona específica a activar ("Entrada Principal" o "Salida Principal").
 * @returns {Object} JSON indicando éxito y la nueva zona activa resultante.
 */
router.post("/toggle-zone", (req, res) => {
  const { zone } = req.body;
  if (zone === "Salida Principal" || zone === "Entrada Principal") {
    globalActiveZone = zone;
    return res.json({ success: true, newZone: globalActiveZone });
  }
  globalActiveZone = globalActiveZone === "Entrada Principal" ? "Salida Principal" : "Entrada Principal";
  res.json({ success: true, newZone: globalActiveZone });
});

/**
 * POST /api/rfid/entrada
 * Endpoint atajo diseñado específicamente para peticiones que fuercen la "Entrada Principal"
 * como zona activa del lector actual, omitiendo verificaciones del body o estado global.
 * Redirige la ejecución a la lógica central de procesamiento RFID.
 * 
 * @name ShortcutEntrada
 * @route {POST} /api/rfid/entrada
 * @returns {Promise<void>} Procesa la petición a través de handleRfidLogic.
 */
router.post("/entrada", async (req: Request, res: Response) => {
  req.query.zone = "Entrada Principal";
  return handleRfidLogic(req, res);
});

/**
 * POST /api/rfid/salida
 * Endpoint atajo diseñado específicamente para peticiones que fuercen la "Salida Principal"
 * como zona activa del lector actual, omitiendo verificaciones del body o estado global.
 * Redirige la ejecución a la lógica central de procesamiento RFID.
 * 
 * @name ShortcutSalida
 * @route {POST} /api/rfid/salida
 * @returns {Promise<void>} Procesa la petición a través de handleRfidLogic.
 */
router.post("/salida", async (req: Request, res: Response) => {
  req.query.zone = "Salida Principal";
  return handleRfidLogic(req, res);
});

/**
 * POST /api/rfid
 * Endpoint principal de recepción de eventos de lectura de tarjetas RFID.
 * Empleado por dispositivos IoT del campus para registrar accesos.
 * 
 * @name MainRfidReceiver
 * @route {POST} /api/rfid
 * @returns {Promise<void>} Procesa la petición a través de handleRfidLogic.
 */
router.post("/", async (req: Request, res: Response) => {
  return handleRfidLogic(req, res);
});

/**
 * Lógica de negocio y verificación central del sistema RFID.
 * Ejecuta la autenticación de vehículos, comprueba validez de los permisos, evalúa las reglas
 * de prevención de doble acceso (Anti-Passback) y registra el evento en la base de datos.
 * 
 * @async
 * @function handleRfidLogic
 * @param {Request} req - Objeto de petición Express conteniendo la UID del tag y opcionalmente la zona.
 * @param {Response} res - Objeto de respuesta Express.
 * @returns {Promise<Response>} JSON detallando la autorización (`granted`), datos del vehículo, propietario y razones de rechazo.
 */
async function handleRfidLogic(req: Request, res: Response) {
  try {
    const { uid } = req.body;
    
    // --- Jerarquía de Resolución de Zona Activa ---
    // Resuelve la zona física del evento evaluando parámetros en orden de prioridad descendente:
    // 1. Parámetro forzado en Query string de Express (shortcuts `/entrada` o `/salida`).
    // 2. Parámetro en el Body de la petición (configuración de hardware multilector).
    // 3. Parámetro en Query de la petición original.
    // 4. Estado global de emulación del sistema.
    const zone = req.query.zone || req.body.zone;
    let activeZone: string = globalActiveZone; 
    
    // Normalización semántica de la zona recibida
    if (zone && typeof zone === "string") {
      if (zone.toLowerCase().includes("salida")) {
        activeZone = "Salida Principal";
      } else if (zone.toLowerCase().includes("entrada")) {
        activeZone = "Entrada Principal";
      } else {
        activeZone = zone; 
      }
    }

    // Validación sintáctica del UID provisto
    if (!uid || typeof uid !== "string") {
      return res.status(400).json({ granted: false, reason: "UID inválido o ausente." });
    }

    // Normaliza el formato de la UID para consistencia en bases de datos (Mayúsculas y sin espacios)
    const normalizedUid = uid.trim().toUpperCase();

    // --- Búsqueda del Vehículo en Base de Datos ---
    // Busca el vehículo asociado a la tarjeta RFID y recupera la información del propietario (Student)
    const vehicle = await prisma.vehicle.findUnique({
      where: { rfidTag: normalizedUid },
      include: { owner: true },
    });

    // CASO DE USO: Tarjeta RFID No Registrada en el Sistema
    if (!vehicle) {
      // Registra un log de acceso fallido con placa UNKNOWN por seguridad y auditoría
      const logEntry = await prisma.accessLog.create({
        data: {
          plate: "UNKNOWN",
          rfidTag: normalizedUid,
          userType: "Desconocido",
          zone: activeZone,
          status: false,
          method: "RFID",
        },
      });

      return res.json({ 
        granted: false, 
        reason: "TAG RFID no registrado en el sistema.",
        debug: { activeZone, logId: logEntry.id }
      });
    }

    // --- Resolución de Estados y Datos del Vehículo ---
    const isActive =
      vehicle.status === "Permiso Activo" ||
      vehicle.status === "ACTIVO" ||
      vehicle.status === "Activo";

    const isVisitor = vehicle.department === "Visitante Temporal";

    // Resuelve el nombre del conductor/propietario
    const ownerName = vehicle.owner
      ? `${vehicle.owner.firstname} ${vehicle.owner.surname}`
      : isVisitor ? "Invitado Externo" : "Propietario Genérico";

    // -------------------------------------------------------------------------
    // MÁQUINA DE ESTADOS: Lógica de Prevención de Doble Entrada/Salida (Anti-Passback)
    // Evita que múltiples vehículos ingresen en fila usando un solo tag, o que salgan
    // sin haber registrado un ingreso válido en el portón de entrada.
    // -------------------------------------------------------------------------
    const lastAccess = await prisma.accessLog.findFirst({
      where: { rfidTag: normalizedUid, status: true },
      orderBy: { timestamp: "desc" }
    });

    if (lastAccess) {
      const isEntering = activeZone.toLowerCase().includes("entrada");
      const wasEntering = lastAccess.zone.toLowerCase().includes("entrada");
      
      // FRAUD DETECTED: Intento de entrada consecutiva sin haber salido previamente
      if (isEntering && wasEntering) {
        const logEntry = await prisma.accessLog.create({
          data: {
            plate: vehicle.plate,
            rfidTag: normalizedUid,
            userType: isVisitor ? "Visitante" : "Estudiante/Personal",
            zone: activeZone,
            status: false,
            method: "RFID",
          },
        });
        return res.json({
          granted: false,
          plate: vehicle.plate,
          ownerName,
          status: vehicle.status,
          reason: "El vehículo ya se encuentra dentro del parqueadero.",
          debug: { activeZone, logId: logEntry.id }
        });
      }
      
      const isExiting = activeZone.toLowerCase().includes("salida");
      const wasExiting = lastAccess.zone.toLowerCase().includes("salida");
      
      // FRAUD DETECTED: Intento de salida consecutiva sin haber entrado previamente
      if (isExiting && wasExiting) {
        const logEntry = await prisma.accessLog.create({
          data: {
            plate: vehicle.plate,
            rfidTag: normalizedUid,
            userType: isVisitor ? "Visitante" : "Estudiante/Personal",
            zone: activeZone,
            status: false,
            method: "RFID",
          },
        });
        return res.json({
          granted: false,
          plate: vehicle.plate,
          ownerName,
          status: vehicle.status,
          reason: "El vehículo no se encuentra dentro del parqueadero.",
          debug: { activeZone, logId: logEntry.id }
        });
      }
    } else if (activeZone.toLowerCase().includes("salida")) {
      // ANOMALÍA: Intento de salida de un vehículo que nunca ha registrado ningún acceso exitoso
      const logEntry = await prisma.accessLog.create({
        data: {
          plate: vehicle.plate,
          rfidTag: normalizedUid,
          userType: isVisitor ? "Visitante" : "Estudiante/Personal",
          zone: activeZone,
          status: false,
          method: "RFID",
        },
      });
      return res.json({
        granted: false,
        plate: vehicle.plate,
        ownerName,
        status: vehicle.status,
        reason: "El vehículo no se encuentra dentro del parqueadero (sin registro previo).",
        debug: { activeZone, logId: logEntry.id }
      });
    }

    // --- Registro Definitivo del Evento de Acceso ---
    // Guarda el acceso en la bitácora relacionando la placa del vehículo, el método y la zona.
    const logEntry = await prisma.accessLog.create({
      data: {
        plate: vehicle.plate,
        rfidTag: normalizedUid,
        userType: isVisitor ? "Visitante" : "Estudiante/Personal",
        zone: activeZone,
        status: isActive,
        method: "RFID",
      },
    });

    // CASO DE USO: Vehículo registrado pero con Permiso Inactivo/Suspendido
    if (!isActive) {
      return res.json({
        granted: false,
        plate: vehicle.plate,
        ownerName,
        status: vehicle.status,
        reason: `Vehículo con estado: ${vehicle.status}`,
        debug: { activeZone, logId: logEntry.id }
      });
    }

    // CASO DE ÉXITO: Acceso completamente concedido
    return res.json({
      granted: true,
      plate: vehicle.plate,
      ownerName,
      vehicleModel: vehicle.model,
      vehicleBrand: vehicle.brand,
      vehicleColor: vehicle.color,
      department: vehicle.department,
      status: vehicle.status,
      debug: {
        activeZone,
        logId: logEntry.id,
        receivedZone: zone || "NONE"
      }
    });
  } catch (error) {
    console.error("[RFID API] Error:", error);
    return res.status(500).json({ granted: false, reason: "Error interno del servidor.", error: String(error) });
  }
}

/**
 * GET /api/rfid/latest
 * Recupera el último log de acceso RFID registrado en la zona especificada.
 * Este endpoint es consultado de forma periódica por el frontend (polling) para 
 * mostrar notificaciones de acceso en tiempo real y desplegar carnets de seguridad en el portón.
 * 
 * ### Algoritmo Secuencial de Resolución del Carnet Digital (`carnetUrl`):
 * El carnet digital del conductor se resuelve evaluando en cascada las siguientes entidades:
 * 1. **Registro Aprobado por Código Estudiantil**: Busca un `UserRegistration` aprobado donde el código
 *    coincida con el carnet del dueño del vehículo o donde coincida la placa directamente.
 * 2. **Registro por Placa**: Busca un `UserRegistration` aprobado mapeado solo a la placa vehicular.
 * 3. **Solicitud de Invitado Temporal**: Si el vehículo pertenece a un visitante externo con placa reconocida,
 *    busca un `AccessRequest` diario aprobado, y extrae la ruta del carnet del anfitrión docente/administrativo
 *    (`hostCarnetPath`) que patrocinó la visita.
 * 4. **Resguardo de Aprobación Genérica**: Búsqueda final de cualquier radicado aprobado por placa.
 * 
 * @name GetLatestRfidEvent
 * @route {GET} /api/rfid/latest
 * @query {string} [zone] - Filtro opcional por zona física de control ("entrada" o "salida").
 * @returns {Object} JSON con `{ event: EventData | null }`. Si existe un evento, incluye metadatos del vehículo y carnetUrl.
 */
router.get("/latest", async (req: Request, res: Response) => {
  try {
    const { zone } = req.query;
    
    // Normalización semántica del filtro de zona recibido
    let zoneFilter = zone as string;
    if (zoneFilter) {
      if (zoneFilter.toLowerCase().includes("salida")) zoneFilter = "Salida Principal";
      else if (zoneFilter.toLowerCase().includes("entrada")) zoneFilter = "Entrada Principal";
    }

    // Configuración de cláusula WHERE de Prisma
    const whereClause: any = { method: "RFID" };
    if (zoneFilter) {
      whereClause.zone = {
        contains: zoneFilter,
        mode: "insensitive", // Ignora diferencias de mayúsculas/minúsculas
      };
    }

    // Obtención del último registro de la bitácora
    const latestLog = await prisma.accessLog.findFirst({
      where: whereClause,
      orderBy: { timestamp: "desc" },
    });

    // Si no existen logs históricos de tipo RFID
    if (!latestLog) {
      return res.json({ event: null });
    }

    // Recupera la información complementaria del vehículo si la placa no es desconocida
    const vehicle =
      latestLog.plate !== "UNKNOWN"
        ? await prisma.vehicle.findUnique({
            where: { plate: latestLog.plate },
            include: { owner: true },
          })
        : null;

    let carnetUrl = null;

    // -------------------------------------------------------------------------
    // CASCADA DE RESOLUCIÓN DE CARNET DIGITAL (carnetUrl)
    // -------------------------------------------------------------------------
    if (vehicle) {
      let reg = null;
      
      // PASO 1: Búsqueda cruzada por código de estudiante del propietario o placa aprobada
      if (vehicle.owner) {
        reg = await prisma.userRegistration.findFirst({
          where: {
            OR: [
              { institutionalCode: vehicle.owner.cardnumber },
              { plate: vehicle.plate }
            ],
            status: "APROBADO"
          },
          orderBy: { createdAt: "desc" }
        });
      }
      
      // PASO 2: Búsqueda alternativa por placa vehicular en solicitudes aprobadas
      if (!reg) {
        reg = await prisma.userRegistration.findFirst({
          where: { plate: vehicle.plate },
          orderBy: { createdAt: "desc" }
        });
      }
      
      if (reg) {
        carnetUrl = reg.carnetFilePath;
      }
    }

    // PASO 3: Búsqueda para visitantes (AccessRequest diario aprobado).
    // Si la visita está programada para hoy y el estado es aprobado, se muestra el
    // carnet digital del anfitrión institucional que autorizó la entrada.
    if (!carnetUrl && latestLog.plate !== "UNKNOWN") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const guestRequest = await prisma.accessRequest.findFirst({
        where: {
          plateNumber: latestLog.plate,
          status: "APPROVED",
          visitDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      });
      if (guestRequest) {
        carnetUrl = guestRequest.hostCarnetPath;
      }
    }

    // PASO 4: Resguardo final por placa aprobada en el módulo de registros generales
    if (!carnetUrl && latestLog.plate !== "UNKNOWN") {
      const reg = await prisma.userRegistration.findFirst({
        where: { plate: latestLog.plate, status: "APROBADO" },
        orderBy: { createdAt: "desc" }
      });
      if (reg) {
        carnetUrl = reg.carnetFilePath;
      }
    }

    // Retorna la respuesta unificada con todos los detalles del último evento capturado
    return res.json({
      event: {
        id: latestLog.id,
        timestamp: latestLog.timestamp,
        plate: latestLog.plate,
        rfidTag: latestLog.rfidTag,
        granted: latestLog.status,
        ownerName: vehicle?.owner
          ? `${vehicle.owner.firstname} ${vehicle.owner.surname}`
          : null,
        vehicleModel: vehicle?.model ?? null,
        vehicleBrand: vehicle?.brand ?? null,
        vehicleColor: vehicle?.color ?? null,
        department: vehicle?.department ?? null,
        vehicleStatus: vehicle?.status ?? null,
        carnetUrl,
      },
    });
  } catch (error) {
    console.error("[RFID Latest] Error:", error);
    return res.status(500).json({ event: null });
  }
});

export default router;
