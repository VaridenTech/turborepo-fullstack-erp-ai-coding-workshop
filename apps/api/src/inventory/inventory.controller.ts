import { Controller } from '@nestjs/common';
import { contract, type User } from '@erp/contracts';
import { Prisma } from '@erp/database';
import { Implement, implement } from '@orpc/nest';
import { CurrentUser } from '../auth/auth.decorators.js';
import { assertStoreScope } from '../auth/store-scope.js';
import { PrismaService } from '../database/prisma.service.js';

type StockLevelRow = {
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  quantity: number;
  reorderThreshold: number | null;
  total: number;
};

/**
 * Which store the search is confined to. A store employee is always confined to their
 * own store (NFR-01): asking for another store, or having none assigned, is rejected
 * by the shared store-scope check. Other roles may search every store or pick one.
 */
function scopedStoreId(user: User, requested: string | undefined): string | undefined {
  if (user.role !== 'STORE_EMPLOYEE') return requested;
  const storeId = requested ?? user.storeId ?? '';
  assertStoreScope(user, storeId);
  return storeId;
}

/**
 * Stock search / low-stock view (INV-01). Any signed-in role may read stock; store
 * employees only for their assigned store. Every (product, store) pair is listed, so a
 * product with no stock record shows quantity 0 instead of disappearing (RPT-02).
 */
@Controller()
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Implement(contract.inventory.list)
  list(@CurrentUser() user: User) {
    return implement(contract.inventory.list).handler(async ({ input }) => {
      const { page, pageSize, search } = input;
      const storeId = scopedStoreId(user, input.storeId);

      const searchFilter = search
        ? Prisma.sql`AND (p."sku" ILIKE ${`%${search}%`} OR p."name" ILIKE ${`%${search}%`}
            OR s."code" ILIKE ${`%${search}%`} OR s."name" ILIKE ${`%${search}%`})`
        : Prisma.empty;
      const storeFilter = storeId ? Prisma.sql`AND s."id" = ${storeId}` : Prisma.empty;

      // The balance row is the source of truth for the current quantity (INV-03); a
      // missing row means nothing has ever been posted, i.e. 0.
      const rows = await this.prisma.$queryRaw<StockLevelRow[]>(Prisma.sql`
        SELECT
          p."id" AS "productId",
          p."sku" AS "sku",
          p."name" AS "productName",
          p."unit" AS "unit",
          s."id" AS "storeId",
          s."code" AS "storeCode",
          s."name" AS "storeName",
          COALESCE(b."quantity", 0)::int AS "quantity",
          t."threshold"::int AS "reorderThreshold",
          (COUNT(*) OVER ())::int AS "total"
        FROM "Product" p
        CROSS JOIN "Store" s
        LEFT JOIN "StockBalance" b ON b."productId" = p."id" AND b."storeId" = s."id"
        LEFT JOIN "ProductReorderThreshold" t ON t."productId" = p."id" AND t."storeId" = s."id"
        WHERE TRUE ${searchFilter} ${storeFilter}
        ORDER BY p."sku" ASC, s."code" ASC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `);

      return {
        items: rows.map((row) => ({
          productId: row.productId,
          sku: row.sku,
          productName: row.productName,
          unit: row.unit,
          storeId: row.storeId,
          storeCode: row.storeCode,
          storeName: row.storeName,
          quantity: row.quantity,
          reorderThreshold: row.reorderThreshold,
          // Low stock is quantity <= threshold (INV-01); no threshold means never low.
          isLowStock: row.reorderThreshold !== null && row.quantity <= row.reorderThreshold,
        })),
        total: rows[0]?.total ?? 0,
        page,
        pageSize,
      };
    });
  }
}
