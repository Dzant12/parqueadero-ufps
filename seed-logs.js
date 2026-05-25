const { PrismaClient } = require('./generated/prisma/client/index.js');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding fake access logs...');
  const logs = [];
  const userTypes = ["Estudiante", "Administrativo", "Docente", "Visitante", "Desconocido"];
  const zones = ["Entrada Principal", "Salida Principal"];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  
  const now = new Date();
  
  for (let i = 0; i < 200; i++) {
    const l1 = letters.charAt(Math.floor(Math.random() * letters.length));
    const l2 = letters.charAt(Math.floor(Math.random() * letters.length));
    const l3 = letters.charAt(Math.floor(Math.random() * letters.length));
    const num = Math.floor(Math.random() * 900) + 100;
    const plate = `${l1}${l2}${l3}-${num}`;

    // Random date within the last 24 hours
    const date = new Date(now.getTime() - Math.random() * 24 * 60 * 60 * 1000);
    
    // Bias towards rush hours: 6 AM to 12 PM
    if (Math.random() > 0.4) {
      date.setHours(Math.floor(Math.random() * 7) + 6); // 6 AM to 12 PM
    }

    logs.push({
      timestamp: date,
      plate: plate,
      userType: userTypes[Math.floor(Math.random() * userTypes.length)],
      zone: zones[Math.floor(Math.random() * zones.length)],
      status: Math.random() > 0.15 // 85% approved
    });
  }

  await prisma.accessLog.createMany({
    data: logs
  });
  console.log(`Successfully seeded ${logs.length} logs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
