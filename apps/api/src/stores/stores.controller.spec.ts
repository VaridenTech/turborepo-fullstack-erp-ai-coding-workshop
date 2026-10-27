import { Test } from '@nestjs/testing';
import { call } from '@orpc/server';
import { ORPCError } from '@orpc/nest';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { StoresController } from './stores.controller.js';

async function createController(prisma: Record<string, unknown>) {
  const moduleRef = await Test.createTestingModule({
    controllers: [StoresController],
    providers: [{ provide: PrismaService, useValue: prisma }],
  }).compile();
  return moduleRef.get(StoresController);
}

const central = {
  id: 's1',
  code: 'B01',
  name: 'สาขาเซ็นทรัล',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('StoresController', () => {
  it('lists stores newest-first with pagination metadata', async () => {
    const findMany = vi.fn().mockResolvedValue([central]);
    const count = vi.fn().mockResolvedValue(1);
    const controller = await createController({ store: { findMany, count } });

    const result = await call(controller.list(), { page: 1, pageSize: 20 });

    expect(result).toEqual({
      items: [
        {
          ...central,
          createdAt: central.createdAt.toISOString(),
          updatedAt: central.updatedAt.toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    // Newest-first ordering and the page window are asked of the database.
    expect(findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('skips the right window for a later page', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const controller = await createController({ store: { findMany, count } });

    await call(controller.list(), { page: 3, pageSize: 10 });

    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' }, skip: 20, take: 10 });
  });

  it('creates a store with a unique code and returns it', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const create = vi.fn().mockResolvedValue(central);
    const controller = await createController({ store: { findUnique, create } });

    const result = await call(controller.create(), { code: 'B01', name: 'สาขาเซ็นทรัล' });

    expect(result).toMatchObject({ id: 's1', code: 'B01', name: 'สาขาเซ็นทรัล' });
    expect(create).toHaveBeenCalledWith({ data: { code: 'B01', name: 'สาขาเซ็นทรัล' } });
  });

  it('rejects a duplicate code with the Thai error envelope', async () => {
    const findUnique = vi.fn().mockResolvedValue(central);
    const create = vi.fn();
    const controller = await createController({ store: { findUnique, create } });

    const error = await call(controller.create(), { code: 'B01', name: 'สาขาใหม่' }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ORPCError);
    const orpcError = error as ORPCError<string, unknown>;
    expect(orpcError.code).toBe('CONFLICT');
    expect(orpcError.data).toMatchObject({
      code: 'STORE_CODE_TAKEN',
      message: 'รหัสสาขานี้ถูกใช้แล้ว',
      fields: ['code'],
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects a blank name before touching the database', async () => {
    const create = vi.fn();
    const controller = await createController({ store: { create } });

    await expect(call(controller.create(), { code: 'B01', name: '' })).rejects.toBeInstanceOf(
      ORPCError,
    );
    expect(create).not.toHaveBeenCalled();
  });
});
