import { ORPCError } from '@orpc/nest';

/**
 * The reusable "is this product usable in a new document?" rule (MD-02). An inactive
 * product stays searchable in history but may not be added to a new document. Later
 * tickets that create documents (#6 stock ledger, #8 purchase orders, #11 sales)
 * import this guard and call it when adding a product line, so the rule lives in one
 * place rather than inside any single controller.
 */
export function assertProductUsableInDocument(product: { isActive: boolean }): void {
  if (!product.isActive) {
    throw new ORPCError('CONFLICT', {
      data: {
        code: 'PRODUCT_INACTIVE',
        message: 'สินค้านี้ถูกปิดการใช้งาน ไม่สามารถเพิ่มลงในเอกสารใหม่ได้',
        fields: ['productId'],
      },
    });
  }
}
