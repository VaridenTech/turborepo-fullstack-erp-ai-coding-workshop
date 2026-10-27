import type { User } from '@erp/contracts';
import { call } from '@orpc/server';
import { describe, expect, it } from 'vitest';
import { useSection81Fixture } from '../../test/integration/harness.js';
import type { PrismaService } from '../database/prisma.service.js';
import { InventoryController } from './inventory.controller.js';
import { postStockMovement } from './stock-ledger.js';

const db = useSection81Fixture();

function controller() {
  return new InventoryController(db.prisma as unknown as PrismaService);
}

async function signedIn(email: string): Promise<User> {
  const user = await db.user(email);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    storeId: user.storeId,
  };
}

const defaults = { page: 1, pageSize: 20 };

// The SQL behind INV-01 runs for real here; seam 1 covers the mapping with a stub.
describe('stock search against Postgres (INV-01)', () => {
  it('lists every product in every store, zero-stock rows included', async () => {
    const manager = await signedIn('manager01@erp.local');

    const result = await call(controller().list(manager), defaults);

    expect(result.total).toBe(6);
    expect(result.items.map((i) => [i.sku, i.storeCode, i.quantity])).toEqual([
      ['SKU001', 'B01', 10],
      ['SKU001', 'B02', 0],
      ['SKU002', 'B01', 5],
      ['SKU002', 'B02', 0],
      ['SKU003', 'B01', 0],
      ['SKU003', 'B02', 0],
    ]);
  });

  it('shows unit, threshold and the low-stock flag: SKU003 at 0 is low, SKU001 at 10 is not (AC-08)', async () => {
    const manager = await signedIn('manager01@erp.local');

    const { items } = await call(controller().list(manager), {
      ...defaults,
      storeId: (await db.store('B01')).id,
    });

    const bySku = Object.fromEntries(items.map((i) => [i.sku, i]));
    expect(bySku.SKU001).toMatchObject({ unit: 'แพ็ค', reorderThreshold: 3, isLowStock: false });
    expect(bySku.SKU002).toMatchObject({ quantity: 5, isLowStock: false });
    expect(bySku.SKU003).toMatchObject({
      unit: 'ถุง',
      quantity: 0,
      reorderThreshold: 3,
      isLowStock: true,
    });
  });

  it('searches by SKU, by product name and by store', async () => {
    const manager = await signedIn('manager01@erp.local');
    const search = async (term: string) =>
      (await call(controller().list(manager), { ...defaults, search: term })).items.map(
        (i) => `${i.sku}@${i.storeCode}`,
      );

    expect(await search('sku002')).toEqual(['SKU002@B01', 'SKU002@B02']);
    expect(await search('ทิชชู่')).toEqual(['SKU002@B01', 'SKU002@B02']);
    expect(await search('B02')).toEqual(['SKU001@B02', 'SKU002@B02', 'SKU003@B02']);
    expect(await search('no-such-thing')).toEqual([]);
  });

  it('flips to low stock the moment a posted movement takes the balance to the threshold', async () => {
    const manager = await signedIn('manager01@erp.local');
    const [product, store] = await Promise.all([db.product('SKU001'), db.store('B01')]);
    await db.prisma.$transaction((tx) =>
      postStockMovement(tx, {
        productId: product.id,
        storeId: store.id,
        quantityChange: -7,
        type: 'SALE',
        sourceDocumentType: 'SALE',
        sourceDocumentId: 'SO-000001',
        actorId: manager.id,
      }),
    );

    const { items } = await call(controller().list(manager), {
      ...defaults,
      search: 'SKU001',
      storeId: store.id,
    });

    expect(items[0]).toMatchObject({ quantity: 3, reorderThreshold: 3, isLowStock: true });
  });

  it('paginates and reports the full total', async () => {
    const manager = await signedIn('manager01@erp.local');

    const page2 = await call(controller().list(manager), { page: 2, pageSize: 4 });

    expect(page2.total).toBe(6);
    expect(page2.items).toHaveLength(2);
  });

  it('confines a store employee to their own store and refuses another (AC-04 flavour)', async () => {
    const staffB02 = await signedIn('staff_b02@erp.local');
    const b01 = await db.store('B01');

    const own = await call(controller().list(staffB02), defaults);
    expect(new Set(own.items.map((i) => i.storeCode))).toEqual(new Set(['B02']));

    await expect(
      call(controller().list(staffB02), { ...defaults, storeId: b01.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
