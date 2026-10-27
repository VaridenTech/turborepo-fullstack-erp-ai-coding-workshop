Closes #3

## Summary

Replaces the two-value role model with the four TOR roles, adds a per-user store assignment, introduces a reusable store-scope enforcement helper, and reseeds the demo users to TOR Section 8.1.

- **Roles**: `Role` enum is now `ADMINISTRATOR` / `PURCHASING_OFFICER` / `STORE_EMPLOYEE` / `MANAGER` (default `STORE_EMPLOYEE`). `RoleSchema` in the contract follows, and `UserSchema` gains `storeId` (nullable). `USER_SELECT` carries `storeId` so the signed-in user knows its assignment.
- **Store assignment**: `User.storeId` is a nullable FK to `Store` (`Store.employees` back-relation). A DB `CHECK` constraint enforces the Section 2 invariant — `STORE_EMPLOYEE` iff a store is assigned.
- **Store-scope helper** (`apps/api/src/auth/store-scope.ts`): `assertStoreScope(user, targetStoreId)` confines a `STORE_EMPLOYEE` to their assigned store and raises the shared Thai `FORBIDDEN` envelope otherwise; `ADMINISTRATOR`, `MANAGER`, and `PURCHASING_OFFICER` are not store-scoped. Reusable by every future store-scoped handler (goods receipts, sales).
- **Seed**: stores B01 / B02 plus `buyer01` (PURCHASING_OFFICER), `staff_b01` (STORE_EMPLOYEE → B01), `staff_b02` (STORE_EMPLOYEE → B02), `manager01` (MANAGER), `administrator` (ADMINISTRATOR), all sign-in-able with password `password`.
- **Migration of #2's code**: `@Roles('ADMIN')` → `@Roles('ADMINISTRATOR')` in the stores module, the login demo accounts, the layout role gate, and every test fixture (now carrying `storeId`).

## Testing

TDD at the ticket's seams:

- **Seam 1 — API controller spec**: `assertStoreScope` unit cases (store employee confined / rejected for another store / rejected with no assignment; manager, administrator, purchasing officer unscoped), **plus** the same enforcement driven through a controller handler so AC2 (store employee rejected at the API) and AC3 (manager allowed across stores) are observable at seam 1 — not only as a pure-function test.
- **Seam 2 — Zod schema test**: `RoleSchema` accepts the four roles and rejects the retired `ADMIN`/`STAFF`; `UserSchema` accepts a store employee with a store id, a non-scoped role with `null`, and rejects a missing `storeId`.
- **Seam 3 — web component test**: the role migration is exercised through the existing stores screen tests — the `สาขา` nav link shows for `ADMINISTRATOR` and is hidden for a `STORE_EMPLOYEE`; login/demo fixtures use the new accounts.

## Evidence

`pnpm check` (lint + typecheck + test + build) and `pnpm format` pass from the repo root.

### Demo — reproduces the ticket's `Demo:` line

Each seeded user signs in; a store employee's requests are scoped to their assigned store; an Administrator can manage master data but has no transaction-approval rights.

Bring the stack up and reset the database so the new migration (enum swap, `User.storeId` FK, the `CHECK` constraint) and the reseed both run:

```bash
pnpm docker:up           # postgres + api + web
pnpm db:reset            # wipe, re-migrate, reseed — 2 stores + 5 users
```

URLs: web `http://localhost:5173`, API `http://localhost:3000/api`, Swagger `http://localhost:3000/api/docs`.

**1. Each seeded user signs in.** At `http://localhost:5173`, sign in with password `password` as each account (all are on the login page):

| Email                     | Role               | Store |
| ------------------------- | ------------------ | ----- |
| `buyer01@erp.local`       | PURCHASING_OFFICER | —     |
| `staff_b01@erp.local`     | STORE_EMPLOYEE     | B01   |
| `staff_b02@erp.local`     | STORE_EMPLOYEE     | B02   |
| `manager01@erp.local`     | MANAGER            | —     |
| `administrator@erp.local` | ADMINISTRATOR      | —     |

Each returns a session; the signed-in user now carries `role` and `storeId`.

**2. A store employee is scoped to their assigned store.** `staff_b01` is assigned B01, `staff_b02` is assigned B02. `assertStoreScope(user, targetStoreId)` lets `staff_b01` act on B01 and rejects B02 (and vice versa) with the shared Thai `FORBIDDEN` envelope (`คุณไม่มีสิทธิ์เข้าถึงข้อมูลของสาขานี้`); a `MANAGER`/`ADMINISTRATOR`/`PURCHASING_OFFICER` is not store-scoped. This is the behaviour proven at seam 1 in `apps/api/src/auth/store-scope.spec.ts` — run it directly:

```bash
pnpm turbo run test --filter=@erp/api
```

The first store-scoped production route (goods receipts, sales) that calls the helper lands in the blocked tickets (#16/#11/#10/#6); no production route calls it in this PR.

**3. An Administrator manages master data but has no approval rights.** `administrator@erp.local` sees the `สาขา` (stores) master-data screen (the nav link is gated to `ADMINISTRATOR`); no transaction-approval route exists in this PR — approvals arrive with the purchase-order workflow (#08). AC4 therefore holds by construction.

## Merge danger

- Everyone inherits a migration that rewrites the `Role` enum, adds `User.storeId` (FK + `CHECK`), and reseeds all demo users. The old `admin@`/`staff@` accounts are gone; use the table above.
- The migration now backfills the retired enum values in the cast (`ADMIN` → `ADMINISTRATOR`, `STAFF` → `STORE_EMPLOYEE`) so it applies on a database seeded on the old enum, not only on a fresh `migrate reset`. A database carrying old `STAFF` rows with no `storeId` would still trip the new `CHECK`; those environments should reset or be backfilled with store assignments.
- `RoleSchema` / `UserSchema` and `USER_SELECT` are shared-package changes every downstream ticket builds on. Blocked tickets (goods receipts, sales) will call `assertStoreScope`; the `FORBIDDEN` envelope shape and the unscoped-purchasing decision propagate to them.

## Notes

- `AC4` ("an Administrator has no approval capability wired to their role") holds by construction — no approval routes exist yet; they arrive in the blocked-by tickets.
- The store-scope helper is deliberately not yet called from a production route: the first store-scoped routes (goods receipts, sales) land in later tickets and will call it directly.
- The purchasing-officer-unscoped reading is a judgement call documented in the helper; Section 2 is silent on purchasing, so this is flagged for the human to confirm against intent.
