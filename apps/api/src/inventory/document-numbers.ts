import type { Prisma } from '@erp/database';

/**
 * Issue the next unique document number for a prefix, e.g. "GR" gives GR-000001,
 * GR-000002 (Section 4.3). Call it inside the transaction that creates the document.
 *
 * One atomic upsert increments the counter and returns it. Concurrent callers queue on
 * the row lock, so no two get the same number, and a rolled-back transaction hands its
 * number back instead of leaving a gap.
 */
export async function nextDocumentNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
): Promise<string> {
  if (!/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/.test(prefix)) {
    throw new Error(`Invalid document number prefix "${prefix}"`);
  }
  const rows = await tx.$queryRaw<{ lastValue: number }[]>`
    INSERT INTO "DocumentSequence" ("prefix", "lastValue")
    VALUES (${prefix}, 1)
    ON CONFLICT ("prefix") DO UPDATE SET "lastValue" = "DocumentSequence"."lastValue" + 1
    RETURNING "lastValue"`;
  const value = rows[0]?.lastValue;
  if (value === undefined) throw new Error('Could not issue a document number');
  return `${prefix}-${String(value).padStart(6, '0')}`;
}
