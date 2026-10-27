import { describe, expect, it } from 'vitest';
import {
  CreateProductSchema,
  ProductListQuerySchema,
  ReorderThresholdSchema,
  UpdateProductSchema,
} from './products.js';

const base = {
  sku: 'SKU001',
  name: 'Drinking water pack of 6',
  category: 'Beverage',
  unit: 'pack',
  sellingPrice: '60.00',
};

describe('CreateProductSchema', () => {
  it('accepts a product with the required fields', () => {
    const result = CreateProductSchema.safeParse(base);

    expect(result.success).toBe(true);
  });

  it('accepts per-store reorder thresholds', () => {
    const result = CreateProductSchema.safeParse({
      ...base,
      reorderThresholds: [{ storeId: 'store-b01', threshold: 3 }],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a blank or whitespace-only sku', () => {
    expect(CreateProductSchema.safeParse({ ...base, sku: '' }).success).toBe(false);
    expect(CreateProductSchema.safeParse({ ...base, sku: '   ' }).success).toBe(false);
  });

  it('rejects a negative selling price', () => {
    const result = CreateProductSchema.safeParse({ ...base, sellingPrice: '-1.00' });

    expect(result.success).toBe(false);
  });

  it('rejects a selling price without two decimal places', () => {
    expect(CreateProductSchema.safeParse({ ...base, sellingPrice: '60' }).success).toBe(false);
    expect(CreateProductSchema.safeParse({ ...base, sellingPrice: '60.0' }).success).toBe(false);
  });

  it('accepts the Section 8.1 prices', () => {
    for (const price of ['60.00', '35.00', '120.00']) {
      expect(CreateProductSchema.safeParse({ ...base, sellingPrice: price }).success).toBe(true);
    }
  });
});

describe('ReorderThresholdSchema', () => {
  it('accepts a non-negative whole-number threshold', () => {
    expect(ReorderThresholdSchema.safeParse({ storeId: 's1', threshold: 3 }).success).toBe(true);
    expect(ReorderThresholdSchema.safeParse({ storeId: 's1', threshold: 0 }).success).toBe(true);
  });

  it('rejects a negative threshold', () => {
    expect(ReorderThresholdSchema.safeParse({ storeId: 's1', threshold: -1 }).success).toBe(false);
  });

  it('rejects a non-whole-number threshold', () => {
    expect(ReorderThresholdSchema.safeParse({ storeId: 's1', threshold: 2.5 }).success).toBe(false);
  });
});

describe('UpdateProductSchema', () => {
  const { sku: _sku, ...editable } = base;

  it('requires an id', () => {
    expect(UpdateProductSchema.safeParse(editable).success).toBe(false);
  });

  it('does not carry sku (immutable): an id plus editable fields is enough', () => {
    const result = UpdateProductSchema.safeParse({ id: 'p1', ...editable });

    expect(result.success).toBe(true);
    if (result.success) {
      expect('sku' in result.data).toBe(false);
    }
  });

  it('ignores an attempt to change sku', () => {
    const result = UpdateProductSchema.safeParse({ id: 'p1', sku: 'SKU999', ...editable });

    // The schema strips unknown keys, so sku never reaches the handler.
    expect(result.success).toBe(true);
    if (result.success) {
      expect('sku' in result.data).toBe(false);
    }
  });
});

describe('ProductListQuerySchema', () => {
  it('defaults page, pageSize, and includeInactive', () => {
    const result = ProductListQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ page: 1, pageSize: 20, includeInactive: false });
    }
  });

  it('accepts a search term and includeInactive', () => {
    const result = ProductListQuerySchema.safeParse({ search: 'water', includeInactive: true });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeInactive).toBe(true);
    }
  });

  it('treats the query string "false" as false (not coerced to true)', () => {
    const result = ProductListQuerySchema.safeParse({ includeInactive: 'false' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeInactive).toBe(false);
    }
  });

  it('treats the query string "true" as true', () => {
    const result = ProductListQuerySchema.safeParse({ includeInactive: 'true' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.includeInactive).toBe(true);
    }
  });
});
