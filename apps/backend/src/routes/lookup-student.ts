/**
 * @file lookup-student.ts
 * @description Ruta de la API de consulta rápida de información básica del estudiante.
 * Expone un endpoint GET que permite al frontend recuperar el nombre y correo institucional
 * de un estudiante mediante la lectura de su código o número de carnet físico.
 * 
 * Implementa múltiples medidas de seguridad críticas de nivel empresarial:
 * 1. **Limitador de Tasa (Rate Limiting) en Memoria**: Mitiga ataques de fuerza bruta y raspado de datos (scraping).
 * 2. **Saneamiento RegEx Estricto**: Restringe las entradas a caracteres alfanuméricos puros para evitar inyecciones.
 * 3. **Mitigación de Enumeración**: Devuelve null con código HTTP 200 si el código no existe, en lugar de error 404,
 *    evitando que atacantes externos descubran qué códigos institucionales son válidos en la base de datos.
 * 
 * @module backend/routes/lookup-student
 * @requires express
 * @requires @parqueadero/database
 */

import { Router, Request, Response } from "express";
import prisma from "@parqueadero/database";

const router = Router();

/* ─── LIMITADOR DE TASA (RATE LIMITING) ──────────────────────────────────────
   Estructura en memoria (Map) para registrar la frecuencia de solicitudes por IP.
   Establece una ventana móvil simple donde se restringe a un máximo de solicitudes
   por ventana temporal para prevenir el abuso de la API de consulta.
   ─────────────────────────────────────────────────────────────────────────── */
const rateLimitMap = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 15;           // Número máximo de solicitudes permitidas por ventana
const RATE_WINDOW_MS = 60_000;   // Duración de la ventana (1 minuto en milisegundos)

/**
 * Evalúa si una dirección IP determinada ha superado el umbral de consultas permitido
 * dentro de la ventana de tiempo activa.
 * 
 * @function isRateLimited
 * @param {string} ip - Dirección IP del cliente remitente.
 * @returns {boolean} Retorna true si el cliente está bloqueado temporalmente (rate limited), false si está libre.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  // Si no existe un registro previo o la ventana de tiempo ha expirado, reinicia el contador.
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }

  // Si se ha alcanzado o superado el límite configurado dentro de la ventana.
  if (entry.count >= RATE_LIMIT) return true;

  // Incrementa el número de solicitudes en la ventana actual.
  entry.count++;
  return false;
}

/**
 * GET /api/lookup-student
 * Recupera la información pública de un estudiante (Nombre completo y correo electrónico institucional)
 * a partir de un código de barra/tarjeta provisto en los parámetros de consulta.
 * 
 * @name LookupStudent
 * @route {GET} /api/lookup-student
 * @query {string} code - Código institucional o UID de tarjeta del estudiante a consultar.
 * 
 * @returns {Object|null} 200 - Objeto con { fullName, email } si se encuentra, o `null` si no existe
 *                              (manteniendo consistencia ante la mitigación de enumeración).
 * @returns {Object} 400 - Mensaje de error si la entrada del código está vacía, no es alfanumérica o excede los límites.
 * @returns {Object} 429 - Mensaje de error si la IP del cliente excede la cuota de rate limiting.
 * @returns {Object} 500 - Mensaje de error en caso de fallo interno de la base de datos o servidor.
 */
router.get("/", async (req: Request, res: Response) => {
  // --- Extracción y resolución de la IP del cliente ---
  // Obtiene la dirección IP real del cliente contemplando proxies inversos (ej: Vercel, Cloudflare)
  // mediante el encabezado X-Forwarded-For, o cae de vuelta al address del socket.
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";

  // Verificación de Rate Limit
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Demasiadas solicitudes. Intenta de nuevo en un momento." });
  }

  // --- Validación y Limpieza de Parámetros de Entrada ---
  const code = (req.query.code as string)?.trim();

  // Validación de longitud para evitar cargas maliciosas de gran tamaño (Buffer Overflow / DoS lógico)
  if (!code || code.length < 3 || code.length > 20) {
    return res.status(400).json({ error: "Código inválido" });
  }

  // Sanitización estricta: Solo admite caracteres alfanuméricos puros para neutralizar
  // intentos de inyección de comandos o SQL a través de queries.
  if (!/^[A-Z0-9a-z]+$/.test(code)) {
    return res.status(400).json({ error: "Código inválido" });
  }

  try {
    // --- Consulta en la Base de Datos ---
    // Recupera únicamente los campos necesarios (Principio de Menor Privilegio)
    const student = await prisma.student.findUnique({
      where: { cardnumber: code },
      select: { firstname: true, surname: true, email: true, emailpro: true },
    });

    // Si el estudiante no existe, responde con null (200 OK)
    // Esto evita que agentes maliciosos escaneen el sistema detectando códigos existentes (Enumeración de Cuentas).
    if (!student) {
      return res.status(200).json(null);
    }

    // --- Lógica de Negocio: Resolución de Correo UFPS Prioritario ---
    // Los estudiantes pueden poseer correos personales y corporativos.
    // Este algoritmo prioriza la entrega de un correo con dominio institucional '@ufps.edu.co'.
    const ufpsEmail =
      student.email?.endsWith("@ufps.edu.co")
        ? student.email
        : student.emailpro?.endsWith("@ufps.edu.co")
        ? student.emailpro
        : student.email ?? student.emailpro ?? "";

    // Retorna los datos con formato unificado y limpio
    return res.status(200).json({
      fullName: `${student.firstname} ${student.surname}`.trim(),
      email: ufpsEmail,
    });
  } catch (error) {
    console.error("[Lookup Student Error]:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
