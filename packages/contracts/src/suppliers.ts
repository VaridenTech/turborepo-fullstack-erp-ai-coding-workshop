import { oc } from '@orpc/contract';
import * as z from 'zod';

/**
 * Suppliers master data (MD-03). Mirrors the stores contract: a unique `code`,
 * a `name`, and optional contact details. `code` and `name` are required; the
 * contact fields are optional, and `email` must be a valid address when present.
 * Reuses the shared Thai error envelope and list-query convention from `stores`.
 */
export const SupplierSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  name: z.string().min(1),
  contactPerson: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  address: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

/**
 * Create input: `code` and `name` are required; each contact field is optional and,
 * when given, an empty string is treated as absent. `email` must be a valid address.
 */
const OptionalContact = z
  .string()
  .trim()
  .transform((value) => (value === '' ? undefined : value))
  .optional();

/** Optional email: absent or empty becomes undefined; otherwise must be a valid address. */
const OptionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === '' ? undefined : value))
  .refine((value) => value === undefined || z.email().safeParse(value).success, {
    message: 'Invalid email address',
  });

export const CreateSupplierSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  contactPerson: OptionalContact,
  phone: OptionalContact,
  email: OptionalEmail,
  address: OptionalContact,
});
export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;

export const UpdateSupplierSchema = CreateSupplierSchema.extend({ id: z.string() });
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;

/** Shared list-query convention (Section 6.2): 1-based `page`, bounded `pageSize`. */
export const SupplierListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type SupplierListQuery = z.infer<typeof SupplierListQuerySchema>;

/** A page of suppliers plus the echo of the query, so the UI can render pagination. */
export const SupplierListSchema = z.object({
  items: z.array(SupplierSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
});
export type SupplierList = z.infer<typeof SupplierListSchema>;

export const suppliersContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/suppliers',
      summary: 'List suppliers (newest first)',
      tags: ['Suppliers'],
    })
    .input(SupplierListQuerySchema)
    .output(SupplierListSchema),
  create: oc
    .route({ method: 'POST', path: '/suppliers', summary: 'Create a supplier', tags: ['Suppliers'] })
    .input(CreateSupplierSchema)
    .output(SupplierSchema),
  update: oc
    .route({
      method: 'PATCH',
      path: '/suppliers/{id}',
      summary: 'Update a supplier',
      tags: ['Suppliers'],
    })
    .input(UpdateSupplierSchema)
    .output(SupplierSchema),
};
