import { describe, expect, it } from 'vitest';
import {
  CreateSupplierSchema,
  SupplierListQuerySchema,
  UpdateSupplierSchema,
} from './suppliers.js';

describe('CreateSupplierSchema', () => {
  it('accepts a supplier with just a code and a name', () => {
    const result = CreateSupplierSchema.safeParse({ code: 'SUP01', name: 'SupplyOne Co Ltd' });

    expect(result.success).toBe(true);
  });

  it('accepts optional contact details', () => {
    const result = CreateSupplierSchema.safeParse({
      code: 'SUP01',
      name: 'SupplyOne Co Ltd',
      contactPerson: 'Somchai',
      phone: '021234567',
      email: 'sales@supplyone.co.th',
      address: 'Bangkok',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a blank code', () => {
    const result = CreateSupplierSchema.safeParse({ code: '', name: 'SupplyOne Co Ltd' });

    expect(result.success).toBe(false);
  });

  it('rejects a blank name', () => {
    const result = CreateSupplierSchema.safeParse({ code: 'SUP01', name: '' });

    expect(result.success).toBe(false);
  });

  it('rejects an invalid email when one is given', () => {
    const result = CreateSupplierSchema.safeParse({
      code: 'SUP01',
      name: 'SupplyOne Co Ltd',
      email: 'not-an-email',
    });

    expect(result.success).toBe(false);
  });

  it('treats an empty email as absent', () => {
    const result = CreateSupplierSchema.safeParse({
      code: 'SUP01',
      name: 'SupplyOne Co Ltd',
      email: '',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBeUndefined();
    }
  });
});

describe('UpdateSupplierSchema', () => {
  it('requires an id alongside the fields', () => {
    const result = UpdateSupplierSchema.safeParse({ code: 'SUP01', name: 'SupplyOne Co Ltd' });

    expect(result.success).toBe(false);
  });

  it('accepts an id with a code and a name', () => {
    const result = UpdateSupplierSchema.safeParse({
      id: 'sup1',
      code: 'SUP01',
      name: 'SupplyOne Co Ltd',
    });

    expect(result.success).toBe(true);
  });
});

describe('SupplierListQuerySchema', () => {
  it('defaults page and pageSize when omitted', () => {
    const result = SupplierListQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 1, pageSize: 20 });
    }
  });

  it('rejects a page below 1', () => {
    const result = SupplierListQuerySchema.safeParse({ page: 0 });

    expect(result.success).toBe(false);
  });
});
