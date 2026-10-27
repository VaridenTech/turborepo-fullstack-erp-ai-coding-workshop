import { oc } from '@orpc/contract';
import * as z from 'zod';

/**
 * Stock search / low-stock view (INV-01). One row per (product, store): current
 * quantity, unit, reorder threshold and the low-stock flag (quantity <= threshold).
 * A product with no stock record in a store is shown with quantity 0 so zero-stock
 * products stay visible (RPT-02). `reorderThreshold` is null when none is configured
 * for that store; such a row is never flagged low.
 */
export const StockLevelSchema = z.object({
  productId: z.string(),
  sku: z.string(),
  productName: z.string(),
  unit: z.string(),
  storeId: z.string(),
  storeCode: z.string(),
  storeName: z.string(),
  quantity: z.number().int('จำนวนต้องเป็นจำนวนเต็ม').min(0, 'จำนวนต้องไม่ติดลบ'),
  reorderThreshold: z.number().int().min(0).nullable(),
  isLowStock: z.boolean(),
});
export type StockLevel = z.infer<typeof StockLevelSchema>;

/**
 * List query: 1-based `page`, bounded `pageSize`, a free-text `search` matched against
 * SKU, product name and store code/name, and an optional exact `storeId`. Store
 * employees are confined to their own store by the API regardless of this filter.
 */
export const InventoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  storeId: z.string().optional(),
});
export type InventoryListQuery = z.infer<typeof InventoryListQuerySchema>;

export const InventoryListSchema = z.object({
  items: z.array(StockLevelSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type InventoryList = z.infer<typeof InventoryListSchema>;

export const inventoryContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/inventory',
      summary: 'Search stock levels by SKU, product name and store',
      tags: ['Inventory'],
    })
    .input(InventoryListQuerySchema)
    .output(InventoryListSchema),
};
