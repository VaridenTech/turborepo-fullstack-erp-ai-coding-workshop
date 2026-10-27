import type { User } from '@erp/contracts';
import { ORPCError } from '@orpc/nest';

/**
 * Roles that are NOT store-scoped: they may act across every store.
 * The spec names Managers and Administrators; Purchasing officers are included
 * because they raise purchase orders for any destination store (Section 2 is
 * silent on them, so they default to cross-store like the other head-office roles).
 */
const UNSCOPED_ROLES: ReadonlySet<User['role']> = new Set([
  'ADMINISTRATOR',
  'MANAGER',
  'PURCHASING_OFFICER',
]);

/**
 * Enforce per-store access (Section 2, NFR-01). Reusable by any handler that acts
 * on store-scoped data: call it with the signed-in user and the store the request
 * targets.
 *
 * - STORE_EMPLOYEE may only act on their assigned store; any other store (or no
 *   assignment at all) is rejected.
 * - ADMINISTRATOR, MANAGER, and PURCHASING_OFFICER are not store-scoped.
 *
 * Rejections surface the shared Thai error envelope (NFR-04), never a raw error.
 */
export function assertStoreScope(user: User, targetStoreId: string): void {
  if (UNSCOPED_ROLES.has(user.role)) return;

  if (user.storeId && user.storeId === targetStoreId) return;

  throw new ORPCError('FORBIDDEN', {
    data: {
      code: 'STORE_SCOPE_FORBIDDEN',
      message: 'คุณไม่มีสิทธิ์เข้าถึงข้อมูลของสาขานี้',
      fields: ['storeId'],
    },
  });
}
