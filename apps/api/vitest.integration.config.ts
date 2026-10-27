import { defineConfig } from 'vitest/config';

// Seam 4: scenarios against a real Postgres. Run with `pnpm test:integration`.
// Kept out of `pnpm test` / `pnpm check` because they need a database to be up.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.spec.ts'],
    globalSetup: ['test/integration/global-setup.ts'],
    // Every scenario resets the one shared test database, so files must not overlap.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
