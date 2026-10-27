import { oc } from '@orpc/contract';
import * as z from 'zod';

/**
 * Products master data (MD-01, MD-02). A product has a unique `sku`, a `name`,
 * `category`, base `unit`, a `sellingPrice`, an active flag, and a reorder threshold
 * per store. Money is a two-decimal string (Section 6.1), never a float over the wire.
 */

/** A money amount with exactly two decimal places, e.g. "60.00". Non-negative. */
const Money = z
  .string()
  .regex(/^\d+\.\d{2}$/, 'ราคาต้องมีทศนิยมสองตำแหน่ง')
  .refine((value) => Number(value) >= 0, { message: 'ราคาต้องไม่ติดลบ' });

/** A per-store reorder threshold: a whole number, not negative (MD-02). */
export const ReorderThresholdSchema = z.object({
  storeId: z.string().min(1),
  threshold: z.number().int('จำนวนต้องเป็นจำนวนเต็ม').min(0, 'จำนวนต้องไม่ติดลบ'),
});
export type ReorderThreshold = z.infer<typeof ReorderThresholdSchema>;

export const ProductSchema = z.object({
  id: z.string(),
  sku: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1),
  sellingPrice: Money,
  isActive: z.boolean(),
  reorderThresholds: z.array(ReorderThresholdSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Product = z.infer<typeof ProductSchema>;

/**
 * Create input: `sku` is required and unique; `sellingPrice` is a non-negative
 * two-decimal string; `reorderThresholds` is optional and each threshold is a
 * non-negative whole number for a store.
 */
export const CreateProductSchema = z.object({
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  sellingPrice: Money,
  isActive: z.boolean().optional(),
  reorderThresholds: z.array(ReorderThresholdSchema).optional(),
});
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

/**
 * Update input: everything the create takes except `sku`. SKU is immutable
 * (MD-01: "cannot change after a transaction exists"); omitting it from the
 * update contract makes it unchangeable by construction.
 */
export const UpdateProductSchema = CreateProductSchema.omit({ sku: true }).extend({
  id: z.string(),
});
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

/**
 * List query (Section 6.2): 1-based `page`, bounded `pageSize`, an optional search
 * term (SKU or name), and `includeInactive` so historical search can surface
 * deactivated products (MD-02).
 */
export const ProductListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  includeInactive: z.coerce.boolean().default(false),
});
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;

export const ProductListSchema = z.object({
  items: z.array(ProductSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type ProductList = z.infer<typeof ProductListSchema>;

export const productsContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/products',
      summary: 'List/search products (newest first)',
      tags: ['Products'],
    })
    .input(ProductListQuerySchema)
    .output(ProductListSchema),
  create: oc
    .route({ method: 'POST', path: '/products', summary: 'Create a product', tags: ['Products'] })
    .input(CreateProductSchema)
    .output(ProductSchema),
  update: oc
    .route({
      method: 'PATCH',
      path: '/products/{id}',
      summary: 'Update a product (SKU is immutable)',
      tags: ['Products'],
    })
    .input(UpdateProductSchema)
    .output(ProductSchema),
};
