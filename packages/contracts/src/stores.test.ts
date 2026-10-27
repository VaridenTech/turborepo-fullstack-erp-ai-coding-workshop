import { describe, expect, it } from 'vitest';
import {
  CreateStoreSchema,
  ErrorEnvelopeSchema,
  StoreListQuerySchema,
  UpdateStoreSchema,
} from './stores.js';

describe('CreateStoreSchema', () => {
  it('accepts a store with a code and a name', () => {
    const result = CreateStoreSchema.safeParse({ code: 'B01', name: 'สาขาเซ็นทรัล' });

    expect(result.success).toBe(true);
  });

  it('rejects a blank name', () => {
    const result = CreateStoreSchema.safeParse({ code: 'B01', name: '' });

    expect(result.success).toBe(false);
  });

  it('rejects a blank code', () => {
    const result = CreateStoreSchema.safeParse({ code: '', name: 'สาขาเซ็นทรัล' });

    expect(result.success).toBe(false);
  });
});

describe('UpdateStoreSchema', () => {
  it('requires an id alongside the fields', () => {
    const result = UpdateStoreSchema.safeParse({ code: 'B01', name: 'สาขาเซ็นทรัล' });

    expect(result.success).toBe(false);
  });

  it('accepts an id with a code and a name', () => {
    const result = UpdateStoreSchema.safeParse({
      id: 's1',
      code: 'B01',
      name: 'สาขาเซ็นทรัล',
    });

    expect(result.success).toBe(true);
  });
});

describe('StoreListQuerySchema', () => {
  it('defaults page and pageSize when omitted', () => {
    const result = StoreListQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 1, pageSize: 20 });
    }
  });

  it('rejects a page below 1', () => {
    const result = StoreListQuerySchema.safeParse({ page: 0 });

    expect(result.success).toBe(false);
  });
});

describe('ErrorEnvelopeSchema', () => {
  it('accepts a code with a Thai message and affected fields', () => {
    const result = ErrorEnvelopeSchema.safeParse({
      code: 'STORE_CODE_TAKEN',
      message: 'รหัสสาขานี้ถูกใช้แล้ว',
      fields: ['code'],
    });

    expect(result.success).toBe(true);
  });

  it('accepts a code with a message and no fields', () => {
    const result = ErrorEnvelopeSchema.safeParse({
      code: 'STORE_CODE_TAKEN',
      message: 'รหัสสาขานี้ถูกใช้แล้ว',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an envelope without a message', () => {
    const result = ErrorEnvelopeSchema.safeParse({ code: 'STORE_CODE_TAKEN' });

    expect(result.success).toBe(false);
  });
});
