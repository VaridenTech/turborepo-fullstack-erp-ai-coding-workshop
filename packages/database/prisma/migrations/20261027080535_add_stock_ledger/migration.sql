-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'SALE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "StockBalance" (
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("productId","storeId")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "sourceDocumentType" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "prefix" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("prefix")
);

-- CreateIndex
CREATE INDEX "StockMovement_productId_storeId_createdAt_idx" ON "StockMovement"("productId", "storeId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- INV-03: a balance can never be negative, even if application code is wrong.
ALTER TABLE "StockBalance"
  ADD CONSTRAINT "StockBalance_quantity_nonnegative" CHECK ("quantity" >= 0);

-- INV-02/INV-03: a movement is a real change whose balances add up and never go negative.
ALTER TABLE "StockMovement"
  ADD CONSTRAINT "StockMovement_change_nonzero" CHECK ("quantityChange" <> 0),
  ADD CONSTRAINT "StockMovement_balances_consistent"
    CHECK ("balanceAfter" = "balanceBefore" + "quantityChange"),
  ADD CONSTRAINT "StockMovement_balances_nonnegative"
    CHECK ("balanceBefore" >= 0 AND "balanceAfter" >= 0);

-- INV-02: confirmed movements cannot be edited or deleted.
CREATE FUNCTION "reject_stock_movement_change"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'StockMovement rows are immutable (% rejected)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StockMovement_immutable"
  BEFORE UPDATE OR DELETE ON "StockMovement"
  FOR EACH ROW EXECUTE FUNCTION "reject_stock_movement_change"();
