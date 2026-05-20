/**
 * @file seed.ts
 * @description Script principal de siembra (seeding) de la base de datos PostgreSQL.
 * Este script inicializa la base de datos con un conjunto consistente de datos simulados 
 * y reales (desde un archivo CSV de estudiantes) para propósitos de desarrollo y pruebas.
 * 
 * El flujo secuencial del script es el siguiente:
 * 1. Limpieza total de los registros preexistentes en cascada para evitar colisiones de clave primaria o única.
 * 2. Carga y análisis del archivo `estudiantes.csv` usando codificación Latin-1 (para conservar tildes y caracteres especiales).
 * 3. Inserción masiva de estudiantes optimizada en lotes (batch inserts) de 5,000 registros para evitar el desbordamiento de memoria.
 * 4. Creación de registros iniciales de vehículos, solicitudes de acceso, registros de entrada/salida y cuentas predeterminadas del sistema.
 * 
 * @module database/seed
 * @requires dotenv/config
 * @requires csv-parse
 * @requires pg
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// Inicializa el pool de conexiones a la base de datos.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Función principal del script de siembra. Orchesta la secuencia de limpieza e inserciones.
 * 
 * @async
 * @function main
 * @returns {Promise<void>} Una promesa que se resuelve cuando el proceso de siembra finaliza con éxito.
 * @throws {Error} Si algún paso del seed o de la conexión de base de datos falla.
 */
