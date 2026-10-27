import { createPrismaClient, DEMO_PASSWORD, seedSection81 } from '../src/index.js';

const prisma = createPrismaClient(
  process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp',
);

try {
  // The TOR Section 8.1 data (stores, supplier, users, SKU001-003 with B01 stock).
  // Re-runnable and non-destructive: existing stock is never overwritten.
  await seedSection81(prisma);
  console.log(`Seeded the TOR Section 8.1 data (demo password: "${DEMO_PASSWORD}").`);
} finally {
  await prisma.$disconnect();
}
