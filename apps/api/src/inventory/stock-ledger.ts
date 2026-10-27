import type { Prisma, StockMovement, StockMovementType } from '@erp/database';
import { ORPCError } from '@orpc/nest';

export type StockMovementInput = {
  productId: string;
  storeId: string;
  /** Signed whole number: positive adds stock, negative removes it. Never zero. */
  quantityChange: number;
  type: StockMovementType;
  /** The document that caused the movement, e.g. "GOODS_RECEIPT" and its document number. */
  sourceDocumentType: string;
  sourceDocumentId: string;
  actorId: string;
};

/** The shared Thai envelope for a decrease larger than the available balance (SAL-02, INV-05). */
function insufficientStockError() {
  return new ORPCError('CONFLICT', {
    data: {
      code: 'INSUFFICIENT_STOCK',
      message: 'สต็อกไม่เพียงพอ',
      fields: ['quantity'],
    },
  });
}

function assertValidMovement(input: StockMovementInput) {
  const { quantityChange, type } = input;
  if (!Number.isInteger(quantityChange) || quantityChange === 0) {
    throw new Error('A stock movement must change the quantity by a non-zero whole number');
  }
  if (type === 'RECEIPT' && quantityChange < 0) {
    throw new Error('A receipt cannot decrease stock');
  }
  if (type === 'SALE' && quantityChange > 0) {
    throw new Error('A sale cannot increase stock');
  }
}

/**
 * The one way stock changes (INV-02, INV-03, INV-04). Call it inside the same
 * `prisma.$transaction` that posts the document, so the document, the movement and the
 * balance commit or roll back together.
 *
 * The balance is changed by a single conditional UPDATE that only matches while the
 * result stays at or above zero. Postgres takes a row lock for it, so concurrent
 * movements on the same (product, store) queue up and each one sees the latest balance;
 * a value read earlier, or sent by the browser, is never trusted. Zero rows updated
 * means there was not enough stock and nothing has been written.
 */
export async function postStockMovement(
  tx: Prisma.TransactionClient,
  input: StockMovementInput,
): Promise<StockMovement> {
  assertValidMovement(input);
  const { productId, storeId, quantityChange } = input;

  // A (product, store) pair has no balance row until something is first posted.
  await tx.$executeRaw`
    INSERT INTO "StockBalance" ("productId", "storeId", "quantity", "updatedAt")
    VALUES (${productId}, ${storeId}, 0, NOW())
    ON CONFLICT ("productId", "storeId") DO NOTHING`;

  const updated = await tx.$queryRaw<{ quantity: number }[]>`
    UPDATE "StockBalance"
    SET "quantity" = "quantity" + ${quantityChange}::int, "updatedAt" = NOW()
    WHERE "productId" = ${productId}
      AND "storeId" = ${storeId}
      AND "quantity" + ${quantityChange}::int >= 0
    RETURNING "quantity"`;
  const balanceAfter = updated[0]?.quantity;
  if (balanceAfter === undefined) throw insufficientStockError();

  return tx.stockMovement.create({
    data: {
      productId,
      storeId,
      quantityChange,
      balanceBefore: balanceAfter - quantityChange,
      balanceAfter,
      type: input.type,
      sourceDocumentType: input.sourceDocumentType,
      sourceDocumentId: input.sourceDocumentId,
      actorId: input.actorId,
    },
  });
}
