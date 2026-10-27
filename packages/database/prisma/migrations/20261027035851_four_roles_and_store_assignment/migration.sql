-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('ADMINISTRATOR', 'PURCHASING_OFFICER', 'STORE_EMPLOYEE', 'MANAGER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
-- Backfill the retired values so the cast lands on a member of Role_new even on a
-- database seeded with the old enum (ADMIN -> ADMINISTRATOR, STAFF -> STORE_EMPLOYEE).
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING (
  CASE "role"::text
    WHEN 'ADMIN' THEN 'ADMINISTRATOR'
    WHEN 'STAFF' THEN 'STORE_EMPLOYEE'
    ELSE "role"::text
  END::"Role_new"
);
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STORE_EMPLOYEE';
COMMIT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "storeId" TEXT,
ALTER COLUMN "role" SET DEFAULT 'STORE_EMPLOYEE';

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A STORE_EMPLOYEE must be assigned a store; other roles must not be (Section 2).
ALTER TABLE "User" ADD CONSTRAINT "User_store_assignment_check"
  CHECK (("role" = 'STORE_EMPLOYEE') = ("storeId" IS NOT NULL));
