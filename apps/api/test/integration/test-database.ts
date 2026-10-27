/**
 * Where the integration scenarios run: a throwaway database on the same Postgres server
 * the dev stack uses, never the dev database itself, because every scenario truncates it.
 * Override with TEST_DATABASE_URL.
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const base = new URL(process.env.DATABASE_URL ?? 'postgresql://erp:erp@localhost:5432/erp');
  base.pathname = '/erp_test';
  return base.toString();
}
