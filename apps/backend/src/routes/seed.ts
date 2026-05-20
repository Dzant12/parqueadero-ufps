/**
 * @file seed.ts
 * @description Ruta de la API para la generación dinámica de datos sintéticos (simulación de tráfico).
 * Expone un endpoint GET diseñado para sembrar rápidamente un volumen considerable (200 registros) 
 * de logs de acceso ficticios en la base de datos para pruebas del módulo de analítica.
 * 
 * ### Modelado Estadístico Incorporado:
 * - **Sesgo de Horas Pico (Rush Hour Bias)**: El 60% de las marcas de tiempo se agrupan artificialmente
 *   entre las 6:00 AM y las 12:00 PM, simulando el comportamiento real de llegada masiva al campus de la universidad.
 * - **Tasa de Aprobación Realista**: Configura una probabilidad fija del 85% de accesos exitosos (concedidos)
 *   y un 15% de rechazos (tarjetas inválidas, bloqueadas o vehículos no autorizados).
 * - **Distribución Equitativa de Canales**: Divide equitativamente (50/50) los métodos de validación
 *   entre la lectura automática inalámbrica ("RFID") y el registro manual del vigilante ("MANUAL").
 * 
 * @module backend/routes/seed
 * @requires express
 * @requires @parqueadero/database
 */

import { Router, Request, Response } from "express";
import prisma from "@parqueadero/database";

const router = Router();

/**
 * GET /api/seed
 * Genera y persiste masivamente 200 logs de acceso aleatorios estructurados estadísticamente.
 * Útil para pruebas de estrés, demostraciones de interfaz y pruebas de gráficas estadísticas en tiempo real.
 * 
 * @name SeedSyntheticLogs
 * @route {GET} /api/seed
 * @returns {Object} 200 - JSON con { success: true, count: 200 } tras la inserción masiva.
 * @returns {Object} 500 - Mensaje de error en caso de fallo interno en la persistencia.
 */
router.get("/", async (req: Request, res: Response) => {
  const logs = [];
  const userTypes = ["Estudiante", "Administrativo", "Docente", "Visitante", "Desconocido"];
  const zones = ["Zona A - Principal", "Zona B - Visitantes", "Zona C - VIP"];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  
  const now = new Date();
  
  // Generación de 600 registros de auditoría:
  // - 100 para hoy (últimas 24 horas) para garantizar datos activos en el dashboard diario
  // - 500 distribuidos en los últimos 30 días para alimentar las vistas semanales y mensuales
  for (let i = 0; i < 600; i++) {
    const l1 = letters.charAt(Math.floor(Math.random() * letters.length));
    const l2 = letters.charAt(Math.floor(Math.random() * letters.length));
    const l3 = letters.charAt(Math.floor(Math.random() * letters.length));
    const num = Math.floor(Math.random() * 900) + 100;
    const plate = `${l1}${l2}${l3}-${num}`;

    let date: Date;
    if (i < 100) {
      // 100 logs para el día de hoy (últimas 24 horas)
      date = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
    } else {
      // 500 logs repartidos en los últimos 30 días
      date = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000);
    }
    
    // --- Modelado de Horas Pico (Rush Hours) ---
    // Agrupa estadísticamente una porción mayoritaria de eventos en la mañana (6:00 AM a 12:00 PM)
    if (Math.random() > 0.4) {
      date.setHours(Math.floor(Math.random() * 7) + 6);
    }

    logs.push({
      timestamp: date,
      plate: plate,
      userType: userTypes[Math.floor(Math.random() * userTypes.length)],
      zone: zones[Math.floor(Math.random() * zones.length)],
      status: Math.random() > 0.15,
      method: Math.random() > 0.5 ? "RFID" : "MANUAL"
    });
  }

  try {
    await prisma.accessLog.createMany({
      data: logs
    });
    
    res.json({ success: true, count: logs.length });
  } catch (error) {
    console.error("[Seed API Error]:", error);
    res.status(500).json({ success: false, error: "Error al sembrar logs de acceso sintéticos." });
  }
});

export default router;
