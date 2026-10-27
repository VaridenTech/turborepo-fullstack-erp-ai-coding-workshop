import { describe, expect, it } from 'vitest';
import { InventoryListQuerySchema, StockLevelSchema } from './inventory.js';

const level = {
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
};

describe('InventoryListQuerySchema (INV-01)', () => {
  it('defaults to page 1 with 20 rows and no filters', () => {
    expect(InventoryListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('accepts a search term and a store filter, trimming the term', () => {
    const result = InventoryListQuerySchema.parse({ search: '  SKU001 ', storeId: 's1' });
    expect(result).toMatchObject({ search: 'SKU001', storeId: 's1' });
  });

  it('coerces page and pageSize from query strings', () => {
    expect(InventoryListQuerySchema.parse({ page: '2', pageSize: '50' })).toMatchObject({
      page: 2,
      pageSize: 50,
    });
  });

  it('rejects a page below 1 and a pageSize above 100', () => {
    expect(InventoryListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(InventoryListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});

describe('StockLevelSchema (INV-01)', () => {
  it('accepts a stock level with a threshold', () => {
    expect(StockLevelSchema.safeParse(level).success).toBe(true);
  });

  it('accepts a stock level with no threshold configured', () => {
    expect(
      StockLevelSchema.safeParse({ ...level, reorderThreshold: null, isLowStock: false }).success,
    ).toBe(true);
  });

  it('rejects a negative or fractional quantity (INV-03, MD-02)', () => {
    expect(StockLevelSchema.safeParse({ ...level, quantity: -1 }).success).toBe(false);
    expect(StockLevelSchema.safeParse({ ...level, quantity: 1.5 }).success).toBe(false);
  });
});
