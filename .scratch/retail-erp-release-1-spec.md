## Problem Statement

RetailOne operates a head office and two stores (B01 Central, B02 Riverside). Product records, purchase orders, and stock balances live in separate files, so stock checks are slow and goods get received twice. Staff cannot trust the on-screen stock number, purchasing cannot see receiving progress, and managers have no cross-store view or audit trail. They need one web application that connects purchasing, receiving, sales, and reporting with traceable, non-negative, per-store inventory that never double-counts a receipt or oversells a product — even under retries and concurrent use.

## Solution

Deliver the complete first-release Retail ERP baseline from the TOR on top of this monorepo (React 19 web, NestJS API, shared oRPC + Zod contract, Prisma + Postgres). The system supports one organization, Thai baht, one base unit per SKU, per-store stock, Thai screens, and Asia/Bangkok times. It covers master data, inventory with an append-only movement ledger, purchase orders with an approval workflow, partial goods receipts, sales, reports with CSV export, and the security/audit/validation nonfunctional requirements. Correctness under concurrency and retries is a first-class feature: posting and stock update happen in one transaction with conditional stock checks, and confirm endpoints are idempotent via a client-supplied key.

## User Stories

1. As an Administrator, I want to create and edit products with SKU, name, category, unit, selling price, active status, and a per-store reorder threshold, so that the catalogue reflects what we sell. (MD-01)
2. As an Administrator, I want SKUs to be unique across the organization and immutable once a transaction references the product, so that historical documents stay consistent. (MD-01)
3. As an Administrator, I want selling prices and reorder thresholds rejected when negative and stock quantities constrained to whole numbers, so that invalid data cannot enter the system. (MD-02)
4. As an Administrator, I want to deactivate a product while keeping it searchable in historical records, and I want inactive products blocked from new documents, so that we retire items without losing history. (MD-02)
5. As an Administrator, I want to maintain store codes/names and supplier codes/names/contact details, so that purchase orders can reference a real supplier and destination store. (MD-03)
6. As an Administrator, I want to manage users, stores, products, and suppliers without automatically gaining transaction-approval rights, so that administration and approval stay separated. (Section 2)
7. As a Store employee, I want to search stock by SKU, product name, and store and see current quantity, unit, reorder threshold, and low-stock status, so that I know what is on hand. (INV-01)
8. As a Manager, I want every stock increase or decrease to record product, store, quantity change, balances before and after, movement type, source document, actor, and timestamp, so that every movement is traceable. (INV-02)
9. As a Manager, I want confirmed movements to be immutable, so that the ledger cannot be altered after the fact. (INV-02)
10. As any user, I want stock balances to equal opening balance plus successful movements and never go negative, so that the numbers are always trustworthy. (INV-03)
11. As any user, I want document posting and the stock update to succeed together or roll back together, so that a failure never leaves stock and documents out of sync. (INV-03)
12. As any user, I want concurrent transactions on the same product and store to never lose an update, validating the latest balance at confirm time rather than trusting the browser, so that two people cannot oversell. (INV-04)
13. As a Manager, I want to increase or decrease stock with a mandatory reason recorded in movement history, and reductions larger than the available balance rejected, so that adjustments are controlled and auditable. (INV-05)
14. As any user, I want document numbers to be unique, so that references are unambiguous. (Section 4.3)
15. As any user, I want changes to master data to never alter names, prices, or details already recorded in historical documents, so that past documents remain faithful snapshots. (Section 4.3)
16. As any user, I want each line computed as quantity times unit price and the document total as the sum of lines, to two decimal places, with no discounts or taxes, so that totals are simple and correct. (Section 4.3)
17. As a Purchasing officer, I want to create draft purchase orders with a supplier, destination store, expected receipt date, and at least one line of positive whole-number quantities and non-negative unit prices, with no duplicate SKUs, so that orders are well-formed. (PO-01)
18. As a Purchasing officer, I want purchase order statuses of Draft, Pending Approval, Approved, Partially Received, Completed, Rejected, and Cancelled, with creating/approving never changing stock, so that the order lifecycle is explicit and does not touch inventory. (PO-02)
19. As a Purchasing officer, I want to edit drafts and submit them when complete, so that I can prepare an order before sending it for approval. (PO-03)
20. As a Manager, I want to approve or reject submitted orders with a reason, after which approved lines, quantities, prices, and destination store cannot change, so that approvals are final and accountable. (PO-03)
21. As a Purchasing officer, I want rejected orders to remain viewable and to require a brand-new order to resubmit, so that history is preserved and nothing is silently re-opened. (PO-03)
22. As a Purchasing officer or Manager, I want to cancel only Draft or Pending Approval orders with a reason, so that approved or partially received orders cannot be cancelled in this release. (PO-04)
23. As a Store employee, I want to receive only Approved or Partially Received orders for my assigned store, seeing ordered, previously received, and outstanding quantities per line, so that I can record deliveries accurately. (GR-01)
24. As a Store employee, I want to record partial receipts across multiple deliveries, each a non-negative whole number with at least one line greater than zero, never exceeding ordered quantities and never adding products outside the order, so that receiving matches reality. (GR-02)
25. As a Store employee, I want confirmation to create a goods receipt number, increase destination-store stock, and record movements, moving the order to Partially Received or Completed, so that stock and order status reflect the delivery. (GR-03)
26. As a Store employee, I want repeated confirmation clicks, duplicate requests, and network-retry resends to never increase stock twice and to return the original receipt, while still allowing a deliberately new receipt, so that flaky networks never corrupt stock. (GR-04)
27. As a Store employee, I want concurrent receiving requests to never exceed the ordered quantity in total, and confirmed receipts to be viewable but not editable or cancellable, so that races cannot over-receive. (GR-05)
28. As a Store employee, I want to create sales for my assigned store using active products and positive whole-number quantities at the current selling price retained in the document, with no price override, so that sales are priced correctly and consistently. (SAL-01)
29. As a Store employee, I want draft sales to not reduce stock, and confirmation to validate the latest stock for every line and reject the entire document (identifying the affected products) if any line is short, with no partial posting, so that we never oversell or half-post a sale. (SAL-02)
30. As a Store employee, I want successful confirmation to generate a document number, record the sale, and decrease stock with movement history in one transaction, with duplicate confirmation creating no second sale or deduction, so that a sale posts exactly once. (SAL-03)
31. As a Store employee, I want confirmed sales to be viewable but not editable, cancellable, or returnable in this release, so that the record is final. (SAL-04)
32. As a Manager, I want daily sales reports filtered by date range and store, including only confirmed sales and showing document count, units sold, and total amount, so that I can see trading performance. (RPT-01)
33. As a Manager or Store employee, I want stock-on-hand and low-stock reports by store with product search, where zero-stock products stay visible when they match, so that I can spot shortages. (RPT-02)
34. As a Manager, I want movement history filtered by product, store, movement type, and date range with access to the source document, so that I can audit any change; Store employees see only their store while Managers see all. (RPT-03)
35. As a Manager, I want to export sales and stock reports as CSV that supports Thai text, applies the same filters and permissions as the screen, and safely handles values a spreadsheet might read as formulas, so that I can share data without corruption or injection. (RPT-04)
36. As a Manager, I want a reporting day defined as 00:00:00 inclusive to the next day 00:00:00 exclusive in Asia/Bangkok using the sale confirmation timestamp, so that daily totals align with local business days. (Section 6.2)
37. As any user, I want lists paginated and ordered newest-first, with loading/success/error states and error messages that say whether to correct input or retry, so that screens are usable and clear. (Section 6.2)
38. As a security stakeholder, I want authentication required before any data access and both role and store permissions enforced at the API on every request (not just hidden buttons), so that permissions cannot be bypassed. (NFR-01)
39. As a security stakeholder, I want passwords never stored as readable text or logged, secrets/tokens never logged, non-production test data used, and configuration kept out of source code, so that we protect credentials and data. (NFR-02)
40. As a Manager, I want approvals, goods receipts, sales, and stock adjustments audited with actor, timestamp, source document, and outcome, with audit access restricted by permission, so that sensitive actions are accountable. (NFR-03)
41. As any user, I want input validated in both the interface and the API with actionable Thai error messages that never expose stack traces or database details, so that mistakes are caught and explained safely. (NFR-04)
42. As a stakeholder, I want the system to handle 1,000 products, 10,000 movements, and 10 concurrent users with search and stock-view APIs at p95 ≤ 2s over a continuous 5-minute test, so that it performs under realistic load. (NFR-05)
43. As a user, I want core screens to work on agreed desktop browsers at 1366px width, with labelled fields and keyboard-operable core flows, so that the app is usable and accessible. (NFR-06)
44. As a Store employee receiving 8 of 20 ordered packs, I want stock to rise from 10 to 18, outstanding to be 12, status Partially Received, and exactly one receipt and one movement created, so that partial receiving is correct. (AC-01)
45. As a Store employee who resends an identical receive request, I want the original receipt returned with stock and cumulative received unchanged, so that retries are safe. (AC-02)
46. As a Store employee attempting to receive 21 against a 20-pack order, I want rejection with no receipt or movement and status unchanged, so that over-receipt is impossible. (AC-03)
47. As security enforcement, I want a direct API receive request by a staff member for another store rejected with no data change, so that store scoping holds at the API. (AC-04)
48. As a Store employee selling 11 when 10 are in stock, I want the whole sale rejected with no confirmed sale or deduction, so that we never oversell. (AC-05)
49. As a Store employee selling 2 SKU001 and 1 SKU002, I want a total of 155.00 and balances of 8 and 4, with an identical resend causing no further change, so that sales total correctly and post once. (AC-06)
50. As a race condition on stock of 10 with two concurrent sales of 7, I want exactly one to succeed and final stock to be 3, so that concurrency cannot oversell. (AC-07)
51. As a Manager viewing a day with no sales, I want zero totals and a clear empty state, and I want SKU003 at balance 0 to appear in the B01 low-stock report, so that empty and low-stock cases display correctly. (AC-08)