async function main() {
  console.log("Iniciando seed...");

  // ----------------------------------------------------------------------------
  // 1. Limpieza de base de datos
  // Se eliminan registros en orden inverso de dependencias para evitar la violación
  // de restricciones de clave foránea.
  // ----------------------------------------------------------------------------
  await prisma.accessLog.deleteMany();
  await prisma.accessRequest.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();

  // ----------------------------------------------------------------------------
  // 2. Carga de estudiantes desde archivo CSV
  // ----------------------------------------------------------------------------
  const csvPath = path.join(process.cwd(), "estudiantes.csv");
  if (fs.existsSync(csvPath)) {
    // Se lee con codificación 'latin1' (ISO-8859-1) debido a que los listados de la
    // universidad comúnmente contienen caracteres en español (ñ, tildes) no formateados en UTF-8.
    const fileContent = fs.readFileSync(csvPath, "latin1");
    
    // Parseo síncrono del archivo CSV separado por punto y coma (;)
    const records = parse(fileContent, {
      delimiter: ";",
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`Se encontraron ${records.length} registros de estudiantes. Sembrando...`);

    /**
     * Valida y normaliza si un valor dado corresponde a un correo con dominio institucional de la UFPS.
     * 
     * @param {string | undefined} val - Valor del email a evaluar.
     * @returns {string | null} El correo normalizado o null si no cumple el criterio.
     */
    const isUfpsEmail = (val: string | undefined) =>
      val && val.toLowerCase().includes("@ufps.edu.co") ? val.trim() : null;

    // Mapeo de la estructura del CSV al formato definido en el esquema Prisma
    const studentsData = (records as Record<string, string>[]).map(record => ({
      cardnumber: record.cardnumber,
      firstname: record.firstname?.trim().toUpperCase() || "",
      surname: record.surname?.trim().toUpperCase() || "",
      email: isUfpsEmail(record.email),
      emailpro: isUfpsEmail(record.emailpro),
    }));

    // Optimización de inserción masiva: El motor de base de datos puede fallar con
    // miles de variables si intentamos insertar todo a la vez. Dividimos en lotes de 5,000.
    const BATCH_SIZE = 5000;
    for (let i = 0; i < studentsData.length; i += BATCH_SIZE) {
      const batch = studentsData.slice(i, i + BATCH_SIZE);
      await prisma.student.createMany({
        data: batch,
        skipDuplicates: true, // Ignora duplicados en llave primaria sin detener la ejecución
      });
      console.log(`Cargados registros ${i} a ${i + batch.length} de ${studentsData.length}`);
    }
    console.log("Estudiantes sembrados con éxito.");
  } else {
    console.warn("estudiantes.csv no encontrado, omitiendo siembra de estudiantes.");
  }

  // ----------------------------------------------------------------------------
  // 3. Sembrar Vehículos de prueba
  // ----------------------------------------------------------------------------
  const vehicles = [
    { plate: "PRK-8821", model: "Tesla Model 3", color: "Gris Medianoche", icon: "directions_car", department: "Ingeniería Biomédica", status: "Permiso Activo" },
    { plate: "FLX-0092", model: "Ford F-150", color: "Blanco Oxford", icon: "fire_truck", department: "Operaciones de Campus", status: "Renovación Pendiente" },
    { plate: "STU-1120", model: "Honda Accord", color: "Dorado Champagne", icon: "directions_car", department: "Facultad de Derecho", status: "Suspendido" },
    { plate: "MTC-4401", model: "Yamaha MT-07", color: "Azul Racing", icon: "motorcycle", department: "Educación Física", status: "Permiso Activo" },
  ];

  for (const v of vehicles) {
    await prisma.vehicle.create({ data: v });
  }

  // ----------------------------------------------------------------------------
  // 4. Sembrar Solicitudes de Acceso de prueba (Visitantes Externos)
  // ----------------------------------------------------------------------------
  const requests = [
    { requesterName: "Julianne Smith", plateNumber: "ABC-1234", visitDate: new Date("2023-10-24T08:00:00"), reason: "Conferenciante Invitado - Depto. de Física", status: "PENDIENTE" },
    { requesterName: "Marcus Reed", plateNumber: "XYZ-9876", visitDate: new Date("2023-10-24T10:00:00"), reason: "Contratista - Mantenimiento HVAC", status: "PENDIENTE" },
    { requesterName: "Linda Bennett", plateNumber: "CAL-4421", visitDate: new Date("2023-10-25T09:00:00"), reason: "Reunión de Relaciones con Exalumnos", status: "PENDIENTE" },
    { requesterName: "Thomas Hinds", plateNumber: "G-992211", visitDate: new Date("2023-10-25T13:00:00"), reason: "Entrevista de Facultad Prospectiva", status: "PENDIENTE" },
  ];

  for (const r of requests) {
    await prisma.accessRequest.create({ data: r });
  }

  // ----------------------------------------------------------------------------
  // 5. Sembrar Historial de Logs de Acceso de prueba
  // ----------------------------------------------------------------------------
  const logs = [
    { timestamp: new Date("2023-10-24T14:22:15"), plate: "TX-882-PLT", userType: "Facultad", zone: "Facultad Norte (B-4)", status: true },
    { timestamp: new Date("2023-10-24T14:18:42"), plate: "CA-019-XKJ", userType: "Estudiante", zone: "Estudiante Central (C-1)", status: true },
    { timestamp: new Date("2023-10-24T14:15:09"), plate: "NY-911-ERR", userType: "Visitante", zone: "Portón Principal", status: false },
    { timestamp: new Date("2023-10-24T14:05:33"), plate: "FL-330-MM9", userType: "Administrador", zone: "Área de Servicio", status: true },
    { timestamp: new Date("2023-10-24T13:58:21"), plate: "TX-551-DOG", userType: "Estudiante", zone: "Desbordamiento Sur", status: true },
  ];

  for (const l of logs) {
    await prisma.accessLog.create({ data: l });
  }

  // ----------------------------------------------------------------------------
  // 6. Sembrar Usuarios del Sistema (Intranet de Gestión)
  // Las contraseñas se almacenan pre-encriptadas en formato Bcrypt para acelerar el seed
  // y asegurar la consistencia sin requerir dependencias activas de hashing en runtime de siembra.
  // - Contraseña admin: "admin123"
  // - Contraseña celador: "celador123"
  // ----------------------------------------------------------------------------
  console.log("Sembrando usuarios...");
  const adminPassword = "$2b$10$aGvn/sUQWhdi92QY8wg2dOelXAsZn0LdBQ4mr9ppVYTjIw.ZBWaj6"; // admin123
  const celadorPassword = "$2b$10$MPmPSpOL/YSRQwJJpVKo7uBo9QmSwhwAYuK812L1BS9UGaxzf.ANy"; // celador123

  await prisma.user.createMany({
    data: [
      {
        username: "admin",
        password: adminPassword,
        name: "Administrador General",
        role: "ADMIN",
        email: "admin@ufps.edu.co",
      },
      {
        username: "celador",
        password: celadorPassword,
        name: "Vigilante Nocturno",
        role: "CELADOR",
        email: "celador@ufps.edu.co",
      },
    ],
  });

  console.log("Usuarios sembrados con éxito.");

  // ----------------------------------------------------------------------------
  // 7. Sembrar registros de pre-registro (UserRegistration)
  // Esto es de utilidad para visualizar carnes de prueba y verificar aprobaciones
  // en la UI de administración del parqueadero.
  // ----------------------------------------------------------------------------
  console.log("Sembrando UserRegistration para pruebas...");
  await prisma.userRegistration.create({
    data: {
      userType: "ESTUDIANTE",
      email: "estudiante.prueba@ufps.edu.co",
      institutionalCode: "1151620",
      fullName: "JUAN PEREZ CONTRERAS",
      carnetFilePath: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=400", // Marcador de imagen elegante para el carnet digital
      ownershipFilePath: "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
      plate: "PRK-8821",
      vehicleBrand: "Tesla",
      vehicleModel: "Model 3",
      status: "APROBADO"
    }
  });
  console.log("UserRegistration creado con éxito.");

  console.log("Seed completado con éxito.");
}

// Ejecución del script principal y control de errores
main()
  .catch((e) => {
    console.error("Error crítico durante la siembra de base de datos:", e);
    process.exit(1);
  })
  .finally(async () => {
    // Cierre de la conexión Prisma de forma explícita
    await prisma.$disconnect();
  });
