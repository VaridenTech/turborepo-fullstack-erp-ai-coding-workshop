import { ORPCError } from '@orpc/nest';
import type { User } from '@erp/contracts';
import { describe, expect, it } from 'vitest';
import { assertStoreScope } from './store-scope.js';

function user(role: User['role'], storeId: string | null): User {
  return { id: 'u1', email: 'u@erp.local', name: 'U', role, storeId };
}

describe('assertStoreScope', () => {
  it('allows a store employee acting on their assigned store', () => {
    expect(() => assertStoreScope(user('STORE_EMPLOYEE', 's1'), 's1')).not.toThrow();
  });

  it('rejects a store employee acting on another store with a Thai FORBIDDEN envelope', () => {
    const error = (() => {
      try {
        assertStoreScope(user('STORE_EMPLOYEE', 's1'), 's2');
        return undefined;
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(ORPCError);
    const orpcError = error as ORPCError<string, unknown>;
    expect(orpcError.code).toBe('FORBIDDEN');
    expect(orpcError.data).toMatchObject({
      code: 'STORE_SCOPE_FORBIDDEN',
      message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลของสาขานี้',
    });
  });

  it('rejects a store employee with no assigned store', () => {
    expect(() => assertStoreScope(user('STORE_EMPLOYEE', null), 's1')).toThrow(ORPCError);
  });

  it('allows a manager to act on any store', () => {
    expect(() => assertStoreScope(user('MANAGER', null), 's1')).not.toThrow();
    expect(() => assertStoreScope(user('MANAGER', null), 's2')).not.toThrow();
  });

  it('allows an administrator to act on any store', () => {
    expect(() => assertStoreScope(user('ADMINISTRATOR', null), 's1')).not.toThrow();
  });

  it('allows a purchasing officer to act on any store', () => {
    expect(() => assertStoreScope(user('PURCHASING_OFFICER', null), 's2')).not.toThrow();
  });
});