## Implementation Decisions

**Release scope.** The full TOR functional baseline end-to-end: Master Data (MD-01..03), Inventory (INV-01..05), Purchasing (PO-01..04), Goods Receipts (GR-01..05), Sales (SAL-01..04), Reports (RPT-01..04), and the nonfunctional requirements NFR-01..06. Everything in TOR Section 3 and all future items Q-01..Q-05 and CR-01 are out.

**Contract-first, one module per feature.** The API shape lives in `@erp/contracts` as oRPC routes with Zod schemas; the API implements each route with `@Implement(contract.<feature>.<route>)`, the web calls it through the typed `orpc` client, and both derive types via `z.infer`. New Nest modules per feature (products, suppliers, stores, inventory, purchase-orders, goods-receipts, sales, reports), each registered in `app.module.ts`. No hand-written request/response types, no `class-validator` DTOs, no hand-written `fetch` in web.

**Roles and store scoping.** Replace the current two-value `Role` enum (`ADMIN`, `STAFF`) with the four TOR roles: `ADMINISTRATOR`, `PURCHASING_OFFICER`, `STORE_EMPLOYEE`, `MANAGER`. Add a single store assignment to users (`storeId`, required for Store employees, null for others). Enforcement is at the API on every request via the existing global `AuthGuard` plus `@Roles(...)` and a store-scope check in handlers: Store employees are restricted to their assigned store for all reads and writes; Managers and Administrators are not store-scoped (Managers see all stores). Seed users become `buyer01`, `staff_b01`, `staff_b02`, `manager01` plus an administrator, matching TOR Section 8.1.

