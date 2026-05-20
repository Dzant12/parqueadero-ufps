/**
 * @file prisma.config.ts
 * @description Archivo de configuración centralizado para Prisma CLI y herramientas asociadas en el monorepo.
 * Este archivo define la ubicación del esquema relacional de base de datos (`schema.prisma`),
 * la ruta de almacenamiento de las migraciones SQL, y proporciona el adaptador dinámico de
 * PostgreSQL para las operaciones a nivel de sistema (como generación de tipos, aplicación de migraciones, etc.).
 * 
 * Utiliza variables de entorno cargadas dinámicamente desde el archivo `.env` localizado en el
 * directorio raíz del monorepo.
 * 
 * @module database/config
 */

import * as path from "path";
import * as dotenv from "dotenv";

// Inicialización preventiva y carga del archivo .env a nivel del monorepo
// para asegurar que Prisma CLI disponga de la cadena de conexión DATABASE_URL adecuada.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { defineConfig } from "prisma/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Configuración unificada para la infraestructura de persistencia de Prisma.
 * Define la ruta del esquema, el directorio de salida de las migraciones SQL y
 * el adaptador PostgreSQL nativo para la optimización de queries.
 */
export default defineConfig({
  // Ruta relativa que apunta al esquema de base de datos principal de Prisma
  schema: "prisma/schema.prisma",
  
  // Configuración del almacenamiento e historial de migraciones generadas
  migrations: {
    path: "prisma/migrations",
  },
  
  /**
   * Proveedor de la conexión del adaptador para Prisma CLI y runtime.
   * Crea un pool de conexiones dedicado a las operaciones administrativas/migraciones
   * y lo envuelve en el adaptador de PrismaPg.
   * 
   * @function adapter
   * @returns {PrismaPg} Adaptador de base de datos PostgreSQL compatible con el ORM Prisma.
   */
  adapter: () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return new PrismaPg(pool);
  },
});

