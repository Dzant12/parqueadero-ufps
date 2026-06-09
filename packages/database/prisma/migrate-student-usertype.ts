/**
 * @file migrate-student-usertype.ts
 * @description Script de migración one-shot para corregir el campo `Student.userType`
 * en todos los estudiantes que tienen una solicitud de registro aprobada (UserRegistration)
 * pero cuyo campo `userType` quedó en null por no haberse propagado al aprobarse.
 *
 * ### Problema que resuelve
 * Al aprobar una `UserRegistration`, el proceso de upsert del `Student` no incluía
 * el campo `userType`, por lo que siempre quedaba null. Esto provocaba que
 * `resolveUserType()` devolviera "Personal" en lugar del tipo real (Estudiante, Docente,
 * Administrativo, etc.) al registrar accesos en la bitácora.
 *
 * ### Ejecución
 * Desde la raíz del repositorio:
 *   npx ts-node packages/database/prisma/migrate-student-usertype.ts
 *
 * O desde packages/database:
 *   npx ts-node prisma/migrate-student-usertype.ts
 *
 * @module database/migrate-student-usertype
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as path from "path";
import * as dotenv from "dotenv";

// Carga .env desde la raíz del monorepo si se ejecuta desde packages/database
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=".repeat(60));
  console.log("  MIGRACIÓN: Student.userType desde UserRegistration");
  console.log("=".repeat(60));

  // 1. Obtener todos los registros aprobados que tienen un código institucional
  const approvedRegistrations = await prisma.userRegistration.findMany({
    where: {
      status: "APROBADO",
      institutionalCode: { not: "" },
    },
    select: {
      id: true,
      institutionalCode: true,
      fullName: true,
      userType: true,
      plate: true,
    },
  });

  console.log(`\n📋 Solicitudes APROBADAS encontradas: ${approvedRegistrations.length}`);

  if (approvedRegistrations.length === 0) {
    console.log("No hay registros aprobados. Nada que migrar.");
    return;
  }

  // 2. Para cada registro aprobado, buscar el Student y actualizar su userType si es null o vacío
  let updated = 0;
  let alreadyOk = 0;
  let noStudent = 0;
  const errors: string[] = [];

  for (const reg of approvedRegistrations) {
    try {
      const student = await prisma.student.findUnique({
        where: { cardnumber: reg.institutionalCode },
        select: { id: true, userType: true, firstname: true, surname: true },
      });

      if (!student) {
        // El Student aún no existe (registro aprobado pero vehículo no sincronizado)
        noStudent++;
        console.log(`  ⚠️  Sin student para código ${reg.institutionalCode} (${reg.fullName})`);
        continue;
      }

      const currentType = student.userType?.trim() ?? null;
      const targetType  = reg.userType?.trim() ?? null;

      if (!targetType) {
        console.log(`  ⏭️  Sin userType en solicitud para ${reg.institutionalCode} — omitido`);
        continue;
      }

      if (currentType && currentType.toLowerCase() !== "") {
        // Ya tiene un valor — no sobreescribir a menos que sea el genérico problemático
        alreadyOk++;
        console.log(`  ✅ ${reg.institutionalCode} (${student.firstname} ${student.surname}) ya tiene: "${currentType}"`);
        continue;
      }

      // Actualizar el campo userType
      await prisma.student.update({
        where: { id: student.id },
        data: { userType: targetType },
      });

      updated++;
      console.log(`  🔧 ${reg.institutionalCode} (${student.firstname} ${student.surname}) → "${targetType}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`código ${reg.institutionalCode}: ${msg}`);
      console.error(`  ❌ Error en ${reg.institutionalCode}: ${msg}`);
    }
  }

  // 3. Resumen final
  console.log("\n" + "=".repeat(60));
  console.log("  RESUMEN");
  console.log("=".repeat(60));
  console.log(`  ✅ Actualizados:       ${updated}`);
  console.log(`  ⏭️  Ya correctos:      ${alreadyOk}`);
  console.log(`  ⚠️  Sin Student en BD: ${noStudent}`);
  console.log(`  ❌ Errores:            ${errors.length}`);

  if (errors.length > 0) {
    console.log("\nDetalle de errores:");
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log("\n✔ Migración completada.\n");
}

main()
  .catch((e) => {
    console.error("Error crítico en la migración:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
