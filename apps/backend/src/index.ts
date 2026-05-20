/**
 * @file index.ts
 * @description Punto de entrada principal (Entrypoint) del servidor de la API Backend.
 * Este archivo inicializa la aplicación Express, configura los middlewares globales 
 * (CORS, análisis de cuerpos JSON), monta los enrutadores de la API e inicia el servidor HTTP.
 * 
 * Además, provee una ruta de verificación de estado (Health Check) para constatar la
 * conectividad activa de la base de datos PostgreSQL, y exporta la aplicación para admitir
 * el despliegue en entornos Serverless (como Vercel Serverless Functions).
 * 
 * @module backend/entrypoint
 * @requires express
 * @requires cors
 * @requires dotenv
 * @requires @parqueadero/database
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "@parqueadero/database";
import rfidRoutes from "./routes/rfid";
import lookupStudentRoutes from "./routes/lookup-student";
import seedRoutes from "./routes/seed";

// Carga las variables de entorno definidas en el archivo .env de la aplicación.
dotenv.config();

const app = express();

// Whitelist de orígenes permitidos para peticiones de CORS cross-origin.
// Filtra cualquier valor vacío/falso si la variable FRONTEND_URL no está definida.
const allowedOrigins = [
  "http://localhost:3000",
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

// Habilita el middleware de CORS. 
// En entorno de desarrollo se permite 'true' (cualquier origen que envíe credenciales)
// para flexibilizar la integración local del frontend.
app.use(cors({
  origin: true,
  credentials: true
}));

// Habilita el parsing automático de peticiones entrantes con formato de payload JSON.
app.use(express.json());

/**
 * GET /
 * Endpoint de prueba básico para confirmar el estado activo del servidor.
 * 
 * @name RootRoute
 * @route {GET} /
 * @returns {string} Mensaje plano indicando que la API está operativa.
 */
app.get("/", (req, res) => {
  res.send("API is running!");
});

// Registro y montaje de las rutas de negocio específicas del sistema
app.use("/api/rfid", rfidRoutes);
app.use("/api/lookup-student", lookupStudentRoutes);
app.use("/api/seed", seedRoutes);

/**
 * GET /health
 * Endpoint de monitoreo de salud del backend y la base de datos.
 * Realiza una consulta SQL cruda ultraliviana para comprobar que la conexión a PostgreSQL
 * esté activa y respondiendo adecuadamente a través de Prisma.
 * 
 * @name HealthCheckRoute
 * @route {GET} /health
 * @returns {Object} JSON conteniendo el estado general y el estado de la base de datos.
 * @returns {number} 200 - Si la base de datos está conectada.
 * @returns {number} 500 - Si la consulta de verificación falla o no hay conexión.
 */
app.get("/health", async (req, res) => {
  try {
    // Consulta simple SELECT 1 para testear el socket de conexión sin sobrecarga
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (error) {
    res.status(500).json({ status: "error", error: String(error) });
  }
});

// Puerto de escucha. Por defecto 4000 para evitar conflictos con el frontend (puerto 3000).
const PORT = process.env.PORT || 4000;

// Inicializa el servidor HTTP para escuchar en el puerto especificado.
app.listen(PORT, () => {
  console.log(`Backend server is running on port ${PORT}`);
});

// Exportación por defecto para compatibilidad con microservicios y funciones Vercel
export default app;
