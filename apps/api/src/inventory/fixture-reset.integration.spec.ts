import { resetToSection81Fixture } from '@erp/database';
import { describe, expect, it } from 'vitest';
import { useSection81Fixture } from '../../test/integration/harness.js';

const db = useSection81Fixture();

describe('Section 8.1 fixture reset (seam 4 harness)', () => {
  it('starts every scenario with the TOR Section 8.1 data', async () => {
    const { prisma } = db;

    expect((await prisma.store.findMany({ orderBy: { code: 'asc' } })).map((s) => s.code)).toEqual([
      'B01',
      'B02',
    ]);
    expect((await prisma.supplier.findMany()).map((s) => s.code)).toEqual(['SUP01']);

    const users = await prisma.user.findMany({ include: { store: true } });
    const storeOf = Object.fromEntries(users.map((u) => [u.email, u.store?.code ?? null]));
    expect(storeOf).toMatchObject({
      'buyer01@erp.local': null,
      'staff_b01@erp.local': 'B01',
      'staff_b02@erp.local': 'B02',
      'manager01@erp.local': null,
    });

    const products = await prisma.product.findMany({ orderBy: { sku: 'asc' } });
    expect(products.map((p) => [p.sku, p.sellingPrice.toFixed(2)])).toEqual([
      ['SKU001', '60.00'],
      ['SKU002', '35.00'],
      ['SKU003', '120.00'],
    ]);

    expect(await db.balance('SKU001', 'B01')).toBe(10);
    expect(await db.balance('SKU002', 'B01')).toBe(5);
    expect(await db.balance('SKU003', 'B01')).toBe(0);
    for (const sku of ['SKU001', 'SKU002', 'SKU003']) {
      expect(await db.balance(sku, 'B02')).toBe(0);
    }

    const thresholds = await prisma.productReorderThreshold.findMany();
    expect(thresholds).toHaveLength(6);
    expect(new Set(thresholds.map((t) => t.threshold))).toEqual(new Set([3]));

    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it('wipes what the previous scenario left behind', async () => {
    const { prisma } = db;
    const [product, store, actor] = await Promise.all([
      db.product('SKU001'),
      db.store('B01'),
      db.user('manager01@erp.local'),
    ]);
    // Dirty the database the way a scenario would.
    await prisma.stockBalance.update({
      where: { productId_storeId: { productId: product.id, storeId: store.id } },
      data: { quantity: 99 },
    });
    await prisma.stockMovement.create({
      data: {
        productId: product.id,
        storeId: store.id,
        quantityChange: 89,
        balanceBefore: 10,
        balanceAfter: 99,
        type: 'ADJUSTMENT',
        sourceDocumentType: 'ADJUSTMENT',
        sourceDocumentId: 'ADJ-000001',
        actorId: actor.id,
      },
    });
    await prisma.documentSequence.create({ data: { prefix: 'GR', lastValue: 41 } });

    await resetToSection81Fixture(prisma);

    expect(await db.balance('SKU001', 'B01')).toBe(10);
    expect(await prisma.stockMovement.count()).toBe(0);
    expect(await prisma.documentSequence.count()).toBe(0);
  });
});
