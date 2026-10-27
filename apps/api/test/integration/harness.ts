import { createPrismaClient, resetToSection81Fixture, type PrismaClient } from '@erp/database';
import { afterAll, beforeEach } from 'vitest';
import { testDatabaseUrl } from './test-database.js';

/**
 * Seam 4 harness. Call once at the top of a scenario file: it connects to the test
 * database, resets it to the TOR Section 8.1 fixture before every test, and disconnects
 * afterwards. Returns the client plus lookups for the fixture rows scenarios need.
 */
export function useSection81Fixture() {
  const prisma: PrismaClient = createPrismaClient(testDatabaseUrl());

  beforeEach(async () => {
    await resetToSection81Fixture(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  return {
    prisma,
    async store(code: string) {
      return prisma.store.findUniqueOrThrow({ where: { code } });
    },
    async product(sku: string) {
      return prisma.product.findUniqueOrThrow({ where: { sku } });
    },
    async user(email: string) {
      return prisma.user.findUniqueOrThrow({ where: { email } });
    },
    async balance(sku: string, storeCode: string) {
      const [product, store] = await Promise.all([this.product(sku), this.store(storeCode)]);
      const row = await prisma.stockBalance.findUnique({
        where: { productId_storeId: { productId: product.id, storeId: store.id } },
      });
      return row?.quantity ?? 0;
    },
  };
}
