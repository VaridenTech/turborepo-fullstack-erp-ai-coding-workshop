import { ORPCError } from '@orpc/nest';
import { describe, expect, it } from 'vitest';
import { useSection81Fixture } from '../../test/integration/harness.js';
import { nextDocumentNumber } from './document-numbers.js';
import { postStockMovement } from './stock-ledger.js';

const db = useSection81Fixture();

async function receiptInput(
  overrides: { quantityChange?: number; type?: 'RECEIPT' | 'SALE' } = {},
) {
  const [product, store, actor] = await Promise.all([
    db.product('SKU001'),
    db.store('B01'),
    db.user('staff_b01@erp.local'),
  ]);
  return {
    productId: product.id,
    storeId: store.id,
    quantityChange: overrides.quantityChange ?? 8,
    type: overrides.type ?? ('RECEIPT' as const),
    sourceDocumentType: 'GOODS_RECEIPT',
    sourceDocumentId: 'GR-000001',
    actorId: actor.id,
  };
}

describe('stock ledger (INV-02, INV-03)', () => {
  it('records a movement and moves the balance in one transaction', async () => {
    const input = await receiptInput({ quantityChange: 8 });

    const movement = await db.prisma.$transaction((tx) => postStockMovement(tx, input));

    expect(movement).toMatchObject({
      productId: input.productId,
      storeId: input.storeId,
      quantityChange: 8,
      balanceBefore: 10,
      balanceAfter: 18,
      type: 'RECEIPT',
      sourceDocumentType: 'GOODS_RECEIPT',
      sourceDocumentId: 'GR-000001',
      actorId: input.actorId,
    });
    expect(movement.createdAt).toBeInstanceOf(Date);
    expect(await db.balance('SKU001', 'B01')).toBe(18);
    expect(await db.prisma.stockMovement.count()).toBe(1);
  });

  it('decreases stock for a sale and records the balances either side', async () => {
    const input = await receiptInput({ quantityChange: -2, type: 'SALE' });

    const movement = await db.prisma.$transaction((tx) => postStockMovement(tx, input));

    expect(movement).toMatchObject({ quantityChange: -2, balanceBefore: 10, balanceAfter: 8 });
    expect(await db.balance('SKU001', 'B01')).toBe(8);
  });

  it('creates the balance for a product that has never had stock in a store', async () => {
    const input = { ...(await receiptInput({ quantityChange: 4 })) };
    const b02 = await db.store('B02');
    await db.prisma.stockBalance.deleteMany({ where: { storeId: b02.id } });

    const movement = await db.prisma.$transaction((tx) =>
      postStockMovement(tx, { ...input, storeId: b02.id }),
    );

    expect(movement).toMatchObject({ balanceBefore: 0, balanceAfter: 4 });
    expect(await db.balance('SKU001', 'B02')).toBe(4);
  });

  it('rejects a decrease larger than the balance and changes nothing (SAL-02 / INV-05)', async () => {
    const input = await receiptInput({ quantityChange: -11, type: 'SALE' });

    const error = await db.prisma
      .$transaction((tx) => postStockMovement(tx, input))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({ code: 'CONFLICT', data: { code: 'INSUFFICIENT_STOCK' } });
    expect(await db.balance('SKU001', 'B01')).toBe(10);
    expect(await db.prisma.stockMovement.count()).toBe(0);
  });

  it('allows draining a balance to exactly zero', async () => {
    const input = await receiptInput({ quantityChange: -10, type: 'SALE' });

    await db.prisma.$transaction((tx) => postStockMovement(tx, input));

    expect(await db.balance('SKU001', 'B01')).toBe(0);
  });

  it('refuses a receipt that decreases stock or a sale that increases it', async () => {
    await expect(
      db.prisma.$transaction(async (tx) =>
        postStockMovement(tx, await receiptInput({ quantityChange: -1, type: 'RECEIPT' })),
      ),
    ).rejects.toThrow();
    await expect(
      db.prisma.$transaction(async (tx) =>
        postStockMovement(tx, await receiptInput({ quantityChange: 1, type: 'SALE' })),
      ),
    ).rejects.toThrow();
    expect(await db.balance('SKU001', 'B01')).toBe(10);
  });

  it('refuses a zero or fractional quantity change', async () => {
    for (const quantityChange of [0, 1.5]) {
      await expect(
        db.prisma.$transaction(async (tx) =>
          postStockMovement(tx, await receiptInput({ quantityChange })),
        ),
      ).rejects.toThrow();
    }
    expect(await db.prisma.stockMovement.count()).toBe(0);
  });

  it('never lets the database hold a negative balance, whatever the application does', async () => {
    const [product, store] = await Promise.all([db.product('SKU001'), db.store('B01')]);

    await expect(
      db.prisma.stockBalance.update({
        where: { productId_storeId: { productId: product.id, storeId: store.id } },
        data: { quantity: -1 },
      }),
    ).rejects.toThrow();
    expect(await db.balance('SKU001', 'B01')).toBe(10);
  });
});