**Stock as an append-only movement ledger.** A `StockMovement` record captures product, store, quantity change, balance before, balance after, movement type (`RECEIPT`, `SALE`, `ADJUSTMENT`), source document reference, actor, and timestamp; confirmed movements are immutable. A per-(product, store) current-balance row is updated inside the same transaction that inserts the movement. Balances are opening plus successful movements and are constrained to be non-negative. This ledger is the authoritative source for INV-01/02/03, RPT-02/03, and the stock-change portion of the audit trail.

**Atomicity and concurrency.** Posting a document and updating stock happen in a single Prisma transaction. Stock decrements/validations use a conditional update (reject when the latest balance is insufficient) rather than trusting a value read earlier or sent by the browser, so concurrent transactions cannot lose updates or oversell (INV-04, GR-05, SAL-02, AC-07). The current-balance row is the concurrency control point.

**Idempotency on confirm endpoints.** Goods-receipt confirm and sales confirm accept a client-supplied `Idempotency-Key` (request header), persisted with the created document and unique per endpoint and actor. A replay with the same key returns the original stored result (GR-04 "return the original receipt", SAL-03); a new key produces a new document (GR-04 "a deliberately new receipt must still be possible").

**Purchase-order state machine.** Statuses Draft, Pending Approval, Approved, Partially Received, Completed, Rejected, Cancelled, with exactly these transitions and no others (from a prototype of the transition set agreed during grilling):

