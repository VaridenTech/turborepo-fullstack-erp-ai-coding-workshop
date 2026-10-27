import { execFileSync } from 'node:child_process';
import { createPrismaClient } from '@erp/database';
import { testDatabaseUrl } from './test-database.js';

/**
 * Once per run: create the test database if it is missing and apply every migration to
 * it, so the scenarios always run against the schema the app ships.
 */
export default async function setup() {
  const url = new URL(testDatabaseUrl());
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!/^[a-z0-9_]+$/i.test(name)) {
    throw new Error(`Refusing to use test database name "${name}"`);
  }
  if (name === 'erp') {
    throw new Error('The integration tests truncate their database; "erp" is the dev database.');
  }

  // Connect to the server's maintenance database to create the test database.
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const prisma = createPrismaClient(admin.toString());
  try {
    const existing = await prisma.$queryRaw<
      unknown[]
    >`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (existing.length === 0) {
      // Identifier validated above; CREATE DATABASE cannot take bind parameters.
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await prisma.$disconnect();
  }

  execFileSync('pnpm', ['--filter', '@erp/database', 'db:deploy'], {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'inherit',
  });
}