describe('confirmed movements are immutable (INV-02)', () => {
  async function confirmedMovement() {
    const input = await receiptInput({ quantityChange: 8 });
    return db.prisma.$transaction((tx) => postStockMovement(tx, input));
  }

  it('rejects an edit', async () => {
    const movement = await confirmedMovement();

    await expect(
      db.prisma.stockMovement.update({ where: { id: movement.id }, data: { balanceAfter: 999 } }),
    ).rejects.toThrow();

    const stored = await db.prisma.stockMovement.findUniqueOrThrow({ where: { id: movement.id } });
    expect(stored.balanceAfter).toBe(18);
  });

  it('rejects a delete', async () => {
    const movement = await confirmedMovement();

    await expect(db.prisma.stockMovement.delete({ where: { id: movement.id } })).rejects.toThrow();
    await expect(db.prisma.stockMovement.deleteMany()).rejects.toThrow();

    expect(await db.prisma.stockMovement.count()).toBe(1);
  });
});

describe('atomicity (INV-03)', () => {
  it('rolls the movement and the balance back together when the transaction fails', async () => {
    const input = await receiptInput({ quantityChange: 8 });

    await expect(
      db.prisma.$transaction(async (tx) => {
        await postStockMovement(tx, input);
        throw new Error('document posting failed after the stock update');
      }),
    ).rejects.toThrow('document posting failed');

    expect(await db.balance('SKU001', 'B01')).toBe(10);
    expect(await db.prisma.stockMovement.count()).toBe(0);
  });

  it('rolls an earlier line back when a later line of the same document is short (SAL-02)', async () => {
    const [water, tissue, store, actor] = await Promise.all([
      db.product('SKU001'),
      db.product('SKU002'),
      db.store('B01'),
      db.user('staff_b01@erp.local'),
    ]);
    const line = (productId: string, quantityChange: number) => ({
      productId,
      storeId: store.id,
      quantityChange,
      type: 'SALE' as const,
      sourceDocumentType: 'SALE',
      sourceDocumentId: 'SO-000001',
      actorId: actor.id,
    });

    await expect(
      db.prisma.$transaction(async (tx) => {
        await postStockMovement(tx, line(water.id, -2)); // fine: 10 -> 8
        await postStockMovement(tx, line(tissue.id, -6)); // short: only 5
      }),
    ).rejects.toMatchObject({ data: { code: 'INSUFFICIENT_STOCK' } });

    expect(await db.balance('SKU001', 'B01')).toBe(10);
    expect(await db.balance('SKU002', 'B01')).toBe(5);
    expect(await db.prisma.stockMovement.count()).toBe(0);
  });
});

describe('concurrency (INV-04)', () => {
  it('lets exactly one of two concurrent sales of 7 succeed from a stock of 10 (AC-07)', async () => {
    const sale = await receiptInput({ quantityChange: -7, type: 'SALE' });

    const results = await Promise.allSettled([
      db.prisma.$transaction((tx) => postStockMovement(tx, sale)),
      db.prisma.$transaction((tx) => postStockMovement(tx, sale)),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected');
    expect(rejected).toMatchObject({ reason: { data: { code: 'INSUFFICIENT_STOCK' } } });
    expect(await db.balance('SKU001', 'B01')).toBe(3);
    expect(await db.prisma.stockMovement.count()).toBe(1);
  });

  it('loses no update when many receipts land at once', async () => {
    const receipt = await receiptInput({ quantityChange: 1 });

    await Promise.all(
      Array.from({ length: 10 }, () =>
        db.prisma.$transaction((tx) => postStockMovement(tx, receipt)),
      ),
    );

    expect(await db.balance('SKU001', 'B01')).toBe(20);
    const movements = await db.prisma.stockMovement.findMany({ orderBy: { balanceAfter: 'asc' } });
    // The ledger chain is unbroken: each row starts where the previous one ended.
    expect(movements.map((m) => [m.balanceBefore, m.balanceAfter])).toEqual(
      Array.from({ length: 10 }, (_, i) => [10 + i, 11 + i]),
    );
  });
});

describe('document numbers (Section 4.3)', () => {
  it('issues consecutive numbers per prefix', async () => {
    const numbers = await db.prisma.$transaction(async (tx) => [
      await nextDocumentNumber(tx, 'GR'),
      await nextDocumentNumber(tx, 'GR'),
      await nextDocumentNumber(tx, 'SO'),
    ]);

    expect(numbers).toEqual(['GR-000001', 'GR-000002', 'SO-000001']);
  });

  it('never issues the same number twice to concurrent callers', async () => {
    const numbers = await Promise.all(
      Array.from({ length: 20 }, () =>
        db.prisma.$transaction((tx) => nextDocumentNumber(tx, 'GR')),
      ),
    );

    expect(new Set(numbers).size).toBe(20);
  });

  it('gives a number back when the transaction that took it rolls back', async () => {
    await db.prisma
      .$transaction(async (tx) => {
        await nextDocumentNumber(tx, 'GR');
        throw new Error('rollback');
      })
      .catch(() => undefined);

    expect(await db.prisma.$transaction((tx) => nextDocumentNumber(tx, 'GR'))).toBe('GR-000001');
  });

  it('rejects a malformed prefix', async () => {
    await expect(db.prisma.$transaction((tx) => nextDocumentNumber(tx, 'gr 1'))).rejects.toThrow();
  });
});
