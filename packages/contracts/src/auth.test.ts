import { describe, expect, it } from 'vitest';
import { LoginInputSchema, RoleSchema, SessionSchema, UserSchema } from './auth.js';

describe('LoginInputSchema', () => {
  it('accepts an email and password', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin@erp.local', password: 'password' });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin', password: 'password' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = LoginInputSchema.safeParse({ email: 'admin@erp.local', password: '' });

    expect(result.success).toBe(false);
  });
});

describe('SessionSchema', () => {
  it('accepts a signed-out session', () => {
    expect(SessionSchema.safeParse({ user: null }).success).toBe(true);
  });

  it('rejects an unknown role', () => {
    const result = SessionSchema.safeParse({
      user: { id: '1', email: 'a@erp.local', name: 'A', role: 'OWNER', storeId: null },
    });

    expect(result.success).toBe(false);
  });
});

describe('RoleSchema', () => {
  it.each(['ADMINISTRATOR', 'PURCHASING_OFFICER', 'STORE_EMPLOYEE', 'MANAGER'])(
    'accepts the %s role',
    (role) => {
      expect(RoleSchema.safeParse(role).success).toBe(true);
    },
  );

  it.each(['ADMIN', 'STAFF'])('rejects the retired %s role', (role) => {
    expect(RoleSchema.safeParse(role).success).toBe(false);
  });
});

describe('UserSchema', () => {
  it('accepts a store employee with an assigned store', () => {
    const result = UserSchema.safeParse({
      id: 'u1',
      email: 'staff_b01@erp.local',
      name: 'Staff B01',
      role: 'STORE_EMPLOYEE',
      storeId: 's1',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a non-scoped role with a null store', () => {
    const result = UserSchema.safeParse({
      id: 'u2',
      email: 'manager01@erp.local',
      name: 'Manager 01',
      role: 'MANAGER',
      storeId: null,
    });

    expect(result.success).toBe(true);
  });

  it('requires storeId to be present (nullable, not optional)', () => {
    const result = UserSchema.safeParse({
      id: 'u3',
      email: 'a@erp.local',
      name: 'A',
      role: 'ADMINISTRATOR',
    });

    expect(result.success).toBe(false);
  });
});