```
Draft            --submit-->  Pending Approval        (purchasing officer)
Pending Approval --approve--> Approved                (manager, reason)
Pending Approval --reject-->  Rejected                (manager, reason)
Approved         --receive--> Partially Received      (goods receipt, partial)
Approved         --receive--> Completed               (goods receipt, full)
Partially Received --receive--> Partially Received | Completed
Draft            --cancel-->  Cancelled               (creator or manager, reason)
Pending Approval --cancel-->  Cancelled               (creator or manager, reason)
```

Creating or approving never changes stock (PO-02). Approved lines/quantities/prices/destination are immutable (PO-03). Rejected orders are viewable; resubmission requires a new order. Cancelling Approved or Partially Received orders is out of scope (PO-04). Illegal transitions are rejected at the API with a Thai error.

**TOR clarifications baseline (recorded in the clarification register).** Q-01 single-manager approval, no thresholds/delegation. Q-02 a product deactivated after PO approval cannot be received against that order (a receipt is a new document per MD-02). Q-03 no backdated receiving; use the system confirmation timestamp. Q-04 no reversals of receipts or sales. Q-05 one base unit per SKU, no barcode or unit conversion.

**Money, numbering, snapshots.** Monetary values use two decimal places; a line is quantity × unit price, a document total is the sum of lines; no discounts or taxes; no inventory valuation or COGS. Document numbers are unique. Documents store transaction-time snapshots of names/prices so later master-data edits do not change history.

**Timezone and reporting windows.** Timestamps are stored in UTC. A reporting day is [00:00:00, next-day 00:00:00) in Asia/Bangkok, computed from the sale confirmation timestamp. Reports show zero totals and a clear empty state when nothing matches; lists paginate and order newest-first.

**CSV export.** UTF-8 with BOM so spreadsheet software renders Thai; identical filters and permissions as the on-screen report; formula-injection guard that neutralizes any cell beginning with `=`, `+`, `-`, `@`, tab, or carriage return.

**Validation and errors.** Validation runs in both the Zod contract layer and the API (NFR-04). User-facing errors use a consistent envelope (error code, Thai message, optional affected-field/affected-product list for cases like SAL-02) and never expose stack traces or database internals.

**Audit.** Audit entries (actor, timestamp, source document, outcome) are recorded for PO approvals, goods receipts, sales confirmations, and stock adjustments; the movement ledger covers stock changes and a separate audit record covers approval/rejection outcomes. Audit reads are permission-restricted.

**Performance.** Search and stock-view APIs target p95 ≤ 2s with 1,000 products / 10,000 movements / 10 concurrent users over a continuous 5-minute run (CSV excluded), demonstrated with a committed, scripted load test and supporting database indexes (SKU, product name, store, movement timestamp). The specific load-test tool is chosen at implementation time based on what installs cleanly in the Docker dev image.

**Schema changes.** New Prisma models: `Store`, `Supplier`, `Product` (with per-store reorder threshold), `StockBalance` (current per product+store), `StockMovement` (ledger), `PurchaseOrder` + `PurchaseOrderLine`, `GoodsReceipt` + `GoodsReceiptLine` (carrying the idempotency key), `Sale` + `SaleLine` (carrying the idempotency key), and `AuditLog`. The `Role` enum and `User` gain the four roles and the `storeId` assignment. Unique constraints on SKU, store code, supplier code, and document numbers; composite uniqueness on (product, store) balance and on (endpoint, actor, idempotency key).

## Testing Decisions

Good tests assert external behavior through the highest existing seam, not implementation details: given an input to a route, assert the returned value, the resulting persisted state, and the error code/message — never internal method calls or private structure. Requirement IDs (MD/INV/PO/GR/SAL/RPT/NFR/AC) tag the tests so every requirement traces to at least one test. `pnpm check` (lint, typecheck, test, build) green from the repo root is the acceptance gate.

