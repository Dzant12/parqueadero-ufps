/**
 * @file index.ts
 * @description Módulo de inicialización y exportación del cliente Prisma singleton en el monorepo.
 * Este archivo configura la conexión a la base de datos PostgreSQL utilizando el conector nativo 
 * de pg (`pg-pool`) y el conector `@prisma/adapter-pg`.
 * 
 * Implementa el patrón de diseño Singleton para evitar el agotamiento de sockets y pools de conexión
 * de la base de datos en entornos de desarrollo durante los reinicios automáticos (hot-reload)
 * de frameworks como Next.js o servidores Express con ts-node-dev.
 * 
 * @module database
 * @see {@link https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections#preventing-the-number-of-connections-from-growing}
 */

export * from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as path from "path";
import * as dotenv from "dotenv";

// Carga las variables de entorno desde la raíz del monorepo.
// Esto es fundamental para herramientas externas, CLI y scripts independientes de migración/siembra
// que se ejecutan directamente en la terminal, fuera del contexto de una aplicación como Next.js.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Configuración del Pool de conexiones de PostgreSQL.
// Utiliza la variable de entorno DATABASE_URL cargada previamente.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Inicialización del adaptador Pg nativo para Prisma.
// Esto permite delegar y optimizar la gestión del pool de conexiones al módulo 'pg' de Node.js.
const adapter = new PrismaPg(pool);

/**
 * Factoría para la creación de una instancia única de PrismaClient.
 * Utiliza el adaptador PostgreSQL configurado nativamente.
 * 
 * @function prismaClientSingleton
 * @returns {PrismaClient} Una instancia lista y configurada del cliente de Prisma.
 */
const prismaClientSingleton = () => {
  return new PrismaClient({ adapter });
};

// Declaración global para TypeScript para admitir la inyección del cliente Prisma
// en el objeto global de Node.js (`globalThis`), evitando advertencias de tipado estático.
declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

/**
 * Cliente Prisma Singleton expuesto para el consumo de todo el monorepo.
 * 
 * - En producción: se crea una nueva instancia directamente.
 * - En desarrollo: se intenta reutilizar la instancia almacenada en globalThis.prisma para evitar
 *   el crecimiento desmedido de conexiones abiertas debido al reinicio de módulos provocado por bundlers.
 */
const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

// Si estamos en entorno de desarrollo, inyectamos la instancia en globalThis
// para que persista a través de las recreaciones de módulos del servidor de desarrollo.
if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

