import { Test } from '@nestjs/testing';
import { call } from '@orpc/server';
import { ORPCError } from '@orpc/nest';
import type { Prisma } from '@erp/database';
import type { User } from '@erp/contracts';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { InventoryController } from './inventory.controller.js';

async function createController(queryRaw: ReturnType<typeof vi.fn>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [InventoryController],
    providers: [{ provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
  }).compile();
  return moduleRef.get(InventoryController);
}

function user(role: User['role'], storeId: string | null): User {
  return { id: 'u1', email: 'u@erp.local', name: 'U', role, storeId };
}

/** A row as the stock-level query returns it (INV-01). */
function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    productId: 'p1',
    sku: 'SKU001',
    productName: 'น้ำดื่มแพ็ค 6',
    unit: 'แพ็ค',
    storeId: 's1',
    storeCode: 'B01',
    storeName: 'สาขาเซ็นทรัล',
    quantity: 10,
    reorderThreshold: 3,
    total: 1,
    ...overrides,
  };
}

const manager = user('MANAGER', null);
const defaults = { page: 1, pageSize: 20 };

describe('InventoryController (INV-01)', () => {
  it('returns quantity, unit, threshold and a not-low flag for a healthy balance', async () => {
    const controller = await createController(vi.fn().mockResolvedValue([row()]));

    const result = await call(controller.list(manager), defaults);

    expect(result).toEqual({
      items: [
        {
          productId: 'p1',
          sku: 'SKU001',
          productName: 'น้ำดื่มแพ็ค 6',
          unit: 'แพ็ค',
          storeId: 's1',
          storeCode: 'B01',
          storeName: 'สาขาเซ็นทรัล',
          quantity: 10,
          reorderThreshold: 3,
          isLowStock: false,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
  });

  it('flags low stock when quantity is below the threshold', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue([row({ quantity: 2, reorderThreshold: 3 })]),
    );

    const { items } = await call(controller.list(manager), defaults);

    expect(items[0]?.isLowStock).toBe(true);
  });

  it('flags low stock when quantity equals the threshold (<=, not <)', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue([row({ quantity: 3, reorderThreshold: 3 })]),
    );

    const { items } = await call(controller.list(manager), defaults);

    expect(items[0]?.isLowStock).toBe(true);
  });

  it('flags a zero balance as low stock (AC-08: SKU003 at 0 vs threshold 3)', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue([row({ sku: 'SKU003', quantity: 0, reorderThreshold: 3 })]),
    );

    const { items } = await call(controller.list(manager), defaults);

    expect(items[0]).toMatchObject({ sku: 'SKU003', quantity: 0, isLowStock: true });
  });

  it('never flags a row with no threshold configured', async () => {
    const controller = await createController(
      vi.fn().mockResolvedValue([row({ quantity: 0, reorderThreshold: null })]),
    );

    const { items } = await call(controller.list(manager), defaults);

    expect(items[0]).toMatchObject({ reorderThreshold: null, isLowStock: false });
  });

  it('returns an empty page with total 0 when nothing matches', async () => {
    const controller = await createController(vi.fn().mockResolvedValue([]));

    await expect(call(controller.list(manager), { ...defaults, search: 'nope' })).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    });
  });

  it('passes the search term and the requested store to the query as parameters', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const controller = await createController(queryRaw);

    await call(controller.list(manager), { ...defaults, search: 'SKU001', storeId: 's1' });

    const sql = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(sql.values).toEqual(expect.arrayContaining(['%SKU001%', 's1']));
  });

  it('lets a store employee read their own store', async () => {
    const queryRaw = vi.fn().mockResolvedValue([row()]);
    const controller = await createController(queryRaw);

    await expect(
      call(controller.list(user('STORE_EMPLOYEE', 's1')), { ...defaults, storeId: 's1' }),
    ).resolves.toMatchObject({ total: 1 });
  });

  it('confines a store employee to their assigned store when no store is requested', async () => {
    const queryRaw = vi.fn().mockResolvedValue([row()]);
    const controller = await createController(queryRaw);

    await call(controller.list(user('STORE_EMPLOYEE', 's1')), defaults);

    const sql = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(sql.values).toContain('s1');
  });

  it('rejects a store employee asking for another store and never queries', async () => {
    const queryRaw = vi.fn();
    const controller = await createController(queryRaw);

    const error = await call(controller.list(user('STORE_EMPLOYEE', 's1')), {
      ...defaults,
      storeId: 's2',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ORPCError);
    expect((error as ORPCError<string, unknown>).code).toBe('FORBIDDEN');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('rejects a store employee with no assigned store', async () => {
    const queryRaw = vi.fn();
    const controller = await createController(queryRaw);

    await expect(call(controller.list(user('STORE_EMPLOYEE', null)), defaults)).rejects.toThrow(
      ORPCError,
    );
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('lets a manager search every store', async () => {
    const queryRaw = vi.fn().mockResolvedValue([row(), row({ storeId: 's2', storeCode: 'B02' })]);
    const controller = await createController(queryRaw);

    const { items } = await call(controller.list(manager), defaults);

    expect(items.map((i) => i.storeCode)).toEqual(['B01', 'B02']);
  });
});