Four seams, three of them already established in the repo:

1. **API controller specs via oRPC `call()` with a stubbed `PrismaService`** — the primary seam for every feature handler, role check, store-scope check, state-machine transition, validation rejection, and error envelope. Prior art: `apps/api/src/auth/auth.controller.spec.ts` (builds the controller through `Test.createTestingModule`, provides a fake `PrismaService`, drives handlers with `call(controller.route(...), input)` and asserts resolved values and `{ code: ... }` rejections). Modules tested: products, suppliers, stores, inventory, purchase-orders, goods-receipts, sales, reports.

2. **Contract Zod schema tests** in `packages/contracts/src/*.test.ts` — pure validation of the schemas: negative price/threshold rejection, whole-number quantity enforcement, status enums, duplicate-SKU rejection, idempotency-key shape. Prior art: `packages/contracts/src/auth.test.ts`, `health.test.ts`.

3. **Web component tests** with a `QueryClient` and the `mockApi()` fetch stub in `apps/web/src/**/*.test.tsx` — screens render loading/success/error states, role-gated UI, Thai copy, empty states, and mutations call the correct typed route. Prior art: `apps/web/src/routes/login.test.tsx`, `apps/web/src/components/health-status.test.tsx`, and `apps/web/src/test/mock-api.ts` (keyed `'<METHOD> <path>'` stub, `unauthorized()` helper).

4. **A new database-backed integration seam** for the acceptance scenarios and the correctness-under-concurrency rules that a stubbed Prisma cannot exercise: INV-04, GR-04, GR-05, SAL-02, SAL-03, and AC-01..AC-08. It runs against the real Postgres already in the Docker stack, resets to the TOR Section 8.1 fixture before each scenario (stores B01/B02, supplier SUP01, users buyer01/staff_b01/staff_b02/manager01, SKU001-003 with given B01 stock and prices, all B02 zero, reorder threshold 3, PO-DEMO-001 Approved for B01 with 20×SKU001 @ 45.00), and drives whole requests. It must fire two genuinely concurrent requests for AC-07 and replay an identical request for AC-02. This is the single new seam, placed at the highest point (whole request against a real DB) so the number of seams stays minimal.

The TOR Section 8.1 sample data is encoded once as a reusable fixture and is the canonical acceptance dataset; AC-01..AC-08 become named integration tests at seam 4. Timezone correctness (RPT-01, Section 6.2) is proven with fixtures placing sales just before and just after Asia/Bangkok midnight and asserting the report day they fall into.

## Out of Scope

Everything in TOR Section 3: general ledger, accounts payable/receivable, payroll, manufacturing, tax calculation and tax invoices, real payments, external POS/ERP integration, inter-store transfers, batch and expiry tracking, returns, and migration of real business data. All future clarifications as capabilities: multi-approver/threshold/delegation approvals (Q-01), receiving against products deactivated after approval (Q-02 — blocked in this release), backdated receiving (Q-03), reversals of receipts or sales (Q-04), alternate purchase/sales units and barcode scanning (Q-05). CR-01 damaged-goods-on-receipt. Cancelling Approved or Partially Received purchase orders (PO-04). Price override on sales, discounts, taxes, inventory valuation, and cost of goods sold. Customer personal data. CSV export is excluded from the NFR-05 performance target.

## Further Notes

The starter ships only auth (cookie session, global `AuthGuard`, `@Public()`/`@Roles()` decorators, `@CurrentUser()`), a two-role `User` model, and health/openapi modules — there is no ERP domain yet, so this is greenfield within an established contract-first structure. There is no `GLOSSARY.md` or `docs/adr/` yet; domain terms and ADRs are created lazily as decisions resolve. ESM rules apply (relative imports in `apps/api` and `packages/*` need `.js` extensions; web uses the `@/` alias). New env vars must be validated in `apps/api/src/config/env.ts` and added to `.env.example`. After schema changes run `pnpm db:migrate --name <change>`; finish with `pnpm check` and `pnpm format` from the repo root. This spec is large; it is intended to be broken into tracer-bullet tickets (one vertical slice per feature, master data first, then inventory ledger, then PO → GR → SAL → RPT) via the `to-tickets` skill.
